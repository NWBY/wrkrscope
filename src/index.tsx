import { serve, type ServerWebSocket } from "bun";
import index from "./index.html";
import { parseArgs } from "util";
import { getKV, type KVResponse } from "./lib/cf/kv";
import type { RequestResponse, StoredRequest } from "./lib/cf/request";
import { configExists, createConfig, getConfig } from "./lib/config";
import packageJson from "../package.json";
import { getProjects } from "./lib/cf/projects";
import { getD1, queryD1Db, type D1Response } from "./lib/cf/d1";
import { getDurableObjectsSql, queryDoDb, type DurableObjectResponse } from "./lib/cf/durable-objects";
import { TrafficCapture } from "./lib/capture/capture";

const { values, positionals } = parseArgs({
    args: Bun.argv,
    options: {
        path: {
            type: "string",
            multiple: true,
        },
    },
    strict: true,
    allowPositionals: true,
});

if (positionals.length == 2) {


    const wsClients = new Set<ServerWebSocket<any>>();

    // Initialize traffic capture
    const capture = new TrafficCapture();

    // Poll for new requests and broadcast via websocket
    let lastRequestCount = 0;
    const sentResponseIds = new Set<string>();
    setInterval(() => {
        const currentRequests = capture.getRequests();
        if (currentRequests.total > lastRequestCount) {
            // New requests were added
            const newRequests = currentRequests.requests.slice(0, currentRequests.total - lastRequestCount);
            for (const request of newRequests) {
                const message = JSON.stringify({
                    type: "new_request",
                    request: request,
                });
                wsClients.forEach((client) => {
                    try {
                        client.send(message);
                    } catch (error) {
                        console.error("Error sending websocket message:", error);
                    }
                });
            }
            lastRequestCount = currentRequests.total;
        }

        // Check for updated responses that haven't been sent yet
        for (const request of currentRequests.requests) {
            if (request.responseStatus && request.id && !sentResponseIds.has(request.id)) {
                const message = JSON.stringify({
                    type: "response_received",
                    requestId: request.id,
                    response: {
                        status: request.responseStatus,
                        headers: request.responseHeaders,
                        body: request.responseBody,
                    },
                });
                wsClients.forEach((client) => {
                    try {
                        client.send(message);
                    } catch (error) {
                        console.error("Error sending websocket message:", error);
                    }
                });
                sentResponseIds.add(request.id);
            }
        }
    }, 100); // Poll every 100ms

    const server = serve({
        routes: {
            // Serve index.html for all unmatched routes.
            "/*": index,

            "/api/projects": async req => {
                const projects = await getProjects();
                return Response.json(projects);
            },

            "/api/requests": async req => {
                const requests = capture.getRequests();
                console.log(`/api/requests called. Total: ${requests.total}, Array length: ${requests.requests.length}`);
                return Response.json(requests);
            },

            "/api/kv": async req => {
                const url = new URL(req.url);
                const project = url.searchParams.get("project") || "";
                if (!project) {
                    return Response.json([]);
                }

                let kv: KVResponse[] = [];
                try {
                    kv = await getKV(project);
                } catch (error) {
                    console.error(error);
                    return Response.json([]);
                }

                return Response.json(kv);
            },
            "/api/d1": async req => {
                const url = new URL(req.url);
                const project = url.searchParams.get("project") || "";
                if (!project) {
                    return Response.json([]);
                }

                const table = url.searchParams.get("table") || "";
                const db = url.searchParams.get("db") || "";
                if (table && db) {
                    const data = await queryD1Db(project, db, table);
                    return Response.json(data);
                }

                let d1: D1Response[] = [];
                try {
                    d1 = await getD1(project);
                } catch (error) {
                    console.error(error);
                    return Response.json([]);
                }

                return Response.json(d1);
            },
            "/api/durable-objects": async req => {
                const url = new URL(req.url);
                const project = url.searchParams.get("project") || "";
                if (!project) {
                    console.error("No project specified");
                    return Response.json([]);
                }

                // const className = url.searchParams.get("className") || "";
                // if (!className) {
                //     console.error("No class name specified");
                //     return Response.json([]);
                // }

                const table = url.searchParams.get("table") || "";
                const db = url.searchParams.get("db") || "";
                if (table && db) {
                    const data = await queryDoDb(project, db, table);
                    return Response.json(data);
                }


                let durableObjects: DurableObjectResponse[] = [];
                try {
                    durableObjects = await getDurableObjectsSql(project);
                } catch (error) {
                    console.error(error);
                    return Response.json([]);
                }

                return Response.json(durableObjects);
            },
            "/api/ws": async req => {
                // upgrade the request to a WebSocket
                if (server.upgrade(req)) {
                    return; // do not return a Response
                }

                return new Response("Upgrade failed", { status: 500 });
            },
            "/api/capture/start": async req => {
                try {
                    const url = new URL(req.url);
                    const port = parseInt(url.searchParams.get("port") || "8787", 10);

                    console.log(`Starting capture on port ${port}`);
                    await capture.start(port);
                    console.log("Capture started successfully");
                    return Response.json({ success: true, message: "Capture started" });
                } catch (error) {
                    console.error("Error starting capture:", error);
                    return Response.json(
                        {
                            success: false,
                            error: error instanceof Error ? error.message : "Unknown error"
                        },
                        { status: 500 }
                    );
                }
            },
            "/api/capture/stop": async req => {
                try {
                    await capture.stop();
                    return Response.json({ success: true, message: "Capture stopped" });
                } catch (error) {
                    return Response.json(
                        {
                            success: false,
                            error: error instanceof Error ? error.message : "Unknown error"
                        },
                        { status: 500 }
                    );
                }
            },
            "/api/capture/status": async req => {
                const status = capture.getStatus();
                return Response.json(status);
            },
        },

        websocket: {
            message(ws, message) {
                // Handle incoming websocket messages if needed
            },
            open(ws) {
                wsClients.add(ws);
                console.log("WebSocket connected");
            },
            close(ws) {
                wsClients.delete(ws);
                console.log("WebSocket disconnected");
            },
        },

        development: process.env.NODE_ENV !== "production" && {
            // Enable browser hot reloading in development
            hmr: true,

            // Echo console logs from the browser to the server
            console: true,
        },
    });

    console.log(`🚀 Server running at ${server.url}`);
} else if (positionals.length == 3) {
    // user has called wrkrscope with a command
    const cmd = positionals[2];

    switch (cmd) {
        case "init":
            // initialize the config
            let paths: string[] = [];
            const configExistsResult = await configExists();
            if (configExistsResult) {
                const config = await getConfig();
                // existing paths
                paths = config.paths;

                for (const path of values.path ?? []) {
                    if (!paths.includes(path)) {
                        paths.push(path);
                    }
                }

                await createConfig(paths);
                console.log("Config updated successfully");
                process.exit(0);
            }

            // create the config
            if (!values.path) {
                console.error("Missing the path flag. Specify one or more paths to your wrangler projects: --path=<path-to-project>");
                process.exit(1);
            }

            await createConfig(values.path);
            console.log("Config created successfully");
            process.exit(0);

        case "version":
            console.log(packageJson.version);
            process.exit(0);
        case "config":
            const configResult = await getConfig();
            console.log(JSON.stringify(configResult, null, 2));
            process.exit(0);
        default:
            console.log('Unknown command');
            process.exit(1);
    }
}

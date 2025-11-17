import { serve, type ServerWebSocket } from "bun";
import index from "./index.html";
import { parseArgs } from "util";
import { getKV, type KVResponse } from "./lib/cf/kv";
import type { RequestResponse } from "./lib/cf/request";
import { configExists, createConfig, getConfig } from "./lib/config";
import packageJson from "../package.json";
import { getProjects } from "./lib/cf/projects";
import { getD1, queryD1Db, type D1Response } from "./lib/cf/d1";
import { getDurableObjectsSql, queryDoDb, type DurableObjectResponse } from "./lib/cf/durable-objects";

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


    const requests: RequestResponse = {
        requests: [],
        total: 0
    };

    const wsClients = new Set<ServerWebSocket<any>>();

    const server = serve({
        routes: {
            // Serve index.html for all unmatched routes.
            "/*": index,

            "/api/projects": async req => {
                const projects = await getProjects();
                return Response.json(projects);
            },

            "/api/requests": async req => {
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
        },

        websocket: {
            message(ws, message) {
                ws.send("Hello, world!");
            },
            open(ws) {
                wsClients.add(ws);
                console.log("WebSocket connected");
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

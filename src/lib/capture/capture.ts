import { sleep, type ServerWebSocket } from "bun";
import { detectCaptureTool } from "./utils";

export interface Captures {
    id: string;
    request: any
    response: any
}

interface PendingRequest {
    id: string;
    stream: string;
    request: any;
    timestamp: number;
}

export class Capture {
    private process: Bun.Subprocess | null = null;
    private wsClients: Set<ServerWebSocket<any>>;
    private captures: Captures[] = [];
    // Map of stream number -> queue of pending requests (FIFO)
    private pendingRequests: Map<string, PendingRequest[]> = new Map();
    private readonly REQUEST_TIMEOUT_MS = 30000; // 30 seconds

    constructor(wsClients: Set<ServerWebSocket<any>>) {
        this.wsClients = wsClients;
    }

    async start(port: number): Promise<void> {
        const config = await detectCaptureTool();
        if (!config) {
            throw new Error("No capture tool found");
        }

        this.process = Bun.spawn([config.command, ...config.args], {
            stdout: "pipe",
            stderr: "pipe",
        });

        const stdout = this.process.stdout;
        if (!stdout || typeof stdout === "number") {
            throw new Error("Failed to open stdout pipe");
        }

        // Bun's ReadableStream is async iterable at runtime
        for await (const chunk of stdout as any) {
            const decoder = new TextDecoder();
            const str = decoder.decode(chunk);
            const removed = str.substring(1)
            const trimmed = removed.trim();
            const tidied = trimmed.replace(/\\n\\r/g, "");
            const json = JSON.parse(tidied);

            const http = json._source.layers.http;
            const tcp = json._source.layers.tcp;
            const dataText = json._source.layers["data-text-lines"];

            if (!http || !tcp) {
                continue;
            }

            // Extract TCP stream number - this is the key to matching requests/responses
            const streamNumber = tcp["tcp.stream"]?.[0];
            if (!streamNumber) {
                continue;
            }

            const unknownKey = Object.keys(http).find(
                key => key.includes(" ") || key.includes("\r") || key.includes("\n")
            );

            if (!unknownKey) {
                continue;
            }

            const unknownValue = http[unknownKey];
            if (!unknownValue) {
                continue;
            }

            // Clean up stale pending requests periodically
            this.cleanupStaleRequests();

            const httpClone = { ...http };
            const clonedWeirdValues = httpClone[unknownKey];
            delete http[unknownKey]
            http.details = clonedWeirdValues;

            // Check if it's a request
            if ("http.request.version" in unknownValue) {
                console.log(`Request detected - stream: ${streamNumber}`);


                const id = Bun.randomUUIDv7();
                const pendingRequest: PendingRequest = {
                    id,
                    stream: streamNumber,
                    request: http,
                    timestamp: Date.now(),
                };

                // Add to queue for this stream (FIFO)
                if (!this.pendingRequests.has(streamNumber)) {
                    this.pendingRequests.set(streamNumber, []);
                }
                this.pendingRequests.get(streamNumber)!.push(pendingRequest);
            }
            // Check if it's a response
            else if ("http.response.version" in unknownValue) {
                console.log(`Response detected - stream: ${streamNumber}`);

                const requestQueue = this.pendingRequests.get(streamNumber);

                if (requestQueue && requestQueue.length > 0) {
                    // Match with the oldest pending request (FIFO)
                    const pendingRequest = requestQueue.shift()!;

                    // Match found! Create the complete capture
                    const capture: Captures = {
                        id: pendingRequest.id,
                        request: pendingRequest.request,
                        response: { response: http, data: dataText },
                    };

                    this.wsClients.forEach(ws => {
                        ws.send(JSON.stringify({
                            type: "capture",
                            capture: capture,
                        }));
                    });

                    this.captures.push(capture);
                    console.log(`Matched request/response pair: ${pendingRequest.id}`);
                } else {
                    // Response without a matching request (might be from before we started capturing)
                    console.log(`Response without matching request - stream: ${streamNumber}`);
                }
            }
        }

        const stderr = this.process.stderr;
        if (!stderr || typeof stderr === "number") {
            throw new Error("Failed to open stderr pipe");
        }

        this.process.exited.then((code) => {
            console.log(`Capture process exited with code ${code}`);
        });
    }

    private cleanupStaleRequests(): void {
        const now = Date.now();

        for (const [streamNumber, requestQueue] of this.pendingRequests.entries()) {
            // Remove stale requests from the front of the queue
            while (requestQueue.length > 0) {
                const firstRequest = requestQueue[0];
                if (!firstRequest || now - firstRequest.timestamp <= this.REQUEST_TIMEOUT_MS) {
                    break;
                }
                const stale = requestQueue.shift()!;
                console.log(`Cleaning up stale request - stream: ${stale.stream}, id: ${stale.id}, age: ${now - stale.timestamp}ms`);
            }

            // Remove empty queues
            if (requestQueue.length === 0) {
                this.pendingRequests.delete(streamNumber);
            }
        }
    }

    async getCaptures(): Promise<Captures[]> {
        return this.captures;
    }
}
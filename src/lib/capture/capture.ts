import type { Subprocess } from "bun";
import { detectCaptureTool } from "./platform";
import type { RequestResponse, StoredRequest } from "../cf/request";
import { parseTsharkFrame, createStoredRequest } from "./parser";

export class TrafficCapture {
    private process: Subprocess | null = null;
    private isRunning = false;
    private streamMap = new Map<string, StoredRequest>();
    public requests: RequestResponse = {
        requests: [],
        total: 0,
    };

    constructor() { }

    async start(port: number = 8787): Promise<void> {
        if (this.isRunning) {
            throw new Error("Capture is already running");
        }

        const config = await detectCaptureTool();
        if (!config) {
            throw new Error(
                "Neither tshark nor wireshark-cli is available. Please install Wireshark."
            );
        }

        // Update filter to use the specified port
        const args = [...config.args];
        const portIndex = args.indexOf("8787");
        if (portIndex !== -1) {
            args[portIndex] = port.toString();
        }

        console.log(`Full command: ${config.command} ${args.join(" ")}`);

        try {
            console.log(`Starting: ${config.command} ${args.join(" ")}`);
            this.process = Bun.spawn([config.command, ...args], {
                stdout: "pipe",
                stderr: "pipe",
            });

            this.isRunning = true;

            // Read from stderr (tshark outputs JSON to stderr)
            const stderr = this.process.stderr;
            if (stderr && typeof stderr !== "number") {
                console.log("✅ Starting to read from stderr stream");
                const reader = stderr.getReader();
                const decoder = new TextDecoder();
                let buffer = "";
                let chunkCount = 0;

                (async () => {
                    try {
                        console.log("📡 Waiting for data from stderr...");
                        while (true) {
                            const { done, value } = await reader.read();
                            chunkCount++;

                            if (done) {
                                console.log(`stderr stream ended after ${chunkCount} chunks`);
                                break;
                            }

                            if (!value || value.length === 0) {
                                console.log(`⚠️ Received empty chunk ${chunkCount}, continuing to wait...`);
                                continue;
                            }

                            console.log(`📦 Received chunk ${chunkCount}, size: ${value.length} bytes`);
                            buffer += decoder.decode(value, { stream: true });
                            console.log(`📝 Buffer now has ${buffer.length} chars, last 200:`, buffer.substring(Math.max(0, buffer.length - 200)));

                            // Process complete lines, keep incomplete line in buffer
                            const lines = buffer.split("\n");
                            buffer = lines.pop() || ""; // Keep incomplete line

                            console.log(`🔍 Processing ${lines.length} complete lines`);

                            for (const line of lines) {
                                const trimmed = line.trim();
                                if (!trimmed) {
                                    console.log("  - Empty line, skipping");
                                    continue;
                                }

                                console.log(`  - Line: ${trimmed.substring(0, 100)}`);

                                // Filter out informational messages
                                if (trimmed.includes("Capturing on")) {
                                    console.log("  - Skipping 'Capturing on' message");
                                    continue;
                                }

                                // Parse JSON lines
                                if (trimmed.startsWith("{")) {
                                    console.log("  - ✅ Found JSON line, parsing...");
                                    try {
                                        const jsonObj = JSON.parse(trimmed);
                                        console.log(`✅ Successfully parsed JSON, calling processJsonFrame`);
                                        this.processJsonFrame(jsonObj);
                                    } catch (parseError) {
                                        console.error(`❌ Failed to parse JSON:`, parseError);
                                        console.error("  Line content:", trimmed.substring(0, 200));
                                    }
                                } else {
                                    console.log(`  - Line doesn't start with {, skipping`);
                                }
                            }
                        }

                        // Process any remaining buffer
                        if (buffer.trim() && buffer.trim().startsWith("{")) {
                            console.log("Processing remaining buffer...");
                            try {
                                const jsonObj = JSON.parse(buffer.trim());
                                this.processJsonFrame(jsonObj);
                            } catch (parseError) {
                                console.error("Failed to parse remaining buffer:", parseError);
                            }
                        }
                    } catch (error) {
                        console.error("❌ Error reading stderr:", error);
                    }
                })();
            } else {
                console.error("❌ stderr is not available:", stderr);
            }

        } catch (error) {
            this.isRunning = false;
            if (error instanceof Error) {
                if (
                    error.message.includes("permission") ||
                    error.message.includes("Permission denied")
                ) {
                    throw new Error(
                        "Permission denied. You may need to run with sudo or grant permissions to capture packets."
                    );
                }
                throw error;
            }
            throw new Error("Failed to start capture process");
        }
    }

    async stop(): Promise<void> {
        if (!this.isRunning || !this.process) {
            return;
        }

        try {
            this.process.kill();
            await this.process.exited;
        } catch (error) {
            // Process might already be dead
        } finally {
            this.isRunning = false;
            this.process = null;
            this.streamMap.clear();
        }
    }

    private processJsonFrame(frame: any) {
        const httpData = parseTsharkFrame(frame);
        if (!httpData) {
            console.log("parseTsharkFrame returned null");
            return;
        }

        console.log("Parsed HTTP data:", JSON.stringify(httpData, null, 2));

        const storedRequest = createStoredRequest(httpData, this.streamMap);
        if (!storedRequest) {
            console.log("createStoredRequest returned null");
            return;
        }

        console.log("Created stored request:", storedRequest.id, storedRequest.method, storedRequest.path);

        // Determine if this is a new request or a response update
        if (httpData.method && httpData.uri) {
            // New request
            this.requests.requests.unshift(storedRequest);
            this.requests.total += 1;
            console.log(`✅ Stored request: ${httpData.method} ${httpData.uri} (Total: ${this.requests.total}, Array length: ${this.requests.requests.length})`);
        } else if (httpData.responseCode !== undefined) {
            // Response update - find existing request and update it
            const index = this.requests.requests.findIndex((r) => r.id === storedRequest.id);
            if (index !== -1) {
                // Update existing request
                this.requests.requests[index] = storedRequest;
                console.log(`✅ Updated request ${storedRequest.id} with response: ${httpData.responseCode}`);
            } else {
                // If not found, add it
                this.requests.requests.unshift(storedRequest);
                this.requests.total += 1;
                console.log(`✅ Added response as new request: ${storedRequest.id} (Total: ${this.requests.total})`);
            }
        } else {
            console.log("⚠️ HTTP data has neither method/uri nor responseCode");
        }
    }

    getStatus(): { running: boolean } {
        return { running: this.isRunning };
    }

    getRequests(): RequestResponse {
        return this.requests;
    }
}

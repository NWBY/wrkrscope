import type { Subprocess } from "bun";
import { detectCaptureTool } from "./platform";
import { parseTsharkLine, createStoredRequest } from "./parser";
import type { StoredRequest } from "../cf/request";

export interface CaptureCallbacks {
    onRequest: (request: StoredRequest) => void;
    onResponse: (request: StoredRequest) => void;
    onError: (error: Error) => void;
}

export class TrafficCapture {
    private process: Subprocess | null = null;
    private isRunning = false;
    private streamMap = new Map<string, StoredRequest>();
    private callbacks: CaptureCallbacks;

    constructor(callbacks: CaptureCallbacks) {
        this.callbacks = callbacks;
    }

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
        const args = config.args.map((arg) =>
            arg === "tcp port 8787" ? `tcp port ${port}` : arg
        );

        try {
            this.process = Bun.spawn([config.command, ...args], {
                stdout: "pipe",
                stderr: "pipe",
            });

            this.isRunning = true;
            this.streamMap.clear();

            // Handle stdout (captured packets)
            const reader = this.process.stdout.getReader();
            this.readOutput(reader);

            // Handle stderr (errors)
            const errorReader = this.process.stderr.getReader();
            this.readErrors(errorReader);

            // Handle process exit
            this.process.exited.then((code) => {
                this.isRunning = false;
                if (code !== 0 && code !== null) {
                    this.callbacks.onError(
                        new Error(`Capture process exited with code ${code}`)
                    );
                }
            });
        } catch (error) {
            this.isRunning = false;
            if (error instanceof Error) {
                // Check for permission errors
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

    private async readOutput(reader: ReadableStreamDefaultReader<Uint8Array>) {
        const decoder = new TextDecoder();
        let buffer = "";

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                buffer = lines.pop() || ""; // Keep incomplete line in buffer

                for (const line of lines) {
                    const trimmed = line.trim();
                    if (trimmed) {
                        // Debug: log first few lines to see structure
                        if (trimmed.startsWith("{")) {
                            this.processLine(trimmed);
                        }
                    }
                }
            }
        } catch (error) {
            if (this.isRunning) {
                this.callbacks.onError(
                    error instanceof Error
                        ? error
                        : new Error("Error reading capture output")
                );
            }
        }
    }

    private async readErrors(reader: ReadableStreamDefaultReader<Uint8Array>) {
        const decoder = new TextDecoder();
        let buffer = "";

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                buffer = lines.pop() || "";

                for (const line of lines) {
                    if (line.trim()) {
                        // Filter out common non-critical messages
                        if (
                            !line.includes("Capturing on") &&
                            !line.includes("File:") &&
                            line.trim().length > 0
                        ) {
                            console.error("[tshark]", line);
                            // Check for permission errors
                            if (
                                line.includes("permission") ||
                                line.includes("Permission denied")
                            ) {
                                this.callbacks.onError(
                                    new Error(
                                        "Permission denied. You may need to run with sudo or grant permissions to capture packets."
                                    )
                                );
                            }
                        }
                    }
                }
            }
        } catch (error) {
            // Error reading stderr, but process might still be running
        }
    }

    private processLine(line: string) {
        try {
            const httpData = parseTsharkLine(line);
            if (!httpData) {
                return;
            }

            const storedRequest = createStoredRequest(httpData, this.streamMap);
            if (!storedRequest) {
                return;
            }

            // Determine if this is a new request or a response update
            if (httpData.method && httpData.uri) {
                // New request
                console.log("Captured request:", httpData.method, httpData.uri);
                this.callbacks.onRequest(storedRequest);
            } else if (httpData.responseCode !== undefined) {
                // Response update
                console.log("Captured response:", httpData.responseCode);
                this.callbacks.onResponse(storedRequest);
            }
        } catch (error) {
            console.error("Error processing capture line:", error);
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

    getStatus(): { running: boolean } {
        return { running: this.isRunning };
    }
}


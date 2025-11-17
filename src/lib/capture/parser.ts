import type { StoredRequest } from "../cf/request";

interface TsharkLayer {
    [key: string]: string[];
}

interface TsharkFrame {
    _source: {
        layers: {
            [key: string]: string | TsharkLayer;
        };
    };
}

interface ParsedHttpData {
    method?: string;
    uri?: string;
    version?: string;
    headers?: Record<string, string>;
    body?: string;
    responseCode?: number;
    stream?: string;
    frameNumber?: string;
    timestamp?: string;
}

function extractValue(layer: any): string | null {
    if (Array.isArray(layer) && layer.length > 0) {
        return String(layer[0]);
    }
    if (layer !== null && layer !== undefined) {
        return String(layer);
    }
    return null;
}

function extractHeaders(layers: any, prefix: string): Record<string, string> {
    const headers: Record<string, string> = {};
    const headerLayer = layers[`${prefix}.header`];
    
    if (headerLayer && typeof headerLayer === "object") {
        Object.entries(headerLayer).forEach(([key, value]) => {
            // Keys are like "http.request.header.host" or "http.response.header.content_type"
            // Extract the header name (everything after the last dot)
            const parts = key.split(".");
            if (parts.length > 0) {
                const headerName = parts[parts.length - 1].toLowerCase();
                const headerValue = extractValue(value);
                if (headerName && headerValue) {
                    headers[headerName] = headerValue;
                }
            }
        });
    }
    
    return headers;
}

export function parseTsharkLine(line: string): ParsedHttpData | null {
    try {
        const frame: any = JSON.parse(line);
        
        // tshark JSON structure: frame._source.layers contains all protocol layers
        const layers = frame._source?.layers;
        if (!layers) {
            return null;
        }

        // Debug: log structure on first parse to understand format
        if (!(globalThis as any).__tshark_structure_logged) {
            console.log("Sample tshark JSON structure:", JSON.stringify(frame, null, 2).substring(0, 500));
            (globalThis as any).__tshark_structure_logged = true;
        }

        const data: ParsedHttpData = {};
        
        // tshark stores HTTP fields directly in layers with keys like "http.request.method"
        // We need to search through all layer keys to find HTTP-related fields

        // Extract HTTP request fields
        const method = extractValue(layers["http.request.method"]);
        if (method) {
            data.method = method;
        }

        const uri = extractValue(layers["http.request.uri"]);
        if (uri) {
            data.uri = uri;
        }

        const requestVersion = extractValue(layers["http.request.version"]);
        if (requestVersion) {
            data.version = requestVersion;
        }

        // Extract HTTP response fields
        const responseCode = extractValue(layers["http.response.code"]);
        if (responseCode) {
            data.responseCode = parseInt(responseCode, 10);
        }

        const responseVersion = extractValue(layers["http.response.version"]);
        if (responseVersion) {
            data.version = responseVersion;
        }

        // Extract headers
        data.headers = {};
        if (data.method) {
            // This is a request, extract request headers
            Object.assign(data.headers, extractHeaders(layers, "http.request"));
        }
        if (data.responseCode !== undefined) {
            // This is a response, extract response headers
            Object.assign(data.headers, extractHeaders(layers, "http.response"));
        }

        // Extract body from http.file_data
        const fileData = extractValue(layers["http.file_data"]);
        if (fileData) {
            data.body = fileData;
        }

        // Extract connection tracking info
        const stream = extractValue(layers["tcp.stream"]);
        if (stream) {
            data.stream = stream;
        }

        const frameNumber = extractValue(layers["frame.number"]);
        if (frameNumber) {
            data.frameNumber = frameNumber;
        }

        const timestamp = extractValue(layers["frame.time"]);
        if (timestamp) {
            data.timestamp = timestamp;
        }

        // Only return if we have meaningful HTTP data
        if (data.method || data.responseCode !== undefined) {
            return data;
        }

        return null;
    } catch (error) {
        // Invalid JSON or parsing error - log for debugging
        console.error("Error parsing tshark line:", error);
        return null;
    }
}

export function createStoredRequest(
    httpData: ParsedHttpData,
    streamMap: Map<string, StoredRequest>
): StoredRequest | null {
    const streamId = httpData.stream || "unknown";
    const id = `${streamId}-${httpData.frameNumber || Date.now()}`;

    // If this is a request
    if (httpData.method && httpData.uri) {
        const request: StoredRequest = {
            id,
            method: httpData.method,
            path: httpData.uri,
            body: httpData.body || "",
            wholeRequest: JSON.stringify({
                method: httpData.method,
                uri: httpData.uri,
                version: httpData.version,
                headers: httpData.headers || {},
                body: httpData.body || "",
            }),
        };

        // Store in stream map for response matching
        streamMap.set(streamId, request);
        return request;
    }

    // If this is a response, try to match with existing request
    if (httpData.responseCode !== undefined) {
        const existingRequest = streamMap.get(streamId);
        if (existingRequest) {
            // Update the existing request with response data
            existingRequest.responseStatus = httpData.responseCode;
            existingRequest.responseHeaders = httpData.headers || {};
            existingRequest.responseBody = httpData.body || "";
            return existingRequest;
        }

        // If no matching request found, create a new entry
        return {
            id,
            method: "UNKNOWN",
            path: "/",
            body: "",
            wholeRequest: JSON.stringify({}),
            responseStatus: httpData.responseCode,
            responseHeaders: httpData.headers || {},
            responseBody: httpData.body || "",
        };
    }

    return null;
}


export interface StoredRequest {
    id: string;
    path: string;
    method: string;
    body: string;
    wholeRequest: string;
    responseStatus?: number;
    responseHeaders?: Record<string, string>;
    responseBody?: string;
}

export interface RequestResponse {
    requests: StoredRequest[];
    total: number;
}
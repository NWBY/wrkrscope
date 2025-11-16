import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import type { RequestResponse, StoredRequest } from "@/lib/cf/request";
import { useEffect, useState } from "react";

export function Requests() {
    const [requests, setRequests] = useState<RequestResponse | null>(null);
    const socket = new WebSocket("ws://localhost:3000/api/ws");

    useEffect(() => {
        fetch("/api/requests")
            .then(res => res.json())
            .then(data => {
                setRequests(data);
            });
    }, []);

    useEffect(() => {
        socket.onopen = () => {
            console.log("WebSocket connected 🌶️");
        };

        socket.onmessage = (event) => {
            const data = JSON.parse(event.data);

            if (data.type === "new_request") {
                // @ts-ignore
                console.log("New request received", data.request);
                setRequests(prev => ({
                    requests: [data.request, ...(prev?.requests || [])],
                    total: (prev?.total || 0) + 1
                }));
            } else if (data.type === "response_received") {
                console.log("Response received for request:", data);
                setRequests(prev => {
                    if (!prev) return prev;
                    const updatedRequests = prev.requests.map(req => {
                        if (req.id === data.requestId) {
                            return {
                                ...req,
                                responseStatus: data.response.status,
                                responseHeaders: data.response.headers,
                                responseBody: data.response.body,
                            };
                        }
                        return req;
                    });
                    return {
                        ...prev,
                        requests: updatedRequests
                    };
                });
            }
        };
    }, []);

    const parseWholeRequest = (wholeRequest: string) => {
        return JSON.parse(wholeRequest);
    }


    return (
        <div className="p-4">
            <div className="flex items-center justify-between mb-4">
                <h1 className="text-3xl font-bold">Requests</h1>
            </div>
            {requests && requests.requests.length > 0 && (
                <Accordion type="single" collapsible>
                    {requests.requests.map((request: StoredRequest) => (
                        <AccordionItem key={request.id} value={request.id}>
                            <AccordionTrigger>
                                {request.method} {request.path}
                                {request.responseStatus && (
                                    <span className="ml-2 text-sm text-muted-foreground">
                                        ({request.responseStatus})
                                    </span>
                                )}
                            </AccordionTrigger>
                            <AccordionContent>
                                <div className="space-y-4">
                                    <div className="bg-muted rounded-sm p-4">
                                        <h3 className="font-semibold mb-2">Request</h3>
                                        {Object.entries(parseWholeRequest(request.wholeRequest)).map(([key, value]) => (
                                            <div key={key as string} className="flex items-center gap-2 py-2">
                                                <p className="font-medium">{key as string}:</p>
                                                <p className="text-sm">{typeof value === "string" ? value : JSON.stringify(value)}</p>
                                            </div>
                                        ))}
                                    </div>
                                    {request.responseStatus && (
                                        <div className="bg-muted rounded-sm p-4">
                                            <h3 className="font-semibold mb-2">Response</h3>
                                            <div className="space-y-2">
                                                <div className="flex items-center gap-2">
                                                    <p className="font-medium">Status:</p>
                                                    <p className="text-sm">{request.responseStatus}</p>
                                                </div>
                                                {request.responseHeaders && Object.keys(request.responseHeaders).length > 0 && (
                                                    <div>
                                                        <p className="font-medium mb-1">Headers:</p>
                                                        {Object.entries(request.responseHeaders).map(([key, value]) => (
                                                            <div key={key} className="flex items-center gap-2 py-1 text-sm">
                                                                <p className="font-medium">{key}:</p>
                                                                <p>{value}</p>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                                {request.responseBody && (
                                                    <div>
                                                        <p className="font-medium mb-1">Body:</p>
                                                        <p className="text-sm whitespace-pre-wrap wrap-break-word">{request.responseBody}</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </AccordionContent>
                        </AccordionItem>
                    ))}
                </Accordion>
            )}
        </div>
    )
}
import { rootRoute } from "@/App";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import type { RequestResponse, StoredRequest } from "@/lib/cf/request";
import type { Captures } from "@/lib/capture/capture";
import { createRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Pause, Play } from "lucide-react";

export const requestsRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/requests',
    component: Requests,
})


export function Requests() {
    const [requests, setRequests] = useState<Captures[]>([]);
    const socket = new WebSocket("ws://localhost:3000/api/ws");
    const [live, setLive] = useState(false);

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

            if (data.type === "capture") {
                // @ts-ignore
                console.log("New request received", data.capture);
                setRequests(prev => [data.capture, ...prev]);
            }
        };
    }, []);

    const startLive = async () => {
        try {
            const response = await fetch("/api/capture/start");
            if (response.ok) {
                setLive(true);
            }
        } catch (error) {
            console.error("Error starting live capture", error);
        }
    }

    return (
        <div className="p-4">
            <div className="flex items-center justify-between mb-4">
                <h1 className="text-3xl font-bold">Requests</h1>
                <Button onClick={startLive}>
                    {live ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </Button>
            </div>
            {requests.length > 0 && (
                <div className="flex flex-col gap-1 border-b border-muted-foreground last:border-b-0">
                    {requests.map(request => (
                        <Accordion type="single" collapsible>
                            <AccordionItem value="item-1">
                                <AccordionTrigger>
                                    <div key={request.id} className="flex items-center gap-x-2">
                                        <p>{request.request.details["http.request.method"]} {request.request.details["http.request.uri"]}</p>
                                        <ResponseBadge responseCode={request.response.response.details["http.response.code"]} responseStatus={request.response.response.details["http.response.code.desc"]} />
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent>
                                    Yes. It adheres to the WAI-ARIA design pattern.
                                </AccordionContent>
                            </AccordionItem>
                        </Accordion>
                    ))}
                </div>
            )}
            {requests.length === 0 && (
                <div className="flex items-center justify-center mt-20">
                    <p className="text-muted-foreground">No requests yet</p>
                </div>
            )}
        </div>
    )
}

function ResponseBadge({ responseCode, responseStatus }: { responseCode: string, responseStatus: string }) {

    const calculateBgStyling = () => {
        const code = parseInt(responseCode);
        if (code >= 100 && code < 200) {
            return "bg-yellow-500/10";
        } else if (code >= 200 && code < 300) {
            return "bg-green-500/10";
        } else if (code >= 300 && code < 400) {
            return "bg-blue-500/10";
        } else if (code >= 400 && code < 500) {
            return "bg-red-500/10";
        } else {
            return "bg-gray-500";
        }
    }

    const calculateTextStyling = () => {
        const code = parseInt(responseCode);
        if (code >= 100 && code < 200) {
            return "text-yellow-500";
        } else if (code >= 200 && code < 300) {
            return "text-green-500";
        } else if (code >= 300 && code < 400) {
            return "text-blue-500";
        } else if (code >= 400 && code < 500) {
            return "text-red-500";
        } else {
            return "text-gray-500";
        }
    }

    return (
        <div className={`flex items-center gap-2 py-1 px-2 rounded-md text-sm ${calculateBgStyling()}`}>
            <p className={calculateTextStyling()}>{responseCode}</p>
            <p className={calculateTextStyling()}>{responseStatus}</p>
        </div>
    )
}

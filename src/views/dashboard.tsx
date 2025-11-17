import { rootRoute } from "@/App";
import { Card, CardHeader, CardContent, CardFooter, CardDescription, CardTitle } from "@/components/ui/card";
import type { D1Binding, DurableObjectBinding, KvBinding, R2Binding } from "@/lib/cf/bindings";
import type { KVResponse } from "@/lib/cf/kv";
import type { ProjectResponse } from "@/lib/cf/projects";
import { createRoute, Link } from "@tanstack/react-router";
import { Database, Folder, FolderCode, Globe, Key } from "lucide-react";
import { useEffect, useState } from "react";

export const dashboardRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: Dashboard,
})

function Dashboard() {
    const [projects, setProjects] = useState<ProjectResponse>({ projects: [] });

    useEffect(() => {
        fetch("/api/projects")
            .then(res => res.json())
            .then(data => {
                setProjects(data);
            });
    }, []);

    const getBindingIcon = (bindingType: string) => {
        switch (bindingType) {
            case "kv":
                return <Key size={16} />;
            case "d1":
                return <Database size={16} />;
            case "r2":
                return <Folder size={16} />;
            case "durable_objects":
                return <Globe size={16} />;
        }
    }

    const getBindingLink = (type: "kv" | "d1" | "r2" | "durable_objects", project: string, binding: KvBinding | D1Binding | R2Binding | DurableObjectBinding) => {
        switch (type) {
            case "kv":
                return (
                    <Link to="/kv" search={{ project: project, id: (binding as KvBinding).id }}>
                        <p className="text-sm text-muted-foreground mb-2">{(binding as KvBinding).binding}</p>
                    </Link>
                );
            case "d1":
                return (
                    <Link to="/d1" search={{ project: project, id: (binding as D1Binding).database_id }}>
                        <p className="text-sm text-muted-foreground mb-2">{(binding as D1Binding).binding}</p>
                    </Link>
                );
            case "durable_objects":
                return (
                    <Link to="/durable-objects" search={{ project: project, id: (binding as DurableObjectBinding).name }}>
                        <p className="text-sm text-muted-foreground mb-2">{(binding as DurableObjectBinding).class_name}</p>
                    </Link>
                );
            // case "r2":
            //     return (
            //         <Link to="/r2" search={{ project: project, id: binding.id }}>
            //             <p className="text-sm text-muted-foreground mb-2">{binding.binding}</p>
            //         </Link>
            //     );
        }
    }

    return (
        <div className="p-4">
            <div className="flex items-center justify-between mb-4">
                <h1 className="text-3xl font-bold">Dashboard</h1>
            </div>
            <div className="grid gap-4">
                {projects.projects.map(project => (
                    <Card key={project.path}>
                        <CardHeader>
                            <CardTitle>{project.name}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center gap-x-2">
                                <FolderCode size={16} />
                                <p className="text-sm text-muted-foreground">{project.path}</p>
                            </div>
                            <div className="mt-4">
                                <p className="text-sm text-muted-foreground font-semibold mb-2">Bindings</p>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    {project.bindings && project.bindings.length > 0 && project.bindings.map(binding => (
                                        <div key={binding.type} className="flex items-start py-2 gap-x-2">
                                            <p>{getBindingIcon(binding.type)}</p>
                                            <div>
                                                {binding.values.map((value: KvBinding | D1Binding | R2Binding | DurableObjectBinding) => (
                                                    getBindingLink(binding.type, project.path, value)
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    )
}
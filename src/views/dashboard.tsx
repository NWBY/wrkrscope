import { rootRoute } from "@/App";
import { Card, CardHeader, CardContent, CardFooter, CardDescription, CardTitle } from "@/components/ui/card";
import type { KVResponse } from "@/lib/cf/kv";
import type { ProjectResponse } from "@/lib/cf/projects";
import { createRoute } from "@tanstack/react-router";
import { FolderCode } from "lucide-react";
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
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    )
}
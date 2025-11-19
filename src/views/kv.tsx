import { rootRoute } from "@/App";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { KVResponse } from "@/lib/cf/kv";
import type { ProjectResponse } from "@/lib/cf/projects";
import { formatDate } from "@/lib/date";
import type { KvParams } from "@/lib/param";
import { createRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export const kvRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/kv',
    component: KV,
    validateSearch: (search: Record<string, unknown>): KvParams => {
        return {
            project: (search.project as string) || '',
            id: (search.id as string) || '',
        }
    },
})


function KV() {
    const { project, id } = kvRoute.useSearch();

    const [kv, setKV] = useState<KVResponse[]>([]);
    const [projects, setProjects] = useState<ProjectResponse>({ projects: [] });
    const [selectedKV, setSelectedKV] = useState<string>(id);
    const [selectedProject, setSelectedProject] = useState<string>(project);

    useEffect(() => {
        fetch("/api/projects")
            .then(res => res.json())
            .then(data => {
                setProjects(data);
            });
    }, []);

    useEffect(() => {
        if (!selectedProject) return;
        fetch(`/api/kv?project=${selectedProject}`)
            .then(res => res.json())
            .then(data => {
                setKV(data);
            });
    }, [selectedProject]);

    const handleSelectProject = (value: string) => {
        setSelectedProject(value);

        fetch(`/api/kv?project=${value}`)
            .then(res => res.json())
            .then(data => {
                setKV(data);
            });
    }

    const selectedKVItem = kv.find(kv => kv.id === selectedKV);

    return (
        <div className="p-4">
            <div className="flex items-center justify-between mb-4">
                <h1 className="text-3xl font-bold">KV</h1>
            </div>
            <div className="flex items-center gap-x-2 justify-end mb-4">
                <Select value={selectedProject} onValueChange={handleSelectProject}>
                    <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select a project" />
                    </SelectTrigger>
                    <SelectContent>
                        {projects.projects.map(project => (
                            <SelectItem key={project.path} value={project.path}>{project.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Select value={selectedKV} onValueChange={setSelectedKV} disabled={!selectedProject}>
                    <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select a KV Namespace" />
                    </SelectTrigger>
                    <SelectContent>
                        {kv.map(kv => (
                            <SelectItem key={kv.id} value={kv.id}>{kv.id}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Key</TableHead>
                        <TableHead>Value</TableHead>
                        <TableHead>Expiration</TableHead>
                        <TableHead>Metadata</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {selectedKVItem?.values.map(value => (
                        <TableRow key={value.key}>
                            <TableCell className="font-medium">{value.key}</TableCell>
                            <TableCell>{value.value}</TableCell>
                            <TableCell>
                                <Tooltip>
                                    <TooltipTrigger>{value.expiration}</TooltipTrigger>
                                    <TooltipContent>
                                        <p>{formatDate(value.expiration ?? 0)}</p>
                                    </TooltipContent>
                                </Tooltip>
                            </TableCell>
                            <TableCell>{value.metadata ? Object.entries(JSON.parse(value.metadata)).map(([key, value]) => (
                                <div key={key}>
                                    <p>{key}: {typeof value === "string" ? value : JSON.stringify(value)}</p>
                                </div>
                            )) : ''}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    )
}
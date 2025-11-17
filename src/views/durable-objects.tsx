import { rootRoute } from "@/App";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { DurableObjectData, DurableObjectResponse } from "@/lib/cf/durable-objects";
import type { KVResponse } from "@/lib/cf/kv";
import type { ProjectResponse } from "@/lib/cf/projects";
import type { KvParams } from "@/lib/param";
import { createRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export const durableObjectsRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/durable-objects',
    component: DurableObjects,
})


function DurableObjects() {
    const [durableObjects, setDurableObjects] = useState<DurableObjectResponse[]>([]);
    const [projects, setProjects] = useState<ProjectResponse>({ projects: [] });
    const [selectedDurableObject, setSelectedDurableObject] = useState<string>("");
    const [selectedProject, setSelectedProject] = useState<string>("");
    const [selectedTable, setSelectedTable] = useState<string>("");
    const [tableData, setTableData] = useState<DurableObjectData>({ data: [], columns: [] });

    useEffect(() => {
        fetch("/api/projects")
            .then(res => res.json())
            .then(data => {
                for (const project of data.projects) {
                    for (const binding of project.bindings || []) {
                        console.log(`Project: ${project.name}, Binding: ${binding.type}`);
                        if (binding.type === "durable_objects") {
                            setProjects({ projects: [...projects.projects, project] });
                        }
                    }
                }
            })
            .catch(error => {
                console.error("Error fetching projects:", error);
            });
    }, []);

    useEffect(() => {
        if (!selectedProject) return;
        fetch(`/api/durable-objects?project=${selectedProject}`)
            .then(res => res.json())
            .then(data => {
                setDurableObjects(data);
            });
    }, [selectedProject]);

    const handleSelectProject = (value: string) => {
        setSelectedProject(value);

        fetch(`/api/durable-objects?project=${value}`)
            .then(res => res.json())
            .then(data => {
                setDurableObjects(data);
            });
    }

    const handleSelectTable = (value: string) => {
        setSelectedTable(value);

        fetch(`/api/durable-objects?project=${selectedProject}&db=${selectedDurableObject}&table=${value}`)
            .then(res => res.json())
            .then(data => {
                setTableData(data);
            });
    }

    const selectedDurableObjectItem = durableObjects.find(durableObject => durableObject.name === selectedDurableObject);

    return (
        <div className="p-4">
            <div className="flex items-center justify-between mb-4">
                <h1 className="text-3xl font-bold">Durable Objects</h1>
            </div>
            <div className="grid grid-cols-2 gap-x-2 mb-4">
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
                <Select value={selectedDurableObject} onValueChange={setSelectedDurableObject} disabled={!selectedProject}>
                    <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select a Durable Object" />
                    </SelectTrigger>
                    <SelectContent>
                        {durableObjects.map(durableObject => (
                            <SelectItem key={durableObject.name} value={durableObject.name}>{durableObject.name.split("/")[1]}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <Tabs defaultValue="data" className="w-full">
                <div className="flex items-center justify-between">
                    <TabsList className="mr-auto">
                        <TabsTrigger value="data">Data</TabsTrigger>
                        <TabsTrigger value="schema">Schema</TabsTrigger>
                    </TabsList>
                    <Select value={selectedTable} onValueChange={handleSelectTable} disabled={!selectedDurableObject}>
                        <SelectTrigger>
                            <SelectValue placeholder="Select a table" />
                        </SelectTrigger>
                        <SelectContent>
                            {selectedDurableObjectItem?.tables.map(table => (
                                <SelectItem key={table.name} value={table.name}>{table.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <TabsContent value="data">
                    <div className="flex flex-col gap-y-4">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    {tableData.columns.map(column => (
                                        <TableHead key={column.name}>{column.name}</TableHead>
                                    ))}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {tableData.data.map(data => (
                                    <TableRow key={JSON.stringify(data)}>
                                        {tableData.columns.map(column => (
                                            <TableCell key={column.name}>{data[column.name]}</TableCell>
                                        ))}
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </TabsContent>
                <TabsContent value="schema">
                    <div className="flex flex-col gap-y-4">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Type</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {tableData.columns.map(column => (
                                    <TableRow key={column.name}>
                                        <TableCell>{column.name}</TableCell>
                                        <TableCell>{column.type}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </TabsContent>
            </Tabs>
        </div >
    )
}
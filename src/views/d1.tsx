import { rootRoute } from "@/App";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { D1Data, D1Response } from "@/lib/cf/d1";
import type { ProjectResponse } from "@/lib/cf/projects";
import { createRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useEffect } from "react";

export const d1Route = createRoute({
    getParentRoute: () => rootRoute,
    path: '/d1',
    component: D1,
})

function D1() {
    const [projects, setProjects] = useState<ProjectResponse>({ projects: [] });
    const [selectedProject, setSelectedProject] = useState<string>("");
    const [selectedD1, setSelectedD1] = useState<string>("");
    const [d1, setD1] = useState<D1Response[]>([]);
    const [selectedTable, setSelectedTable] = useState<string>("");
    const [tableData, setTableData] = useState<D1Data>({ data: [], columns: [] });

    useEffect(() => {
        fetch("/api/projects")
            .then(res => res.json())
            .then(data => {
                setProjects(data);
            });
    }, []);

    const handleSelectProject = (value: string) => {
        setSelectedProject(value);
        fetch(`/api/d1?project=${value}`)
            .then(res => res.json())
            .then(data => {
                setD1(data);
            });
    }

    const handleSelectTable = (value: string) => {
        setSelectedTable(value);

        fetch(`/api/d1?project=${selectedProject}&db=${selectedD1}&table=${value}`)
            .then(res => res.json())
            .then(data => {
                setTableData(data);
            });
    }

    const selectedD1Item = d1.find(d1 => d1.name === selectedD1);

    return (
        <div className="p-4">
            <div className="flex items-center justify-between mb-4">
                <h1 className="text-3xl font-bold">D1</h1>
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
                <Select value={selectedD1} onValueChange={setSelectedD1} disabled={!selectedProject}>
                    <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select a D1 database" />
                    </SelectTrigger>
                    <SelectContent>
                        {d1.map(d1 => (
                            <SelectItem key={d1.name} value={d1.name}>{d1.name}</SelectItem>
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
                    <Select value={selectedTable} onValueChange={handleSelectTable} disabled={!selectedD1}>
                        <SelectTrigger>
                            <SelectValue placeholder="Select a table" />
                        </SelectTrigger>
                        <SelectContent>
                            {selectedD1Item?.tables.map(table => (
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
                <TabsContent value="schema">Change your password here.</TabsContent>
            </Tabs>
        </div>
    )
}
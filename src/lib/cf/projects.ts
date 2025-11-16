import { getConfig } from "../config";
import { getWranglerConfig } from "./utils";

interface Project {
    name: string;
    path: string;
}

export interface ProjectResponse {
    projects: Project[];
}

export const getProjects = async (): Promise<ProjectResponse> => {
    const config = await getConfig();

    const projects: Project[] = [];

    for (const path of config.paths) {
        const project = await getProject(path);
        if (project) {
            projects.push(project);
        }
    }

    return {
        projects: projects,
    };
}

export const getProject = async (path: string): Promise<Project | null> => {
    const wranglerConfig = await getWranglerConfig(path);
    if (!wranglerConfig) {
        return null;
    }

    return {
        name: wranglerConfig.name,
        path: path,
    };
}
import { getConfig } from "../config";
import type { D1Binding, KvBinding, R2Binding } from "./bindings";
import { getWranglerConfig } from "./utils";

interface Binding {
    type: "kv" | "d1" | "r2";
    values: (KvBinding | D1Binding | R2Binding)[];
}

interface Project {
    name: string;
    path: string;
    bindings?: Binding[];
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

    let bindings: Binding[] = [];

    if (wranglerConfig.kv_namespaces) {
        let kvBindings: KvBinding[] = [];
        for (const binding of wranglerConfig.kv_namespaces) {
            kvBindings.push({
                binding: binding.binding,
                id: binding.id,
            });
        }
        bindings.push({
            type: "kv",
            values: kvBindings,
        });
    }

    if (wranglerConfig.d1_databases) {
        let d1Bindings: D1Binding[] = [];
        for (const binding of wranglerConfig.d1_databases) {
            d1Bindings.push({
                binding: binding.binding,
                database_id: binding.database_id,
                database_name: binding.database_name,
            });
        }
        bindings.push({
            type: "d1",
            values: d1Bindings,
        });
    }

    if (wranglerConfig.r2_buckets) {
        let r2Bindings: R2Binding[] = [];
        for (const binding of wranglerConfig.r2_buckets) {
            r2Bindings.push({
                binding: binding.binding,
                bucket_name: binding.bucket_name,
            });
        }
        bindings.push({
            type: "r2",
            values: r2Bindings,
        });
    }

    return {
        name: wranglerConfig.name,
        path: path,
        bindings: bindings,
    };
}
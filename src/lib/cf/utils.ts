import { access, readdir } from "node:fs/promises";

interface Binding {
    binding: string;
    id: string;
}

interface WranglerConfig {
    kv_namespaces: Binding[];
}

export const checkForDir = async (path: string, dir: string): Promise<boolean> => {
    // who tf designed an api that returns undefined on success
    return await access(path + "/" + dir).then(() => true).catch(() => false);
}

export const readDir = async (path: string, dir: string): Promise<string[]> => {
    return await readdir(path + "/" + dir);
}

export const getBindingsByType = async (path: string, bindingType: keyof WranglerConfig): Promise<Binding[]> => {
    const wranglerConfig = Bun.file(`${path}/wrangler.jsonc`);
    const text = await wranglerConfig.text();
    const jsonString = text.replace(/\\"|"(?:\\"|[^"])*"|(\/\/.*|\/\*[\s\S]*?\*\/)/g, (m, g) => g ? "" : m);
    const json: WranglerConfig = JSON.parse(jsonString);

    return json[bindingType as keyof WranglerConfig];
}

export const getWranglerConfig = async (path: string): Promise<any | null> => {
    const wranglerConfig = Bun.file(`${path}/wrangler.jsonc`);
    if (!await wranglerConfig.exists()) {
        return null;
    }
    const text = await wranglerConfig.text();
    const jsonString = text.replace(/\\"|"(?:\\"|[^"])*"|(\/\/.*|\/\*[\s\S]*?\*\/)/g, (m, g) => g ? "" : m);
    return JSON.parse(jsonString);
}
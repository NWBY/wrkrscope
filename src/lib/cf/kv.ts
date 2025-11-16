import { checkForDir, getBindingsByType, readDir } from "./utils";
import { Database } from "bun:sqlite";

interface KVEntry {
    key: string;
    blob_id: string;
    expiration?: number;
    metadata?: string;
}

interface KVValue {
    key: string;
    value: string;
}

export interface KVResponse {
    id: string;
    values: KVValue[];
}

export const getKV = async (path: string): Promise<KVResponse[]> => {
    if (!await checkForDir(path, ".wrangler/state")) {
        throw new Error("No .wrangler directory found");
    }

    let dbFile;
    const kvDbFiles = await readDir(path, ".wrangler/state/v3/kv/miniflare-KVNamespaceObject");
    for (const kvDbFile of kvDbFiles) {
        if (kvDbFile.endsWith(".sqlite")) {
            dbFile = kvDbFile;
            break;
        }
    }

    if (!dbFile) {
        throw new Error("No KV database file found");
    }

    const kvSqliteDb = new Database(path + "/.wrangler/state/v3/kv/miniflare-KVNamespaceObject/" + dbFile);
    const query = kvSqliteDb.query("SELECT * FROM _mf_entries");
    const entries: KVEntry[] = query.all() as KVEntry[];

    const bindings = await getBindingsByType(path, "kv_namespaces");
    const response: KVResponse[] = [];

    for (const binding of bindings) {
        const finalEntries: KVValue[] = [];
        const kvBlobs = await readDir(path, ".wrangler/state/v3/kv/" + binding.id + "/blobs");
        for (const entry of entries) {
            if (kvBlobs.includes(entry.blob_id)) {
                const value = await Bun.file(path + "/.wrangler/state/v3/kv/" + binding.id + "/blobs/" + entry.blob_id).text();
                finalEntries.push({
                    key: entry.key,
                    value: value
                });
            }
        }

        response.push({
            id: binding.id,
            values: finalEntries
        });
    }

    return response;
}
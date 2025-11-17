import { checkForDir, getBindingsByType, readDir } from "./utils";
import { Database } from "bun:sqlite";

export interface D1Response {
    name: string;
    tables: D1Table[];
}

interface D1Table {
    name: string;
    sql: string;
    columns?: D1Column[];
}

interface D1Column {
    name: string;
    type: string;
}

export interface D1Data {
    data: any[];
    columns: D1Column[];
}

export const getD1 = async (path: string): Promise<D1Response[]> => {
    if (!await checkForDir(path, ".wrangler/state")) {
        throw new Error("No .wrangler directory found");
    }

    let dbFiles: string[] = [];
    const d1DbFiles = await readDir(path, ".wrangler/state/v3/d1/miniflare-D1DatabaseObject");
    for (const d1DbFile of d1DbFiles) {
        if (d1DbFile.endsWith(".sqlite")) {
            dbFiles.push(d1DbFile);
        }
    }

    if (dbFiles.length === 0) {
        throw new Error("No D1 database file found");
    }

    const responses: D1Response[] = [];
    for (const dbFile of dbFiles) {
        const d1SqliteDb = new Database(path + "/.wrangler/state/v3/d1/miniflare-D1DatabaseObject/" + dbFile);
        const schemaQuery = d1SqliteDb.query("SELECT * FROM sqlite_master;");
        const schema: any[] = schemaQuery.all();
        const tables = schema.filter((s: any) => s.type === "table");

        const response: D1Response = {
            name: dbFile,
            tables: tables.map((t: any) => ({
                name: t.name,
                sql: t.sql
            }))
        };

        responses.push(response);
    }

    return responses;
}

export const queryD1Db = async (path: string, db: string, table: string): Promise<D1Data> => {
    const d1SqliteDb = new Database(path + "/.wrangler/state/v3/d1/miniflare-D1DatabaseObject/" + db);
    const columns = d1SqliteDb.query(`PRAGMA table_info(${table})`).all();

    const query = d1SqliteDb.query(`SELECT * FROM ${table}`);
    const data: any[] = query.all();

    const columnsType = columns.map((c: any) => ({
        name: c.name,
        type: c.type
    }));

    return {
        columns: columnsType,
        data: data
    };
}
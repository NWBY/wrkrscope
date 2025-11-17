import { readdir } from "fs/promises";
import { checkForDir, readDir } from "./utils";
import { Database } from "bun:sqlite";

export interface DurableObjectResponse {
    name: string;
    tables: DurableObjectTable[];
}

interface DurableObjectTable {
    name: string;
    sql: string;
    columns?: DurableObjectColumn[];
}

interface DurableObjectColumn {
    name: string;
    type: string;
}

export interface DurableObjectData {
    data: any[];
    columns: DurableObjectColumn[];
}

export const getDurableObjectsSql = async (path: string): Promise<DurableObjectResponse[]> => {
    if (!await checkForDir(path, ".wrangler/state")) {
        throw new Error("No .wrangler directory found");
    }

    let dbFiles: string[] = [];

    const files = await readdir(`${path}/.wrangler/state/v3/do`, { recursive: true });

    for (const file of files) {
        if (file.endsWith(".sqlite")) {
            dbFiles.push(file);
        }
    }

    if (dbFiles.length === 0) {
        throw new Error("No Durable Object database file found");
    }

    const responses: DurableObjectResponse[] = [];
    for (const dbFile of dbFiles) {
        const doSqliteDb = new Database(`${path}/.wrangler/state/v3/do/${dbFile}`);
        const schemaQuery = doSqliteDb.query("SELECT * FROM sqlite_master;");
        const schema: any[] = schemaQuery.all();
        const tables = schema.filter((s: any) => s.type === "table");

        const response: DurableObjectResponse = {
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

export const queryDoDb = async (path: string, db: string, table: string): Promise<DurableObjectData> => {
    const doSqliteDb = new Database(path + `/.wrangler/state/v3/do/${db}`);
    const columns = doSqliteDb.query(`PRAGMA table_info(${table})`).all();

    const query = doSqliteDb.query(`SELECT * FROM ${table}`);
    const data: any[] = query.all();

    const columnsType = columns.map((c: any) => ({
        name: c.name,
        type: c.type
    }));

    console.log(columnsType);

    return {
        columns: columnsType,
        data: data
    };
}
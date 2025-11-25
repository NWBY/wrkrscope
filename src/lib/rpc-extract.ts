import { readdir, access } from "fs/promises";
import { join } from "path";

export interface RpcParameter {
    name: string;
    type?: string;
    optional?: boolean;
    defaultValue?: string;
}

export interface RpcMethod {
    name: string;
    parameters: RpcParameter[];
    returnType?: string;
    isAsync: boolean;
}

export interface DurableObjectRpc {
    className: string;
    filePath: string;
    methods: RpcMethod[];
}

/**
 * Extract RPC methods from a single TypeScript file
 */
export async function extractRpcFromFile(filePath: string): Promise<DurableObjectRpc[]> {
    const content = await Bun.file(filePath).text();
    const results: DurableObjectRpc[] = [];

    // Match class declarations that extend DurableObject
    // Handles: 
    // - class MyClass extends DurableObject { ... }
    // - export class MyClass extends DurableObject<Env> { ... }
    // - class MyClass extends DurableObject<SomeType> implements Interface { ... }
    // Type parameters and implements clauses are optional
    const classRegex = /(?:export\s+)?class\s+(\w+)\s+extends\s+DurableObject(?:\s*<[^>]+>)?(?:\s+implements\s+[^{]+)?\s*\{/g;

    let classMatch;
    let matchCount = 0;
    while ((classMatch = classRegex.exec(content)) !== null) {
        matchCount++;
        const className = classMatch[1];
        if (!className) continue;

        const classStart = classMatch.index + classMatch[0].length;

        // Find the matching closing brace for the class
        const classBody = extractClassBody(content, classStart);
        if (!classBody) {
            continue;
        }

        const methods = extractMethods(classBody);

        // Include class even if no methods found (might be useful for debugging)
        results.push({
            className,
            filePath,
            methods
        });
    }

    if (matchCount === 0) {
        // Check if file contains "DurableObject" at all for debugging
        if (content.includes('DurableObject')) {
        }
    }

    return results;
}

/**
 * Extract the class body by finding matching braces
 * Handles nested braces, strings, and comments
 */
function extractClassBody(content: string, startPos: number): string | null {
    let depth = 1;
    let pos = startPos;
    const start = pos;

    while (pos < content.length && depth > 0) {
        const char = content[pos];

        if (char === '{') {
            depth++;
        } else if (char === '}') {
            depth--;
        } else if (char === '"' || char === "'" || char === '`') {
            // Skip string literals
            pos = skipString(content, pos);
            continue;
        } else if (char === '/' && pos + 1 < content.length) {
            if (content[pos + 1] === '/') {
                // Skip single-line comments
                const newlinePos = content.indexOf('\n', pos);
                if (newlinePos === -1) break;
                pos = newlinePos;
                continue;
            } else if (content[pos + 1] === '*') {
                // Skip multi-line comments
                const commentEnd = content.indexOf('*/', pos);
                if (commentEnd === -1) break;
                pos = commentEnd + 2;
                continue;
            }
        }

        pos++;
    }

    if (depth === 0) {
        return content.substring(start, pos - 1);
    }

    return null;
}

/**
 * Skip string literals (handles escaped quotes)
 */
function skipString(content: string, startPos: number): number {
    const quote = content[startPos];
    let pos = startPos + 1;

    while (pos < content.length) {
        if (content[pos] === '\\') {
            pos += 2; // Skip escaped character
            continue;
        }
        if (content[pos] === quote) {
            return pos + 1;
        }
        pos++;
    }

    return pos;
}

/**
 * Extract method definitions from class body
 * Handles:
 * - Access modifiers (private, public, protected)
 * - Static methods
 * - Async methods
 * - Getter/setter methods
 * - Methods with return types
 */
function extractMethods(classBody: string): RpcMethod[] {
    const methods: RpcMethod[] = [];

    // Match method definitions with various patterns:
    // - public async methodName(params): ReturnType { ... }
    // - private methodName(params) { ... }
    // - static async methodName(params): ReturnType { ... }
    // - async methodName(params) { ... }
    // - methodName(params): ReturnType { ... }
    // - get methodName(): ReturnType { ... }
    // - set methodName(value: Type) { ... }
    const methodRegex = /(?:(?:public|private|protected|static)\s+)*(async\s+)?(?:get\s+|set\s+)?(\w+)\s*\(([^)]*)\)\s*(?::\s*([^{;=]+))?\s*\{/g;

    let methodMatch;
    while ((methodMatch = methodRegex.exec(classBody)) !== null) {
        const isAsync = !!methodMatch[1]; // Check if async was captured
        const methodName = methodMatch[2];
        if (!methodName) continue;

        // Skip standard DurableObject methods
        if (['constructor', 'fetch', 'alarm'].includes(methodName)) {
            continue;
        }

        const paramsStr = methodMatch[3] || "";
        const returnType = methodMatch[4]?.trim();

        // Parse parameters (extract name, type, optional flag, and default value)
        const parameters: RpcParameter[] = paramsStr
            .split(',')
            .map((p): RpcParameter | null => {
                const param = p?.trim() || '';
                if (!param) return null;

                // Extract parameter name (with optional ?)
                const nameMatch = param.match(/^([a-zA-Z_$][a-zA-Z0-9_$]*)(\?)?/);
                if (!nameMatch || !nameMatch[1]) return null;

                const name = nameMatch[1];
                const optional = !!nameMatch[2];
                const afterName = param.substring(nameMatch[0].length).trim();

                // Check if there's a type annotation (: Type)
                let type: string | undefined;
                let defaultValue: string | undefined;

                if (afterName.startsWith(':')) {
                    // Extract type - handle complex types with generics, unions, etc.
                    const typeStart = 1; // Skip the ':'
                    let typeEnd = typeStart;
                    let depth = 0;
                    let inString = false;
                    let stringChar = '';

                    // Find the end of the type (either = or end of string)
                    for (let i = typeStart; i < afterName.length; i++) {
                        const char = afterName[i];

                        if (!inString && (char === '"' || char === "'" || char === '`')) {
                            inString = true;
                            stringChar = char;
                        } else if (inString && char === stringChar && afterName[i - 1] !== '\\') {
                            inString = false;
                        } else if (!inString) {
                            if (char === '<' || char === '(' || char === '[') {
                                depth++;
                            } else if (char === '>' || char === ')' || char === ']') {
                                depth--;
                            } else if (depth === 0 && char === '=') {
                                typeEnd = i;
                                break;
                            }
                        }
                        typeEnd = i + 1;
                    }

                    type = afterName.substring(typeStart, typeEnd).trim();

                    // Check for default value after =
                    const afterType = afterName.substring(typeEnd).trim();
                    if (afterType.startsWith('=')) {
                        defaultValue = afterType.substring(1).trim();
                    }
                } else if (afterName.startsWith('=')) {
                    // No type, just default value
                    defaultValue = afterName.substring(1).trim();
                }

                const result: RpcParameter = {
                    name,
                };

                if (type) {
                    result.type = type;
                }
                if (optional) {
                    result.optional = true;
                }
                if (defaultValue) {
                    result.defaultValue = defaultValue;
                }

                return result;
            })
            .filter((p): p is RpcParameter => p !== null);

        methods.push({
            name: methodName,
            parameters,
            returnType: returnType || undefined,
            isAsync
        });
    }

    return methods;
}

/**
 * Recursively scan a directory for TypeScript files and extract RPC methods
 */
export async function extractRpcFromDirectory(srcPath: string): Promise<DurableObjectRpc[]> {
    const results: DurableObjectRpc[] = [];

    // Check if directory exists
    try {
        await access(srcPath);
    } catch (error) {
        console.error("❌ Cannot access directory:", srcPath, error);
        throw new Error(`Cannot access directory ${srcPath}: ${error}`);
    }

    let fileCount = 0;
    let processedCount = 0;

    async function scanDirectory(dir: string): Promise<void> {
        try {
            const entries = await readdir(dir, { withFileTypes: true });

            for (const entry of entries) {
                const fullPath = join(dir, entry.name);

                if (entry.isDirectory()) {
                    // Skip node_modules and other common directories
                    if (entry.name === 'node_modules' ||
                        entry.name === '.git' ||
                        entry.name === 'dist' ||
                        entry.name === 'build' ||
                        entry.name === '.wrangler' ||
                        entry.name.startsWith('.')) {
                        continue;
                    }
                    await scanDirectory(fullPath);
                } else if (entry.isFile()) {
                    // Process TypeScript files
                    if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
                        fileCount++;
                        try {
                            const rpcResults = await extractRpcFromFile(fullPath);
                            if (rpcResults.length > 0) {
                                processedCount++;
                                results.push(...rpcResults);
                            }
                        } catch (error) {
                            console.error(`❌ Error processing ${fullPath}:`, error);
                        }
                    }
                }
            }
        } catch (error) {
            console.error(`❌ Error scanning directory ${dir}:`, error);
            throw error;
        }
    }

    await scanDirectory(srcPath);
    return results;
}

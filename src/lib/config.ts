import { homedir } from 'os';

interface Config {
    paths: string[];
}

export const configExists = async (): Promise<boolean> => {
    const homeDir = homedir();
    const configPath = `${homeDir}/.wrkrscope.json`;
    const file = Bun.file(configPath);

    return await file.exists();
}

export const createConfig = async (paths: string[]): Promise<void> => {
    const homeDir = homedir();
    const configPath = `${homeDir}/.wrkrscope.json`;
    const file = Bun.file(configPath);

    await file.write(JSON.stringify({
        paths: paths,
    }, null, 2));
}

export const getConfig = async (): Promise<Config> => {
    const homeDir = homedir();
    const configPath = `${homeDir}/.wrkrscope.json`;
    const file = Bun.file(configPath);
    const config = await file.json();
    return {
        paths: config.paths,
    };
}
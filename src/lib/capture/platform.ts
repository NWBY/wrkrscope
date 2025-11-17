export interface CaptureConfig {
    command: string;
    interface: string;
    args: string[];
}

export async function detectCaptureTool(): Promise<CaptureConfig | null> {
    const platform = process.platform;
    let interfaceName: string;
    let command: string | null = null;

    // Determine network interface based on platform
    if (platform === "darwin") {
        // macOS
        interfaceName = "lo0";
    } else if (platform === "linux") {
        // Linux
        interfaceName = "lo";
    } else {
        throw new Error(`Unsupported platform: ${platform}`);
    }

    // Check for tshark first (common on Mac and many Linux distros)
    const tsharkAvailable = await checkCommandAvailable("tshark");
    if (tsharkAvailable) {
        command = "tshark";
    } else {
        // Fallback to wireshark-cli (some Linux distros)
        const wiresharkCliAvailable = await checkCommandAvailable("wireshark-cli");
        if (wiresharkCliAvailable) {
            command = "wireshark-cli";
        }
    }

    if (!command) {
        return null;
    }

    return {
        command,
        interface: interfaceName,
        args: [
            "-i", interfaceName,
            "-f", `tcp port 8787`,
            "-T", "json",
            "-Y", "http",
        ],
    };
}

async function checkCommandAvailable(command: string): Promise<boolean> {
    try {
        const process = Bun.spawn(["which", command], {
            stdout: "pipe",
            stderr: "pipe",
        });
        await process.exited;
        return process.exitCode === 0;
    } catch {
        return false;
    }
}


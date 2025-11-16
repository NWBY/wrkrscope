# wrkrscope

![wrkrscope](/assets/wrkrscope.png)

Browser based explorer for local wrangler projects

## Installation

Install via the shell script:

```
curl -fsSL https://raw.githubusercontent.com/NWBY/wrkrscope/refs/heads/main/install.sh | sh
```

## Upgrading

To upgrade to the latest version you can simply run the install command above.

## Setup

To use wrkrscope you'll need to initialise it with the paths to your worker projects first:

```
wrkrscope init --path=<path-to-your-worker-project> --path=<path-to-your-worker-project>
```

You can pass the path flag as many times as you like

## Usage

After you've run the `init` command, just run: `wrkrscope`

## Commands

- `wrkrscope version` - print the version of wrkrscope
- `wrkrscope config` - print the JSON config file

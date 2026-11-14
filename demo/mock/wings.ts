// A stand-in for the Wings console websocket: auth, status, console output, stats every two seconds, power and
// commands, with output that reads like the real software. The socket URL points at a reserved .invalid host and
// never leaves the page.
import type { SocketPeer } from './transport';
import { findServer, usage, type DemoServer } from './data';
import { displayTimeZone } from './clock';

const peers = new Map<string, Set<SocketPeer>>();
const logs = new Map<string, string[]>();
const DIM = '\u001b[90m';
const RESET = '\u001b[0m';
const YELLOW = '\u001b[33m';
const GREEN = '\u001b[32m';

const stamp = () => new Date().toLocaleTimeString('en-GB', { hourCycle: 'h23', timeZone: displayTimeZone() });

function bootLines(server: DemoServer): string[] {
    const port = server.allocations.find((a) => a.is_default)?.port ?? 25565;
    switch (server.kind) {
        case 'node':
            return ['npm notice', `> community-bot@1.4.0 start`, `> node src/index.js`, '', 'Loaded 2 commands', 'Logged in as Community Bot#4821', `Health check listening on :${port}`];
        case 'velocity':
            return ['Booting up Velocity 3.4.0-SNAPSHOT...', 'Loading localizations...', 'Connections will use NIO channels, Java compression, Java ciphers', 'Loading plugins...', 'Loaded plugin luckperms 5.4.141 by Luck', `Listening on /0.0.0.0:${port}`, 'Done (1.94s)!'];
        case 'fabric':
            return ['Loading Minecraft 1.21.1 with Fabric Loader 0.16.9', 'Loading 5 mods:', '\t- fabric-api 0.110.0+1.21.1', '\t- ferritecore 7.0.2', '\t- lithium 0.14.3', `Starting Minecraft server on *:${port}`, 'Preparing level "world"', 'Done (11.204s)! For help, type "help"'];
        default:
            return [
                'Starting org.bukkit.craftbukkit.Main',
                'System Info: Java 21 (OpenJDK 64-Bit Server VM 21.0.5+11-LTS) Host: Linux 6.8.0 (amd64)',
                'Loading libraries, please wait...',
                'Environment: Environment[sessionHost=https://sessionserver.mojang.com, servicesHost=https://api.minecraftservices.com, name=PROD]',
                'Loaded 1370 recipes',
                'Starting minecraft server version 1.21.4',
                'Loading properties',
                'This server is running Paper version 1.21.4-232-ver/1.21.4@12e5f74 (2026-11-02T18:41:27Z)',
                `Starting Minecraft server on *:${port}`,
                'Using epoll channel type',
                'Paper: Using libdeflate (Linux x86_64) compression from Velocity.',
                '[LuckPerms] Loading configuration...',
                '[LuckPerms] Loading storage provider... [H2]',
                'Preparing level "world"',
                'Preparing start region for dimension minecraft:overworld',
                'Time elapsed: 1843 ms',
                '[LuckPerms] Enabling LuckPerms v5.4.141',
                'Running delayed init tasks',
                'Done (6.412s)! For help, type "help"',
            ];
    }
}

const prefix = (server: DemoServer) => (server.kind === 'node' ? '' : `${DIM}[${stamp()} INFO]:${RESET} `);

function history(server: DemoServer): string[] {
    let lines = logs.get(server.uuid);
    if (!lines) {
        lines = server.state === 'running' ? bootLines(server).map((line) => prefix(server) + line) : [];
        if (server.state === 'running' && server.kind === 'paper') lines.push(`${prefix(server)}Steve joined the game`, `${prefix(server)}<Steve> anyone up for the nether?`);
        logs.set(server.uuid, lines);
    }
    return lines;
}

function emit(server: DemoServer, event: string, ...args: string[]) {
    for (const peer of peers.get(server.uuid) ?? []) if (!peer.closed) peer.send(event, ...args);
}

function print(server: DemoServer, line: string) {
    const lines = history(server);
    lines.push(line);
    if (lines.length > 300) lines.splice(0, lines.length - 300);
    emit(server, 'console output', line);
}

const stats = (server: DemoServer) => JSON.stringify(usage(server));

function setState(server: DemoServer, state: DemoServer['state']) {
    server.state = state;
    if (state === 'running') server.startedAt = Date.now();
    emit(server, 'status', state);
    emit(server, 'stats', stats(server));
}

const timers = new Map<string, number[]>();
const later = (server: DemoServer, ms: number, run: () => void) => {
    const id = window.setTimeout(run, ms);
    timers.set(server.uuid, [...(timers.get(server.uuid) ?? []), id]);
};

export function power(server: DemoServer, signal: string) {
    (timers.get(server.uuid) ?? []).forEach((id) => window.clearTimeout(id));
    timers.set(server.uuid, []);
    const start = () => {
        setState(server, 'starting');
        print(server, `${YELLOW}[Gobia Demo]: Pulling Docker container image, this could take a few minutes to complete...${RESET}`);
        print(server, `${YELLOW}[Gobia Demo]: Finished pulling Docker container image${RESET}`);
        bootLines(server).forEach((line, index, all) =>
            later(server, 400 + index * 140, () => {
                print(server, prefix(server) + line);
                if (index === all.length - 1) setState(server, 'running');
            })
        );
    };
    const stop = (then?: () => void, kill = false) => {
        if (server.state === 'offline') return then?.();
        setState(server, 'stopping');
        if (!kill && server.kind !== 'node') {
            print(server, `${prefix(server)}Stopping the server`);
            print(server, `${prefix(server)}Saving players`);
            print(server, `${prefix(server)}Saving worlds`);
        }
        later(server, kill ? 200 : 1300, () => {
            setState(server, 'offline');
            then?.();
        });
    };
    if (signal === 'start' && server.state === 'offline') start();
    if (signal === 'stop') stop();
    if (signal === 'kill') stop(undefined, true);
    if (signal === 'restart') stop(start);
}

const PLAYERS = ['Steve', 'Alex', 'builder_kim'];

export function sendCommand(server: DemoServer, command: string) {
    const text = command.trim();
    if (!text) return;
    if (server.state !== 'running') return;
    const out = (line: string) => print(server, prefix(server) + line);
    const [verb, ...rest] = text.replace(/^\//, '').split(/\s+/);
    if (server.kind === 'node') {
        out(`Unknown input "${text}". This process does not read the console.`);
        return;
    }
    switch (verb.toLowerCase()) {
        case 'list':
            return out(`There are ${PLAYERS.length} of a max of 40 players online: ${PLAYERS.join(', ')}`);
        case 'tps':
            return out(`${GREEN}TPS from last 1m, 5m, 15m: 20.0, 20.0, 19.98${RESET}`);
        case 'say':
            return out(`[Server] ${rest.join(' ')}`);
        case 'help':
            return ['--------- Help: Index (1/12) ---------', 'Use /help [n] to get page n of help.', 'Aliases: Lists command aliases', 'Bukkit: All commands for Bukkit', 'Minecraft: All commands for Minecraft', 'Try: list, tps, say <message>, version, stop'].forEach(out);
        case 'version':
        case 'ver':
            return out('This server is running Paper version 1.21.4-232-ver/1.21.4@12e5f74 (Implementing API version 1.21.4-R0.1-SNAPSHOT)');
        case 'stop':
            return power(server, 'stop');
        case 'op':
            return out(`Made ${rest[0] ?? 'nobody'} a server operator`);
        default:
            return out('Unknown or incomplete command, see below for error');
    }
}

// Chat and joins now and then, so a running console is alive.
window.setInterval(() => {
    for (const [uuid, set] of peers) {
        const server = findServer(uuid);
        if (!server || server.state !== 'running' || set.size === 0 || server.kind !== 'paper' || Math.random() > 0.25) continue;
        const lines = ['<Alex> gg', '<builder_kim> the spawn build is done', 'Alex has made the advancement [Stone Age]', '<Steve> brb', 'builder_kim joined the game', 'Steve left the game'];
        print(server, prefix(server) + lines[Math.floor(Math.random() * lines.length)]);
    }
}, 9000);

window.setInterval(() => {
    for (const [uuid, set] of peers) {
        const server = findServer(uuid);
        if (server && set.size) emit(server, 'stats', stats(server));
    }
}, 2000);

export function connectWings(url: URL, peer: SocketPeer) {
    const uuid = url.pathname.match(/\/api\/servers\/([0-9a-f-]+)\/ws$/)?.[1] ?? '';
    const server = findServer(uuid);
    return (event: string, args: string[]) => {
        if (!server) return;
        switch (event) {
            case 'auth':
                peers.set(server.uuid, new Set([...(peers.get(server.uuid) ?? [])].filter((p) => !p.closed)).add(peer));
                peer.send('auth success');
                peer.send('status', server.state);
                peer.send('stats', stats(server));
                break;
            case 'send logs':
                history(server).forEach((line) => peer.send('console output', line));
                break;
            case 'send stats':
                peer.send('stats', stats(server));
                break;
            case 'set state':
                power(server, args[0]);
                break;
            case 'send command':
                sendCommand(server, args[0] ?? '');
                break;
        }
    };
}

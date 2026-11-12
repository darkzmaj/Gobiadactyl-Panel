import type { MockRequest, MockResponse } from './transport';
import { categories, findServer, grants, NODES, nodeOf, PEOPLE, servers, usage, USER, type DemoServer, type Folder, type FileNode } from './data';
import { power, sendCommand } from './wings';
import permissionGroups from './permissions.json';

type Params = Record<string, string>;
type Route = [method: string, pattern: RegExp, handler: (request: MockRequest, params: Params) => MockResponse | Promise<MockResponse>];

let fixtures: Promise<Record<string, unknown>> | null = null;
const loadFixtures = () => (fixtures ??= fetch('/demo/fixtures.json').then((r) => r.json() as Promise<Record<string, unknown>>));
// The contract fixtures describe one server; its per-server reads (backups, schedules...) are served for every demo server.
const FIXTURE_SERVER = '5e7f0001-0000-4000-8000-000000000001';

const ok = (body: unknown): MockResponse => ({ status: 200, body });
const none = (): MockResponse => ({ status: 204 });
const fail = (status: number, detail: string): MockResponse => ({ status, body: { errors: [{ code: 'DisplayException', status: String(status), detail }] } });
const list = (object: string, items: unknown[]) => ({ object: 'list', data: items.map((attributes) => ({ object, attributes })) });
const paginated = (data: unknown[]) => ({
    object: 'list',
    data,
    meta: { pagination: { total: data.length, count: data.length, per_page: 50, current_page: 1, total_pages: 1, links: {} } },
});
const body = <T>(request: MockRequest) => (request.body ?? {}) as T;

// ---- Servers ---------------------------------------------------------------------------------------------------

const render = (server: DemoServer) =>
    server.rawStartup.replace(/\{\{(\w+)\}\}/g, (_, key: string) =>
        key === 'SERVER_MEMORY' ? String(server.limits.memory) : (server.variables.find((v) => v.env_variable === key)?.server_value ?? '')
    );

function serverResource(server: DemoServer, includes: string[] = []) {
    const node = nodeOf(server);
    const relationships: Record<string, unknown> = {
        allocations: list('allocation', server.allocations),
        variables: list('egg_variable', server.variables),
    };
    if (includes.includes('egg')) relationships.egg = { object: 'egg', attributes: { uuid: server.egg.uuid, name: server.egg.name } };
    if (includes.includes('subusers')) relationships.subusers = { object: 'list', data: [] };
    return {
        object: 'server',
        attributes: {
            server_owner: server.owner,
            identifier: server.identifier,
            __deprecated_uuid_short: server.identifier,
            server_identifier: `serv_demo${String(server.internalId).padStart(19, 'a')}`,
            internal_id: server.internalId,
            uuid: server.uuid,
            name: server.name,
            node: node.name,
            is_node_under_maintenance: false,
            upload_size: 100,
            sftp_details: { ip: node.fqdn, port: 2022 },
            description: server.description,
            limits: server.limits,
            invocation: render(server),
            docker_image: server.image,
            egg_features: server.kind === 'paper' || server.kind === 'fabric' ? ['eula', 'java_version'] : [],
            egg_tags: server.kind === 'node' ? ['bot'] : ['minecraft'],
            feature_limits: { databases: 2, allocations: 5, backups: 3 },
            status: null,
            is_suspended: false,
            is_installing: false,
            is_transferring: false,
            skip_scripts: false,
            relationships,
        },
        meta: { is_server_owner: server.owner, user_permissions: ['*', 'admin.websocket.errors', 'admin.websocket.install', 'admin.websocket.transfer'] },
    };
}

const instance = (server: DemoServer) => {
    const primary = server.allocations.find((a) => a.is_default)!;
    return {
        uuid: server.uuid,
        identifier: server.identifier,
        name: server.name,
        description: server.description,
        node: nodeOf(server).name,
        address: `${primary.ip_alias ?? primary.ip}:${primary.port}`,
        is_owner: server.owner,
        status: null,
        limits: { memory: server.limits.memory, disk: server.limits.disk, cpu: server.limits.cpu },
        icon_color: server.color,
        categories: server.categories,
    };
};

const viewOf = (server: DemoServer, view: string) => view === 'all' || (view === 'you' ? server.owner : !server.owner);
const viewCounts = (pool: DemoServer[]) => ({ all: pool.length, you: pool.filter((s) => s.owner).length, other: pool.filter((s) => !s.owner).length });

function instances(url: URL) {
    const view = url.searchParams.get('view') ?? 'all';
    const category = url.searchParams.get('category');
    const q = (url.searchParams.get('q') ?? '').toLowerCase();
    let pool = servers.filter((s) => !q || s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q));
    if (category === 'none') pool = pool.filter((s) => s.categories.length === 0);
    else if (category) pool = pool.filter((s) => s.categories.includes(Number(category)));
    const data = (category ? pool : pool.filter((s) => viewOf(s, view))).map(instance);
    return ok({ data, meta: { counts: viewCounts(pool), pagination: { total: data.length, count: data.length, per_page: 30, current_page: 1, total_pages: 1 } } });
}

const summary = () =>
    ok({
        categories: categories.map((c) => ({ ...c, count: servers.filter((s) => s.categories.includes(c.id)).length })),
        uncategorized: servers.filter((s) => s.categories.length === 0).length,
        counts: viewCounts(servers),
        recent_icon_colors: ['#22c55e', '#3b82f6', '#a855f7', '#ef4444'],
    });

// ---- Files -----------------------------------------------------------------------------------------------------

const segments = (path: string) => path.split('/').filter((part) => part && part !== '.');

function locate(server: DemoServer, path: string): { parent: Folder | null; node: FileNode | null; name: string } {
    const parts = segments(path);
    let folder: Folder = server.files;
    for (let i = 0; i < parts.length - 1; i++) {
        const next = folder.get(parts[i]);
        if (!next?.children) return { parent: null, node: null, name: parts[parts.length - 1] ?? '' };
        folder = next.children;
    }
    const name = parts[parts.length - 1] ?? '';
    return { parent: folder, node: name ? (folder.get(name) ?? null) : null, name };
}

const folderAt = (server: DemoServer, path: string): Folder | null => (segments(path).length === 0 ? server.files : (locate(server, path).node?.children ?? null));

const MIME: Record<string, string> = { yml: 'text/yaml', yaml: 'text/yaml', json: 'application/json', js: 'text/javascript', md: 'text/markdown', toml: 'text/plain', properties: 'text/plain', txt: 'text/plain', log: 'text/plain', jar: 'application/java-archive', gz: 'application/gzip' };
const bytes = (node: FileNode) => (node.children ? 4096 : node.content !== undefined ? new TextEncoder().encode(node.content).length : (node.size ?? 0));

const fileObject = (node: FileNode) => ({
    object: 'file_object',
    attributes: {
        name: node.name,
        mode: node.children ? 'drwxr-xr-x' : '-rw-r--r--',
        mode_bits: node.children ? '755' : '644',
        size: bytes(node),
        is_file: !node.children,
        is_symlink: false,
        mimetype: node.children ? 'inode/directory' : (MIME[node.name.split('.').pop() ?? ''] ?? 'application/octet-stream'),
        created_at: node.modified,
        modified_at: node.modified,
    },
});

const join = (root: string, name: string) => '/' + [...segments(root), ...segments(name)].join('/');
const touch = (node: FileNode) => (node.modified = new Date().toISOString());

function filesRoute(server: DemoServer, action: string, request: MockRequest): MockResponse {
    const { url } = request;
    switch (action) {
        case 'list': {
            const folder = folderAt(server, url.searchParams.get('directory') ?? '/');
            if (!folder) return fail(404, 'The requested directory does not exist.');
            return ok({ object: 'list', data: [...folder.values()].map(fileObject) });
        }
        case 'contents': {
            const node = locate(server, url.searchParams.get('file') ?? '').node;
            if (!node || node.children) return fail(404, 'The requested file does not exist.');
            if (node.content === undefined) return fail(400, 'This is a binary file and cannot be opened in the demo.');
            return { status: 200, body: node.content, headers: { 'content-type': 'text/plain' } };
        }
        case 'write': {
            const target = locate(server, url.searchParams.get('file') ?? '');
            if (!target.parent || !target.name) return fail(404, 'The parent directory does not exist.');
            const content = typeof request.body === 'string' ? request.body : JSON.stringify(request.body, null, 4);
            const node = target.node ?? { name: target.name, modified: '' };
            node.content = content;
            touch(node);
            target.parent.set(target.name, node);
            return none();
        }
        case 'create-folder': {
            const { root = '/', name = '' } = body<{ root?: string; name?: string }>(request);
            const target = locate(server, join(root, name));
            if (!target.parent) return fail(404, 'The parent directory does not exist.');
            if (target.node) return fail(409, 'A file or folder with that name already exists.');
            target.parent.set(target.name, { name: target.name, children: new Map(), modified: new Date().toISOString() });
            return none();
        }
        case 'rename': {
            const { root = '/', files = [] } = body<{ root?: string; files?: { from: string; to: string }[] }>(request);
            for (const { from, to } of files) {
                const source = locate(server, join(root, from));
                const destination = locate(server, join(root, to));
                if (!source.node || !source.parent || !destination.parent) return fail(404, 'The file does not exist.');
                if (destination.node) return fail(409, 'A file or folder with that name already exists.');
                source.parent.delete(source.name);
                source.node.name = destination.name;
                destination.parent.set(destination.name, source.node);
            }
            return none();
        }
        case 'delete': {
            const { root = '/', files = [] } = body<{ root?: string; files?: string[] }>(request);
            for (const name of files) {
                const target = locate(server, join(root, name));
                target.parent?.delete(target.name);
            }
            return none();
        }
        case 'copy': {
            const { location = '' } = body<{ location?: string }>(request);
            const source = locate(server, location);
            if (!source.node || !source.parent) return fail(404, 'The file does not exist.');
            const dot = source.name.lastIndexOf('.');
            const base = dot > 0 ? source.name.slice(0, dot) : source.name;
            const extension = dot > 0 ? source.name.slice(dot) : '';
            let name = `${base} copy${extension}`;
            for (let n = 2; source.parent.has(name); n++) name = `${base} copy ${n}${extension}`;
            source.parent.set(name, structuredClone({ ...source.node, name, modified: new Date().toISOString() }));
            return none();
        }
        case 'compress': {
            const { root = '/' } = body<{ root?: string }>(request);
            const folder = folderAt(server, root);
            if (!folder) return fail(404, 'The directory does not exist.');
            const name = `archive-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.tar.gz`;
            const node: FileNode = { name, size: 48213, modified: new Date().toISOString() };
            folder.set(name, node);
            return ok(fileObject(node));
        }
        case 'chmod':
            return none();
        case 'decompress':
        case 'pull':
            return fail(400, 'Archives are not unpacked in the demo.');
        case 'download':
        case 'upload':
            return fail(400, 'Downloads and uploads are turned off in the demo. Everything else works on fake files.');
        default:
            return fail(404, 'This is not part of the demo.');
    }
}

// ---- Admin overview ----------------------------------------------------------------------------------------------

function overview() {
    const rows = NODES.map((node) => {
        const on = servers.filter((s) => s.node === node.id);
        const used = on.reduce((sum, s) => sum + usage(s).memory_bytes, 0);
        return {
            id: node.id,
            name: node.name,
            location: node.location,
            fqdn: node.fqdn,
            version: '1.12.1',
            allocations: { used: on.reduce((sum, s) => sum + s.allocations.length, 0), total: 200 },
            status: 'online' as const,
            instances: on.length,
            instances_running: on.filter((s) => s.state === 'running').length,
            ram: { total: node.memory * 1048576, allocated: on.reduce((sum, s) => sum + s.limits.memory, 0) * 1048576, used: used + 2.1 * 1073741824 },
            storage: { total: node.disk * 1048576, allocated: on.reduce((sum, s) => sum + s.limits.disk, 0) * 1048576, used: on.reduce((sum, s) => sum + s.load.disk, 0) * 1048576 + 24 * 1073741824 },
            cpu: { percent: node.cpu, cores: node.cores },
        };
    });
    const sum = (pick: (row: (typeof rows)[number]) => number) => rows.reduce((total, row) => total + pick(row), 0);
    const memory = NODES.reduce((total, n) => total + n.memory, 0);
    const disk = NODES.reduce((total, n) => total + n.disk, 0);
    const allocatedMemory = servers.reduce((total, s) => total + s.limits.memory, 0);
    const allocatedDisk = servers.reduce((total, s) => total + s.limits.disk, 0);
    return ok({
        totals: { users: PEOPLE.length + 1, administrators: 2, nodes: NODES.length, instances: servers.length, databases: 3, locations: 3, mounts: 1, templates: 4 },
        resources: {
            ram: { total: sum((r) => r.ram.total), allocated: sum((r) => r.ram.allocated), used: sum((r) => r.ram.used) },
            storage: { total: sum((r) => r.storage.total), allocated: sum((r) => r.storage.allocated), used: sum((r) => r.storage.used) },
            cpu: { percent: Math.round(sum((r) => r.cpu.percent * r.cpu.cores) / sum((r) => r.cpu.cores)), nodes_reporting: NODES.length },
            instances: { total: servers.length, running: servers.filter((s) => s.state === 'running').length },
            nodes: { total: NODES.length, online: NODES.length, maintenance: 0, offline: 0 },
        },
        nodes: rows,
        allocatable: {
            enabled: true,
            reserve_percent: 10,
            memory: { total: memory, allocated: allocatedMemory, reserved: memory * 0.1, safe: memory * 0.9 - allocatedMemory },
            disk: { total: disk, allocated: allocatedDisk, reserved: disk * 0.1, safe: disk * 0.9 - allocatedDisk },
        },
    });
}

// ---- Access ------------------------------------------------------------------------------------------------------

const ALL_KEYS = Object.entries(permissionGroups as Record<string, { keys: Record<string, string> }>).flatMap(([prefix, group]) => Object.keys(group.keys).map((key) => `${prefix}.${key}`));

const access = () =>
    ok({
        grants: grants.map(({ person, servers: shared }) => ({
            uuid: person.uuid,
            email: person.email,
            username: person.username,
            servers: shared.map((entry) => ({ uuid: entry.uuid, name: findServer(entry.uuid)?.name ?? 'Unknown', permissions: entry.permissions })),
            permissions: [...new Set(shared.flatMap((entry) => entry.permissions))],
        })),
        servers: servers.filter((s) => s.owner).map((s) => ({ uuid: s.uuid, name: s.name, owned: true, grantable: null })),
        permission_groups: permissionGroups,
    });

function grant(request: MockRequest): MockResponse {
    const { email = '', servers: chosen = [], permissions = [] } = body<{ email?: string; servers?: string[]; permissions?: string[] }>(request);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { status: 422, body: { errors: [{ code: 'ValidationException', status: '422', detail: 'Enter a valid email address.', meta: { source_field: 'email', rule: 'email' } }] } };
    if (chosen.length === 0) return fail(422, 'Choose at least one instance.');
    const unknown = permissions.find((p) => !ALL_KEYS.includes(p));
    if (unknown) return fail(422, `Unknown permission: ${unknown}.`);
    let entry = grants.find((g) => g.person.email === email);
    if (!entry) {
        const username = email.split('@')[0].replace(/[^a-z0-9_.-]/gi, '').slice(0, 20) || 'friend';
        entry = { person: { id: 100 + grants.length, uuid: `d3e10000-0000-4000-8000-0000000001${String(grants.length).padStart(2, '0')}`, username, email, first_name: username, last_name: '', admin: false }, servers: [] };
        grants.push(entry);
    }
    entry.servers = chosen.map((uuid) => ({ uuid, permissions }));
    return none();
}

// ---- Routes ------------------------------------------------------------------------------------------------------

const S = '/api/client/servers/(?<server>[0-9a-f-]+)';
const GC = '/api/client/extensions/gobia-core';
const re = (pattern: string) => new RegExp(`^${pattern}$`);

const routes: Route[] = [
    ['GET', re('/sanctum/csrf-cookie'), none],
    ['POST', re('/auth/login'), () => {
        localStorage.setItem('gobia-demo:session', '1');
        return ok({ data: { complete: true, intended: '/' } });
    }],
    ['POST', re('/auth/logout'), () => (localStorage.removeItem('gobia-demo:session'), none())],
    ['POST', re('/auth/password'), () => ok({ status: 'If an account exists for that email, a reset link is on its way. (Demo: nothing is sent.)' })],

    ['GET', re('/api/client'), () => ok(paginated(servers.map((s) => serverResource(s, ['egg']))))],
    ['GET', re('/api/client/account'), () => ok({ object: 'user', attributes: { id: USER.id, uuid: USER.uuid, admin: true, username: USER.username, email: USER.email, first_name: USER.first_name, last_name: USER.last_name, language: 'en', avatar: null, '2fa_enabled': false, created_at: '2026-01-15T09:00:00+00:00', updated_at: '2026-11-01T09:00:00+00:00' } })],
    ['PUT', re('/api/client/account/(email|password)'), () => fail(400, 'Email and password changes are turned off in the demo.')],
    ['POST', re('/api/client/account/(api-keys|ssh-keys)'), () => fail(400, 'Creating keys is turned off in the demo.')],
    ['GET', re('/api/client/account/two-factor'), () => fail(400, 'Two-factor setup is turned off in the demo.')],

    ['GET', re(S), (r, p) => ok(serverResource(findServer(p.server)!, (r.url.searchParams.get('include') ?? '').split(',')))],
    ['GET', re(`${S}/resources`), (_, p) => {
        const s = findServer(p.server)!;
        const u = usage(s);
        return ok({ object: 'stats', attributes: { current_state: s.state, is_suspended: false, resources: { memory_bytes: u.memory_bytes, cpu_absolute: u.cpu_absolute, disk_bytes: u.disk_bytes, network_rx_bytes: u.network.rx_bytes, network_tx_bytes: u.network.tx_bytes, uptime: u.uptime } } });
    }],
    ['GET', re(`${S}/websocket`), (_, p) => ok({ data: { token: 'demo-token', socket: `wss://wings.demo.invalid/api/servers/${findServer(p.server)!.uuid}/ws` } })],
    ['POST', re(`${S}/power`), (r, p) => (power(findServer(p.server)!, body<{ signal: string }>(r).signal), none())],
    ['POST', re(`${S}/command`), (r, p) => (sendCommand(findServer(p.server)!, body<{ command: string }>(r).command), none())],

    ['GET', re(`${S}/startup`), (_, p) => {
        const s = findServer(p.server)!;
        return ok({ ...list('egg_variable', s.variables), meta: { startup_command: render(s), docker_images: s.images, raw_startup_command: s.rawStartup } });
    }],
    ['PUT', re(`${S}/startup/variable`), (r, p) => {
        const s = findServer(p.server)!;
        const { key, value } = body<{ key: string; value: string }>(r);
        const variable = s.variables.find((v) => v.env_variable === key);
        if (!variable || !variable.is_editable) return fail(400, 'This variable cannot be changed.');
        variable.server_value = value;
        return ok({ object: 'egg_variable', attributes: variable, meta: { startup_command: render(s), raw_startup_command: s.rawStartup } });
    }],
    ['PUT', re(`${S}/settings/docker-image`), (r, p) => ((findServer(p.server)!.image = body<{ docker_image: string }>(r).docker_image), none())],
    ['POST', re(`${S}/settings/rename`), (r, p) => {
        const s = findServer(p.server)!;
        const { name, description } = body<{ name?: string; description?: string }>(r);
        if (name) s.name = name;
        if (description !== undefined) s.description = description;
        return none();
    }],
    ['POST', re(`${S}/settings/reinstall`), () => fail(400, 'Reinstalling is turned off in the demo.')],

    ['GET', re(`${S}/network/allocations`), (_, p) => ok(list('allocation', findServer(p.server)!.allocations))],
    ['POST', re(`${S}/network/allocations`), (_, p) => {
        const s = findServer(p.server)!;
        const last = s.allocations[s.allocations.length - 1];
        const allocation = { id: 1000 + Math.floor(Math.random() * 9000), ip: last.ip, ip_alias: last.ip_alias, port: last.port + 1, notes: null, is_default: false };
        s.allocations.push(allocation);
        return ok({ object: 'allocation', attributes: allocation });
    }],
    ['POST', re(`${S}/network/allocations/(?<id>\\d+)/primary`), (_, p) => {
        const s = findServer(p.server)!;
        s.allocations.forEach((a) => (a.is_default = a.id === Number(p.id)));
        return ok({ object: 'allocation', attributes: s.allocations.find((a) => a.id === Number(p.id)) });
    }],
    ['POST', re(`${S}/network/allocations/(?<id>\\d+)`), (r, p) => {
        const allocation = findServer(p.server)!.allocations.find((a) => a.id === Number(p.id))!;
        allocation.notes = body<{ notes?: string | null }>(r).notes ?? null;
        return ok({ object: 'allocation', attributes: allocation });
    }],
    ['DELETE', re(`${S}/network/allocations/(?<id>\\d+)`), (_, p) => {
        const s = findServer(p.server)!;
        const allocation = s.allocations.find((a) => a.id === Number(p.id));
        if (allocation?.is_default) return fail(400, 'You cannot delete the primary allocation for this server.');
        s.allocations = s.allocations.filter((a) => a.id !== Number(p.id));
        return none();
    }],

    ['GET', re(`${S}/files/(?<action>[a-z-]+)`), (r, p) => filesRoute(findServer(p.server)!, p.action, r)],
    ['POST', re(`${S}/files/(?<action>[a-z-]+)`), (r, p) => filesRoute(findServer(p.server)!, p.action, r)],
    ['PUT', re(`${S}/files/(?<action>[a-z-]+)`), (r, p) => filesRoute(findServer(p.server)!, p.action, r)],
    ['POST', re('/api/client/extensions/gobia-files/transfers'), () => fail(400, 'Transfers between servers are turned off in the demo.')],

    ['GET', re(`${GC}/servers`), (r) => instances(r.url)],
    ['GET', re(`${GC}/servers/summary`), summary],
    ['PUT', re(`${GC}/servers/order`), (r) => {
        const order = body<{ servers: string[] }>(r).servers ?? [];
        servers.sort((a, b) => (order.indexOf(a.uuid) + 1 || 999) - (order.indexOf(b.uuid) + 1 || 999));
        return none();
    }],
    ['PUT', re(`${GC}/servers/(?<uuid>[0-9a-f-]+)/icon-color`), (r, p) => {
        findServer(p.uuid)!.color = body<{ color: string | null }>(r).color;
        return ok({ icon_color: findServer(p.uuid)!.color, recent_icon_colors: ['#22c55e', '#3b82f6', '#a855f7', '#ef4444'] });
    }],
    ['POST', re(`${GC}/categories`), (r) => {
        const category = { id: Math.max(0, ...categories.map((c) => c.id)) + 1, name: body<{ name: string }>(r).name, position: categories.length };
        categories.push(category);
        return ok({ ...category, count: 0 });
    }],
    ['PUT', re(`${GC}/categories/order`), (r) => {
        const order = body<{ categories: number[] }>(r).categories ?? [];
        categories.forEach((c) => (c.position = order.indexOf(c.id)));
        categories.sort((a, b) => a.position - b.position);
        return none();
    }],
    ['PUT', re(`${GC}/categories/(?<id>\\d+)`), (r, p) => {
        const category = categories.find((c) => c.id === Number(p.id))!;
        category.name = body<{ name: string }>(r).name ?? category.name;
        return ok({ ...category, count: servers.filter((s) => s.categories.includes(category.id)).length });
    }],
    ['DELETE', re(`${GC}/categories/(?<id>\\d+)`), (_, p) => {
        const id = Number(p.id);
        categories.splice(categories.findIndex((c) => c.id === id), 1);
        servers.forEach((s) => (s.categories = s.categories.filter((c) => c !== id)));
        return none();
    }],
    ['PUT', re(`${GC}/categories/(?<id>\\d+)/servers`), (r, p) => {
        const id = Number(p.id);
        const chosen = body<{ servers: string[] }>(r).servers ?? [];
        servers.forEach((s) => (s.categories = chosen.includes(s.uuid) ? [...new Set([...s.categories, id])] : s.categories.filter((c) => c !== id)));
        return none();
    }],
    ['PUT', re(`${GC}/categories/(?<id>\\d+)/servers/(?<uuid>[0-9a-f-]+)`), (r, p) => {
        const s = findServer(p.uuid)!;
        const id = Number(p.id);
        const member = body<{ member?: boolean; in?: boolean }>(r);
        const add = member.member ?? member.in ?? !s.categories.includes(id);
        s.categories = add ? [...new Set([...s.categories, id])] : s.categories.filter((c) => c !== id);
        return none();
    }],
    ['GET', re(`${GC}/profile`), () => ok(profile())],
    ['PUT', re(`${GC}/profile/appearance`), (r) => {
        const { theme, file_editor } = body<{ theme?: string; file_editor?: string }>(r);
        if (theme) localStorage.setItem('gobia-demo:scheme', theme);
        if (file_editor) localStorage.setItem('gobia-demo:file-editor', file_editor);
        return ok(profile());
    }],
    ['PUT', re(`${GC}/profile/username`), () => fail(400, 'The demo account keeps its name.')],
    ['POST', re(`${GC}/profile/avatar`), () => fail(400, 'Avatar uploads are turned off in the demo.')],
    ['GET', re(`${GC}/access`), access],
    ['POST', re(`${GC}/access`), grant],
    ['PUT', re(`${GC}/access/(?<person>[0-9a-f-]+)`), (r, p) => {
        const entry = grants.find((g) => g.person.uuid === p.person);
        if (!entry) return fail(404, 'That person has no access.');
        const { servers: chosen = [], permissions = [] } = body<{ servers?: string[]; permissions?: string[] }>(r);
        entry.servers = chosen.map((uuid) => ({ uuid, permissions }));
        return none();
    }],
    ['DELETE', re(`${GC}/access/(?<person>[0-9a-f-]+)`), (_, p) => {
        grants.splice(grants.findIndex((g) => g.person.uuid === p.person), 1);
        return none();
    }],

    ['GET', re('/api/admin/extensions/gobia-core/overview'), overview],
    ['GET', re('/api/admin/languages'), () => ok({ en: 'English', de: 'German', fr: 'French', sl: 'Slovenian' })],
    ['GET', re('/api/admin/version'), () => ok({ current: '2.1.0', latest: '2.1.0', is_latest: true, daemon: '1.12.1', discord: 'https://discord.gg/example', donations: 'https://example.com/donate' })],
    ['GET', re('/api/admin/settings'), () =>
        ok({
            general: { 'app:name': 'Gobia Panel', 'app:logo': null, 'pterodactyl:auth:2fa_required': 0, 'pterodactyl:client_features:avatars:enabled': false, 'app:locale': 'en' },
            mail: { 'mail:default': 'smtp', 'mail:mailers:smtp:host': 'smtp.example.com', 'mail:mailers:smtp:port': 587, 'mail:mailers:smtp:encryption': 'tls', 'mail:mailers:smtp:username': 'panel@example.com', 'mail:mailers:smtp:password': '', 'mail:from:address': 'panel@example.com', 'mail:from:name': 'Gobia Panel' },
            advanced: { 'recaptcha:enabled': false, 'recaptcha:secret_key': '', 'recaptcha:website_key': '', 'pterodactyl:guzzle:timeout': 15, 'pterodactyl:guzzle:connect_timeout': 5, 'pterodactyl:client_features:allocations:enabled': true, 'pterodactyl:client_features:allocations:range_start': 25565, 'pterodactyl:client_features:allocations:range_end': 25600 },
            meta: { load_environment_only: false, show_recaptcha_warning: false },
        })],
    ['GET', re('/api/admin/nodes/\\d+/system-information'), () => ok({ architecture: 'amd64', cpu_count: 16, kernel_version: '6.8.0-49-generic', os: 'linux', version: '1.12.1' })],
    ['GET', re('/api/admin/nodes/\\d+/utilization'), () =>
        ok({ disk: { value: '312.4 GiB', max: '1000 GiB', percent: 31, css: 'bg-green-500' }, memory: { value: '24.1 GiB', max: '64 GiB', percent: 38, css: 'bg-green-500' } })],
    ['GET', re('/api/admin/extensions/gobia-core/compatibility'), () =>
        ok({
            gobia_version: '2.1.0',
            pterodactyl_base: { version: '2.0.0-beta', commit: '3d93cd07d' },
            php: '8.4.14',
            database: { driver: 'mariadb', version: '11.4.4' },
            extensions: [
                { id: 'gobia-core', name: 'Gobia Core', version: '1.0.0', enabled: true, compatible: true, reason: null },
                { id: 'gobia-files', name: 'Gobia Files', version: '1.0.0', enabled: true, compatible: true, reason: null },
                { id: 'gobia-theme', name: 'Gobia', version: '1.0.0', enabled: true, compatible: true, reason: null },
            ],
            migrations: { pending: 0, ran: 214 },
            health: { database: true, cache: true, queue: 'running' },
            release: { min_upgrade_from: '2.0.0', security_update: false },
        })],
    ['GET', re('/api/admin/extensions/gobia-core/updates/check'), () =>
        ok({ contract_version: 1, current: { gobia: '2.1.0', pterodactyl_base: '2.0.0-beta' }, latest_approved: null, update_available: false, error: null, checked_at: new Date().toISOString(), active_update_id: null })],
    ['GET', re('/api/admin/extensions/gobia-core/updates/preflight'), () =>
        ok({ ready: true, checks: [{ id: 'php', required: true, status: 'pass', message: 'PHP 8.4.14' }, { id: 'disk', required: true, status: 'pass', message: '61 GiB free' }], extensions: [], migrations: { pending: 0, destructive: false, rollback: 'file-only' } })],
    ['GET', re('/api/admin/extensions/gobia-core/updates/history'), () =>
        ok({ data: [{ update_id: '20261112T183000-a1b2c3', from: '2.0.0', to: '2.1.0', started_at: '2026-11-12T18:30:00Z', finished_at: '2026-11-12T18:33:41Z', result: 'completed', database_restored: false }] })],
    ['GET', re('/api/admin/extensions/gobia-core/updates/rollback-eligibility'), () => ok({ eligible: false, mode: 'file-only', update_id: null, database_snapshot: null, reason: 'Rollback is turned off in the demo.' })],
    ['POST', /^\/api\/admin\/extensions\/gobia-core\/updates\//, () => fail(400, 'Updates are not installed from the demo.')],
    ['GET', /^\/api\/(client\/account|client\/servers\/[0-9a-f-]+|admin)\/activity\/filters$/, () =>
        ok({
            data: {
                events: ['auth:success', 'server:console.command', 'server:file.write', 'server:file.rename', 'server:power.start', 'server:power.restart', 'server:startup.edit', 'server:allocation.notes', 'user:account.email-changed'],
                users: [{ id: USER.id, username: USER.username, email: USER.email }, ...PEOPLE.map((p) => ({ id: p.id, username: p.username, email: p.email }))],
            },
        })],
];

function profile() {
    return {
        theme: localStorage.getItem('gobia-demo:scheme') ?? 'system',
        file_editor: localStorage.getItem('gobia-demo:file-editor') ?? 'gobia',
        avatar_url: null,
        username: USER.username,
    };
}

export const seen: string[] = [];
(window as unknown as { __demoSeen: string[] }).__demoSeen = seen;

export async function route(request: MockRequest): Promise<MockResponse | null> {
    const { method, url } = request;
    for (const [m, pattern, handler] of routes) {
        if (m !== method) continue;
        const match = url.pathname.match(pattern);
        if (!match) continue;
        if (match.groups?.server && !findServer(match.groups.server)) return fail(404, 'The requested server does not exist.');
        seen.push(`ok ${method} ${url.pathname}${url.search}`);
        return handler(request, match.groups ?? {});
    }
    const all = await loadFixtures();
    if (method === 'GET') {
        const key = url.pathname + decodeURIComponent(url.search);
        const server = url.pathname.match(/^\/api\/client\/servers\/([0-9a-f-]+)/)?.[1];
        const swap = (k: string) => (server ? k.replace(server, FIXTURE_SERVER) : k);
        // An admin record the fixtures do not hold (users/1) is answered with a sibling record of the same kind.
        const sibling = () => {
            const shape = url.pathname.match(/^(\/api\/admin\/[a-z-]+\/)\d+(.*)$/);
            if (!shape) return undefined;
            const like = new RegExp(`^${shape[1].replace(/[/-]/g, '\\$&')}\\d+${shape[2].replace(/[/-]/g, '\\$&')}(\\?|$)`);
            const found = Object.keys(all).find((k) => like.test(k));
            return found ? all[found] : undefined;
        };
        const hit = all[key] ?? all[url.pathname] ?? all[swap(key)] ?? all[swap(url.pathname)] ?? sibling();
        seen.push(`${hit ? 'fx' : '--'} ${method} ${key}`);
        if (hit) return ok(hit);
        return null;
    }
    seen.push(`-- ${method} ${url.pathname}`);
    // Writes the demo does not model: refused politely, nothing changes.
    return fail(400, 'This action is turned off in the demo.');
}

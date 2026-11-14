// Builds the static Gobia Panel demo into demo/dist: the real panel frontend and the Gobia extensions, a page shell
// that boots them the way the Panel's Blade layout does, and a mock layer (demo/mock) that answers every API call and
// the console websocket in the browser with fake data. No backend; nothing is requested from any real panel or node.
//   node demo/build.mjs            full build
//   node demo/build.mjs --skip-app reuse the panel and extension builds, rebuild only the shell and the mock
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const demo = join(root, 'demo');
const out = join(demo, 'dist');
const stage = join(demo, '.build');
const skipApp = process.argv.includes('--skip-app');
const vite = join(root, 'node_modules', '.bin', process.platform === 'win32' ? 'vite.cmd' : 'vite');
// Only the extensions the demo shows. gobia-templates and gobia-backups need real infrastructure.
const extensions = ['gobia-theme', 'gobia-core', 'gobia-files'];

function run(args, cwd) {
    // Quoted for cmd.exe: the repository path may contain spaces.
    const command = process.platform === 'win32' ? `"${vite}"` : vite;
    const result = spawnSync(command, process.platform === 'win32' ? args.map((arg) => `"${arg}"`) : args, { cwd, stdio: 'inherit', shell: process.platform === 'win32', env: { ...process.env, PTERODACTYL_BUILD_HASH: 'demo' } });
    if (result.status !== 0) throw new Error(`vite ${args.join(' ')} failed in ${cwd}`);
}

if (!skipApp) {
    run(['build', '--outDir', join(stage, 'assets'), '--emptyOutDir'], root);
    for (const id of extensions) run(['build'], join(root, 'extensions', id));
}

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
const noMaps = (source) => !source.endsWith('.map');
cpSync(join(stage, 'assets'), join(out, 'assets'), { recursive: true, filter: noMaps });
for (const id of extensions) {
    cpSync(join(root, 'extensions', id, 'dist'), join(out, 'assets', 'extensions', id), { recursive: true, filter: noMaps });
}
cpSync(join(root, 'public', 'favicons'), join(out, 'favicons'), { recursive: true });
cpSync(join(root, 'public', 'gobia'), join(out, 'gobia'), { recursive: true });
writeFileSync(join(out, 'robots.txt'), 'User-agent: *\nAllow: /\n');

// The fixtures of the API contract tests are real response shapes with fake data (example.test hosts, documentation
// address ranges). Only successful reads are shipped; the mock serves them and patches its own data on top.
const fixtures = {};
const walk = (dir) =>
    readdirSync(dir).forEach((name) => {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) return walk(path);
        if (!name.endsWith('.json')) return;
        const content = JSON.parse(readFileSync(path, 'utf8'));
        for (const entry of Array.isArray(content) ? content : [content]) {
            const [method, url] = String(entry.request ?? '').split(' ');
            if (method !== 'GET' || entry.status !== 200 || /per_page=1\b|page=99|filter\[/.test(url ?? '')) continue;
            fixtures[url] ??= entry.body;
        }
    });
['client', 'admin'].forEach((area) => walk(join(root, 'tests', 'Fixtures', 'api', area)));
mkdirSync(join(out, 'demo'), { recursive: true });
// The fixtures' private sample addresses become documentation addresses, so the scan below stays strict.
writeFileSync(join(out, 'demo', 'fixtures.json'), JSON.stringify(fixtures).replaceAll('10.0.0.0/8', '198.51.100.0/24').replaceAll('10.0.0.5', '192.0.2.5'));

await build({
    configFile: false,
    logLevel: 'warn',
    define: { __GOBIA_VERSION__: JSON.stringify(JSON.parse(readFileSync(join(root, 'gobia-release.json'), 'utf8')).gobia_version) },
    build: {
        outDir: join(out, 'demo'),
        emptyOutDir: false,
        minify: true,
        lib: { entry: join(demo, 'mock', 'index.ts'), formats: ['iife'], name: 'GobiaDemo', fileName: () => 'mock.js' },
    },
});

const manifest = JSON.parse(readFileSync(join(out, 'assets', 'manifest.json'), 'utf8'));
const asset = (key) => '/assets/' + manifest[key].file;
const runtime = {
    react: 'resources/scripts/ext-runtime/react.ts',
    'react/jsx-runtime': 'resources/scripts/ext-runtime/react-jsx-runtime.ts',
    'react-dom': 'resources/scripts/ext-runtime/react-dom.ts',
    'react-dom/client': 'resources/scripts/ext-runtime/react-dom-client.ts',
    '@tanstack/react-query': 'resources/scripts/ext-runtime/tanstack-react-query.ts',
    '@pterodactyl/sdk': 'resources/scripts/sdk/index.ts',
    '@pterodactyl/sdk/api': 'resources/scripts/sdk/api.ts',
    '@pterodactyl/sdk/theme': 'resources/scripts/sdk/theme.ts',
};
const importMap = { imports: Object.fromEntries(Object.entries(runtime).map(([name, key]) => [name, asset(key)])) };
const main = manifest['resources/scripts/index.tsx'];
const manifestOf = (id) => JSON.parse(readFileSync(join(root, 'extensions', id, 'extension.json'), 'utf8'));
const entryUrl = (id) => `/assets/extensions/${id}/client.js`;

// window.SiteConfiguration as AssetComposer renders it for a signed-in user; config.js adds the user after sign-in.
const theme = manifestOf('gobia-theme');
const site = {
    name: 'Gobia Panel',
    logo: null,
    locale: 'en',
    userAvatarsEnabled: false,
    recaptcha: { enabled: false, siteKey: '' },
    extensions: extensions.map((id) => {
        const m = manifestOf(id);
        return {
            id,
            entry: entryUrl(id),
            prefix: m.ui?.prefix ?? null,
            translations: null,
            config: id === 'gobia-core' ? { logo: '/gobia/img/icon-256.png', favicon: '/gobia/img/favicon-32.png', console_prompt: 'demo@gobia~' } : {},
            development: null,
            version: m.version,
            screens: m.ui?.screens ?? [],
            views: m.ui?.views ?? [],
            ...(m.type === 'theme' ? { theme: true } : {}),
        };
    }),
    theme: {
        id: 'gobia-theme',
        chain: [{ id: 'gobia-theme', version: theme.version, entry: entryUrl('gobia-theme'), development: null }],
        settings: Object.fromEntries(Object.entries(theme.theme.settings).map(([key, s]) => [key, s.default ?? null])),
        scheme: 'dark',
        schemes: theme.theme.schemes,
        safeMode: false,
        preview: false,
    },
};
writeFileSync(join(out, 'demo', 'config.js'), readFileSync(join(demo, 'config.js'), 'utf8').replace('"__SITE__"', () => JSON.stringify(site)));

// The policy allows the page's own files only. The import map is the one inline script, allowed by its hash; the
// console's terminal compiles WebAssembly from a data: URL; Monaco runs its workers from the page's origin.
const importMapJson = JSON.stringify(importMap);
const csp = [
    "default-src 'self'",
    `script-src 'self' 'wasm-unsafe-eval' 'sha256-${createHash('sha256').update(importMapJson).digest('base64')}'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self' data:",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
].join('; ');

// The demo's own files keep fixed names; a content hash in the link makes a new deploy reach visitors at once.
const version = (file) => createHash('sha256').update(readFileSync(file)).digest('hex').slice(0, 10);
const configVersion = version(join(out, 'demo', 'config.js'));
const mockVersion = version(join(out, 'demo', 'mock.js'));
const cssVersion = version(join(demo, 'demo.css'));

const html = `<!DOCTYPE html>
<html lang="en" class="dark" data-theme="gobia-theme">
    <head>
        <title>Gobia Panel Demo</title>
        <meta charset="utf-8">
        <meta http-equiv="Content-Security-Policy" content="${csp}">
        <meta content="width=device-width, initial-scale=1" name="viewport">
        <meta name="description" content="A live demo of Gobia Panel with fake data: instances, console, file workspace, settings and admin.">
        <link rel="icon" type="image/png" href="/gobia/img/favicon-32.png">
        <link rel="apple-touch-icon" href="/gobia/img/apple-touch-icon.png">
        <meta name="theme-color" content="#0e4688" data-theme-token>
        <script src="/demo/config.js?v=${configVersion}"></script>
        <script src="/demo/mock.js?v=${mockVersion}"></script>
        <style id="theme-settings"></style>
        <link rel="stylesheet" href="${asset('resources/scripts/assets/tailwind.css')}">
        <link rel="stylesheet" href="/assets/extensions/gobia-theme/theme.css">
        ${(main.css ?? []).map((file) => `<link rel="stylesheet" href="/assets/${file}">`).join('')}
        <link rel="stylesheet" href="/demo/demo.css?v=${cssVersion}">
        <script type="importmap">${importMapJson}</script>
        <link rel="modulepreload" href="${entryUrl('gobia-theme')}">
    </head>
    <body class="bg-background">
        <div id="modal-portal"></div>
        <div id="app"></div>
        <script type="module" src="/assets/${main.file}"></script>
    </body>
</html>
`;
writeFileSync(join(out, 'index.html'), html);
cpSync(join(demo, 'demo.css'), join(out, 'demo', 'demo.css'));

// Nothing internal may ship: fail the build on infrastructure names, private or overlay addresses and secrets.
const forbidden = [
    /\bkori\b/i, /netbird/i, /coolify/i, /hetzner/i, /tailscale/i, /majcek/i, /minecraft\.gobia/i,
    /\b100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.\d{1,3}\.\d{1,3}\b/, // CGNAT / overlay range
    /\b(10\.\d{1,3}|192\.168|172\.(1[6-9]|2\d|3[01]))\.\d{1,3}\.\d{1,3}\b/, // RFC 1918
    /-----BEGIN [A-Z ]*PRIVATE KEY-----/, /\bptl[acr]_[A-Za-z0-9]{20,}/, /\bghp_[A-Za-z0-9]{20,}/,
];
// Third party code that legitimately contains a match (Monaco ships language samples and IPv4 regexes).
const allowed = (file, match) =>
    (/extensions[\\/]gobia-files[\\/]/.test(file) && /^(10|192|172|100)\./.test(match)) ||
    match === 'ptlc_9mQ4rT2xVbN8kLw3Zp7Hy1Jc6Fs0Dg5Ae'; // the panel's own sample key in its view fixtures
const leaks = [];
const scan = (dir) =>
    readdirSync(dir).forEach((name) => {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) return scan(path);
        if (!/\.(js|css|html|json|txt|svg|xml|webmanifest)$/.test(name)) return;
        const text = readFileSync(path, 'utf8');
        for (const pattern of forbidden) {
            const match = text.match(pattern);
            if (match && !allowed(path, match[0])) leaks.push(`${relative(out, path)}: ${match[0]}`);
        }
    });
scan(out);
if (leaks.length) {
    console.error('Demo bundle contains forbidden strings:\n  ' + leaks.join('\n  '));
    process.exit(1);
}
const size = (dir) => readdirSync(dir).reduce((sum, name) => { const p = join(dir, name); const s = statSync(p); return sum + (s.isDirectory() ? size(p) : s.size); }, 0);
console.log(`demo built: ${relative(root, out)} (${(size(out) / 1048576).toFixed(1)} MiB), no forbidden strings`);
if (!existsSync(join(out, 'index.html'))) process.exit(1);

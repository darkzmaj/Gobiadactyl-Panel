# Gobia Panel demo

A fully static demo of Gobia Panel for `gobiadactyl-demo.gobia.cloud`. It is the real panel frontend, the Gobia look
(`extensions/gobia-theme`), the instance list and access screens (`extensions/gobia-core`) and the file workspace
(`extensions/gobia-files`), with every API call and the console websocket answered in the browser by a mock layer.
There is no backend, no real sign-in and no Wings: nothing leaves the page.

| Path | What it is |
| --- | --- |
| `build.mjs` | Builds the panel and the three extensions, writes `dist/` with the page shell, the mock and the fixtures, and fails on internal names, private addresses or secrets in the output |
| `config.js` | Stand-in for the Blade layout: `window.SiteConfiguration`, the demo user after sign-in, the colour scheme |
| `mock/transport.ts` | Replaces `fetch`, `XMLHttpRequest` and `WebSocket`; refuses any other host |
| `mock/routes.ts` | The API: servers, power, startup, ports, files (an in-memory file system), gobia-core instances, categories, access, profile, admin overview and updates. Anything else falls back to the API contract fixtures in `tests/Fixtures/api` |
| `mock/data.ts` | The fake servers, nodes, people and files (reserved `example` names, documentation addresses) |
| `mock/wings.ts` | The console socket: auth, logs, stats, power and a few commands (`list`, `tps`, `say`, `help`, `version`) |
| `mock/banner.ts`, `demo.css` | "Try the demo" on the sign-in page, the "Demo · fake data · Reset" badge |
| `Dockerfile`, `nginx.conf` | Multi-stage build, then nginx serving files only on port 8080 (`/healthz` for health checks) |

## Build and run

```bash
node demo/build.mjs              # full build (needs npm ci in the root, extensions/gobia-theme and extensions/gobia-files)
node demo/build.mjs --skip-app   # reuse the panel and extension builds, rebuild the shell and the mock only
node demo/serve.mjs              # http://localhost:4173
docker build -f demo/Dockerfile -t gobiadactyl-demo .
docker run --rm -p 8080:8080 gobiadactyl-demo
```

Changes made in the demo live in memory until the page reloads; the sign-in, the colour scheme and the file editor
choice are kept in `localStorage`. The badge's Reset forgets all of it. Uploads, downloads, transfers between
servers, reinstalling, account changes and updates answer with a short "turned off in the demo" message.

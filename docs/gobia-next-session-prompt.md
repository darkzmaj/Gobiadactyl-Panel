# Master prompt: Gobia deployment, Wings, updates, installers and public release

Paste everything below the line into a new Claude Code session opened in `D:\PROJECTS\Gobiadactyl Panel`.

---

You are continuing the Gobia Panel project. Read `CLAUDE.md`, `MAJCEK_HANDOFF.md`, `docs/gobia-core-patches.md` and
`docs/gobia-backend-performance.md` before acting, and follow them exactly (branch policy, updater ownership, testing policy:
Linux CI is the verdict, never call work finished on a Windows result alone).

## Where things stand (2026-11-12)

* Panel: Gobia on Pterodactyl 2.0. Branch `gobia/upstream-sync-2026-11-12` (worktree
  `.claude/worktrees/gobiadactyl-panel-setup-d9db66`) merges upstream `2.0-develop` at `3d93cd07d` into `gobia-2` and moves the Gobia look
  into the `extensions/gobia-theme` theme extension. It is committed but not pushed and not merged into `gobia-2`; Linux CI
  (`.github/workflows/gobia-ci.yaml`) has not run on it. First job: push it (or the CI mirror remote `ci`), get CI green, then merge
  into `gobia-2` with my approval.
* Open items from that session are listed at the end of `docs/gobia-core-patches.md` ("Changed by the 2026-11-12 sync"). One Pest
  test (`OffsiteBackupTest`, schedule) fails only after the whole upstream suite in one process.
* Wings: the Gobia Wings fork is `D:\PROJECTS\gobia-wings-sloblock3` (remote `gobia` = `Cryvex-Dev/gobia-wings`, see its `GOBIA.md`
  and Phase 3 report). Benchmarks and the CRIU warm pool research are in `D:\PROJECTS\gobia-wings-benchmarks` (Phase 5). Branch
  `claude/minecraft-wings-perf-b45532` in the panel repo holds earlier Minecraft and Wings performance work. Read all three before
  changing Wings.
* Measured on the dev box (Windows, `php artisan serve`): file API 40 to 120 ms (1 MiB write 120 ms), explorer clicks one frame
  (7 ms), a 600 file folder 394 ms. A node address of `localhost` costs about 210 ms per call on Windows: always use `127.0.0.1` or a
  real hostname. The rest of the panel speed is server side and belongs to the deployment below.

## Goals, in this order (finish and verify each before the next; ask me before any irreversible or outward step)

1. **Panel to production on Coolify** at `minecraft.gobia.cloud`, reachable only through NetBird.
   * Production image: PHP 8.4 FPM with OPcache (validate_timestamps off, JIT off unless measured), nginx or Caddy with HTTP/2,
     Brotli or gzip for text (the 2.8 MB Monaco chunk of gobia-files must be compressed), `Cache-Control: immutable` for hashed
     `/assets/*`, Redis for cache, sessions and queue, a queue worker and the scheduler as separate Coolify services, MariaDB 11 with a
     tuned buffer pool. Build assets in CI, never on the server.
   * Security: `APP_ENV=production`, `APP_DEBUG=false`, HTTPS only (HSTS, secure and SameSite cookies), `TRUSTED_PROXIES` set to the
     Coolify proxy only, no public ports except through NetBird (the panel answers only on the NetBird interface or behind a NetBird
     protected route), secrets only in Coolify's secret store, a firewall on every host, database never exposed, backups encrypted
     and tested by a restore.
   * Production installs only signed Gobia releases (`docs/gobia-updates.md`); do not deploy a branch by hand once the updater path
     exists. Before the first release: bump `gobia_version` in `gobia-release.json`, build with `scripts/release/build-release.sh`,
     sign, and run the updater end to end on a staging copy (`docs/gobia-updater-e2e.md`).
2. **Two nodes over NetBird**: one for proxies (Velocity, BungeeCord or Gate), one for development servers. Wings reachable from the
   panel only over NetBird, SFTP through NetBird as well, allocations and ports documented, node `fqdn` set to the NetBird name, TLS
   between panel and Wings.
3. **Wings optimisation** in the Gobia Wings fork: measure first with the benchmark harness (start time, backup and restore time,
   file API latency, websocket stats), then optimise, then measure again and record numbers in the benchmarks repo. Keep the Wings API
   compatible with the panel's `WingsFiles`, `NodeJwt` and backup flows. Do not change Wings behaviour that the panel relies on
   without a matching panel change and test.
4. **Cleaner updates for panel and Wings**: one signed release per component, a version compatibility matrix (panel release to
   supported Wings releases), the panel's Updates screen showing Wings versions of each node, and an update path for Wings that is as
   safe as the panel one (staging, health check, rollback). Majcek owns the panel updater: changes there need
   `tests/Integration/Gobia/UpdaterTest.php` and an end to end run.
5. **Much simpler installs**: one command for the panel (Docker Compose and Coolify template, plus a bare metal script) and one for
   Wings (systemd, Docker check, NetBird join, node registration through the panel API with a one time token). Idempotent, safe to
   re-run, no secrets in shell history, a clear dry run.
6. **Publish both repositories publicly on GitHub.** Before anything is made public, and only after I confirm: scan the full git
   history for secrets (gitleaks or trufflehog), keys, `.env` files, internal hostnames and personal data, and rewrite history or start
   a clean repository if anything is found; keep upstream licences (Pterodactyl panel and Wings are MIT) and attribution; add a
   README, SECURITY.md, a CONTRIBUTING guide and the install docs; check that no signing key, Storage Box credential or NetBird setup
   key is committed. Publishing is irreversible: show me the exact list of what will become public and wait for my yes.

## Working rules

* Plan each goal before doing it and show me the plan; keep a task list.
* Measure before and after every optimisation and write the numbers into the docs; never claim faster without them.
* Never weaken Pterodactyl authorisation, never expose secrets, never push to `upstream`, never merge into `main`.
* Ask before: pushing, merging, deploying, changing DNS, creating cloud resources, opening ports, joining or removing NetBird peers,
  making a repository public, or anything that costs money.
* At the end of each goal give me a short report: what is done and verified, what is not, and the next step.

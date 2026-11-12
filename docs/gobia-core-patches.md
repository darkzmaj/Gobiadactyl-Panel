# Gobia core patches

Every modification Gobia makes to official Pterodactyl files outside Gobia owned paths (`extensions/gobia-*`, `public/gobia`, `tools/audit-probe`,
`scripts/gobia`, `docs/gobia-*`, `tests/Integration/Gobia`, `tests/Integration/Extensions/AuditProbeTest.php`, `CLAUDE.md`, `MAJCEK_HANDOFF.md`,
`vitest.gobia.config.ts`, `.oxlintrc.gobia.json`, `.github/workflows/gobia-ci.yaml`). Goal: keep this list tiny.

Baseline: upstream `2.0-develop` at `3d93cd07d605529a399438d32aa7a08a3e038d02` (synced 2026-11-12; the previous baseline was `240aaf62ea53b1d6956a643a872f44d2f5956031`).
`git diff 3d93cd07d -- app bootstrap config routes resources database` lists every core change below; nothing else may appear in it.

## The Gobia theme (2026-11-12 sync)

Upstream 2.0 now has a theme platform: a theme is an extension of `"type": "theme"` with tokens and CSS, skins for the UI kit, and **views** for layouts and
pages (`packages/sdk/THEMES.md`). That was the removal path of most visual patches, so the Gobia look is now `extensions/gobia-theme`, activated with
`php artisan p:theme:activate gobia-theme`, and the core files it used to patch are upstream's again.

| In `extensions/gobia-theme` | Replaces the former core patch |
| --- | --- |
| `src/theme.css` (tokens, fonts) and `src/gobia.css` (the gb-* component layer). It does not import `@pterodactyl/sdk/theme-entry.css`, which would rebuild the whole panel stylesheet the panel already loads (75 KB instead of 173 KB); every utility class the views use must be in `@pterodactyl/sdk/core-classes.txt` | `themes/gobia/tokens.css` and `p:theme:apply gobia`, the `resources/gobia/gobia.css` import in `resources/scripts/index.tsx` |
| `src/skins.ts` (sentence case and medium corners for buttons, labels, card titles; no page footer) | `components/elements/Button.tsx`, `Label.tsx`, `PageContentBlock.tsx` (footer), `form/controls.tsx`, `ui/*`, `typography.ts`, `ContentBox.tsx`, `TitledGreyBox.tsx` and the other primitive class patches |
| `src/views/Shell.tsx` (`layout.app`: top bar, area sidebar with the fixed admin groups, user menu, footer), `ServerCard.tsx` (switcher and status dots), `UserMenu.tsx` | `router/layouts/AuthenticatedLayout.tsx`, `AdminLayout.tsx`, `ServerLayout.tsx`, `resources/scripts/gobia/shell/*`, the admin navigation entries and labels removed in `router/routeTree.ts` |
| `src/views/AccountLayout.tsx` (`layout.account`), `AccountSecurity.tsx` (`page.account.overview`) | `router/layouts/AccountLayout.tsx`, `dashboard/AccountOverviewContainer.tsx` |
| `src/views/auth/AuthLayout.tsx` (`layout.auth`), `auth/pages.tsx` (`page.auth.*`) | `router/layouts/AuthLayout.tsx`, `components/auth/*Container.tsx`, `LoginFormContainer.tsx` |
| `src/views/Footer.tsx`, theme settings (Admin, Themes, Gobia, Footer and Sidebar) | The gobia.cloud footer: now the copyright line and the sponsor, and the sidebar card, all editable or hideable |
| `src/views/ServerSftp.tsx` (`server.sftp`), `StartupImage.tsx` (`server.startup.image`) | The labelled SFTP fields and Docker image select of the former core settings and startup pages (axe) |
| The `--terminal-*` tokens in `src/theme.css` | Console selection in Gobia blue, the blue prompt and muted status lines (the console reads tokens as solid colours, so none is transparent) |
| `src/views/SettingsTabs.tsx` (over `page.server.settings` and `page.server.startup`) | `components/server/settings/SettingsContainer.tsx`, `ServerSettingsTabs.tsx`, `startup/StartupContainer.tsx` |
| The scheme switch (`model.setScheme`, the `pterodactyl_scheme` cookie) | the inline scheme script in `resources/views/templates/wrapper.blade.php` and gobia-core's class toggling |

Upstream also replaced "replaceable components" with view overrides, so the `dashboard.page` patch (componentTypes, manifest name lists, testing
fixtures) is gone: `gobia-core` overrides `page.dashboard`, `gobia-files` overrides `server.files.manager` and `server.files.editor` (`ui.views` and
`views.override`). The Gobia brand images moved from `themes/gobia/assets/img` (published by the old theme command) to the tracked `public/gobia/img`.

## Permanent patches

| File | Purpose | Why the extension API cannot support it | Upstream conflict risk | Tests | Removal path |
| --- | --- | --- | --- | --- | --- |
| `.gitignore` | Track `extensions/gobia-*` (upstream ignores the whole `extensions/` directory as local checkouts) | Repository layout, not an extension concern | Low (two lines) | CI builds from tracked files | Move Gobia extensions to a separate repository and install them in the release build |
| `.github/workflows/*` (upstream `ci.yaml`, `docker.yaml`, `release.yaml`, `staging.yaml`, `build.yaml`, `react-doctor.yml`, and since the 2026-11-12 sync `install.yaml`, `docker-refresh.yaml`, `.github/dependabot.yaml` and `.github/scripts/archive.sh` deleted; `gobia-ci.yaml` added) | Upstream workflows publish to `ghcr.io/pterodactyl/panel` and dispatch staging; they must never run from the Gobia repository. `gobia-ci.yaml` runs the same checks as upstream's `ci.yaml` (lint job, pinned actions) plus the Gobia ones | CI is repository configuration | None (deleted files); re-check `ci.yaml` on every sync | n/a | Keep deleted |
| `router/routeTree.ts`, `sdk/navigation.tsx` (path types) | Server `users` and `users/new` redirect to Account, Access; `network` opens `ports` and `startup` opens `settings/startup` in place (`redirectServerTo`); Settings sends a startup-only person to Startup | Routes and their addresses are core | Medium (the server route list changes upstream) | `scripts/gobia/nav-flows.mjs`, `access:` flows | Keep |
| `components/admin/servers/ServersContainer.tsx` | Admin "Servers" is "Instances" (page heading) | Admin pages are not views | Low (two strings) | none | Keep |
| `components/admin/AdminTabs.tsx` (new), `AdminContentBlock.tsx`, `settings/SettingsContainer.tsx`, `settings/SettingsTabButton.tsx` (deleted) | Tabs that merge Nodes and Instances, Eggs and Mounts and the Settings sections (upstream's logo card kept in General); the heading comes from the tab group. Without a router (component specs) the block falls back to the plain upstream heading | Admin pages are core routes, not views | Low to medium | `admin:` flows, egg and theme specs | Keep |
| `components/admin/overview/OverviewContainer.tsx`, `RecentActivity.tsx` (new) | Gobia overview: statistics from the gobia-core slot, the admin activity log (upstream's `activity.log` view) below; no stock version card or link cards (updates are Gobia releases) | The overview page is core | Low | `admin:` flow | Keep |
| `components/server/WebsocketHandler.tsx`, `gobia/liveStats.ts` | One stats frame after the socket authenticates, and every `stats` event published as the `gobia:live-stats` window event for the theme's instance card | The server socket is core; the shell sits outside the server context | Low (two hunks) | `status:` flows | Upstream hook for socket events |
| `router/router.tsx`, `gobia/PageSkeleton.tsx` | No root view transition, pending time 0, the page skeleton as the pending component | Router options are core | Low | browser comparison | An upstream router option for the pending component |
| `app/Services/Extensions/ExtensionRepository.php` (`records()`, `clearErrors()`, `recordFailure()`) | The `extensions` table check is the failed select (SQLSTATE 42S02) instead of an `information_schema` query, and `clearErrors()` sends no query when the rows just read carry no error (on top of upstream's load phase rule). Boot queries per request: 3 before, 1 after (`docs/gobia-backend-performance.md`) | The extension loader is core | Low to medium | `tests/Unit/Services/Extensions`, `tests/Integration/Extensions`, `tests/Integration/Gobia` | Offer upstream |
| `bootstrap/app.php` (groups `admin-api`, `application-api`) | The administrator and application checks run before route model binding, so a caller without access cannot tell existing ids from missing ones (`docs/gobia-security-review.md`, finding 6) | Middleware groups are core | Low: two lines | `tests/Integration/Gobia/AdminEnumerationTest.php` | Offer upstream |
| `package.json`, `package-lock.json`, `packages/sdk/types/**` (regenerated) | `dev:gobia` and `test:gobia:browser` scripts, dev dependencies of the browser checks (`playwright-core`, `axe-core`, `pixelmatch`, `pngjs`) | Tooling | Low | `npm run sdk:check` | Keep |
| `resources/scripts/components/server/console/useConsoleSocketLogs.ts`, `views/server/console.ts` (fixtures) | The panel's prompt in the console is `panel@gobia~` in bold bright blue (the text an administrator sets in gobia-core, Branding, published as `data-gobia-console-prompt`, control characters dropped); Wings' status lines are muted (bright black); a repeated identical power state is printed once | The prompt and the line formatting live in the engine hook, not in a view | Low (one constant became a function, one handler) | `a11y` and `smoke` browser suites | An upstream option for the prompt |
| `resources/scripts/components/admin/AdminTabs.tsx` (Themes tab) | Admin, Themes is a tab of Settings, so the theme's settings are reachable without a sidebar entry | Admin pages are core routes | Low | admin flows | Keep with AdminTabs |
| `resources/scripts/components/Avatar.tsx` | A generated avatar without a title is `aria-hidden` (axe `svg-img-alt` on every page that shows one) | `Avatar` is replaceable, but a replacement would have to ship `boring-avatars` in the theme entry | Low (one prop) | `a11y` browser suite | Offer upstream |
| `public/favicon.ico` (new) | The Gobia icon for browsers and crawlers that ask for `/favicon.ico` without reading the page head. The head icons, web manifest and tile config are registered by gobia-core (`registerHeadTags`), which replaces every Pterodactyl icon element | Static file at the web root | None (new file) | `curl /favicon.ico` | Keep |
| `.gitattributes` (new) | `*.sh` and `deploy/linux/*` keep LF on a Windows checkout | Repository configuration | None | n/a | Keep |
| `deploy/linux/gobia-update-helper`, `scripts/release/*`, `.github/workflows/gobia-release.yaml` (new) | Privileged update helper, release packaging and signing | Deployment tooling | None | `tests/Integration/Gobia/UpdaterTest.php`, `docs/gobia-updater-e2e.md` | Keep |
| `services/mock-wings/server.mjs` | Pushes stats every second, dev only `mock-stats` endpoint | Development tool, never shipped | None | `status:` flows | Keep |

## Changed by the 2026-11-12 sync (check when touching these areas)

* **Removed, upstream has it now:** the five temporary pull request patches (7249 to 7253, all merged upstream); the `dashboard.page` component patch.
* **Taken from upstream, Gobia behaviour not re-applied:** the `Spinner` that rendered the page skeleton (the router still uses it as the pending component),
  the Tab trap in `components/elements/dialog/Dialog.tsx` (re-run the `keyboard` browser flow), the `relative` table scroll container in
  `DataTable.tsx` (re-run the responsive check at 390 and 430 px), the toast description colour in `AppToaster.tsx` and `aria-hidden` on `Avatar.tsx`
  (re-run axe). Where a check fails, fix it in the theme (skin or CSS) before reaching for core.
* **gobia-core:** upstream's subuser actions now write the `server:subuser.*` activity themselves, so Access no longer logs them a second time (the entries
  lose Gobia's `via: account` property). The username rule comes from `CreateUser::rules()`; the updater's finalize step activates `gobia-theme` through
  `ActivatesThemes` after republishing the extensions.
* **gobia-backups:** node tokens come from upstream's `NodeJwt::issue()` (the old `NodeJWTService` is gone).
* **Application API keys:** upstream's `AuthorizeExtensionApplicationRequest` lets an application key reach an extension endpoint only with read (GET) or
  write (anything else) on **every** resource. A key scoped to servers alone can no longer use the gobia-templates application API. Not weakened in core.
* **Lint:** upstream's `.oxlintrc.json` gained stricter rules; `scripts/gobia/run.mjs lint` checks the Gobia extensions with `.oxlintrc.gobia.json`
  (the previous rule set) until they are brought up to it.
* **Tests:** `ClientApiIntegrationTestCase` now wraps each test in a transaction instead of deleting every row afterwards. Extension migrations are DDL,
  which commits it, so `InstallsGobiaExtensions` opens a real transaction again after installing and rolls back before dropping its tables;
  `BuildsTemplates` uses `DatabaseTransactions` too, so the template and legacy import tests no longer leave rows behind. Upstream suites built on
  `IntegrationTestCase` still keep their rows, so the Gobia tests that count everything an administrator sees compare against what was there before.
  Fixed: `OffsiteBackupTest` "the schedule queues a backup" failed after the whole suite (Linux CI too) because rows other tests keep made the
  scheduler's server list longer than one, and strict mode refuses `node` lazy loaded from a list; the scheduler swallowed that as "cannot back
  up now". The scheduler now eager loads `node` and `transfer` (also one query per chunk instead of per server in production), and the test
  creates a second server so it fails without the fix.
* **Dependencies (2026-11-12):** `composer update "symfony/*" phpseclib/phpseclib -W` and `npm audit fix` cleared every Composer
  advisory (14, two high) and the high and moderate npm ones (`follow-redirects`, `seroval`) within the allowed ranges. Left for
  upstream: `i18next-http-backend` (low; needs a major upgrade; the language in its query string comes from the panel's own
  validated locale list).
* **Windows only:** upstream requires `ext-posix`; a Windows development checkout installs with `composer install --ignore-platform-req=ext-posix`.

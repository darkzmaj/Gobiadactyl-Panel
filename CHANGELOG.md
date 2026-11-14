# Changelog

Gobiadactyl Panel releases. Versions follow [Semantic Versioning](https://semver.org). Changes inherited from Pterodactyl are
listed in [Pterodactyl's changelog](https://github.com/pterodactyl/panel/blob/2.0-develop/CHANGELOG.md); each release below names
the upstream commit it is based on.

## Unreleased

### Added
* Panel time zone (Admin, Settings, Extensions, Gobia Core, Time): every time the panel shows (activity, schedules,
  backups, updates, templates) is shown in the chosen IANA zone instead of each browser's, and schedules run at its local
  time, also across daylight saving changes. Stored timestamps stay in `APP_TIMEZONE`, so changing it is safe at any time.

## 2.1.3 (2026-11-14)

Based on Pterodactyl `2.0-develop` at `3d93cd07d`.

### Security
* Templates: "From a server" no longer copies, and following servers are never sent, files that usually hold secrets
  (`config/paper-global.yml` with the Velocity forwarding secret, `forwarding.secret`, `*.secret`, `.env`). The list is
  `secret_files` in the gobia-templates configuration.

## 2.1.2 (2026-11-14)

Based on Pterodactyl `2.0-develop` at `3d93cd07d`.

### Added
* Following servers (hub sync): a template lists synced paths (Lifecycle tab, for example `plugins` and `config`; never
  worlds), and servers created from it can follow it (Instances tab). Each new published revision is rolled out to the
  following servers one at a time: only changed and new files under the synced paths are written and removed ones deleted,
  a running server is restarted and must report running again, and a server that fails gets its previous files back and
  stops the rollout. "Sync now" repeats a rollout. The template is the source of truth; servers never sync with each other.

### Fixed
* The browser tab on the sign-in pages showed "Pterodactyl"; it now shows the panel name (Gobia while the name is still
  upstream's default).

## 2.1.1 (2026-11-14)

Based on Pterodactyl `2.0-develop` at `3d93cd07d`.

### Added
* Templates can be created from a live server (Admin, Templates, From a server): software, image, startup, resources,
  variable values and a copy of its files, minus what you leave out. The new template is disabled and unpublished.
* Container installs (`GOBIA_UPDATE_RUNNER=image`, the default in the release image): the Updates screen reports and verifies
  the next signed release and explains that the update is deploying its image, instead of only saying "not ready".

### Security
* A file transfer with `resume` could overwrite existing files on the destination without `file.update`; it now needs it.
* Account, Access: granting access is limited to 10 requests a minute (each grant can create accounts and send mail).
* Offsite backups: server users see a generic failure message instead of the storage error, which could name the storage host.
* Account, Access no longer changes shares of suspended servers.

## 2.1.0 (2026-11-12)

Based on Pterodactyl `2.0-develop` at `3d93cd07d`.

### Added
* The Gobia look is now a theme extension (`gobia-theme`) on Pterodactyl's theme platform, activated by the update.
* Admin customisation of branding, footer, sidebar card and console prompt.
* Per person choice of file editor: the Gobia workspace or Legacy (the classic file pages with the Monaco editor).
* Resource protector: server creation and resource changes keep a safety reserve per node; the admin overview shows what is
  safe to allocate.
* Container image built only from a signed release package (`deploy/docker`).

### Fixed
* Scheduled offsite backups were skipped when several servers existed.

### Changed
* Releases come from `darkzmaj/Gobiadactyl-Panel` (formerly `Cryvex-Dev/panel.gobia.cloud`; the old address still redirects).

## 2.0.0 (2026-10-10)

First Gobia release on Pterodactyl 2.0: Gobia interface and navigation, instance list with views, categories and live status,
Monaco file workspace with dual server editing and verified transfers between servers, Access in one place, templates and
provisioning, offsite backups, and signed one click updates with preflight, database backup and automatic rollback.

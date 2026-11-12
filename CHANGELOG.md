# Changelog

Gobiadactyl Panel releases. Versions follow [Semantic Versioning](https://semver.org). Changes inherited from Pterodactyl are
listed in [Pterodactyl's changelog](https://github.com/pterodactyl/panel/blob/2.0-develop/CHANGELOG.md); each release below names
the upstream commit it is based on.

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

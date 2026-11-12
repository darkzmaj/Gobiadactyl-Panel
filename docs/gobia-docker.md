# Gobia Panel in a container (from a signed release)

`deploy/docker/` builds and runs Gobia Panel from a **signed release package**, never from a branch.

| File | Purpose |
| --- | --- |
| `Dockerfile.release` | Verifies the release manifest's Ed25519 signature (Gobia 2.0 release key by default, build argument `GOBIA_RELEASE_PUBLIC_KEY`) and the archive's signed SHA-256 and size, refuses any symbolic link, then unpacks it onto upstream's runtime layout (`.github/docker`: PHP 8.4 FPM, nginx, supervisord with the queue worker and the scheduler). OPcache timestamp checks are off and JIT is off. |
| `verify-release.php` | The build gate; uses `ReleaseSignature.php`, the same code the Panel's updater verifies with. |
| `build-image.sh <release dir> [name]` | Stages the release directory (`release.json`, `gobia-panel-<version>.tar.gz`) and builds `<name>:<version>`. |
| `compose.yml` | Panel, MariaDB 11.4 and Redis 7.4. Only the panel publishes a port, at `PANEL_BIND` (a private address, never `0.0.0.0`). |

## Run

```
deploy/docker/build-image.sh dist/2.1.0
cd deploy/docker   # with APP_URL, APP_KEY, HASHIDS_SALT, DB_PASSWORD, REDIS_PASSWORD, TRUSTED_PROXIES, PANEL_BIND set
docker compose up -d database cache
docker compose run --rm panel php artisan migrate --force --seed
docker compose run --rm panel php artisan p:extension:enable gobia-core
docker compose run --rm panel php artisan p:extension:enable gobia-theme
docker compose run --rm panel php artisan p:theme:activate gobia-theme
docker compose run --rm panel php artisan p:extension:enable gobia-files
docker compose run --rm panel php artisan p:extension:enable gobia-templates
docker compose up -d panel
```

`gobia-backups` stays off until an offsite destination exists (`docs/gobia-backups.md`).

## Updates

The code in the image is owned by root, so the in-place updater's permission preflight fails and the Update button stays unavailable
inside a container. An update is: build the image from the next signed release, run `php artisan migrate --force` with the new image,
then recreate the panel container. Back up the database volume first.

## Verified (2026-11-12, Docker 29.9 on Linux, release 2.1.0)

Healthy container, login page 200, theme and extension assets served from the persisted volume, hashed assets gzip compressed with a one
year cache, `opcache.validate_timestamps=0`, queue worker and cron running, the four Gobia extensions enabled and still enabled after a
restart. A manifest edited after signing and an archive with one extra byte both fail the build.

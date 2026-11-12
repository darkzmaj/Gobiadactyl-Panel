# Contributing

Thanks for helping with Gobiadactyl Panel. Bug reports and pull requests are welcome.

## Before you start

* Gobiadactyl is a fork of [Pterodactyl Panel](https://github.com/pterodactyl/panel) 2.0. If a bug also happens on an unmodified
  Pterodactyl panel, it belongs upstream.
* New features go into extensions (`extensions/gobia-*`, using Pterodactyl's extension SDK) rather than Pterodactyl's own files.
  When a core file really has to change, record it in [docs/gobia-core-patches.md](docs/gobia-core-patches.md) with the reason.
* Never weaken Pterodactyl's permission checks, and never commit secrets, `.env` files or keys.

## Pull requests

1. Branch from `main`.
2. Keep the change focused and match the surrounding code (React 19, TanStack, Tailwind 4, TypeScript; Laravel 13, Pest).
3. Run the checks: `npm run tsc`, `npm run lint`, `npm test`, `composer test`. CI runs the same on Linux and must pass.
4. Describe what changed and how you tested it.

## Security

Do not report security problems in public. See [SECURITY.md](SECURITY.md).

## AI assisted contributions

AI tools are fine, but you are responsible for the result: understand every change, test it, and write descriptions in your own
words.

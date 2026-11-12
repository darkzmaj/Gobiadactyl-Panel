# Gobia theme

The Gobia look on Pterodactyl's theme platform (`packages/sdk/THEMES.md`). Everything a view does not override stays classic and follows the tokens.

| File | What it is |
| --- | --- |
| `src/theme.css` | Fonts (Manrope, Space Grotesk, shipped in `src/fonts`) and the Gobia colour roles for `.light` and `.dark` |
| `src/gobia.css` | The gb-* component layer the shell and the Gobia extensions draw with |
| `src/skins.ts` | Sentence case and medium corners for buttons, labels and card titles; no page footer |
| `src/views/Shell.tsx` | `layout.app`: top bar, the sidebar of the area the user is in (the fixed admin groups, the instance card), user menu, footer |
| `src/views/ServerCard.tsx` | The instance card: status dots (live stats from the `gobia:live-stats` event) and the instance switcher |
| `src/views/AccountLayout.tsx`, `AccountSecurity.tsx` | The account menu in the Gobia order, and the overview as Security |
| `src/views/auth/*` | `layout.auth` (pitch, preview, logo) and the four sign-in pages |
| `src/views/SettingsTabs.tsx` | General and Startup tabs over the two server settings pages |

Build and activate from the panel root:

```sh
npm --prefix extensions/gobia-theme ci
npm --prefix extensions/gobia-theme run build
php artisan p:extension:enable gobia-theme
php artisan p:theme:activate gobia-theme
```

`npm run dev:gobia` rebuilds it on change. Tests: `npx vitest run --config extensions/gobia-theme/vitest.config.mjs`. What Gobia still keeps in core,
and why, is in `docs/gobia-core-patches.md`.

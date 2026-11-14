# What can be customised, and where

Everything below changes without a rebuild or a deploy.

## Administrators

| Where | Setting | Default |
| --- | --- | --- |
| Admin, Settings, Themes, Gobia, Settings, **Footer** | Show the copyright line; copyright text | on; `© 2026 Maj Kovačič. All Rights Reserved.` |
| same | Show the sponsor line; sponsor label, name and link (only `https://` or `http://` links are made clickable) | on; `Project Sponsored by:` `NCSE NETWORK`, `https://ncse.tw/zh/` |
| same, **Sidebar** | Show the card at the bottom of the sidebar; its title (empty uses the panel name), description and logo (empty uses the Gobia icon). In the admin area the card reads "Back to instances". | on; panel name; `Beyond The Clouds`; Gobia icon |
| Admin, Settings, Extensions, Gobia Core, **Branding** | Logo (top bar and sign-in page), favicon (browser tab; also replaces the `.ico`), console prompt | Gobia wordmark; Gobia icon; `panel@gobia~` |
| same, **Resources** | Resource protector on or off; reserve in percent (0 to 90) | off; 10 % |
| same, **Time** | Time zone (IANA, such as Europe/Ljubljana): every time the panel shows is in this zone, and schedules run at its local time across daylight saving changes. Stored times stay in `APP_TIMEZONE` | empty: each person's browser zone, schedules in `APP_TIMEZONE` |
| Admin, Settings, General | Panel name, and upstream's panel logo (used when gobia-core has no logo of its own) | |

**Resource protector.** The admin overview (Resources across all nodes) always shows what is safe to allocate: the total memory and
storage of all nodes, minus the reserve, minus what servers have allocated. With the protector switched on, creating a server or
growing one (admin, application API, templates) is refused when it would eat into the reserve; shrinking is always allowed.
Unlimited servers (0) allocate nothing, as in Pterodactyl itself. Concurrent requests are not serialised, so two creations at the
same moment can both pass; the reserve is a safety margin, not a hard quota.

## Every person

| Where | Setting |
| --- | --- |
| Account, Appearance | Colour scheme: System, Dark or Light (also in the profile menu); follows the person to every device |
| Account, Appearance, **File editor** | Gobia workspace (explorer, tabs, two servers, search and replace) or Legacy (the classic file list; files open on their own page in the same Monaco editor) |
| Account, Profile | Profile picture and username |

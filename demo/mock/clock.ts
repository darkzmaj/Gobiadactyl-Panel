// The demo's panel time zone: Admin, Settings, Extensions, Gobia Core, Time. Since 2.1.4 the panel shows every time in
// `SiteConfiguration.timezone` (demo/config.js sets it), so the demo only needs the value, plus this for its own console.
export const TIME_ZONE = 'Europe/Ljubljana';

/** The zone the panel currently shows times in: the setting, else the visitor's own (setting emptied in the demo). */
export function displayTimeZone(): string | undefined {
    return (window as unknown as { SiteConfiguration?: { timezone?: string | null } }).SiteConfiguration?.timezone || undefined;
}

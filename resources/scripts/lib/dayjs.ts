import base from 'dayjs';
import advancedFormat from 'dayjs/plugin/advancedFormat';
import relativeTime from 'dayjs/plugin/relativeTime';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';
import type { SiteSettings } from '@/api/settings/types';

// Import dayjs from this module so these plugins are registered.
base.extend(advancedFormat);
base.extend(relativeTime);
base.extend(utc);
base.extend(timezone);

/**
 * The time zone the panel shows times in: the one chosen in the admin settings (Gobia), else the browser's own.
 * Read on every call, so a page never needs a reload after the bootstrap data is in place.
 */
export function displayTimeZone(): string | null {
    // globalThis is window in the browser; outside it (tests, tooling) there is no bootstrap data and no zone.
    return (globalThis as { SiteConfiguration?: Partial<SiteSettings> }).SiteConfiguration?.timezone || null;
}

/** dayjs, but every date is shown in the panel's time zone when one is set. */
const dayjs = ((...args: Parameters<typeof base>) => {
    const value = base(...args);
    const zone = displayTimeZone();

    return zone && value.isValid() ? value.tz(zone) : value;
}) as typeof base;

Object.assign(dayjs, base);

export default dayjs;

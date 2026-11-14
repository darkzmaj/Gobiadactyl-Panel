import { afterEach, describe, expect, it } from 'vitest';
import dayjs, { displayTimeZone } from './dayjs';
import { formatDate } from './dates';

const site = globalThis as { SiteConfiguration?: { timezone?: string | null } };

describe('panel time zone', () => {
    afterEach(() => {
        delete site.SiteConfiguration;
    });

    it('keeps the browser time zone when none is configured', () => {
        expect(displayTimeZone()).toBeNull();
        expect(dayjs('2026-07-01T10:00:00Z').toISOString()).toBe('2026-07-01T10:00:00.000Z');
    });

    it('shows dates in the configured zone, daylight saving time included', () => {
        site.SiteConfiguration = { timezone: 'Europe/Ljubljana' };

        expect(formatDate('2026-07-01T10:00:00Z', 'YYYY-MM-DD HH:mm')).toBe('2026-07-01 12:00');
        expect(formatDate('2026-01-15T10:00:00Z', 'YYYY-MM-DD HH:mm')).toBe('2026-01-15 11:00');
    });
});

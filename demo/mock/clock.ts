// Every visitor sees the demo in Slovenian time (Europe/Ljubljana, CET/CEST), whatever their own time zone: the panel
// formats dates with dayjs and toLocaleString, which read the browser's local zone, so the local-time getters of Date
// and the default zone of Intl are pointed at Europe/Ljubljana before the app starts.
// shortcut: local-time setters and the Date(y, m, d) constructor still use the visitor's zone; the panel only formats
// and compares instants, so that is enough until a page builds dates from parts.
export const TIME_ZONE = 'Europe/Ljubljana';

const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TIME_ZONE,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
});

interface Wall {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    second: number;
}

function wall(time: number): Wall | null {
    if (!Number.isFinite(time)) return null;
    const out: Record<string, number> = {};
    for (const part of parts.formatToParts(new Date(time))) if (part.type !== 'literal') out[part.type] = Number(part.value);
    return { year: out.year, month: out.month - 1, day: out.day, hour: out.hour, minute: out.minute, second: out.second };
}

export function installClock() {
    const proto = Date.prototype;
    const getTime = proto.getTime;
    const read = (date: Date, pick: (w: Wall) => number) => {
        const w = wall(getTime.call(date));
        return w ? pick(w) : NaN;
    };
    const define = (name: string, value: (this: Date) => number) => Object.defineProperty(proto, name, { value, configurable: true, writable: true });
    define('getFullYear', function () { return read(this, (w) => w.year); });
    define('getMonth', function () { return read(this, (w) => w.month); });
    define('getDate', function () { return read(this, (w) => w.day); });
    define('getHours', function () { return read(this, (w) => w.hour); });
    define('getMinutes', function () { return read(this, (w) => w.minute); });
    define('getSeconds', function () { return read(this, (w) => w.second); });
    define('getDay', function () { return read(this, (w) => new Date(Date.UTC(w.year, w.month, w.day)).getUTCDay()); });
    define('getTimezoneOffset', function () {
        const time = getTime.call(this);
        const w = wall(time);
        if (!w) return NaN;
        const asUtc = Date.UTC(w.year, w.month, w.day, w.hour, w.minute, w.second);
        return Math.round((Math.floor(time / 1000) * 1000 - asUtc) / 60000);
    });

    // toLocaleString and friends, and any Intl.DateTimeFormat created without a zone, use Europe/Ljubljana too.
    const NativeFormat = Intl.DateTimeFormat;
    const withZone = (options?: Intl.DateTimeFormatOptions) => ({ ...options, timeZone: options?.timeZone ?? TIME_ZONE });
    const Format = function (this: unknown, locales?: string | string[], options?: Intl.DateTimeFormatOptions) {
        return new NativeFormat(locales, withZone(options));
    } as unknown as typeof Intl.DateTimeFormat;
    Format.prototype = NativeFormat.prototype;
    Format.supportedLocalesOf = NativeFormat.supportedLocalesOf;
    Intl.DateTimeFormat = Format;
    for (const name of ['toLocaleString', 'toLocaleDateString', 'toLocaleTimeString'] as const) {
        const native = proto[name];
        Object.defineProperty(proto, name, {
            value(this: Date, locales?: string | string[], options?: Intl.DateTimeFormatOptions) {
                return native.call(this, locales, withZone(options));
            },
            configurable: true,
            writable: true,
        });
    }
}

/** Self-check, run once at start: a winter and a summer instant must read as CET and CEST. */
export function checkClock() {
    const winter = new Date(Date.UTC(2026, 0, 15, 12, 0, 0));
    const summer = new Date(Date.UTC(2026, 6, 15, 12, 0, 0));
    const ok = winter.getHours() === 13 && winter.getTimezoneOffset() === -60 && summer.getHours() === 14 && summer.getTimezoneOffset() === -120;
    if (!ok) console.warn('[demo] clock is not on Europe/Ljubljana');
    return ok;
}

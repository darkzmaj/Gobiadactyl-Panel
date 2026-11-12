import { useSyncExternalStore } from 'react';

/** Published by the panel's server websocket (resources/scripts/gobia/liveStats.ts), with this detail. */
const LIVE_STATS_EVENT = 'gobia:live-stats';

export interface LiveStats {
    cpu: number;
    memory: number;
    disk: number;
}

interface LiveStatsDetail {
    uuid: string;
    stats: LiveStats;
}

let owner: string | null = null;
let current: LiveStats | null = null;
const listeners = new Set<() => void>();

window.addEventListener(LIVE_STATS_EVENT, (event) => {
    // Dispatched only by the panel's own websocket handler, which builds the detail from parsed stats.
    const { uuid, stats } = (event as CustomEvent<LiveStatsDetail>).detail;

    owner = uuid;
    current = stats;
    for (const listener of listeners) {
        listener();
    }
});

const subscribe = (listener: () => void) => {
    listeners.add(listener);

    return () => {
        listeners.delete(listener);
    };
};

/** The newest numbers of `uuid`, or null until some arrive (numbers of another server never show under this one). */
export const useLiveStats = (uuid: string): LiveStats | null =>
    useSyncExternalStore(
        subscribe,
        () => (owner === uuid ? current : null),
        () => null
    );

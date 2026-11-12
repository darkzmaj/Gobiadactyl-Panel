/**
 * Gobia: the numbers the server websocket pushes, published as a window event for the Gobia theme's instance card. A
 * theme cannot import panel code, and the card sits in the shell, outside the server's own context.
 */
export const LIVE_STATS_EVENT = 'gobia:live-stats';

export interface LiveStats {
    cpu: number;
    memory: number;
    disk: number;
}

export interface LiveStatsDetail {
    uuid: string;
    stats: LiveStats;
}

export function pushLiveStats(uuid: string, stats: LiveStats): void {
    window.dispatchEvent(new CustomEvent<LiveStatsDetail>(LIVE_STATS_EVENT, { detail: { uuid, stats } }));
}

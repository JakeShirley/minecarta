import type { WorldTime } from '@minecraft-map/shared';

/**
 * In-memory world time state service
 *
 * Stores the current Minecraft world time, synchronized from the behavior pack.
 * The time is periodically synced (about once per minute) to allow clients
 * to predict time between syncs.
 *
 * Minecraft time:
 * - 1 tick = 1/20 real-world second
 * - 1 day = 24000 ticks = 20 real-world minutes
 * - timeOfDay cycles 0-23999:
 *   - 0 = 6:00 AM (sunrise)
 *   - 6000 = noon
 *   - 12000 = 6:00 PM (sunset)
 *   - 18000 = midnight
 */
export class TimeStateService {
    private worldTime: WorldTime | null = null;
    private lastSyncTime: number = 0;

    /**
     * Update the world time from a sync message
     */
    updateTime(time: WorldTime): WorldTime {
        this.worldTime = time;
        this.lastSyncTime = Date.now();
        return time;
    }

    /**
     * Get the current world time
     */
    getTime(): WorldTime | null {
        return this.worldTime;
    }

    /**
     * Get the timestamp of the last sync
     */
    getLastSyncTime(): number {
        return this.lastSyncTime;
    }

    /**
     * Check if we have received a time sync
     */
    hasTime(): boolean {
        return this.worldTime !== null;
    }

    /**
     * Clear the time state
     */
    clear(): void {
        this.worldTime = null;
        this.lastSyncTime = 0;
    }
}

// Singleton instance
let _timeStateService: TimeStateService | null = null;

export function getTimeStateService(): TimeStateService {
    if (!_timeStateService) {
        _timeStateService = new TimeStateService();
    }
    return _timeStateService;
}

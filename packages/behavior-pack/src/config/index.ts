/**
 * Configuration for the behavior pack
 */
export interface Config {
    /** Base URL of the map server */
    readonly serverUrl: string;
    /** Authentication token for server communication */
    readonly authToken: string;
    /** Interval in ticks between player position updates (20 ticks = 1 second) */
    readonly playerUpdateInterval: number;
    /**
     * Interval in ticks between world time sync updates.
     * Default: 1200 ticks = 60 seconds (1 minute).
     * Time is also synced when a significant change is detected (e.g., /time set command).
     */
    readonly timeSyncInterval: number;
    /** Whether to enable debug logging */
    readonly debug: boolean;
    /**
     * Whether to send player stats (health, hunger, armor) with position updates.
     * Set to true to enable displaying player vitals on the web map.
     * Default: false (for privacy/performance reasons)
     */
    readonly sendPlayerStats: boolean;
}

/**
 * Default configuration values
 */
export const config: Config = {
    serverUrl: 'http://localhost:3000',
    authToken: 'dev-token',
    playerUpdateInterval: 20, // 1 second
    timeSyncInterval: 1200, // 60 seconds (1 minute)
    debug: true,
    sendPlayerStats: true, // Enable player stats by default for development
};

/**
 * Get the full API URL for an endpoint
 *
 * @param endpoint - The API endpoint path (e.g., '/api/v1/players')
 * @returns Full URL to the endpoint
 */
export function getApiUrl(endpoint: string): string {
    const base = config.serverUrl.replace(/\/$/, '');
    const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    return `${base}${path}`;
}


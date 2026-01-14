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
    /** Whether to enable debug logging */
    readonly debug: boolean;
}

/**
 * Default configuration values
 */
export const config: Config = {
    serverUrl: 'http://localhost:3000',
    authToken: 'dev-token',
    playerUpdateInterval: 20, // 1 second
    debug: true,
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

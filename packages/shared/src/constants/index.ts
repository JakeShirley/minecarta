/**
 * Protocol version for client-server communication.
 * Increment this when making breaking changes to the API or data formats.
 * Both the behavior pack and server should use the same protocol version.
 */
export const PROTOCOL_VERSION = '0.0.0-semantically-versioned';

/**
 * API version for endpoints
 */
export const API_VERSION = 'v1';

/**
 * API base path
 */
export const API_BASE_PATH = `/api/${API_VERSION}`;

/**
 * Default server port
 */
export const DEFAULT_PORT = 3000;

/**
 * Default server host
 */
export const DEFAULT_HOST = '0.0.0.0';

/**
 * Tile size in pixels
 */
export const TILE_SIZE = 256;

/**
 * Available zoom levels (0 = highest detail, most zoomed in)
 */
export const ZOOM_LEVELS = [0, 1, 2, 3, 4, 5, 6, 7] as const;
export type ZoomLevel = (typeof ZOOM_LEVELS)[number];

/**
 * Blocks per tile at each zoom level
 * - z0: 1 chunk = 1 tile, 16 blocks per tile (16x16 pixels per block)
 * - z1: 2x2 chunks = 1 tile, 32 blocks per tile (8x8 pixels per block)
 * - z2: 4x4 chunks = 1 tile, 64 blocks per tile (4x4 pixels per block)
 * - z3: 8x8 chunks = 1 tile, 128 blocks per tile (2x2 pixels per block)
 * - z4: 16x16 chunks = 1 tile, 256 blocks per tile (1 pixel per block)
 * - z5: 32x32 chunks = 1 tile, 512 blocks per tile (2 blocks per pixel)
 * - z6: 64x64 chunks = 1 tile, 1024 blocks per tile (4 blocks per pixel)
 * - z7: 128x128 chunks = 1 tile, 2048 blocks per tile (8 blocks per pixel)
 */
export const BLOCKS_PER_TILE: Record<ZoomLevel, number> = {
    0: 16,
    1: 32,
    2: 64,
    3: 128,
    4: 256,
    5: 512,
    6: 1024,
    7: 2048,
};

/**
 * Minecraft dimensions
 */
export const DIMENSIONS = ['overworld', 'nether', 'the_end'] as const;

/**
 * Map types for tile rendering
 */
export const MAP_TYPES = ['block', 'height'] as const;

/**
 * Authentication header name
 */
export const AUTH_HEADER = 'x-mc-auth-token';

/**
 * WebSocket events
 */
export const WS_EVENTS = {
    PLAYER_UPDATE: 'player:update',
    PLAYER_JOIN: 'player:join',
    PLAYER_LEAVE: 'player:leave',
    BLOCK_UPDATE: 'block:update',
    TILE_UPDATE: 'tile:update',
    CHAT_MESSAGE: 'chat:message',
    CHAT_HISTORY: 'chat:history',
    SPAWN_WORLD: 'spawn:world',
    SPAWN_PLAYER: 'spawn:player',
    SPAWN_STATE: 'spawn:state',
    TIME_UPDATE: 'time:update',
    TIME_STATE: 'time:state',
    WEATHER_UPDATE: 'weather:update',
    WEATHER_STATE: 'weather:state',
    QUEUE_STATUS: 'queue:status',
    STRUCTURE_UPDATE: 'structure:update',
    STRUCTURE_MERGED: 'structure:merged',
    STRUCTURE_STATE: 'structure:state',
} as const;

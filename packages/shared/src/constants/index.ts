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
 * - z0: 1 block = 1 pixel, 256 blocks per tile (highest detail)
 * - z1: 2 blocks = 1 pixel, 512 blocks per tile
 * - z2: 4 blocks = 1 pixel, 1024 blocks per tile
 * - z3: 8 blocks = 1 pixel, 2048 blocks per tile
 * - z4: 16 blocks = 1 pixel, 4096 blocks per tile
 * - z5: 32 blocks = 1 pixel, 8192 blocks per tile
 * - z6: 64 blocks = 1 pixel, 16384 blocks per tile
 * - z7: 128 blocks = 1 pixel, 32768 blocks per tile
 */
export const BLOCKS_PER_TILE: Record<ZoomLevel, number> = {
  0: 256,
  1: 512,
  2: 1024,
  3: 2048,
  4: 4096,
  5: 8192,
  6: 16384,
  7: 32768,
};

/**
 * Minecraft dimensions
 */
export const DIMENSIONS = ['overworld', 'nether', 'the_end'] as const;

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
} as const;

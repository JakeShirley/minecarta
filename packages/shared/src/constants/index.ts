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
 * - z0: 0.25 blocks = 1 pixel (4 pixels per block), 64 blocks per tile
 * - z1: 0.5 blocks = 1 pixel (2 pixels per block), 128 blocks per tile
 * - z2: 1 block = 1 pixel, 256 blocks per tile
 * - z3: 2 blocks = 1 pixel, 512 blocks per tile
 * - z4: 4 blocks = 1 pixel, 1024 blocks per tile
 * - z5: 8 blocks = 1 pixel, 2048 blocks per tile
 * - z6: 16 blocks = 1 pixel, 4096 blocks per tile
 * - z7: 32 blocks = 1 pixel, 8192 blocks per tile
 */
export const BLOCKS_PER_TILE: Record<ZoomLevel, number> = {
  0: 64,
  1: 128,
  2: 256,
  3: 512,
  4: 1024,
  5: 2048,
  6: 4096,
  7: 8192,
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

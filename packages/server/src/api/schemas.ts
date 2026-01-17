import { z } from 'zod';

/**
 * Player stats schema (health, hunger, armor)
 */
export const playerStatsSchema = z.object({
    health: z.number().min(0).max(100), // Allow absorption effects
    maxHealth: z.number().min(0).max(100),
    hunger: z.number().min(0).max(20),
    armor: z.number().min(0).max(20),
});

export type PlayerStatsRequest = z.infer<typeof playerStatsSchema>;

/**
 * Player update request schema
 */
export const playerUpdateSchema = z.object({
    name: z.string().min(1).max(32),
    x: z.number(),
    y: z.number(),
    z: z.number(),
    dimension: z.enum(['overworld', 'nether', 'the_end']),
    playfabId: z.string().optional(),
    stats: playerStatsSchema.optional(),
});

export type PlayerUpdateRequest = z.infer<typeof playerUpdateSchema>;

/**
 * Players batch update request schema
 */
export const playersBatchUpdateSchema = z.object({
    players: z.array(playerUpdateSchema),
});

export type PlayersBatchUpdateRequest = z.infer<typeof playersBatchUpdateSchema>;

/**
 * Player join notification schema
 */
export const playerJoinSchema = z.object({
    name: z.string().min(1).max(32),
    x: z.number(),
    y: z.number(),
    z: z.number(),
    dimension: z.enum(['overworld', 'nether', 'the_end']),
    playfabId: z.string().optional(),
    stats: playerStatsSchema.optional(),
});

export type PlayerJoinRequest = z.infer<typeof playerJoinSchema>;

/**
 * Player leave notification schema
 */
export const playerLeaveSchema = z.object({
    name: z.string().min(1).max(32),
});

export type PlayerLeaveRequest = z.infer<typeof playerLeaveSchema>;

/**
 * Block change request schema
 */
export const blockChangeSchema = z.object({
    dimension: z.enum(['overworld', 'nether', 'the_end']),
    x: z.number().int(),
    y: z.number().int(),
    z: z.number().int(),
    blockType: z.string().min(1),
    previousType: z.string().optional(),
    player: z.string().optional(),
    timestamp: z.number().default(() => Date.now()),
});

export type BlockChangeRequest = z.infer<typeof blockChangeSchema>;

/**
 * Blocks batch update request schema
 */
export const blocksBatchUpdateSchema = z.object({
    blocks: z.array(blockChangeSchema),
});

export type BlocksBatchUpdateRequest = z.infer<typeof blocksBatchUpdateSchema>;

/**
 * Entity update request schema
 */
export const entityUpdateSchema = z.object({
    id: z.string().min(1),
    type: z.string().min(1),
    x: z.number(),
    y: z.number(),
    z: z.number(),
    dimension: z.enum(['overworld', 'nether', 'the_end']),
});

export type EntityUpdateRequest = z.infer<typeof entityUpdateSchema>;

/**
 * Entities batch update request schema
 */
export const entitiesBatchUpdateSchema = z.object({
    entities: z.array(entityUpdateSchema),
});

export type EntitiesBatchUpdateRequest = z.infer<typeof entitiesBatchUpdateSchema>;

/**
 * RGBA color schema
 */
export const rgbaSchema = z.object({
    r: z.number().int().min(0).max(255),
    g: z.number().int().min(0).max(255),
    b: z.number().int().min(0).max(255),
    a: z.number().int().min(0).max(255),
});

/**
 * Chunk block schema
 */
export const chunkBlockSchema = z.object({
    x: z.number().int(),
    y: z.number().int(),
    z: z.number().int(),
    type: z.string().min(1),
    mapColor: rgbaSchema,
    waterDepth: z.number().int().min(1).optional(),
});

/**
 * Chunk data request schema
 */
export const chunkDataSchema = z.object({
    dimension: z.enum(['overworld', 'nether', 'the_end']),
    chunkX: z.number().int(),
    chunkZ: z.number().int(),
    blocks: z.array(chunkBlockSchema),
});

export type ChunkDataRequest = z.infer<typeof chunkDataSchema>;

/**
 * Chunks batch update request schema
 */
export const chunksBatchUpdateSchema = z.object({
    chunks: z.array(chunkDataSchema),
});

export type ChunksBatchUpdateRequest = z.infer<typeof chunksBatchUpdateSchema>;

/**
 * Chat message request schema
 */
export const chatMessageSchema = z.object({
    playerName: z.string().min(1).max(32),
    message: z.string().min(1).max(500),
    dimension: z.enum(['overworld', 'nether', 'the_end']),
    timestamp: z.number().default(() => Date.now()),
});

export type ChatMessageRequest = z.infer<typeof chatMessageSchema>;

/**
 * Chunk existence check request schema
 */
export const chunkExistsQuerySchema = z.object({
    dimension: z.enum(['overworld', 'nether', 'the_end']),
    chunkX: z.coerce.number().int(),
    chunkZ: z.coerce.number().int(),
});

export type ChunkExistsQuery = z.infer<typeof chunkExistsQuerySchema>;

/**
 * Dimension parameter schema
 */
export const dimensionParamSchema = z.object({
    dimension: z.enum(['overworld', 'nether', 'the_end']).optional(),
});

/**
 * World spawn update request schema
 */
export const worldSpawnSchema = z.object({
    x: z.number(),
    y: z.number(),
    z: z.number(),
    dimension: z.enum(['overworld', 'nether', 'the_end']),
});

export type WorldSpawnRequest = z.infer<typeof worldSpawnSchema>;

/**
 * Player spawn update request schema
 */
export const playerSpawnSchema = z.object({
    playerName: z.string().min(1).max(32),
    x: z.number(),
    y: z.number(),
    z: z.number(),
    dimension: z.enum(['overworld', 'nether', 'the_end']),
});

export type PlayerSpawnRequest = z.infer<typeof playerSpawnSchema>;

/**
 * World time update request schema
 *
 * Minecraft time:
 * - timeOfDay: 0-23999 ticks (0 = 6:00 AM sunrise)
 * - absoluteTime: Total ticks since world creation
 * - day: Current day number (0-based)
 */
export const worldTimeSchema = z.object({
    timeOfDay: z.number().int().min(0).max(23999),
    absoluteTime: z.number().int().min(0),
    day: z.number().int().min(0),
});

export type WorldTimeRequest = z.infer<typeof worldTimeSchema>;

/**
 * World weather update request schema
 *
 * Weather types:
 * - Clear: No precipitation, clear skies
 * - Rain: Raining (or snowing in cold biomes)
 * - Thunder: Thunderstorm with lightning
 */
export const worldWeatherSchema = z.object({
    weather: z.enum(['Clear', 'Rain', 'Thunder']),
    dimension: z.enum(['overworld', 'nether', 'the_end']),
});

export type WorldWeatherRequest = z.infer<typeof worldWeatherSchema>;

/**
 * Client connect request schema
 *
 * Sent by the behavior pack when it first connects to establish
 * version compatibility and log any version mismatches.
 */
export const clientConnectSchema = z.object({
    protocolVersion: z.string().min(1),
});

export type ClientConnectRequest = z.infer<typeof clientConnectSchema>;

/**
 * Chunk queue status request schema
 *
 * Sent periodically by the behavior pack to report queue processing status.
 */
export const queueStatusSchema = z.object({
    queueSize: z.number().int().min(0),
    completedCount: z.number().int().min(0),
    totalCount: z.number().int().min(0),
    completionPercent: z.number().int().min(0).max(100),
    etaMs: z.number().int().min(0).nullable(),
    avgJobTimeMs: z.number().int().min(0).nullable(),
    isProcessing: z.boolean(),
});

export type QueueStatusRequest = z.infer<typeof queueStatusSchema>;

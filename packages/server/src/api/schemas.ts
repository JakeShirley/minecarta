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

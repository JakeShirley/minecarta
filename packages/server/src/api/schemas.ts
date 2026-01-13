import { z } from 'zod';

/**
 * Player update request schema
 */
export const playerUpdateSchema = z.object({
  name: z.string().min(1).max(32),
  x: z.number(),
  y: z.number(),
  z: z.number(),
  dimension: z.enum(['overworld', 'nether', 'the_end']),
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
  timestamp: z.number().optional(),
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
 * Chunk block schema
 */
export const chunkBlockSchema = z.object({
  x: z.number().int(),
  y: z.number().int(),
  z: z.number().int(),
  type: z.string().min(1),
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
 * Dimension parameter schema
 */
export const dimensionParamSchema = z.object({
  dimension: z.enum(['overworld', 'nether', 'the_end']).optional(),
});

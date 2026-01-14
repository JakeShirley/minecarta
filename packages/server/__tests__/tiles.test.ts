import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BlockColorService, HelperColor } from '../src/tiles/block-colors.js';
import { TileGeneratorService } from '../src/tiles/tile-generator.js';
import { TileUpdateService } from '../src/services/tile-update.js'; // This assumes internal access or I should export it from tile-update directly
import { TileStorageService } from '../src/tiles/tile-storage.js';
import type { ChunkData, ChunkBlock } from '@minecraft-map/shared';
import sharp from 'sharp';

// Mocks
vi.mock('../src/tiles/tile-storage.js', () => {
  const mockStorage = {
    blockToTile: vi.fn(),
    readTile: vi.fn(),
    writeTile: vi.fn(),
  };
  return {
    TileStorageService: vi.fn(() => mockStorage),
    getTileStorageService: vi.fn(() => mockStorage),
  };
});

describe('BlockColorService', () => {
  it('should return correct color for known block', () => {
    const service = new BlockColorService();
    const color = service.getColor('minecraft:grass_block');
    expect(color).toEqual({ r: 124, g: 189, b: 107 });
  });

  it('should handle block names without namespace', () => {
    const service = new BlockColorService();
    const color = service.getColor('stone');
    expect(color).toEqual({ r: 125, g: 125, b: 125 });
  });

  it('should return fallback for unknown block', () => {
    const service = new BlockColorService();
    const color = service.getColor('unknown_block');
    expect(color).toEqual({ r: 255, g: 0, b: 255, a: 255 });
  });
});

describe('TileGeneratorService', () => {
  it('should generate a tile buffer from blocks', async () => {
    const service = new TileGeneratorService();
    // At zoom 0, tile (0,0) covers blocks 0-15 (one chunk)
    const blocks: ChunkBlock[] = [
      { x: 0, y: 64, z: 0, type: 'minecraft:stone' },
      { x: 15, y: 64, z: 15, type: 'minecraft:grass_block' },
    ];
    
    const buffer = await service.generateTile(blocks, { dimension: 'overworld', zoom: 0, x: 0, z: 0 });
    
    expect(buffer).toBeDefined();
    expect(Buffer.isBuffer(buffer)).toBe(true);
    
    // Check image dimensions using sharp
    const metadata = await sharp(buffer).metadata();
    expect(metadata.width).toBe(256);
    expect(metadata.height).toBe(256);
    expect(metadata.channels).toBe(4);
  });

  it('should preserve existing pixels when baseImage is provided', async () => {
    const service = new TileGeneratorService();
    
    // Create a base image (red pixel at 0,0)
    const basePixelData = new Uint8ClampedArray(256 * 256 * 4);
    basePixelData[0] = 255; // R
    basePixelData[3] = 255; // A
    
    const baseImage = await sharp(basePixelData, {
      raw: { width: 256, height: 256, channels: 4 }
    }).png().toBuffer();

    // Add water block at position (1, 1)
    // At zoom 0: 16 blocks per 256 pixels = 16 pixels per block
    // So block (1, 1) renders to pixels (16, 16) through (31, 31)
    const blocks: ChunkBlock[] = [
      { x: 1, y: 64, z: 1, type: 'minecraft:water' } 
    ];
    
    const buffer = await service.generateTile(blocks, { dimension: 'overworld', zoom: 0, x: 0, z: 0 }, baseImage);
    
    const { data } = await sharp(buffer).raw().toBuffer({ resolveWithObject: true });
    
    // Check 0,0 is red (preserved)
    expect(data[0]).toBe(255);
    expect(data[1]).toBe(0);
    expect(data[2]).toBe(0);
    
    // Check pixel (16, 16) is water blue (added) - block (1,1) maps to pixels starting at (16,16)
    const idx = (16 * 256 + 16) * 4;
    expect(data[idx]).toBe(63); // Water R
    expect(data[idx + 1]).toBe(118); // Water G
    expect(data[idx + 2]).toBe(228); // Water B
  });
});

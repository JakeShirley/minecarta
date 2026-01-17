import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TileGeneratorService } from '../src/tiles/tile-generator.js';
import { TileUpdateService } from '../src/services/tile-update.js'; // This assumes internal access or I should export it from tile-update directly
import { TileStorageService } from '../src/tiles/tile-storage.js';
import type { ChunkData, ChunkBlock, RGBA } from '@minecarta/shared';
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

// Helper function to create a color
function color(r: number, g: number, b: number, a = 255): RGBA {
    return { r, g, b, a };
}

// Standard test colors
const GRASS_COLOR = color(124, 189, 107);
const STONE_COLOR = color(125, 125, 125);
const WATER_COLOR = color(63, 118, 228);

describe('TileGeneratorService', () => {
    it('should generate a tile buffer from blocks', async () => {
        const service = new TileGeneratorService();
        // At zoom 0, tile (0,0) covers blocks 0-15 (one chunk)
        const blocks: ChunkBlock[] = [
            { x: 0, y: 64, z: 0, type: 'minecraft:stone', mapColor: STONE_COLOR },
            { x: 15, y: 64, z: 15, type: 'minecraft:grass_block', mapColor: GRASS_COLOR },
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

    it('should render blocks at correct pixel positions with shading', async () => {
        const service = new TileGeneratorService();

        // Single block at z=0
        const blocks: ChunkBlock[] = [{ x: 0, y: 64, z: 0, type: 'minecraft:stone', mapColor: STONE_COLOR }];

        const buffer = await service.generateTile(blocks, { dimension: 'overworld', zoom: 0, x: 0, z: 0 });
        const { data } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

        // Block at z=0, x=0 should render at pixel (0, 0) with a 16x16 square
        // Since no block to the north, NORMAL shade (220/255) is applied
        const expectedR = Math.floor((STONE_COLOR.r * 220) / 255);
        const expectedG = Math.floor((STONE_COLOR.g * 220) / 255);
        const expectedB = Math.floor((STONE_COLOR.b * 220) / 255);

        // Check pixel at (0, 0)
        expect(data[0]).toBe(expectedR);
        expect(data[1]).toBe(expectedG);
        expect(data[2]).toBe(expectedB);
        expect(data[3]).toBe(255);

        // Check pixel at (15, 15) - still within the block's 16x16 square
        const idx15 = (15 * 256 + 15) * 4;
        expect(data[idx15]).toBe(expectedR);
        expect(data[idx15 + 1]).toBe(expectedG);
        expect(data[idx15 + 2]).toBe(expectedB);

        // Check pixel at (16, 16) - should be transparent (outside the block)
        const idx16 = (16 * 256 + 16) * 4;
        expect(data[idx16]).toBe(0);
        expect(data[idx16 + 3]).toBe(0); // Alpha should be 0
    });

    it('should render block at z=1 at correct pixel position', async () => {
        const service = new TileGeneratorService();

        // Block at z=1 should render at pixel y=16
        const blocks: ChunkBlock[] = [{ x: 0, y: 64, z: 1, type: 'minecraft:stone', mapColor: STONE_COLOR }];

        const buffer = await service.generateTile(blocks, { dimension: 'overworld', zoom: 0, x: 0, z: 0 });
        const { data } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

        // Block at z=1 renders at pixel row 16 (y=16)
        // NORMAL shade since no north neighbor
        const expectedR = Math.floor((STONE_COLOR.r * 220) / 255);

        // Pixel at (0, 16) should have the stone color
        const idx = (16 * 256 + 0) * 4;
        expect(data[idx]).toBe(expectedR);
        expect(data[idx + 3]).toBe(255);

        // Pixel at (0, 0) should be transparent - block at z=0 was not added
        expect(data[0]).toBe(0);
        expect(data[3]).toBe(0);
    });

    it('should preserve existing pixels when baseImage is provided', async () => {
        const service = new TileGeneratorService();

        // Create a base image (red pixel at 0,0)
        const basePixelData = new Uint8ClampedArray(256 * 256 * 4);
        basePixelData[0] = 255; // R
        basePixelData[3] = 255; // A

        const baseImage = await sharp(basePixelData, {
            raw: { width: 256, height: 256, channels: 4 },
        })
            .png()
            .toBuffer();

        // Add water block at position (1, 1)
        // At zoom 0: 16 blocks per 256 pixels = 16 pixels per block
        // So block (1, 1) renders to pixels (16, 16) through (31, 31)
        // With no block to the north, NORMAL shade (220/255) is applied
        const blocks: ChunkBlock[] = [{ x: 1, y: 64, z: 1, type: 'minecraft:water', mapColor: WATER_COLOR }];

        const buffer = await service.generateTile(blocks, { dimension: 'overworld', zoom: 0, x: 0, z: 0 }, baseImage);

        const { data } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

        // Check 0,0 is red (preserved)
        expect(data[0]).toBe(255);
        expect(data[1]).toBe(0);
        expect(data[2]).toBe(0);

        // Check pixel (16, 16) is water blue with NORMAL shade applied (220/255 multiplier)
        // Since there's no block to the north, normal shade is used
        const idx = (16 * 256 + 16) * 4;
        expect(data[idx]).toBe(Math.floor((63 * 220) / 255)); // Water R with normal shade
        expect(data[idx + 1]).toBe(Math.floor((118 * 220) / 255)); // Water G with normal shade
        expect(data[idx + 2]).toBe(Math.floor((228 * 220) / 255)); // Water B with normal shade
    });

    describe('Minecraft map height-based shading', () => {
        it('should apply BRIGHTER shade when block is higher than block to the north', async () => {
            const service = new TileGeneratorService();

            // Block at z=1 is higher (y=70) than block at z=0 (y=64)
            // The block at z=1 should be BRIGHTER (multiplier 255/255 = 1.0)
            const blocks: ChunkBlock[] = [
                { x: 0, y: 64, z: 0, type: 'minecraft:stone', mapColor: STONE_COLOR },
                { x: 0, y: 70, z: 1, type: 'minecraft:stone', mapColor: STONE_COLOR },
            ];

            const buffer = await service.generateTile(blocks, { dimension: 'overworld', zoom: 0, x: 0, z: 0 });
            const { data } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

            // Block at z=1 maps to pixel row 16 (z * 16 = 1 * 16)
            const idxZ1 = (16 * 256 + 0) * 4;

            // BRIGHTER shade: multiply by 255/255 = 1.0 (no change)
            expect(data[idxZ1]).toBe(Math.floor(STONE_COLOR.r * 1.0));
            expect(data[idxZ1 + 1]).toBe(Math.floor(STONE_COLOR.g * 1.0));
            expect(data[idxZ1 + 2]).toBe(Math.floor(STONE_COLOR.b * 1.0));
        });

        it('should apply NORMAL shade when block is same height as block to the north', async () => {
            const service = new TileGeneratorService();

            // Both blocks at same height (y=64)
            // The block at z=1 should have NORMAL shade (multiplier 220/255)
            const blocks: ChunkBlock[] = [
                { x: 0, y: 64, z: 0, type: 'minecraft:stone', mapColor: STONE_COLOR },
                { x: 0, y: 64, z: 1, type: 'minecraft:stone', mapColor: STONE_COLOR },
            ];

            const buffer = await service.generateTile(blocks, { dimension: 'overworld', zoom: 0, x: 0, z: 0 });
            const { data } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

            // Block at z=1 maps to pixel row 16
            const idxZ1 = (16 * 256 + 0) * 4;

            // NORMAL shade: multiply by 220/255 ≈ 0.86
            expect(data[idxZ1]).toBe(Math.floor((STONE_COLOR.r * 220) / 255));
            expect(data[idxZ1 + 1]).toBe(Math.floor((STONE_COLOR.g * 220) / 255));
            expect(data[idxZ1 + 2]).toBe(Math.floor((STONE_COLOR.b * 220) / 255));
        });

        it('should apply DARKER shade when block is lower than block to the north', async () => {
            const service = new TileGeneratorService();

            // Block at z=1 is lower (y=60) than block at z=0 (y=64)
            // The block at z=1 should be DARKER (multiplier 180/255)
            const blocks: ChunkBlock[] = [
                { x: 0, y: 64, z: 0, type: 'minecraft:stone', mapColor: STONE_COLOR },
                { x: 0, y: 60, z: 1, type: 'minecraft:stone', mapColor: STONE_COLOR },
            ];

            const buffer = await service.generateTile(blocks, { dimension: 'overworld', zoom: 0, x: 0, z: 0 });
            const { data } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

            // Block at z=1 maps to pixel row 16
            const idxZ1 = (16 * 256 + 0) * 4;

            // DARKER shade: multiply by 180/255 ≈ 0.71
            expect(data[idxZ1]).toBe(Math.floor((STONE_COLOR.r * 180) / 255));
            expect(data[idxZ1 + 1]).toBe(Math.floor((STONE_COLOR.g * 180) / 255));
            expect(data[idxZ1 + 2]).toBe(Math.floor((STONE_COLOR.b * 180) / 255));
        });

        it('should apply NORMAL shade when no block exists to the north', async () => {
            const service = new TileGeneratorService();

            // Single block with no block to the north
            // Should use NORMAL shade (multiplier 220/255)
            const blocks: ChunkBlock[] = [{ x: 0, y: 64, z: 0, type: 'minecraft:stone', mapColor: STONE_COLOR }];

            const buffer = await service.generateTile(blocks, { dimension: 'overworld', zoom: 0, x: 0, z: 0 });
            const { data } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

            // Block at z=0 maps to pixel row 0
            const idxZ0 = (0 * 256 + 0) * 4;

            // NORMAL shade: multiply by 220/255 (no north neighbor)
            expect(data[idxZ0]).toBe(Math.floor((STONE_COLOR.r * 220) / 255));
            expect(data[idxZ0 + 1]).toBe(Math.floor((STONE_COLOR.g * 220) / 255));
            expect(data[idxZ0 + 2]).toBe(Math.floor((STONE_COLOR.b * 220) / 255));
        });

        it('should create visual terrain effect with multiple height levels', async () => {
            const service = new TileGeneratorService();

            // Simulate a hill going from z=0 to z=3
            // Heights: 60 -> 64 -> 68 -> 64 (up then down)
            const blocks: ChunkBlock[] = [
                { x: 0, y: 60, z: 0, type: 'minecraft:grass_block', mapColor: GRASS_COLOR },
                { x: 0, y: 64, z: 1, type: 'minecraft:grass_block', mapColor: GRASS_COLOR }, // Higher = BRIGHTER
                { x: 0, y: 68, z: 2, type: 'minecraft:grass_block', mapColor: GRASS_COLOR }, // Higher = BRIGHTER
                { x: 0, y: 64, z: 3, type: 'minecraft:grass_block', mapColor: GRASS_COLOR }, // Lower = DARKER
            ];

            const buffer = await service.generateTile(blocks, { dimension: 'overworld', zoom: 0, x: 0, z: 0 });
            const { data } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

            // z=0: No north neighbor, NORMAL shade
            const idxZ0 = (0 * 256 + 0) * 4;
            expect(data[idxZ0]).toBe(Math.floor((GRASS_COLOR.r * 220) / 255));

            // z=1: Higher than z=0, BRIGHTER shade
            const idxZ1 = (16 * 256 + 0) * 4;
            expect(data[idxZ1]).toBe(Math.floor((GRASS_COLOR.r * 255) / 255));

            // z=2: Higher than z=1, BRIGHTER shade
            const idxZ2 = (32 * 256 + 0) * 4;
            expect(data[idxZ2]).toBe(Math.floor((GRASS_COLOR.r * 255) / 255));

            // z=3: Lower than z=2, DARKER shade
            const idxZ3 = (48 * 256 + 0) * 4;
            expect(data[idxZ3]).toBe(Math.floor((GRASS_COLOR.r * 180) / 255));
        });
    });

    describe('Water depth-based checkerboard shading', () => {
        it('should apply BRIGHTER shade for shallow water (depth 1-2)', async () => {
            const service = new TileGeneratorService();

            // Shallow water at depth 1
            const blocks: ChunkBlock[] = [
                { x: 0, y: 62, z: 0, type: 'minecraft:water', mapColor: WATER_COLOR, waterDepth: 1 },
                { x: 1, y: 62, z: 0, type: 'minecraft:water', mapColor: WATER_COLOR, waterDepth: 2 },
            ];

            const buffer = await service.generateTile(blocks, { dimension: 'overworld', zoom: 0, x: 0, z: 0 });
            const { data } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

            // Both should have BRIGHTER shade (255/255)
            const idx0 = (0 * 256 + 0) * 4;
            const idx1 = (0 * 256 + 16) * 4; // x=1 maps to pixel 16

            expect(data[idx0]).toBe(Math.floor((WATER_COLOR.r * 255) / 255));
            expect(data[idx1]).toBe(Math.floor((WATER_COLOR.r * 255) / 255));
        });

        it('should apply checkerboard pattern for depth 3-4 (bright/normal)', async () => {
            const service = new TileGeneratorService();

            // Water at depth 3 - checkerboard pattern
            // (x + z) % 2 == 1 -> BRIGHTER, otherwise NORMAL
            const blocks: ChunkBlock[] = [
                { x: 0, y: 62, z: 0, type: 'minecraft:water', mapColor: WATER_COLOR, waterDepth: 3 }, // (0+0)%2=0 -> NORMAL
                { x: 1, y: 62, z: 0, type: 'minecraft:water', mapColor: WATER_COLOR, waterDepth: 3 }, // (1+0)%2=1 -> BRIGHTER
                { x: 0, y: 62, z: 1, type: 'minecraft:water', mapColor: WATER_COLOR, waterDepth: 4 }, // (0+1)%2=1 -> BRIGHTER
                { x: 1, y: 62, z: 1, type: 'minecraft:water', mapColor: WATER_COLOR, waterDepth: 4 }, // (1+1)%2=0 -> NORMAL
            ];

            const buffer = await service.generateTile(blocks, { dimension: 'overworld', zoom: 0, x: 0, z: 0 });
            const { data } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

            // Check the pattern
            const idx00 = (0 * 256 + 0) * 4; // x=0, z=0 -> NORMAL
            const idx10 = (0 * 256 + 16) * 4; // x=1, z=0 -> BRIGHTER
            const idx01 = (16 * 256 + 0) * 4; // x=0, z=1 -> BRIGHTER
            const idx11 = (16 * 256 + 16) * 4; // x=1, z=1 -> NORMAL

            expect(data[idx00]).toBe(Math.floor((WATER_COLOR.r * 220) / 255)); // NORMAL
            expect(data[idx10]).toBe(Math.floor((WATER_COLOR.r * 255) / 255)); // BRIGHTER
            expect(data[idx01]).toBe(Math.floor((WATER_COLOR.r * 255) / 255)); // BRIGHTER
            expect(data[idx11]).toBe(Math.floor((WATER_COLOR.r * 220) / 255)); // NORMAL
        });

        it('should apply NORMAL shade for medium depth water (depth 5-7)', async () => {
            const service = new TileGeneratorService();

            const blocks: ChunkBlock[] = [
                { x: 0, y: 62, z: 0, type: 'minecraft:water', mapColor: WATER_COLOR, waterDepth: 5 },
                { x: 1, y: 62, z: 0, type: 'minecraft:water', mapColor: WATER_COLOR, waterDepth: 7 },
            ];

            const buffer = await service.generateTile(blocks, { dimension: 'overworld', zoom: 0, x: 0, z: 0 });
            const { data } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

            // Both should have NORMAL shade (220/255)
            const idx0 = (0 * 256 + 0) * 4;
            const idx1 = (0 * 256 + 16) * 4;

            expect(data[idx0]).toBe(Math.floor((WATER_COLOR.r * 220) / 255));
            expect(data[idx1]).toBe(Math.floor((WATER_COLOR.r * 220) / 255));
        });

        it('should apply checkerboard pattern for depth 8-11 (normal/dark)', async () => {
            const service = new TileGeneratorService();

            // Water at depth 8 - checkerboard pattern
            // (x + z) % 2 == 1 -> NORMAL, otherwise DARKER
            const blocks: ChunkBlock[] = [
                { x: 0, y: 62, z: 0, type: 'minecraft:water', mapColor: WATER_COLOR, waterDepth: 8 }, // (0+0)%2=0 -> DARKER
                { x: 1, y: 62, z: 0, type: 'minecraft:water', mapColor: WATER_COLOR, waterDepth: 10 }, // (1+0)%2=1 -> NORMAL
            ];

            const buffer = await service.generateTile(blocks, { dimension: 'overworld', zoom: 0, x: 0, z: 0 });
            const { data } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

            const idx0 = (0 * 256 + 0) * 4;
            const idx1 = (0 * 256 + 16) * 4;

            expect(data[idx0]).toBe(Math.floor((WATER_COLOR.r * 180) / 255)); // DARKER
            expect(data[idx1]).toBe(Math.floor((WATER_COLOR.r * 220) / 255)); // NORMAL
        });

        it('should apply DARKER shade for deep water (depth 12+)', async () => {
            const service = new TileGeneratorService();

            const blocks: ChunkBlock[] = [
                { x: 0, y: 62, z: 0, type: 'minecraft:water', mapColor: WATER_COLOR, waterDepth: 12 },
                { x: 1, y: 62, z: 0, type: 'minecraft:water', mapColor: WATER_COLOR, waterDepth: 20 },
            ];

            const buffer = await service.generateTile(blocks, { dimension: 'overworld', zoom: 0, x: 0, z: 0 });
            const { data } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

            // Both should have DARKER shade (180/255)
            const idx0 = (0 * 256 + 0) * 4;
            const idx1 = (0 * 256 + 16) * 4;

            expect(data[idx0]).toBe(Math.floor((WATER_COLOR.r * 180) / 255));
            expect(data[idx1]).toBe(Math.floor((WATER_COLOR.r * 180) / 255));
        });
    });

    describe('Height map generation', () => {
        it('should generate a grayscale tile based on Y values', async () => {
            const service = new TileGeneratorService();

            // Block at y=64 should map to a mid-gray value
            // Height range: -64 to 320 (384 total)
            // y=64 is at position (64 - (-64)) / 384 = 128/384 ≈ 0.333
            // Grayscale: 0.333 * 255 ≈ 85
            const blocks: ChunkBlock[] = [{ x: 0, y: 64, z: 0, type: 'minecraft:stone', mapColor: STONE_COLOR }];

            const buffer = await service.generateTile(
                blocks,
                { dimension: 'overworld', zoom: 0, x: 0, z: 0 },
                undefined,
                'height'
            );

            expect(buffer).toBeDefined();
            expect(Buffer.isBuffer(buffer)).toBe(true);

            const { data } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

            // Check that pixel at (0,0) has grayscale value
            const expectedGray = Math.floor(((64 - -64) / (320 - -64)) * 255);
            expect(data[0]).toBe(expectedGray); // R
            expect(data[1]).toBe(expectedGray); // G
            expect(data[2]).toBe(expectedGray); // B
            expect(data[3]).toBe(255); // A (fully opaque)
        });

        it('should render darker for lower Y values', async () => {
            const service = new TileGeneratorService();

            // Block at y=-64 (minimum) should be black
            const blocks: ChunkBlock[] = [{ x: 0, y: -64, z: 0, type: 'minecraft:bedrock', mapColor: STONE_COLOR }];

            const buffer = await service.generateTile(
                blocks,
                { dimension: 'overworld', zoom: 0, x: 0, z: 0 },
                undefined,
                'height'
            );

            const { data } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

            // y=-64 maps to gray value 0 (black)
            expect(data[0]).toBe(0);
            expect(data[1]).toBe(0);
            expect(data[2]).toBe(0);
            expect(data[3]).toBe(255);
        });

        it('should render brighter for higher Y values', async () => {
            const service = new TileGeneratorService();

            // Block at y=320 (maximum) should be white
            const blocks: ChunkBlock[] = [{ x: 0, y: 320, z: 0, type: 'minecraft:air', mapColor: STONE_COLOR }];

            const buffer = await service.generateTile(
                blocks,
                { dimension: 'overworld', zoom: 0, x: 0, z: 0 },
                undefined,
                'height'
            );

            const { data } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

            // y=320 maps to gray value 255 (white)
            expect(data[0]).toBe(255);
            expect(data[1]).toBe(255);
            expect(data[2]).toBe(255);
            expect(data[3]).toBe(255);
        });

        it('should only use the highest block at each position for height map', async () => {
            const service = new TileGeneratorService();

            // Two blocks at same x,z but different y - only highest should be used
            const blocks: ChunkBlock[] = [
                { x: 0, y: 64, z: 0, type: 'minecraft:stone', mapColor: STONE_COLOR },
                { x: 0, y: 128, z: 0, type: 'minecraft:grass_block', mapColor: GRASS_COLOR },
            ];

            const buffer = await service.generateTile(
                blocks,
                { dimension: 'overworld', zoom: 0, x: 0, z: 0 },
                undefined,
                'height'
            );

            const { data } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

            // Should use y=128, not y=64
            const expectedGray = Math.floor(((128 - -64) / (320 - -64)) * 255);
            expect(data[0]).toBe(expectedGray);
        });

        it('should clamp Y values to the configured range', async () => {
            const service = new TileGeneratorService();

            // Block at y=500 (above max) should clamp to white
            const blocks: ChunkBlock[] = [{ x: 0, y: 500, z: 0, type: 'minecraft:air', mapColor: STONE_COLOR }];

            const buffer = await service.generateTile(
                blocks,
                { dimension: 'overworld', zoom: 0, x: 0, z: 0 },
                undefined,
                'height'
            );

            const { data } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

            // y=500 should clamp to 320 and map to 255 (white)
            expect(data[0]).toBe(255);
            expect(data[1]).toBe(255);
            expect(data[2]).toBe(255);
        });
    });

    describe('compositeChildTiles (pyramid generation)', () => {
        it('should composite 4 child tiles into a parent tile', async () => {
            const service = new TileGeneratorService();

            // Create 4 solid-color child tiles (256x256 each)
            const redTile = await sharp({
                create: { width: 256, height: 256, channels: 4, background: { r: 255, g: 0, b: 0, alpha: 255 } },
            })
                .png()
                .toBuffer();

            const greenTile = await sharp({
                create: { width: 256, height: 256, channels: 4, background: { r: 0, g: 255, b: 0, alpha: 255 } },
            })
                .png()
                .toBuffer();

            const blueTile = await sharp({
                create: { width: 256, height: 256, channels: 4, background: { r: 0, g: 0, b: 255, alpha: 255 } },
            })
                .png()
                .toBuffer();

            const yellowTile = await sharp({
                create: { width: 256, height: 256, channels: 4, background: { r: 255, g: 255, b: 0, alpha: 255 } },
            })
                .png()
                .toBuffer();

            // Composite: [topLeft=red, topRight=green, bottomLeft=blue, bottomRight=yellow]
            const result = await service.compositeChildTiles([redTile, greenTile, blueTile, yellowTile]);

            expect(result).toBeDefined();
            expect(Buffer.isBuffer(result)).toBe(true);

            // Verify the output is 256x256
            const metadata = await sharp(result).metadata();
            expect(metadata.width).toBe(256);
            expect(metadata.height).toBe(256);

            // Read pixel data to verify quadrants
            const { data } = await sharp(result).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

            // Top-left (0,0) should be red
            const topLeftIdx = (0 * 256 + 0) * 4;
            expect(data[topLeftIdx]).toBe(255); // R
            expect(data[topLeftIdx + 1]).toBe(0); // G
            expect(data[topLeftIdx + 2]).toBe(0); // B

            // Top-right (128,0) should be green
            const topRightIdx = (0 * 256 + 128) * 4;
            expect(data[topRightIdx]).toBe(0); // R
            expect(data[topRightIdx + 1]).toBe(255); // G
            expect(data[topRightIdx + 2]).toBe(0); // B

            // Bottom-left (0,128) should be blue
            const bottomLeftIdx = (128 * 256 + 0) * 4;
            expect(data[bottomLeftIdx]).toBe(0); // R
            expect(data[bottomLeftIdx + 1]).toBe(0); // G
            expect(data[bottomLeftIdx + 2]).toBe(255); // B

            // Bottom-right (128,128) should be yellow
            const bottomRightIdx = (128 * 256 + 128) * 4;
            expect(data[bottomRightIdx]).toBe(255); // R
            expect(data[bottomRightIdx + 1]).toBe(255); // G
            expect(data[bottomRightIdx + 2]).toBe(0); // B
        });

        it('should handle missing child tiles gracefully', async () => {
            const service = new TileGeneratorService();

            // Create only one tile (red for top-left)
            const redTile = await sharp({
                create: { width: 256, height: 256, channels: 4, background: { r: 255, g: 0, b: 0, alpha: 255 } },
            })
                .png()
                .toBuffer();

            // Pass null for missing tiles
            const result = await service.compositeChildTiles([redTile, null, null, null]);

            expect(result).toBeDefined();
            expect(Buffer.isBuffer(result)).toBe(true);

            const { data } = await sharp(result).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

            // Top-left (0,0) should be red
            const topLeftIdx = (0 * 256 + 0) * 4;
            expect(data[topLeftIdx]).toBe(255); // R
            expect(data[topLeftIdx + 1]).toBe(0); // G
            expect(data[topLeftIdx + 2]).toBe(0); // B
            expect(data[topLeftIdx + 3]).toBe(255); // A

            // Top-right (128,0) should be transparent
            const topRightIdx = (0 * 256 + 128) * 4;
            expect(data[topRightIdx + 3]).toBe(0); // A should be 0
        });

        it('should return transparent tile when all children are null', async () => {
            const service = new TileGeneratorService();

            const result = await service.compositeChildTiles([null, null, null, null]);

            expect(result).toBeDefined();
            expect(Buffer.isBuffer(result)).toBe(true);

            const { data } = await sharp(result).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

            // All pixels should be transparent
            expect(data[3]).toBe(0); // Alpha of first pixel
        });
    });
});

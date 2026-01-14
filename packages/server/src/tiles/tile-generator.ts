import sharp from 'sharp';
import { TILE_SIZE, BLOCKS_PER_TILE } from '@minecraft-map/shared';
import type { ZoomLevel, TileCoordinates, ChunkBlock } from '@minecraft-map/shared';

/**
 * Service for generating map tiles from block data
 */
export class TileGeneratorService {
  /**
   * Generate a PNG tile from block data
   * 
   * @param blocks Array of blocks that fall within this tile's area
   * @param coords The coordinates of the tile being generated
   * @param baseImage Optional buffer of the existing tile image to update
   */
  async generateTile(
    blocks: ChunkBlock[],
    coords: TileCoordinates,
    baseImage?: Buffer
  ): Promise<Buffer> {
    const { zoom, x: tileX, z: tileZ } = coords;
    
    // Create distinct pixel buffer (RGBA)
    let pixelData: Uint8ClampedArray;
    
    if (baseImage) {
      // If we have a base image, load it and get raw pixel data
      const { data, info } = await sharp(baseImage)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
        
      if (info.width !== TILE_SIZE || info.height !== TILE_SIZE) {
        // Warning: dimension mismatch, falling back to empty
        pixelData = new Uint8ClampedArray(TILE_SIZE * TILE_SIZE * 4);
        pixelData.fill(0);
      } else {
        pixelData = new Uint8ClampedArray(data);
      }
    } else {
      // Initialize with transparent black
      pixelData = new Uint8ClampedArray(TILE_SIZE * TILE_SIZE * 4);
      pixelData.fill(0);
    }
    
    const blockStartX = tileX * BLOCKS_PER_TILE[zoom as ZoomLevel];
    const blockStartZ = tileZ * BLOCKS_PER_TILE[zoom as ZoomLevel];
    
    // Scale factor: blocks per pixel
    // At zoom 0: 16 blocks / 256 pixels = 0.0625 blocks per pixel (16x16 pixels per block)
    // At zoom 4: 256 blocks / 256 pixels = 1 block per pixel
    // At zoom 7: 2048 blocks / 256 pixels = 8 blocks per pixel
    const scale = BLOCKS_PER_TILE[zoom as ZoomLevel] / TILE_SIZE;
    
    // Pixels per block (inverse of scale, used when scale < 1)
    const pixelsPerBlock = Math.floor(1 / scale);

    // We process blocks and draw them to the buffer
    for (const block of blocks) {
      // Calculate relative position within the tile
      const relX = block.x - blockStartX;
      const relZ = block.z - blockStartZ;
      
      // Skip if outside tile bounds
      if (
        relX < 0 || 
        relZ < 0 || 
        relX >= BLOCKS_PER_TILE[zoom as ZoomLevel] || 
        relZ >= BLOCKS_PER_TILE[zoom as ZoomLevel]
      ) {
        continue;
      }
      
      // Use mapColor from block data if provided, otherwise fall back to lookup
      const color = block.mapColor;
      if (color == null) {
        console.error(`[TileGenerator] Missing map color for block at (${block.x}, ${block.z}) of type ${block.type}`);
        continue;
      }
      
      if (scale >= 1) {
        // Multiple blocks per pixel - draw single pixel
        const px = Math.floor(relX / scale);
        const py = Math.floor(relZ / scale); // Z maps to Y in image space
        
        // Calculate buffer index
        const idx = (py * TILE_SIZE + px) * 4;
        
        // Simple overwrite (no blending yet)
        pixelData[idx] = color.r;
        pixelData[idx + 1] = color.g;
        pixelData[idx + 2] = color.b;
        pixelData[idx + 3] = 255; // Hard code to fully opaque for now
      } else {
        // Each block is multiple pixels - draw a square
        const startPx = relX * pixelsPerBlock;
        const startPy = relZ * pixelsPerBlock; // Z maps to Y in image space
        
        // Draw a pixelsPerBlock x pixelsPerBlock square for each block
        for (let dy = 0; dy < pixelsPerBlock; dy++) {
          for (let dx = 0; dx < pixelsPerBlock; dx++) {
            const px = startPx + dx;
            const py = startPy + dy;
            
            // Safety check (should not be needed if math is correct)
            if (px >= TILE_SIZE || py >= TILE_SIZE) continue;
            
            const idx = (py * TILE_SIZE + px) * 4;
            
            pixelData[idx] = color.r;
            pixelData[idx + 1] = color.g;
            pixelData[idx + 2] = color.b;
            pixelData[idx + 3] = 255; // Hard code to fully opaque for now
          }
        }
      }
    }

    // Generate PNG using Sharp
    return sharp(pixelData, {
      raw: {
        width: TILE_SIZE,
        height: TILE_SIZE,
        channels: 4
      }
    })
    .png()
    .toBuffer();
  }
}

// Singleton instance
let _tileGeneratorService: TileGeneratorService | null = null;

export function getTileGeneratorService(): TileGeneratorService {
  if (!_tileGeneratorService) {
    _tileGeneratorService = new TileGeneratorService();
  }
  return _tileGeneratorService;
}

#!/usr/bin/env npx tsx
/**
 * Clear all tile data from disk
 *
 * Usage: pnpm clear-tiles
 */

import { TileStorageService } from '../src/tiles/tile-storage.js';

console.log('🗑️  Clearing all tile data...');

const tileStorage = new TileStorageService();
tileStorage.clearAllTiles();

console.log('✅ Tile data cleared successfully!');

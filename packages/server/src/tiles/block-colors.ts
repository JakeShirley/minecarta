/**
 * Block color definitions and mapping service
 */

export interface HelperColor {
  r: number;
  g: number;
  b: number;
  a?: number;
}

// Default fallback color (magenta to indicate missing texture/color)
const DEFAULT_COLOR: HelperColor = { r: 255, g: 0, b: 255, a: 255 };

// Common block colors
const BLOCK_COLORS: Record<string, HelperColor> = {
  // Natural materials
  'minecraft:air': { r: 0, g: 0, b: 0, a: 0 },
  'minecraft:stone': { r: 125, g: 125, b: 125 },
  'minecraft:granite': { r: 149, g: 108, b: 93 },
  'minecraft:polished_granite': { r: 153, g: 113, b: 98 },
  'minecraft:diorite': { r: 188, g: 188, b: 188 },
  'minecraft:polished_diorite': { r: 198, g: 198, b: 198 },
  'minecraft:andesite': { r: 134, g: 134, b: 134 },
  'minecraft:polished_andesite': { r: 136, g: 136, b: 136 },
  'minecraft:grass_block': { r: 124, g: 189, b: 107 }, // Temperate biome green
  'minecraft:dirt': { r: 150, g: 108, b: 74 },
  'minecraft:coarse_dirt': { r: 119, g: 85, b: 59 },
  'minecraft:podzol': { r: 90, g: 63, b: 42 },
  'minecraft:cobblestone': { r: 127, g: 127, b: 127 },
  'minecraft:oak_planks': { r: 162, g: 130, b: 78 },
  'minecraft:spruce_planks': { r: 114, g: 84, b: 56 },
  'minecraft:birch_planks': { r: 192, g: 175, b: 121 },
  'minecraft:jungle_planks': { r: 151, g: 109, b: 77 },
  'minecraft:acacia_planks': { r: 168, g: 90, b: 50 },
  'minecraft:dark_oak_planks': { r: 66, g: 43, b: 20 },
  'minecraft:mangrove_planks': { r: 118, g: 54, b: 49 },
  'minecraft:cherry_planks': { r: 224, g: 187, b: 186 },
  'minecraft:bamboo_planks': { r: 219, g: 192, b: 84 },
  'minecraft:bedrock': { r: 83, g: 83, b: 83 },
  'minecraft:water': { r: 63, g: 118, b: 228 },
  'minecraft:lava': { r: 207, g: 16, b: 32 },
  'minecraft:sand': { r: 219, g: 211, b: 160 },
  'minecraft:red_sand': { r: 169, g: 88, b: 33 },
  'minecraft:gravel': { r: 136, g: 128, b: 128 },
  'minecraft:gold_ore': { r: 252, g: 238, b: 75 },
  'minecraft:iron_ore': { r: 216, g: 175, b: 147 },
  'minecraft:coal_ore': { r: 111, g: 111, b: 111 },
  'minecraft:nether_gold_ore': { r: 252, g: 238, b: 75 },
  'minecraft:oak_log': { r: 58, g: 35, b: 20 }, // Top texture approximate
  'minecraft:spruce_log': { r: 35, g: 22, b: 14 },
  'minecraft:birch_log': { r: 215, g: 213, b: 205 },
  'minecraft:jungle_log': { r: 86, g: 75, b: 28 },
  'minecraft:acacia_log': { r: 104, g: 96, b: 87 },
  'minecraft:dark_oak_log': { r: 37, g: 27, b: 19 },
  'minecraft:stripped_oak_log': { r: 174, g: 137, b: 89 },
  'minecraft:leaves': { r: 72, g: 181, b: 24 }, // Generic leaves
  'minecraft:oak_leaves': { r: 72, g: 181, b: 24 },
  'minecraft:spruce_leaves': { r: 97, g: 153, b: 97 },
  'minecraft:birch_leaves': { r: 128, g: 167, b: 85 },
  'minecraft:jungle_leaves': { r: 72, g: 181, b: 24 }, // Often dynamic
  'minecraft:acacia_leaves': { r: 72, g: 181, b: 24 },
  'minecraft:dark_oak_leaves': { r: 72, g: 181, b: 24 },
  'minecraft:sponge': { r: 205, g: 192, b: 75 },
  'minecraft:wet_sponge': { r: 171, g: 160, b: 59 },
  'minecraft:glass': { r: 255, g: 255, b: 255, a: 40 }, // Transparent
  'minecraft:lapis_ore': { r: 82, g: 99, b: 156 },
  'minecraft:lapis_block': { r: 30, g: 67, b: 140 },
  'minecraft:dispenser': { r: 104, g: 104, b: 104 },
  'minecraft:sandstone': { r: 216, g: 203, b: 155 },
  'minecraft:chiseled_sandstone': { r: 216, g: 203, b: 155 },
  'minecraft:cut_sandstone': { r: 216, g: 203, b: 155 },
  'minecraft:note_block': { r: 92, g: 59, b: 35 },
  'minecraft:white_wool': { r: 233, g: 236, b: 236 },
  'minecraft:orange_wool': { r: 240, g: 118, b: 19 },
  'minecraft:magenta_wool': { r: 189, g: 68, b: 179 },
  'minecraft:light_blue_wool': { r: 58, g: 175, b: 217 },
  'minecraft:yellow_wool': { r: 248, g: 198, b: 39 },
  'minecraft:lime_wool': { r: 112, g: 185, b: 25 },
  'minecraft:pink_wool': { r: 237, g: 141, b: 172 },
  'minecraft:gray_wool': { r: 62, g: 68, b: 71 },
  'minecraft:light_gray_wool': { r: 142, g: 142, b: 134 },
  'minecraft:cyan_wool': { r: 21, g: 137, b: 145 },
  'minecraft:purple_wool': { r: 121, g: 42, b: 172 },
  'minecraft:blue_wool': { r: 53, g: 57, b: 157 },
  'minecraft:brown_wool': { r: 114, g: 71, b: 40 },
  'minecraft:green_wool': { r: 84, g: 109, b: 27 },
  'minecraft:red_wool': { r: 161, g: 39, b: 34 },
  'minecraft:black_wool': { r: 20, g: 21, b: 25 },
  'minecraft:gold_block': { r: 246, g: 208, b: 61 },
  'minecraft:iron_block': { r: 220, g: 220, b: 220 },
  'minecraft:bricks': { r: 144, g: 65, b: 54 },
  'minecraft:tnt': { r: 219, g: 68, b: 58 },
  'minecraft:bookshelf': { r: 119, g: 87, b: 51 },
  'minecraft:mossy_cobblestone': { r: 105, g: 117, b: 99 },
  'minecraft:obsidian': { r: 20, g: 18, b: 29 },
  'minecraft:torch': { r: 255, g: 255, b: 0, a: 0 }, // Often handled specially or ignored
  'minecraft:fire': { r: 224, g: 153, b: 67 },
  'minecraft:chest': { r: 147, g: 113, b: 62 },
  'minecraft:diamond_ore': { r: 94, g: 222, b: 222 },
  'minecraft:diamond_block': { r: 99, g: 224, b: 214 },
  'minecraft:crafting_table': { r: 162, g: 130, b: 78 },
  'minecraft:wheat': { r: 220, g: 187, b: 84 },
  'minecraft:farmland': { r: 150, g: 108, b: 74 },
  'minecraft:furnace': { r: 104, g: 104, b: 104 },
  'minecraft:ladder': { r: 255, g: 255, b: 255, a: 0 }, // Transparent-ish
  'minecraft:snow': { r: 239, g: 251, b: 251 },
  'minecraft:ice': { r: 144, g: 174, b: 253, a: 160 },
  'minecraft:snow_block': { r: 239, g: 251, b: 251 },
  'minecraft:cactus': { r: 87, g: 130, b: 39 },
  'minecraft:clay': { r: 160, g: 166, b: 179 },
  'minecraft:netherrack': { r: 111, g: 54, b: 52 },
  'minecraft:soul_sand': { r: 81, g: 64, b: 56 },
  'minecraft:glowstone': { r: 247, g: 225, b: 136 },
  'minecraft:portal': { r: 180, g: 100, b: 236, a: 180 },

  // Add more as needed
};

/**
 * Service for mapping blocks to colors
 */
export class BlockColorService {
  private customColors: Map<string, HelperColor> = new Map();

  /**
   * Get the color for a block type
   */
  getColor(blockType: string): HelperColor {
    // Normalize string (remove namespace if only provided as 'stone')
    const type = blockType.includes(':') ? blockType : `minecraft:${blockType}`;
    
    // Check known mappings
    if (BLOCK_COLORS[type]) {
      return BLOCK_COLORS[type];
    }
    
    // Check custom mappings
    if (this.customColors.has(type)) {
      return this.customColors.get(type)!;
    }

    // Attempt to guess or return fallback
    // For now, return a debug pink to highlight missing colors
    return DEFAULT_COLOR;
  }

  /**
   * Register a custom color override
   */
  registerColor(blockType: string, color: HelperColor): void {
    const type = blockType.includes(':') ? blockType : `minecraft:${blockType}`;
    this.customColors.set(type, color);
  }
}

// Singleton instance
let _blockColorService: BlockColorService | null = null;

export function getBlockColorService(): BlockColorService {
  if (!_blockColorService) {
    _blockColorService = new BlockColorService();
  }
  return _blockColorService;
}

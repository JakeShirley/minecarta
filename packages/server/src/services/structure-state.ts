import { promises as fs } from 'fs';
import path from 'path';
import type { Structure, Dimension } from '@minecarta/shared';
import { logDebug, logInfo, logWarning, logError } from '../logging/index.js';

/**
 * Logging tag for this module
 */
const LOG_TAG = 'StructureState';

/**
 * Result of adding a structure to the service
 */
export interface AddStructureResult {
    /** The structure that was added or the result of merging */
    structure: Structure;
    /** Whether this was a merge operation (true) or a new addition (false) */
    merged: boolean;
    /** If merged, the original structure that was replaced */
    replacedStructure?: Structure;
}

/**
 * Default data directory for structure storage
 */
const DEFAULT_DATA_DIR = './data/structures';

/**
 * Check if two bounding boxes overlap.
 */
function extentsOverlap(
    a: { minX: number; maxX: number; minZ: number; maxZ: number },
    b: { minX: number; maxX: number; minZ: number; maxZ: number }
): boolean {
    // Two rectangles don't overlap if one is entirely to the left, right, above, or below the other
    if (a.maxX < b.minX || b.maxX < a.minX) return false;
    if (a.maxZ < b.minZ || b.maxZ < a.minZ) return false;
    return true;
}

/**
 * Check if two bounding boxes are directly adjacent (touching edges).
 * Adjacent means one edge ends where another begins (e.g., maxX + 1 === minX).
 */
function extentsAdjacent(
    a: { minX: number; maxX: number; minZ: number; maxZ: number },
    b: { minX: number; maxX: number; minZ: number; maxZ: number }
): boolean {
    // Check if Z ranges overlap or are adjacent (required for X adjacency to matter)
    const zOverlapOrAdjacent = !(a.maxZ + 1 < b.minZ || b.maxZ + 1 < a.minZ);
    // Check if X ranges overlap or are adjacent (required for Z adjacency to matter)
    const xOverlapOrAdjacent = !(a.maxX + 1 < b.minX || b.maxX + 1 < a.minX);

    // Adjacent on X axis (one's maxX + 1 === other's minX) and Z ranges overlap/touch
    const adjacentOnX = (a.maxX + 1 === b.minX || b.maxX + 1 === a.minX) && zOverlapOrAdjacent;
    // Adjacent on Z axis (one's maxZ + 1 === other's minZ) and X ranges overlap/touch
    const adjacentOnZ = (a.maxZ + 1 === b.minZ || b.maxZ + 1 === a.minZ) && xOverlapOrAdjacent;

    return adjacentOnX || adjacentOnZ;
}

/**
 * Check if two bounding boxes overlap or are directly adjacent.
 */
function extentsOverlapOrAdjacent(
    a: { minX: number; maxX: number; minZ: number; maxZ: number },
    b: { minX: number; maxX: number; minZ: number; maxZ: number }
): boolean {
    return extentsOverlap(a, b) || extentsAdjacent(a, b);
}

/**
 * Merge two extents into a single bounding box that contains both.
 */
function mergeExtents(
    a: { minX: number; maxX: number; minZ: number; maxZ: number },
    b: { minX: number; maxX: number; minZ: number; maxZ: number }
): { minX: number; maxX: number; minZ: number; maxZ: number } {
    return {
        minX: Math.min(a.minX, b.minX),
        maxX: Math.max(a.maxX, b.maxX),
        minZ: Math.min(a.minZ, b.minZ),
        maxZ: Math.max(a.maxZ, b.maxZ),
    };
}

/**
 * Structure state service for managing discovered structures.
 *
 * Stores structures in memory and persists them to JSON files per dimension.
 * Deduplicates structures based on their extents and type to avoid storing
 * the same structure multiple times.
 */
export class StructureStateService {
    private readonly structures: Map<string, Structure> = new Map();
    private readonly dataDir: string;
    private initialized = false;
    private structureIdCounter = 0;

    constructor(dataDir: string = DEFAULT_DATA_DIR) {
        this.dataDir = dataDir;
    }

    /**
     * Generate a unique key for a structure.
     * Uses a counter-based ID for uniqueness.
     */
    private generateStructureKey(): string {
        return `structure_${++this.structureIdCounter}_${Date.now()}`;
    }

    /**
     * Check if a structure overlaps or is adjacent to any existing structure of the same type in the same dimension.
     * Returns the existing structure if found, null otherwise.
     */
    private findOverlappingOrAdjacentStructure(structure: Structure): Structure | null {
        // If the incoming structure doesn't have extents, we can't do overlap detection
        if (!structure.extents) {
            return null;
        }

        for (const existing of this.structures.values()) {
            // Must be same dimension and type
            if (existing.dimension !== structure.dimension || existing.structureType !== structure.structureType) {
                continue;
            }

            // Skip structures without extents (legacy data)
            if (!existing.extents) {
                continue;
            }

            // Check if extents overlap or are adjacent
            if (extentsOverlapOrAdjacent(existing.extents, structure.extents)) {
                return existing;
            }
        }
        return null;
    }

    /**
     * Merge a new structure's extents with an existing structure.
     * Always merges to create the combined bounding box of both structures.
     * Returns the merged structure if successful, null if no merge was needed.
     */
    private mergeStructureExtents(existingKey: string, existing: Structure, incoming: Structure): Structure | null {
        // If either structure lacks extents, we can't merge
        if (!existing.extents || !incoming.extents) {
            return null;
        }

        // Check if the incoming structure extends beyond the existing extents
        const needsMerge =
            incoming.extents.minX < existing.extents.minX ||
            incoming.extents.maxX > existing.extents.maxX ||
            incoming.extents.minZ < existing.extents.minZ ||
            incoming.extents.maxZ > existing.extents.maxZ;

        if (!needsMerge) {
            // Incoming structure is fully contained within existing, no update needed
            return null;
        }

        // Merge the extents to create a combined bounding box
        const mergedExtents = mergeExtents(existing.extents, incoming.extents);

        // Calculate the new center point
        const centerX = Math.floor((mergedExtents.minX + mergedExtents.maxX) / 2);
        const centerZ = Math.floor((mergedExtents.minZ + mergedExtents.maxZ) / 2);

        // Create the merged structure, keeping the earlier discovery time
        const mergedStructure: Structure = {
            structureType: existing.structureType,
            x: centerX,
            y: existing.y,
            z: centerZ,
            dimension: existing.dimension,
            extents: mergedExtents,
            discoveredAt: Math.min(existing.discoveredAt, incoming.discoveredAt),
        };

        this.structures.set(existingKey, mergedStructure);

        const oldExtentsStr = `(${existing.extents.minX},${existing.extents.minZ}) to (${existing.extents.maxX},${existing.extents.maxZ})`;
        const newExtentsStr = `(${mergedExtents.minX},${mergedExtents.minZ}) to (${mergedExtents.maxX},${mergedExtents.maxZ})`;
        logInfo(LOG_TAG, `Merged structure ${existing.structureType}: ${oldExtentsStr} -> ${newExtentsStr}`);

        return mergedStructure;
    }

    /**
     * Get the file path for a dimension's structure data
     */
    private getDimensionFilePath(dimension: Dimension): string {
        return path.join(this.dataDir, `${dimension}.json`);
    }

    /**
     * Initialize the service by loading existing structure data
     */
    async initialize(): Promise<void> {
        if (this.initialized) {
            return;
        }

        try {
            // Ensure data directory exists
            await fs.mkdir(this.dataDir, { recursive: true });

            // Load structures from each dimension file
            const dimensions: Dimension[] = ['overworld', 'nether', 'the_end'];

            for (const dimension of dimensions) {
                await this.loadDimensionStructures(dimension);
            }

            this.initialized = true;
            logInfo(LOG_TAG, `Initialized with ${this.structures.size} structures`);
        } catch (error) {
            logError(LOG_TAG, 'Failed to initialize structure state', error);
            throw error;
        }
    }

    /**
     * Load structures from a dimension's JSON file
     */
    private async loadDimensionStructures(dimension: Dimension): Promise<void> {
        const filePath = this.getDimensionFilePath(dimension);

        try {
            const data = await fs.readFile(filePath, 'utf-8');
            const structures: Structure[] = JSON.parse(data);

            for (const structure of structures) {
                const key = this.generateStructureKey();
                this.structures.set(key, structure);
            }

            logDebug(LOG_TAG, `Loaded ${structures.length} structures from ${dimension}`);
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
                // File doesn't exist yet, that's fine
                logDebug(LOG_TAG, `No existing structure file for ${dimension}`);
            } else {
                logWarning(LOG_TAG, `Failed to load structures for ${dimension}`, error);
            }
        }
    }

    /**
     * Save structures for a dimension to its JSON file
     */
    private async saveDimensionStructures(dimension: Dimension): Promise<void> {
        const filePath = this.getDimensionFilePath(dimension);
        const dimensionStructures = this.getStructuresByDimension(dimension);

        try {
            await fs.writeFile(filePath, JSON.stringify(dimensionStructures, null, 2), 'utf-8');
            logDebug(LOG_TAG, `Saved ${dimensionStructures.length} structures for ${dimension}`);
        } catch (error) {
            logError(LOG_TAG, `Failed to save structures for ${dimension}`, error);
        }
    }

    /**
     * Add a structure if it doesn't already exist or overlap/adjacent with an existing one.
     * If it overlaps or is adjacent, the structures will be merged.
     * Returns the result containing the structure and merge info, or null if it was a duplicate.
     */
    addStructure(structure: Structure): AddStructureResult | null {
        // Check for overlapping or adjacent structures of the same type
        const overlapping = this.findOverlappingOrAdjacentStructure(structure);

        if (overlapping) {
            // Find the key for the overlapping structure
            for (const [key, existing] of this.structures.entries()) {
                if (existing === overlapping) {
                    const mergedStructure = this.mergeStructureExtents(key, existing, structure);
                    if (mergedStructure) {
                        // Persist the update
                        this.saveDimensionStructures(structure.dimension).catch(err => {
                            logError(LOG_TAG, 'Failed to persist structure update', err);
                        });
                        return {
                            structure: mergedStructure,
                            merged: true,
                            replacedStructure: existing,
                        };
                    }
                    break;
                }
            }
            logDebug(
                LOG_TAG,
                `Structure overlaps with existing: ${structure.structureType} at ${structure.x}, ${structure.z}`
            );
            return null;
        }

        const key = this.generateStructureKey();
        this.structures.set(key, structure);
        logInfo(
            LOG_TAG,
            `Added new structure: ${structure.structureType} at (${structure.x}, ${structure.y}, ${structure.z}) in ${structure.dimension}, extents: (${structure.extents.minX},${structure.extents.minZ}) to (${structure.extents.maxX},${structure.extents.maxZ})`
        );

        // Persist to disk asynchronously
        this.saveDimensionStructures(structure.dimension).catch(err => {
            logError(LOG_TAG, 'Failed to persist structure', err);
        });

        return {
            structure,
            merged: false,
        };
    }

    /**
     * Add multiple structures at once.
     * Returns an array of results for structures that were newly added or merged.
     */
    addStructures(structures: Structure[]): AddStructureResult[] {
        const results: AddStructureResult[] = [];
        const dimensionsToSave = new Set<Dimension>();

        for (const structure of structures) {
            // Check for overlapping or adjacent structures of the same type
            const overlapping = this.findOverlappingOrAdjacentStructure(structure);

            if (overlapping) {
                // Find the key for the overlapping structure
                for (const [key, existing] of this.structures.entries()) {
                    if (existing === overlapping) {
                        const mergedStructure = this.mergeStructureExtents(key, existing, structure);
                        if (mergedStructure) {
                            results.push({
                                structure: mergedStructure,
                                merged: true,
                                replacedStructure: existing,
                            });
                            dimensionsToSave.add(structure.dimension);
                        }
                        break;
                    }
                }
            } else {
                const key = this.generateStructureKey();
                this.structures.set(key, structure);
                results.push({
                    structure,
                    merged: false,
                });
                dimensionsToSave.add(structure.dimension);
                logInfo(
                    LOG_TAG,
                    `Added new structure: ${structure.structureType} at (${structure.x}, ${structure.y}, ${structure.z}) in ${structure.dimension}`
                );
            }
        }

        // Persist affected dimensions asynchronously
        for (const dimension of dimensionsToSave) {
            this.saveDimensionStructures(dimension).catch(err => {
                logError(LOG_TAG, 'Failed to persist structures', err);
            });
        }

        return results;
    }

    /**
     * Get a structure by its key
     */
    getStructure(key: string): Structure | undefined {
        return this.structures.get(key);
    }

    /**
     * Get all structures
     */
    getAllStructures(): Structure[] {
        return Array.from(this.structures.values());
    }

    /**
     * Get structures in a specific dimension
     */
    getStructuresByDimension(dimension: Dimension): Structure[] {
        return this.getAllStructures().filter(s => s.dimension === dimension);
    }

    /**
     * Get structures of a specific type
     */
    getStructuresByType(structureType: string): Structure[] {
        return this.getAllStructures().filter(s => s.structureType === structureType);
    }

    /**
     * Get the total number of structures
     */
    getStructureCount(): number {
        return this.structures.size;
    }

    /**
     * Clear all structures (primarily for testing)
     */
    clear(): void {
        this.structures.clear();
    }
}

// Singleton instance
let _structureStateService: StructureStateService | null = null;

export function getStructureStateService(): StructureStateService {
    if (!_structureStateService) {
        _structureStateService = new StructureStateService();
    }
    return _structureStateService;
}

import { describe, it, expect, beforeEach } from 'vitest';
import { StructureStateService } from '../src/services/structure-state.js';
import type { Structure } from '@minecarta/shared';

describe('StructureStateService', () => {
    let service: StructureStateService;

    beforeEach(() => {
        // Create a new service instance for each test (using temp dir)
        service = new StructureStateService('./test-data/structures');
        service.clear();
    });

    describe('structure deduplication', () => {
        it('should add a new structure when no existing structures', () => {
            const structure: Structure = {
                structureType: 'minecraft:village',
                x: 100,
                y: 64,
                z: 100,
                dimension: 'overworld',
                extents: { minX: 64, maxX: 128, minZ: 64, maxZ: 128 },
                discoveredAt: Date.now(),
            };

            const result = service.addStructure(structure);

            expect(result).not.toBeNull();
            expect(result!.merged).toBe(false);
            expect(result!.replacedStructure).toBeUndefined();
            expect(service.getStructureCount()).toBe(1);
        });

        it('should merge overlapping structures of the same type', () => {
            const structure1: Structure = {
                structureType: 'minecraft:village',
                x: 100,
                y: 64,
                z: 100,
                dimension: 'overworld',
                extents: { minX: 64, maxX: 128, minZ: 64, maxZ: 128 },
                discoveredAt: 1000,
            };
            const structure2: Structure = {
                structureType: 'minecraft:village',
                x: 150,
                y: 64,
                z: 100,
                dimension: 'overworld',
                extents: { minX: 100, maxX: 192, minZ: 64, maxZ: 128 },
                discoveredAt: 2000,
            };

            service.addStructure(structure1);
            const result = service.addStructure(structure2);

            expect(result).not.toBeNull();
            expect(result!.merged).toBe(true);
            expect(result!.replacedStructure).toEqual(structure1);
            expect(service.getStructureCount()).toBe(1);

            const merged = service.getAllStructures()[0];
            expect(merged.extents.minX).toBe(64);
            expect(merged.extents.maxX).toBe(192);
            expect(merged.extents.minZ).toBe(64);
            expect(merged.extents.maxZ).toBe(128);
            // Should keep the earlier discovery time
            expect(merged.discoveredAt).toBe(1000);
        });

        it('should merge adjacent structures of the same type', () => {
            // These are the exact structures from the user's example
            const structure1: Structure = {
                structureType: 'minecraft:ruined_portal',
                x: 55,
                y: 64,
                z: 183,
                dimension: 'overworld',
                extents: { minX: 48, maxX: 63, minZ: 176, maxZ: 191 },
                discoveredAt: 1768623428915,
            };
            const structure2: Structure = {
                structureType: 'minecraft:ruined_portal',
                x: 39,
                y: 64,
                z: 183,
                dimension: 'overworld',
                extents: { minX: 32, maxX: 47, minZ: 176, maxZ: 191 },
                discoveredAt: 1768623430427,
            };

            service.addStructure(structure1);
            const result = service.addStructure(structure2);

            expect(result).not.toBeNull();
            expect(result!.merged).toBe(true);
            expect(result!.replacedStructure).toEqual(structure1);
            expect(service.getStructureCount()).toBe(1);

            const merged = service.getAllStructures()[0];
            // Merged extents should cover both structures
            expect(merged.extents.minX).toBe(32);
            expect(merged.extents.maxX).toBe(63);
            expect(merged.extents.minZ).toBe(176);
            expect(merged.extents.maxZ).toBe(191);
            // Center should be recalculated
            expect(merged.x).toBe(47); // Math.floor((32 + 63) / 2)
            expect(merged.z).toBe(183); // Math.floor((176 + 191) / 2)
            // Should keep the earlier discovery time
            expect(merged.discoveredAt).toBe(1768623428915);
        });

        it('should not merge structures of different types', () => {
            const structure1: Structure = {
                structureType: 'minecraft:village',
                x: 100,
                y: 64,
                z: 100,
                dimension: 'overworld',
                extents: { minX: 64, maxX: 128, minZ: 64, maxZ: 128 },
                discoveredAt: Date.now(),
            };
            const structure2: Structure = {
                structureType: 'minecraft:ruined_portal',
                x: 100,
                y: 64,
                z: 100,
                dimension: 'overworld',
                extents: { minX: 64, maxX: 128, minZ: 64, maxZ: 128 },
                discoveredAt: Date.now(),
            };

            service.addStructure(structure1);
            service.addStructure(structure2);

            expect(service.getStructureCount()).toBe(2);
        });

        it('should not merge structures in different dimensions', () => {
            const structure1: Structure = {
                structureType: 'minecraft:ruined_portal',
                x: 100,
                y: 64,
                z: 100,
                dimension: 'overworld',
                extents: { minX: 64, maxX: 128, minZ: 64, maxZ: 128 },
                discoveredAt: Date.now(),
            };
            const structure2: Structure = {
                structureType: 'minecraft:ruined_portal',
                x: 100,
                y: 64,
                z: 100,
                dimension: 'nether',
                extents: { minX: 64, maxX: 128, minZ: 64, maxZ: 128 },
                discoveredAt: Date.now(),
            };

            service.addStructure(structure1);
            service.addStructure(structure2);

            expect(service.getStructureCount()).toBe(2);
        });

        it('should not merge non-adjacent, non-overlapping structures', () => {
            const structure1: Structure = {
                structureType: 'minecraft:ruined_portal',
                x: 100,
                y: 64,
                z: 100,
                dimension: 'overworld',
                extents: { minX: 64, maxX: 128, minZ: 64, maxZ: 128 },
                discoveredAt: Date.now(),
            };
            const structure2: Structure = {
                structureType: 'minecraft:ruined_portal',
                x: 500,
                y: 64,
                z: 500,
                dimension: 'overworld',
                extents: { minX: 480, maxX: 520, minZ: 480, maxZ: 520 },
                discoveredAt: Date.now(),
            };

            service.addStructure(structure1);
            service.addStructure(structure2);

            expect(service.getStructureCount()).toBe(2);
        });

        it('should return null for duplicate structure fully contained within existing', () => {
            const structure1: Structure = {
                structureType: 'minecraft:village',
                x: 100,
                y: 64,
                z: 100,
                dimension: 'overworld',
                extents: { minX: 64, maxX: 192, minZ: 64, maxZ: 192 },
                discoveredAt: Date.now(),
            };
            const structure2: Structure = {
                structureType: 'minecraft:village',
                x: 100,
                y: 64,
                z: 100,
                dimension: 'overworld',
                extents: { minX: 80, maxX: 160, minZ: 80, maxZ: 160 },
                discoveredAt: Date.now(),
            };

            service.addStructure(structure1);
            const result = service.addStructure(structure2);

            // Should be null because incoming is fully contained
            expect(result).toBeNull();
            expect(service.getStructureCount()).toBe(1);
        });

        it('should merge adjacent structures on Z axis', () => {
            const structure1: Structure = {
                structureType: 'minecraft:ruined_portal',
                x: 100,
                y: 64,
                z: 100,
                dimension: 'overworld',
                extents: { minX: 80, maxX: 120, minZ: 64, maxZ: 127 },
                discoveredAt: 1000,
            };
            const structure2: Structure = {
                structureType: 'minecraft:ruined_portal',
                x: 100,
                y: 64,
                z: 160,
                dimension: 'overworld',
                extents: { minX: 80, maxX: 120, minZ: 128, maxZ: 191 },
                discoveredAt: 2000,
            };

            service.addStructure(structure1);
            const result = service.addStructure(structure2);

            expect(result).not.toBeNull();
            expect(service.getStructureCount()).toBe(1);

            const merged = service.getAllStructures()[0];
            expect(merged.extents.minZ).toBe(64);
            expect(merged.extents.maxZ).toBe(191);
        });
    });

    describe('addStructures batch method', () => {
        it('should merge multiple adjacent structures in a batch', () => {
            const structures: Structure[] = [
                {
                    structureType: 'minecraft:ruined_portal',
                    x: 55,
                    y: 64,
                    z: 183,
                    dimension: 'overworld',
                    extents: { minX: 48, maxX: 63, minZ: 176, maxZ: 191 },
                    discoveredAt: 1000,
                },
                {
                    structureType: 'minecraft:ruined_portal',
                    x: 39,
                    y: 64,
                    z: 183,
                    dimension: 'overworld',
                    extents: { minX: 32, maxX: 47, minZ: 176, maxZ: 191 },
                    discoveredAt: 2000,
                },
            ];

            const added = service.addStructures(structures);

            // First one added, second one merged
            expect(added.length).toBe(2);
            expect(service.getStructureCount()).toBe(1);
        });
    });
});

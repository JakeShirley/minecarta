/**
 * Unit tests for serialization functions
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
    serializeBlockChange,
    serializePlayer,
    serializeEntity,
    normalizeBlockType,
    normalizeEntityType,
    serializeBlockChanges,
    serializePlayers,
    serializeEntities,
} from '../src/serializers';
import type { MinecraftBlockEvent, MinecraftPlayer, MinecraftEntity } from '../src/types';

describe('Serializers', () => {
    describe('normalizeBlockType', () => {
        it('should remove minecraft: prefix', () => {
            expect(normalizeBlockType('minecraft:stone')).toBe('stone');
            expect(normalizeBlockType('minecraft:grass_block')).toBe('grass_block');
        });

        it('should return unchanged if no prefix', () => {
            expect(normalizeBlockType('stone')).toBe('stone');
            expect(normalizeBlockType('custom:block')).toBe('custom:block');
        });
    });

    describe('normalizeEntityType', () => {
        it('should remove minecraft: prefix', () => {
            expect(normalizeEntityType('minecraft:zombie')).toBe('zombie');
            expect(normalizeEntityType('minecraft:skeleton')).toBe('skeleton');
        });

        it('should return unchanged if no prefix', () => {
            expect(normalizeEntityType('zombie')).toBe('zombie');
            expect(normalizeEntityType('custom:mob')).toBe('custom:mob');
        });
    });

    describe('serializeBlockChange', () => {
        beforeEach(() => {
            vi.useFakeTimers();
            vi.setSystemTime(new Date('2026-01-12T12:00:00Z'));
        });

        it('should serialize a block place event', () => {
            const event: MinecraftBlockEvent = {
                dimension: 'overworld',
                x: 100,
                y: 64,
                z: -200,
                blockType: 'minecraft:stone',
                previousType: 'minecraft:air',
                playerName: 'Steve',
            };

            const result = serializeBlockChange(event);

            expect(result).toEqual({
                dimension: 'overworld',
                x: 100,
                y: 64,
                z: -200,
                blockType: 'stone',
                previousType: 'air',
                player: 'Steve',
                timestamp: Date.now(),
            });
        });

        it('should floor decimal coordinates', () => {
            const event: MinecraftBlockEvent = {
                dimension: 'nether',
                x: 10.7,
                y: 64.2,
                z: -20.9,
                blockType: 'netherrack',
            };

            const result = serializeBlockChange(event);

            expect(result.x).toBe(10);
            expect(result.y).toBe(64);
            expect(result.z).toBe(-21);
        });

        it('should handle missing optional fields', () => {
            const event: MinecraftBlockEvent = {
                dimension: 'the_end',
                x: 0,
                y: 100,
                z: 0,
                blockType: 'end_stone',
            };

            const result = serializeBlockChange(event);

            expect(result.previousType).toBeUndefined();
            expect(result.player).toBeUndefined();
        });
    });

    describe('serializePlayer', () => {
        beforeEach(() => {
            vi.useFakeTimers();
            vi.setSystemTime(new Date('2026-01-12T12:00:00Z'));
        });

        it('should serialize player data', () => {
            const player: MinecraftPlayer = {
                name: 'TestPlayer',
                x: 100.5,
                y: 64.8,
                z: -50.2,
                dimension: 'overworld',
            };

            const result = serializePlayer(player);

            expect(result).toEqual({
                name: 'TestPlayer',
                x: 100,
                y: 64,
                z: -51,
                dimension: 'overworld',
                lastSeen: Date.now(),
            });
        });

        it('should handle nether dimension', () => {
            const player: MinecraftPlayer = {
                name: 'NetherPlayer',
                x: 0,
                y: 64,
                z: 0,
                dimension: 'nether',
            };

            const result = serializePlayer(player);

            expect(result.dimension).toBe('nether');
        });
    });

    describe('serializeEntity', () => {
        it('should serialize entity data', () => {
            const entity: MinecraftEntity = {
                id: 'entity-123',
                type: 'minecraft:zombie',
                x: 50.5,
                y: 32.7,
                z: -100.9,
                dimension: 'overworld',
            };

            const result = serializeEntity(entity);

            expect(result).toEqual({
                id: 'entity-123',
                type: 'zombie',
                x: 50,
                y: 32,
                z: -101,
                dimension: 'overworld',
            });
        });
    });

    describe('batch serializers', () => {
        beforeEach(() => {
            vi.useFakeTimers();
            vi.setSystemTime(new Date('2026-01-12T12:00:00Z'));
        });

        it('should serialize multiple block changes', () => {
            const events: MinecraftBlockEvent[] = [
                { dimension: 'overworld', x: 1, y: 64, z: 1, blockType: 'stone' },
                { dimension: 'overworld', x: 2, y: 64, z: 2, blockType: 'dirt' },
            ];

            const results = serializeBlockChanges(events);

            expect(results).toHaveLength(2);
            expect(results[0].blockType).toBe('stone');
            expect(results[1].blockType).toBe('dirt');
        });

        it('should serialize multiple players', () => {
            const players: MinecraftPlayer[] = [
                { name: 'Player1', x: 0, y: 64, z: 0, dimension: 'overworld' },
                { name: 'Player2', x: 100, y: 64, z: 100, dimension: 'nether' },
            ];

            const results = serializePlayers(players);

            expect(results).toHaveLength(2);
            expect(results[0].name).toBe('Player1');
            expect(results[1].name).toBe('Player2');
        });

        it('should serialize multiple entities', () => {
            const entities: MinecraftEntity[] = [
                { id: '1', type: 'zombie', x: 0, y: 64, z: 0, dimension: 'overworld' },
                { id: '2', type: 'skeleton', x: 10, y: 64, z: 10, dimension: 'overworld' },
            ];

            const results = serializeEntities(entities);

            expect(results).toHaveLength(2);
            expect(results[0].type).toBe('zombie');
            expect(results[1].type).toBe('skeleton');
        });
    });
});

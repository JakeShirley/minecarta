import { describe, it, expect, beforeEach } from 'vitest';
import { PlayerStateService } from '../src/services/player-state.js';

describe('PlayerStateService', () => {
    let service: PlayerStateService;

    beforeEach(() => {
        service = new PlayerStateService();
    });

    describe('updatePlayer', () => {
        it('should add a new player', () => {
            const player = service.updatePlayer({
                name: 'TestPlayer',
                x: 100,
                y: 64,
                z: 200,
                dimension: 'overworld',
            });

            expect(player.name).toBe('TestPlayer');
            expect(player.x).toBe(100);
            expect(player.y).toBe(64);
            expect(player.z).toBe(200);
            expect(player.dimension).toBe('overworld');
            expect(player.lastSeen).toBeTypeOf('number');
        });

        it('should update an existing player', () => {
            service.updatePlayer({
                name: 'TestPlayer',
                x: 100,
                y: 64,
                z: 200,
                dimension: 'overworld',
            });

            const updated = service.updatePlayer({
                name: 'TestPlayer',
                x: 150,
                y: 70,
                z: 250,
                dimension: 'nether',
            });

            expect(updated.x).toBe(150);
            expect(updated.y).toBe(70);
            expect(updated.z).toBe(250);
            expect(updated.dimension).toBe('nether');
            expect(service.getPlayerCount()).toBe(1);
        });
    });

    describe('getPlayer', () => {
        it('should return undefined for non-existent player', () => {
            expect(service.getPlayer('NonExistent')).toBeUndefined();
        });

        it('should return the player if exists', () => {
            service.updatePlayer({
                name: 'TestPlayer',
                x: 100,
                y: 64,
                z: 200,
                dimension: 'overworld',
            });

            const player = service.getPlayer('TestPlayer');
            expect(player?.name).toBe('TestPlayer');
        });
    });

    describe('removePlayer', () => {
        it('should remove an existing player', () => {
            service.updatePlayer({
                name: 'TestPlayer',
                x: 100,
                y: 64,
                z: 200,
                dimension: 'overworld',
            });

            expect(service.removePlayer('TestPlayer')).toBe(true);
            expect(service.getPlayer('TestPlayer')).toBeUndefined();
        });

        it('should return false when removing non-existent player', () => {
            expect(service.removePlayer('NonExistent')).toBe(false);
        });
    });

    describe('getAllPlayers', () => {
        it('should return all players', () => {
            service.updatePlayer({
                name: 'Player1',
                x: 100,
                y: 64,
                z: 200,
                dimension: 'overworld',
            });

            service.updatePlayer({
                name: 'Player2',
                x: 0,
                y: 64,
                z: 0,
                dimension: 'nether',
            });

            const players = service.getAllPlayers();
            expect(players).toHaveLength(2);
        });
    });

    describe('getPlayersByDimension', () => {
        it('should filter players by dimension', () => {
            service.updatePlayer({
                name: 'OverworldPlayer',
                x: 100,
                y: 64,
                z: 200,
                dimension: 'overworld',
            });

            service.updatePlayer({
                name: 'NetherPlayer',
                x: 0,
                y: 64,
                z: 0,
                dimension: 'nether',
            });

            const overworldPlayers = service.getPlayersByDimension('overworld');
            expect(overworldPlayers).toHaveLength(1);
            expect(overworldPlayers[0].name).toBe('OverworldPlayer');
        });
    });

    describe('clear', () => {
        it('should remove all players', () => {
            service.updatePlayer({
                name: 'Player1',
                x: 100,
                y: 64,
                z: 200,
                dimension: 'overworld',
            });

            service.clear();
            expect(service.getPlayerCount()).toBe(0);
        });
    });
});


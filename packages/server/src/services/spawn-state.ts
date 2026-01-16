import type { WorldSpawn, PlayerSpawn, Dimension } from '@minecarta/shared';

/**
 * In-memory spawn state service
 *
 * Stores world spawn and player spawn points.
 * State resets on server restart.
 */
export class SpawnStateService {
    private worldSpawn: WorldSpawn | null = null;
    private readonly playerSpawns: Map<string, PlayerSpawn> = new Map();

    /**
     * Update the world spawn location
     */
    updateWorldSpawn(spawn: WorldSpawn): WorldSpawn {
        this.worldSpawn = spawn;
        return spawn;
    }

    /**
     * Get the world spawn location
     */
    getWorldSpawn(): WorldSpawn | null {
        return this.worldSpawn;
    }

    /**
     * Update or add a player spawn point
     */
    updatePlayerSpawn(spawn: PlayerSpawn): PlayerSpawn {
        this.playerSpawns.set(spawn.playerName, spawn);
        return spawn;
    }

    /**
     * Remove a player's spawn point
     */
    removePlayerSpawn(playerName: string): boolean {
        return this.playerSpawns.delete(playerName);
    }

    /**
     * Get a player's spawn point
     */
    getPlayerSpawn(playerName: string): PlayerSpawn | undefined {
        return this.playerSpawns.get(playerName);
    }

    /**
     * Get all player spawn points
     */
    getAllPlayerSpawns(): PlayerSpawn[] {
        return Array.from(this.playerSpawns.values());
    }

    /**
     * Get player spawns in a specific dimension
     */
    getPlayerSpawnsByDimension(dimension: Dimension): PlayerSpawn[] {
        return this.getAllPlayerSpawns().filter(s => s.dimension === dimension);
    }

    /**
     * Get the number of player spawns
     */
    getPlayerSpawnCount(): number {
        return this.playerSpawns.size;
    }

    /**
     * Clear all spawn data
     */
    clear(): void {
        this.worldSpawn = null;
        this.playerSpawns.clear();
    }
}

// Singleton instance
let _spawnStateService: SpawnStateService | null = null;

export function getSpawnStateService(): SpawnStateService {
    if (!_spawnStateService) {
        _spawnStateService = new SpawnStateService();
    }
    return _spawnStateService;
}


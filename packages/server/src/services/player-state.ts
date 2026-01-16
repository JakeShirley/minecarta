import type { Player, Dimension } from '@minecarta/shared';

/**
 * In-memory player state service
 *
 * Players are stored in memory for simplicity.
 * State resets on server restart.
 */
export class PlayerStateService {
    private readonly players: Map<string, Player> = new Map();

    /**
     * Update or add a player
     */
    updatePlayer(data: Omit<Player, 'lastSeen'>): Player {
        const player: Player = {
            ...data,
            lastSeen: Date.now(),
        };
        this.players.set(player.name, player);
        return player;
    }

    /**
     * Remove a player
     */
    removePlayer(name: string): boolean {
        return this.players.delete(name);
    }

    /**
     * Get a player by name
     */
    getPlayer(name: string): Player | undefined {
        return this.players.get(name);
    }

    /**
     * Get all players
     */
    getAllPlayers(): Player[] {
        return Array.from(this.players.values());
    }

    /**
     * Get players in a specific dimension
     */
    getPlayersByDimension(dimension: Dimension): Player[] {
        return this.getAllPlayers().filter(p => p.dimension === dimension);
    }

    /**
     * Get the number of players
     */
    getPlayerCount(): number {
        return this.players.size;
    }

    /**
     * Clear all players
     */
    clear(): void {
        this.players.clear();
    }
}

// Singleton instance
let _playerStateService: PlayerStateService | null = null;

export function getPlayerStateService(): PlayerStateService {
    if (!_playerStateService) {
        _playerStateService = new PlayerStateService();
    }
    return _playerStateService;
}


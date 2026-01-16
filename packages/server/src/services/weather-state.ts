import type { WorldWeather, WeatherType, Dimension } from '@minecarta/shared';

/**
 * In-memory world weather state service
 *
 * Stores the current Minecraft world weather, synchronized from the behavior pack.
 * Weather changes are tracked via the weatherChange event in the game.
 *
 * Weather types:
 * - Clear: No precipitation, clear skies
 * - Rain: Raining (or snowing in cold biomes)
 * - Thunder: Thunderstorm with lightning
 */
export class WeatherStateService {
    private worldWeather: WorldWeather | null = null;
    private lastSyncTime: number = 0;

    /**
     * Update the world weather from a sync message
     */
    updateWeather(weather: { weather: WeatherType; dimension: Dimension }): WorldWeather {
        this.worldWeather = {
            weather: weather.weather,
            dimension: weather.dimension,
        };
        this.lastSyncTime = Date.now();
        return this.worldWeather;
    }

    /**
     * Get the current world weather
     */
    getWeather(): WorldWeather | null {
        return this.worldWeather;
    }

    /**
     * Get the timestamp of the last sync
     */
    getLastSyncTime(): number {
        return this.lastSyncTime;
    }

    /**
     * Check if we have received a weather sync
     */
    hasWeather(): boolean {
        return this.worldWeather !== null;
    }

    /**
     * Clear the weather state
     */
    clear(): void {
        this.worldWeather = null;
        this.lastSyncTime = 0;
    }
}

// Singleton instance
let _weatherStateService: WeatherStateService | null = null;

export function getWeatherStateService(): WeatherStateService {
    if (!_weatherStateService) {
        _weatherStateService = new WeatherStateService();
    }
    return _weatherStateService;
}

/**
 * Mock implementation of @minecraft/server for testing.
 * This provides minimal stubs needed for unit tests.
 */

export const world = {
    getAllPlayers: () => [],
    getDimension: (_id: string) => ({
        id: _id,
    }),
    afterEvents: {
        playerJoin: { subscribe: () => {} },
        playerLeave: { subscribe: () => {} },
        playerSpawn: { subscribe: () => {} },
        chatSend: { subscribe: () => {} },
        worldLoad: { subscribe: () => {} },
        blockBreak: { subscribe: () => {} },
        blockPlace: { subscribe: () => {} },
        weatherChange: { subscribe: () => {} },
    },
    sendMessage: () => {},
};

export const system = {
    runInterval: (_callback: () => void, _interval: number) => 0,
    run: (_callback: () => void) => 0,
    clearRun: (_runId: number) => {},
};

export enum Direction {
    Down = 'Down',
    Up = 'Up',
    North = 'North',
    South = 'South',
    West = 'West',
    East = 'East',
}

export class Vector3 {
    x: number;
    y: number;
    z: number;

    constructor(x: number, y: number, z: number) {
        this.x = x;
        this.y = y;
        this.z = z;
    }
}

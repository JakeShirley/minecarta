# @minecarta/shared

Shared types and constants for the Minecraft Map project.

## Installation

This package is part of the monorepo and is automatically linked via pnpm workspaces.

```typescript
import { Player, BlockChange, API_BASE_PATH } from '@minecarta/shared';
```

## Types

### Core Types

| Type              | Description                                                  |
| ----------------- | ------------------------------------------------------------ |
| `Dimension`       | Minecraft dimension: `'overworld' \| 'nether' \| 'the_end'`  |
| `Position`        | 3D coordinates: `{ x, y, z }`                                |
| `Player`          | Player data with position, dimension, and lastSeen timestamp |
| `Entity`          | Entity data with id, type, position, and dimension           |
| `BlockChange`     | Block modification event data                                |
| `ChunkData`       | Chunk terrain data for map generation                        |
| `ChunkBlock`      | Individual block within a chunk                              |
| `TileCoordinates` | Map tile coordinates: dimension, zoom, x, z                  |
| `WorldState`      | Snapshot of current world state                              |

### Type Definitions

```typescript
interface Player {
    readonly name: string;
    readonly x: number;
    readonly y: number;
    readonly z: number;
    readonly dimension: Dimension;
    readonly lastSeen: number;
}

interface BlockChange {
    readonly dimension: Dimension;
    readonly x: number;
    readonly y: number;
    readonly z: number;
    readonly blockType: string;
    readonly previousType?: string;
    readonly player?: string;
    readonly timestamp: number;
}

interface Entity {
    readonly id: string;
    readonly type: string;
    readonly x: number;
    readonly y: number;
    readonly z: number;
    readonly dimension: Dimension;
}
```

## Constants

| Constant        | Value                                | Description                     |
| --------------- | ------------------------------------ | ------------------------------- |
| `API_VERSION`   | `'v1'`                               | Current API version             |
| `API_BASE_PATH` | `'/api/v1'`                          | Base path for all API endpoints |
| `DEFAULT_PORT`  | `3000`                               | Default server port             |
| `DEFAULT_HOST`  | `'0.0.0.0'`                          | Default server host             |
| `TILE_SIZE`     | `256`                                | Tile size in pixels             |
| `ZOOM_LEVELS`   | `[0, 1, 2, 3, 4, 5, 6, 7]`           | Available zoom levels           |
| `DIMENSIONS`    | `['overworld', 'nether', 'the_end']` | Minecraft dimensions            |
| `AUTH_HEADER`   | `'x-mc-auth-token'`                  | Authentication header name      |

### Zoom Levels

| Zoom | Pixels per Block | Blocks per Tile |
| ---- | ---------------- | --------------- |
| 0    | 4                | 64              |
| 1    | 2                | 128             |
| 2    | 1                | 256             |
| 3    | 0.5              | 512             |
| 4    | 0.25             | 1024            |
| 5    | 0.125            | 2048            |
| 6    | 0.0625           | 4096            |
| 7    | 0.03125          | 8192            |

## WebSocket Events

```typescript
const WS_EVENTS = {
    PLAYER_UPDATE: 'player:update',
    PLAYER_JOIN: 'player:join',
    PLAYER_LEAVE: 'player:leave',
    BLOCK_UPDATE: 'block:update',
    TILE_UPDATE: 'tile:update',
};
```

## Scripts

```bash
# Build the package
pnpm build

# Watch mode for development
pnpm dev

# Clean build output
pnpm clean
```


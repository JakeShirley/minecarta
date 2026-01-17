# minecarta

Fastify-based web server for the MineCarta project. Receives world data from the Minecraft behavior pack and serves map tiles to the web client.

## Features

- **REST API** for receiving Minecraft world data (players, blocks, entities, chunks)
- **In-memory state management** for real-time player/entity tracking
- **File-based tile storage** for map tiles
- **Minecraft-style map shading** - Height-based color shading that replicates the look of vanilla Minecraft maps
- **Density map tiles** - Grayscale density view based on normalized Y-column occupancy
- **Authentication** via shared secret token
- **CORS support** for cross-origin requests

## Quick Start

```bash
# Install dependencies
pnpm install

# Start development server (with hot reload)
pnpm dev

# Build for production
pnpm build

# Start production server
pnpm start

# Run tests
pnpm test
```

## Docker

The server is available as a Docker image from GitHub Container Registry:

```bash
# Pull the latest image
docker pull ghcr.io/JakeShirley/minecarta/server:latest

# Run the container
docker run -d \
  -p 3000:3000 \
  -v $(pwd)/data:/app/data \
  -e AUTH_TOKEN=your-secret-token \
  ghcr.io/JakeShirley/minecarta/server:latest
```

### Build Locally

```bash
# From the repository root
docker build -t minecarta-server -f packages/server/Dockerfile .

# Run locally
docker run -d -p 3000:3000 -v $(pwd)/data:/data
```

## Configuration

The server is configured via environment variables:

| Variable     | Default     | Description                                                   |
| ------------ | ----------- | ------------------------------------------------------------- |
| `PORT`       | `3000`      | Server port                                                   |
| `HOST`       | `0.0.0.0`   | Server host                                                   |
| `AUTH_TOKEN` | `dev-token` | Authentication token for protected endpoints                  |
| `DATA_DIR`   | `./data`    | Directory for tile storage                                    |
| `LOG_LEVEL`  | `info`      | Log level: `fatal`, `error`, `warn`, `info`, `debug`, `trace` |

## API Endpoints

### Health Check

```
GET /health
```

Returns server health status. No authentication required.

**Response:**

```json
{
    "status": "ok",
    "uptime": 12345,
    "timestamp": 1704067200000
}
```

### World Data Ingestion (Protected)

These endpoints require the `x-mc-auth-token` header with a valid token.

#### Update Players

```
POST /api/v1/world/players
```

Receive player position updates from Minecraft.

**Request:**

```json
{
    "players": [
        {
            "name": "Steve",
            "x": 100,
            "y": 64,
            "z": 200,
            "dimension": "overworld"
        }
    ]
}
```

#### Update Blocks

```
POST /api/v1/world/blocks
```

Receive block change events from Minecraft.

**Request:**

```json
{
    "blocks": [
        {
            "dimension": "overworld",
            "x": 100,
            "y": 64,
            "z": 200,
            "blockType": "minecraft:stone",
            "previousType": "minecraft:air",
            "player": "Steve"
        }
    ]
}
```

#### Update Entities

```
POST /api/v1/world/entities
```

Receive entity updates from Minecraft.

**Request:**

```json
{
    "entities": [
        {
            "id": "entity-123",
            "type": "minecraft:zombie",
            "x": 100,
            "y": 64,
            "z": 200,
            "dimension": "overworld"
        }
    ]
}
```

#### Update Chunks

```
POST /api/v1/world/chunks
```

Receive chunk data for map generation.

**Request:**

```json
{
    "chunks": [
        {
            "dimension": "overworld",
            "chunkX": 6,
            "chunkZ": 12,
            "blocks": [{ "x": 100, "y": 64, "z": 200, "type": "minecraft:grass_block" }]
        }
    ]
}
```

#### Get World State

```
GET /api/v1/world/state
```

Get current world state snapshot.

**Response:**

```json
{
  "success": true,
  "data": {
    "players": [...],
    "entities": [...],
    "lastUpdated": 1704067200000
  }
}
```

#### Check Chunk Existence

```
GET /api/v1/world/chunk/exists?dimension=overworld&chunkX=6&chunkZ=12
```

Check if a chunk tile exists at the lowest zoom level (z0). Used by the behavior pack to determine if it needs to send chunk data.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `dimension` | string | `overworld`, `nether`, or `the_end` |
| `chunkX` | integer | Chunk X coordinate |
| `chunkZ` | integer | Chunk Z coordinate |

**Response:**

```json
{
    "success": true,
    "data": {
        "exists": false,
        "dimension": "overworld",
        "chunkX": 6,
        "chunkZ": 12
    }
}
```

### Player Queries (Public)

These endpoints do not require authentication.

#### List All Players

```
GET /api/v1/players
GET /api/v1/players?dimension=overworld
```

**Response:**

```json
{
    "success": true,
    "data": {
        "players": [
            {
                "name": "Steve",
                "x": 100,
                "y": 64,
                "z": 200,
                "dimension": "overworld",
                "lastSeen": 1704067200000
            }
        ],
        "count": 1
    }
}
```

#### Get Player by Name

```
GET /api/v1/players/:name
```

**Response:**

```json
{
    "success": true,
    "data": {
        "name": "Steve",
        "x": 100,
        "y": 64,
        "z": 200,
        "dimension": "overworld",
        "lastSeen": 1704067200000
    }
}
```

### Map Tiles (Public)

```
GET /api/v1/tiles/:dimension/:mapType/:zoom/:x/:z.png
```

Get a map tile image.

**Parameters:**

- `dimension`: `overworld`, `nether`, or `the_end`
- `mapType`: `block` (standard colored map), `height` (grayscale height map), or `density` (grayscale density map)
- `zoom`: `0` through `7` (0 = highest detail, 7 = most zoomed out)
- `x`: Tile X coordinate
- `z`: Tile Z coordinate

**Response:** PNG image (256x256 pixels)

**Map Types:**

- **block**: Standard block-color map similar to Minecraft's in-game map item, with height-based shading for terrain and checkerboard patterns for water depth.
- **height**: Grayscale height map where pixel brightness represents the Y coordinate of the topmost block. Darker = lower elevation, brighter = higher elevation.
- **density**: Grayscale density map where pixel brightness represents the normalized occupancy of the full Y column. Darker = more air/liquid, brighter = more solid blocks.

## Project Structure

```
src/
├── index.ts              # Entry point
├── app.ts                # Fastify app factory
├── config/
│   └── index.ts          # Configuration loader
├── types/
│   └── index.ts          # Server-specific types
├── api/
│   ├── index.ts          # Route registration
│   ├── auth.ts           # Authentication middleware
│   ├── schemas.ts        # Zod validation schemas
│   ├── world-routes.ts   # World data ingestion routes
│   ├── player-routes.ts  # Player query routes
│   └── tile-routes.ts    # Tile serving routes
├── services/
│   ├── index.ts          # Service exports
│   ├── player-state.ts   # In-memory player storage
│   └── entity-state.ts   # In-memory entity storage
└── tiles/
    ├── index.ts          # Tile exports
    └── tile-storage.ts   # File-based tile storage
```

## Data Storage

### In-Memory (Players & Entities)

Players and entities are stored in memory using `Map` collections. This provides fast lookups and real-time updates, but data is lost on server restart.

### File-Based (Tiles)

Map tiles are stored on disk with the following structure:

```
data/tiles/
├── overworld/
│   ├── block/       # Standard block-color map tiles
│   │   ├── 0/       # Zoom level 0 (highest detail)
│   │   └── ...
│   ├── density/     # Grayscale density map tiles
│   │   ├── 0/
│   │   └── ...
│   └── height/      # Grayscale height map tiles
│       ├── 0/
│       └── ...
├── nether/
└── the_end/
```

**Path format:** `data/tiles/{dimension}/{mapType}/{zoom}/{x}/{z}.png`

### Height-Based Shading

Map tiles use Minecraft's authentic height-based shading algorithm to create a 3D relief effect. Each block's color is adjusted based on the height difference from the block to its north:

| Height Comparison | Shade Multiplier | Visual Effect                         |
| ----------------- | ---------------- | ------------------------------------- |
| Higher than north | 255/255 (1.00)   | Brightest - highlights rising terrain |
| Same as north     | 220/255 (0.86)   | Normal - flat terrain                 |
| Lower than north  | 180/255 (0.71)   | Darker - shadows descending terrain   |

This creates the distinctive "dithered" look of Minecraft maps, making hills and valleys clearly visible on the map.

### Water Depth Shading

Water blocks use a special depth-based checkerboard shading pattern that conveys water depth. Minecraft uses 5 distinct levels:

| Depth (blocks) | Shading                      | Visual Effect |
| -------------- | ---------------------------- | ------------- |
| 1-2            | Brightest (255/255)          | Shallow water |
| 3-4            | Checkerboard (bright/normal) | Transitional  |
| 5-7            | Normal (220/255)             | Medium depth  |
| 8-11           | Checkerboard (normal/dark)   | Transitional  |
| 12+            | Darkest (180/255)            | Deep water    |

The checkerboard pattern alternates between two shades based on `(x + z) % 2`, creating the distinctive dithered water appearance seen on vanilla Minecraft maps.

## Testing

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch
```

### Test Structure

- `__tests__/player-state.test.ts` - Unit tests for PlayerStateService
- `__tests__/api.test.ts` - Integration tests for API endpoints

## Authentication

Protected endpoints require the `x-mc-auth-token` header:

```bash
curl -X POST http://localhost:3000/api/v1/world/players \
  -H "Content-Type: application/json" \
  -H "x-mc-auth-token: your-secret-token" \
  -d '{"players": [...]}'
```

## Example Usage

### Send Player Update from Minecraft

```typescript
const response = await fetch('http://localhost:3000/api/v1/world/players', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'x-mc-auth-token': 'your-secret-token',
    },
    body: JSON.stringify({
        players: [
            {
                name: 'Steve',
                x: 100,
                y: 64,
                z: 200,
                dimension: 'overworld',
            },
        ],
    }),
});
```

### Query Players from Web Client

```typescript
const response = await fetch('http://localhost:3000/api/v1/players');
const { data } = await response.json();
console.log(data.players);
```

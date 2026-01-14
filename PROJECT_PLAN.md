# Minecraft World Map Project

---

## Completion Status Tracking

<!--
COPILOT STATUS TRACKING
Use these status markers to track completion. Update status as work progresses.
Format: `[STATUS]` where STATUS is one of the values below.
-->

| Status      | Marker          | Description                            |
| ----------- | --------------- | -------------------------------------- |
| Not Started | `[NOT_STARTED]` | Work has not begun                     |
| In Progress | `[IN_PROGRESS]` | Currently being worked on              |
| Completed   | `[COMPLETED]`   | Fully implemented and tested           |
| Blocked     | `[BLOCKED]`     | Cannot proceed due to dependency/issue |

### Overall Project Status

| Component      | Status          | Notes                                      |
| -------------- | --------------- | ------------------------------------------ |
| Shared Package | `[COMPLETED]`   | Types and constants                        |
| Behavior Pack  | `[IN_PROGRESS]` | Minecraft script module (Phase 1 complete) |
| Web Server     | `[IN_PROGRESS]` | Fastify + API (Phase 1 complete)           |
| Web Client     | `[NOT_STARTED]` | Leaflet.js map UI                          |
| CI/CD Pipeline | `[NOT_STARTED]` | GitHub Actions                             |
| Documentation  | `[NOT_STARTED]` | API docs, deployment guide                 |

---

## Overview

This project consists of two major components:

1. **Minecraft Behavior Pack** - TypeScript-based behavior pack that monitors world state and sends data to an external server
2. **Map Web Server** - TypeScript web server that receives world data and serves a Google Maps-like visualization

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              MINECRAFT WORLD                                 │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     Behavior Pack (TypeScript)                       │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌─────────────────────────┐   │   │
│  │  │ World Events │  │ State Reader │  │ HTTP Client (@minecraft │   │   │
│  │  │  Listeners   │──│   Service    │──│   /server-net)          │   │   │
│  │  └──────────────┘  └──────────────┘  └───────────┬─────────────┘   │   │
│  └──────────────────────────────────────────────────┼─────────────────┘   │
└─────────────────────────────────────────────────────┼─────────────────────┘
                                                      │ HTTP POST
                                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           MAP WEB SERVER                                     │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                        Fastify Server                                 │  │
│  │  ┌───────────────┐  ┌───────────────┐  ┌─────────────────────────┐  │  │
│  │  │  REST API     │  │  In-Memory    │  │  WebSocket Server       │  │  │
│  │  │  (Ingest)     │──│  State        │──│  (Real-time Updates)    │  │  │
│  │  └───────────────┘  └───────────────┘  └───────────┬─────────────┘  │  │
│  │                                                    │                  │  │
│  │  ┌───────────────┐  ┌───────────────┐             │                  │  │
│  │  │  Static File  │  │  Map Tile     │             │                  │  │
│  │  │  Server       │  │  Generator    │◄────────────┘                  │  │
│  │  └───────┬───────┘  └───────────────┘                                │  │
│  └──────────┼───────────────────────────────────────────────────────────┘  │
└─────────────┼───────────────────────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           WEB CLIENT                                         │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  Leaflet.js / OpenLayers Map Interface                                │  │
│  │  - Pan/Zoom navigation                                                │  │
│  │  - Layer controls (terrain, structures, players)                      │  │
│  │  - Real-time player markers                                           │  │
│  │  - Block/structure overlays                                           │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Project Structure

```
map/
├── packages/
│   ├── behavior-pack/           # Minecraft Behavior Pack
│   │   ├── manifest.json        # Behavior pack manifest
│   │   ├── pack_icon.png        # Pack icon
│   │   ├── scripts/             # Compiled JS output
│   │   ├── src/                 # TypeScript source
│   │   │   ├── index.ts         # Entry point
│   │   │   ├── events/          # World event listeners
│   │   │   ├── state/           # World state readers
│   │   │   ├── network/         # HTTP client wrapper
│   │   │   └── types/           # Type definitions
│   │   ├── tsconfig.json
│   │   ├── package.json
│   │   └── __tests__/           # Unit tests
│   │
│   ├── server/                  # Web Server
│   │   ├── src/
│   │   │   ├── index.ts         # Entry point
│   │   │   ├── api/             # REST API routes
│   │   │   ├── services/        # Business logic
│   │   │   ├── state/           # In-memory state management
│   │   │   ├── websocket/       # Real-time updates
│   │   │   ├── tiles/           # Map tile generation
│   │   │   └── types/           # Shared types
│   │   ├── data/                # Tile storage on disk
│   │   │   └── tiles/           # Rendered tiles: /{dimension}/{zoom}/{x}/{z}.png
│   │   ├── public/              # Static web assets
│   │   ├── tsconfig.json
│   │   ├── package.json
│   │   └── __tests__/           # Unit & integration tests
│   │
│   └── shared/                  # Shared types & utilities
│       ├── src/
│       │   ├── types/           # Shared type definitions
│       │   └── constants/       # Shared constants
│       ├── tsconfig.json
│       └── package.json
│
├── e2e/                         # End-to-end tests
│   ├── tests/
│   └── playwright.config.ts
│
├── docs/                        # Documentation
│   ├── API.md
│   ├── BEHAVIOR_PACK.md
│   └── DEPLOYMENT.md
│
├── scripts/                     # Build & deployment scripts
│   ├── build-pack.ts
│   ├── deploy-pack.ts
│   └── dev-server.ts
│
├── package.json                 # Root package.json (workspaces)
├── pnpm-workspace.yaml          # pnpm workspace config
├── tsconfig.base.json           # Shared TypeScript config
└── README.md
```

---

## Part 1: Minecraft Behavior Pack

### Technology Stack

| Component   | Technology              | Purpose                     |
| ----------- | ----------------------- | --------------------------- |
| Language    | TypeScript              | Type-safe development       |
| Runtime     | Minecraft Script API    | `@minecraft/server` v1.16+  |
| HTTP Client | `@minecraft/server-net` | External HTTP requests      |
| Build Tool  | esbuild                 | Fast bundling for Minecraft |
| Testing     | Vitest                  | Unit testing with mocks     |

### Key Minecraft APIs

```typescript
// Core APIs needed
import { world, system, Player, Block, Dimension } from '@minecraft/server';
import { http, HttpRequest, HttpRequestMethod } from '@minecraft/server-net';
```

### manifest.json Structure

```json
{
    "format_version": 2,
    "header": {
        "name": "World Map Sync",
        "description": "Syncs world state to external map server",
        "uuid": "<generate-uuid>",
        "version": [1, 0, 0],
        "min_engine_version": [1, 21, 0]
    },
    "modules": [
        {
            "type": "script",
            "language": "javascript",
            "uuid": "<generate-uuid>",
            "entry": "scripts/index.js",
            "version": [1, 0, 0]
        }
    ],
    "dependencies": [
        {
            "module_name": "@minecraft/server",
            "version": "1.16.0"
        },
        {
            "module_name": "@minecraft/server-net",
            "version": "1.0.0-beta"
        }
    ],
    "capabilities": ["script_eval"]
}
```

### Events to Monitor

| Event             | API                                            | Data Captured                |
| ----------------- | ---------------------------------------------- | ---------------------------- |
| Block Changes     | `world.afterEvents.blockPlace` / `blockBreak`  | Position, block type, player |
| Player Movement   | `world.afterEvents.playerSpawn` + polling      | Player positions             |
| Entity Changes    | `world.afterEvents.entitySpawn` / `entityDie`  | Entity positions, types      |
| Chunk Loading     | Custom polling with `dimension.getBlock()`     | Terrain data                 |
| Player Join/Leave | `world.afterEvents.playerJoin` / `playerLeave` | Player list                  |

### Implementation Phases

#### Phase 1: Basic Setup & Events (Week 1) `[COMPLETED]`

- [x] Set up behavior pack project structure
- [x] Configure TypeScript + esbuild build pipeline
- [x] Implement basic event listeners (block place/break)
- [x] Create HTTP client wrapper
- [x] Basic server connectivity test

#### Phase 2: World State Reading (Week 2) `[NOT_STARTED]`

- [ ] Implement chunk scanning service
- [ ] Player position tracking
- [ ] Entity tracking
- [ ] Efficient data batching/throttling

#### Phase 3: Optimization & Reliability (Week 3) `[NOT_STARTED]`

- [ ] Add request queuing and retry logic
- [ ] Implement delta updates (only send changes)
- [ ] Add compression for large payloads
- [ ] Handle server disconnection gracefully

### Testing Strategy for Behavior Pack `[NOT_STARTED]`

```
┌─────────────────────────────────────────────────────────┐
│                   TESTING PYRAMID                        │
├─────────────────────────────────────────────────────────┤
│                                                          │
│                    ┌─────────┐                          │
│                    │  E2E    │  Manual in-game testing  │
│                    │  Tests  │  + automated validation  │
│                    └────┬────┘                          │
│               ┌─────────┴─────────┐                     │
│               │  Integration      │  Mock Minecraft     │
│               │  Tests            │  APIs + real HTTP   │
│               └─────────┬─────────┘                     │
│          ┌──────────────┴──────────────┐                │
│          │       Unit Tests            │  Pure logic    │
│          │  (Vitest + mocked APIs)     │  functions     │
│          └─────────────────────────────┘                │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

#### Unit Tests (Automated)

```typescript
// Example: Testing data transformation logic
describe('BlockChangeSerializer', () => {
    it('should serialize block change to API format', () => {
        const blockChange = {
            position: { x: 10, y: 64, z: -20 },
            blockType: 'minecraft:stone',
            previousType: 'minecraft:air',
            player: 'Steve',
        };

        const result = serializeBlockChange(blockChange);

        expect(result).toEqual({
            type: 'block_change',
            pos: [10, 64, -20],
            block: 'stone',
            prev: 'air',
            player: 'Steve',
            timestamp: expect.any(Number),
        });
    });
});
```

#### Integration Tests

- Mock `@minecraft/server` and `@minecraft/server-net` modules
- Test event handlers trigger correct HTTP calls
- Verify batching and throttling behavior

#### E2E Validation

- Deploy pack to test world
- Use Minecraft's `/scriptevent` for triggering test scenarios
- Validate server receives expected data

---

## Part 2: Map Web Server

### Technology Stack

| Component       | Technology              | Purpose                          |
| --------------- | ----------------------- | -------------------------------- |
| Runtime         | Node.js 20+             | Server runtime                   |
| Framework       | Fastify                 | Fast, low-overhead HTTP          |
| WebSocket       | Socket.io               | Real-time browser updates        |
| State Storage   | In-memory + File system | Players in memory, tiles on disk |
| Map Library     | Leaflet.js              | Client-side map rendering        |
| Tile Generation | Sharp                   | Image processing                 |
| Build Tool      | Vite                    | Frontend bundling                |
| Testing         | Vitest + Playwright     | Unit + E2E tests                 |

### API Design

#### REST Endpoints

```
POST /api/v1/world/blocks          - Receive block changes
POST /api/v1/world/players         - Receive player positions
POST /api/v1/world/entities        - Receive entity updates
POST /api/v1/world/chunks          - Receive chunk data
GET  /api/v1/world/state           - Get current world state
GET  /api/v1/tiles/{z}/{x}/{y}.png - Get map tile
GET  /api/v1/players               - Get player list
WS   /ws                           - WebSocket for real-time updates
```

#### Authentication

```typescript
// Simple shared secret for Minecraft → Server auth
// Header: X-MC-Auth-Token: <shared-secret>
```

### Map Tile Generation

```
┌────────────────────────────────────────────────────────────────┐
│                     TILE GENERATION PIPELINE                    │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Minecraft Blocks    ──►   Block Color Map   ──►   Tile Image │
│                                                                 │
│  ┌─────────────┐         ┌─────────────┐        ┌───────────┐ │
│  │ stone       │   ──►   │ #808080     │   ──►  │           │ │
│  │ grass_block │   ──►   │ #7CFC00     │   ──►  │  256x256  │ │
│  │ water       │   ──►   │ #1E90FF     │   ──►  │   PNG     │ │
│  │ oak_log     │   ──►   │ #8B4513     │   ──►  │           │ │
│  └─────────────┘         └─────────────┘        └───────────┘ │
│                                                                 │
│  Zoom Levels:                                                   │
│  - z0: 1 block = 1 pixel (highest detail)                      │
│  - z1: 2 blocks = 1 pixel                                       │
│  - z2: 4 blocks = 1 pixel                                       │
│  - z3: 8 blocks = 1 pixel (overview)                           │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

### Implementation Phases

#### Phase 1: Core Server (Week 1) `[COMPLETED]`

- [x] Set up Fastify server with TypeScript
- [x] Implement REST API for receiving Minecraft data
- [x] Set up in-memory state management for players
- [x] Set up file-based tile storage directory structure

#### Phase 2: Map Generation (Week 2) `[COMPLETED]`

- [x] Implement block-to-color mapping
- [x] Create tile generation service
- [x] Implement tile caching
- [x] Set up tile serving endpoint
- [x] Update testing webpage to view tiles (both a map control and fetching specific tiles)

#### Phase 3: Web Client (Week 3) `[NOT_STARTED]`

- [ ] Create Leaflet.js map interface
- [ ] Implement custom tile layer
- [ ] Add player markers
- [ ] Add real-time WebSocket updates

#### Phase 4: Polish & Features (Week 4) `[NOT_STARTED]`

- [ ] Layer controls (terrain, players, structures)
- [ ] Search functionality
- [ ] Coordinate display
- [ ] Mobile responsiveness

### Data Storage

#### In-Memory State (Players)

```typescript
// Players are stored in memory for simplicity
// No persistence - state resets on server restart

interface Player {
    name: string;
    x: number;
    y: number;
    z: number;
    dimension: 'overworld' | 'nether' | 'the_end';
    lastSeen: number; // Unix timestamp
}

// In-memory store
const players: Map<string, Player> = new Map();
```

#### File-Based Tile Storage

Rendered map tiles are stored on disk using a hierarchical folder structure:

```
data/tiles/
├── overworld/
│   ├── 0/                    # Zoom level 0 (highest detail)
│   │   ├── 0/
│   │   │   ├── 0.png         # Tile at x=0, z=0
│   │   │   ├── 1.png         # Tile at x=0, z=1
│   │   │   └── ...
│   │   ├── 1/
│   │   │   ├── 0.png         # Tile at x=1, z=0
│   │   │   └── ...
│   │   └── ...
│   ├── 1/                    # Zoom level 1
│   ├── 2/                    # Zoom level 2
│   └── 3/                    # Zoom level 3 (overview)
├── nether/
│   └── {zoom}/{x}/{z}.png
└── the_end/
    └── {zoom}/{x}/{z}.png
```

**Path format:** `data/tiles/{dimension}/{zoom}/{x}/{z}.png`

**Benefits:**

- Simple to understand and debug
- Easy to serve directly via static file server
- Can be cached by CDN/reverse proxy
- Tiles can be manually inspected or regenerated
- No database dependencies

### Testing Strategy for Web Server `[NOT_STARTED]`

#### Unit Tests (Vitest)

```typescript
describe('TileGenerator', () => {
    it('should generate correct tile for chunk data', async () => {
        const chunkData = createMockChunkData([{ x: 0, z: 0, blocks: ['grass_block', 'stone', 'water'] }]);

        const tile = await tileGenerator.generate(chunkData, { zoom: 0 });

        expect(tile.width).toBe(256);
        expect(tile.height).toBe(256);
        // Verify specific pixels match expected colors
    });
});

describe('WorldStateService', () => {
    it('should update block and invalidate affected tiles', async () => {
        const service = new WorldStateService();

        await service.updateBlock({
            dimension: 'overworld',
            x: 100,
            y: 64,
            z: 200,
            blockType: 'diamond_ore',
        });

        // Verify tile file was deleted (will be regenerated on next request)
        const tilePath = 'data/tiles/overworld/0/6/12.png';
        expect(fs.existsSync(tilePath)).toBe(false);
    });
});

describe('PlayerStateService', () => {
    it('should store and retrieve player positions in memory', () => {
        const service = new PlayerStateService();

        service.updatePlayer({
            name: 'TestPlayer',
            x: 100,
            y: 64,
            z: 200,
            dimension: 'overworld',
        });

        const player = service.getPlayer('TestPlayer');
        expect(player).toEqual({
            name: 'TestPlayer',
            x: 100,
            y: 64,
            z: 200,
            dimension: 'overworld',
            lastSeen: expect.any(Number),
        });
    });
});
```

#### Integration Tests

```typescript
describe('API Integration', () => {
    let app: FastifyInstance;

    beforeAll(async () => {
        app = await buildApp({ testing: true });
    });

    it('should accept block changes and update state', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/api/v1/world/blocks',
            headers: { 'X-MC-Auth-Token': 'test-secret' },
            payload: {
                changes: [{ dimension: 'overworld', x: 0, y: 64, z: 0, blockType: 'stone' }],
            },
        });

        expect(response.statusCode).toBe(200);

        // Verify state was updated
        const stateResponse = await app.inject({
            method: 'GET',
            url: '/api/v1/world/state',
        });

        expect(stateResponse.json().blockCount).toBe(1);
    });
});
```

#### E2E Tests (Playwright)

```typescript
test('map displays player markers in real-time', async ({ page }) => {
    await page.goto('/');

    // Wait for map to load
    await expect(page.locator('.leaflet-container')).toBeVisible();

    // Simulate player position update via API
    await page.request.post('/api/v1/world/players', {
        data: {
            players: [{ name: 'TestPlayer', x: 100, y: 64, z: 200 }],
        },
    });

    // Verify marker appears
    await expect(page.locator('.player-marker[data-player="TestPlayer"]')).toBeVisible({ timeout: 5000 });
});
```

---

## Testing Automation Summary `[NOT_STARTED]`

### Continuous Integration Pipeline `[NOT_STARTED]`

```yaml
# .github/workflows/ci.yml
name: CI

on: [push, pull_request]

jobs:
    test-shared:
        runs-on: ubuntu-latest
        steps:
            - uses: actions/checkout@v4
            - uses: pnpm/action-setup@v2
            - uses: actions/setup-node@v4
              with:
                  node-version: '20'
                  cache: 'pnpm'
            - run: pnpm install
            - run: pnpm --filter shared test
            - run: pnpm --filter shared build

    test-behavior-pack:
        runs-on: ubuntu-latest
        needs: test-shared
        steps:
            - uses: actions/checkout@v4
            - uses: pnpm/action-setup@v2
            - uses: actions/setup-node@v4
              with:
                  node-version: '20'
                  cache: 'pnpm'
            - run: pnpm install
            - run: pnpm --filter behavior-pack test
            - run: pnpm --filter behavior-pack build
            - run: pnpm --filter behavior-pack lint

    test-server:
        runs-on: ubuntu-latest
        needs: test-shared
        steps:
            - uses: actions/checkout@v4
            - uses: pnpm/action-setup@v2
            - uses: actions/setup-node@v4
              with:
                  node-version: '20'
                  cache: 'pnpm'
            - run: pnpm install
            - run: pnpm --filter server test
            - run: pnpm --filter server build
            - run: pnpm --filter server lint

    e2e-tests:
        runs-on: ubuntu-latest
        needs: [test-behavior-pack, test-server]
        steps:
            - uses: actions/checkout@v4
            - uses: pnpm/action-setup@v2
            - uses: actions/setup-node@v4
              with:
                  node-version: '20'
                  cache: 'pnpm'
            - run: pnpm install
            - run: pnpm --filter server build
            - run: pnpm exec playwright install --with-deps
            - run: pnpm --filter e2e test
```

### Test Commands

```bash
# Root package.json scripts
pnpm test              # Run all tests
pnpm test:unit         # Unit tests only
pnpm test:integration  # Integration tests only
pnpm test:e2e          # Playwright E2E tests
pnpm test:coverage     # Generate coverage report

# Per-package
pnpm --filter behavior-pack test
pnpm --filter server test
pnpm --filter e2e test
```

---

## Development Workflow `[NOT_STARTED]`

### Local Development `[NOT_STARTED]`

```bash
# Terminal 1: Start web server in dev mode
pnpm --filter server dev

# Terminal 2: Watch & rebuild behavior pack
pnpm --filter behavior-pack dev

# Terminal 3: Run E2E tests in watch mode
pnpm --filter e2e test:watch
```

### Deploying Behavior Pack for Testing `[NOT_STARTED]`

```bash
# Build and copy to Minecraft
pnpm --filter behavior-pack build
pnpm --filter behavior-pack deploy  # Copies to com.mojang folder
```

### Mock Minecraft for Development `[NOT_STARTED]`

Create a mock Minecraft client for testing server without actual Minecraft:

```typescript
// scripts/mock-minecraft.ts
// Simulates Minecraft sending data to the server
async function simulateWorld() {
    setInterval(async () => {
        await fetch('http://localhost:3000/api/v1/world/players', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                players: [{ name: 'Player1', x: Math.random() * 100, y: 64, z: Math.random() * 100 }],
            }),
        });
    }, 1000);
}
```

---

## Risk Mitigation

| Risk                                | Mitigation                                          |
| ----------------------------------- | --------------------------------------------------- |
| `@minecraft/server-net` limitations | Test early; have fallback via WebSocket if needed   |
| Large world data size               | Implement chunking, compression, delta updates      |
| Tile generation performance         | Pre-generate tiles, use caching, background workers |
| Minecraft API changes               | Pin versions, abstract API usage                    |
| Server availability                 | Queue requests in behavior pack, retry logic        |

---

## Getting Started Checklist

### Week 1 Goals `[NOT_STARTED]`

- [ ] Initialize monorepo with pnpm workspaces
- [ ] Set up shared types package
- [ ] Create basic behavior pack that logs events
- [ ] Create basic Fastify server with health endpoint
- [ ] Establish HTTP communication between pack and server
- [ ] Set up CI pipeline

### Success Criteria `[NOT_STARTED]`

- Behavior pack successfully sends block change to server
- Server persists block change to database
- Basic map page shows a single tile
- All unit tests pass in CI

---

## Resources

- [Minecraft Bedrock Script API Docs](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/)
- [@minecraft/server-net Reference](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server-net/minecraft-server-net)
- [Leaflet.js Documentation](https://leafletjs.com/reference.html)
- [Fastify Documentation](https://fastify.dev/docs/latest/)
- [Vitest Documentation](https://vitest.dev/)
- [Playwright Documentation](https://playwright.dev/)

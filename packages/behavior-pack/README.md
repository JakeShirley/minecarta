# @minecraft-map/behavior-pack

Minecraft Behavior Pack that monitors world state and sends data to the map web server.

## Features

- Monitors block place/break events
- Tracks player positions
- Tracks entity positions
- Sends real-time updates to the map server via HTTP

## Installation

### For Development

1. Build the pack:
   ```bash
   pnpm build
   ```

2. Create a symlink or copy the pack to your Minecraft behavior packs folder:
   - Windows: `%APPDATA%\Minecraft\development_behavior_packs\world-map-sync`
   - macOS: `~/Library/Application Support/minecraft/development_behavior_packs/world-map-sync`

3. Enable the behavior pack in your world settings

### Required Experimental Features

This pack requires the following experimental features to be enabled in your world:

- **Beta APIs** - Required for `@minecraft/server-net` HTTP functionality

## Configuration

The pack connects to the map server using environment configuration. By default:
- Server URL: `http://localhost:3000`

To change the server URL, modify the `config/index.ts` file before building.

## API Dependencies

- `@minecraft/server` v1.16.0+
- `@minecraft/server-net` v1.0.0-beta

## Project Structure

```
behavior-pack/
├── manifest.json          # Behavior pack manifest
├── pack_icon.png          # Pack icon (optional)
├── scripts/               # Compiled JavaScript (output)
│   └── index.js
├── src/                   # TypeScript source
│   ├── index.ts           # Entry point
│   ├── config/            # Configuration
│   ├── events/            # World event listeners
│   ├── network/           # HTTP client wrapper
│   ├── serializers/       # Data transformation
│   └── types/             # Type definitions
└── __tests__/             # Unit tests
```

## Development

### Build

```bash
pnpm build
```

### Watch mode

```bash
pnpm build:watch
```

### Run tests

```bash
pnpm test
```

## Events Monitored

| Event | Description |
|-------|-------------|
| `blockPlace` | When a player places a block |
| `blockBreak` | When a player breaks a block |
| `playerJoin` | When a player joins the world |
| `playerLeave` | When a player leaves the world |
| `playerSpawn` | When a player spawns |

## Data Flow

```
Minecraft World Events
        │
        ▼
  Event Listeners (events/)
        │
        ▼
  Data Serialization (serializers/)
        │
        ▼
  HTTP Client (network/)
        │
        ▼
  Map Web Server
```

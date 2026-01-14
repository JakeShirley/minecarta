# @minecraft-map/behavior-pack

Minecraft Behavior Pack that monitors world state and sends data to the map web server.

## Features

- Monitors block place/break events
- Tracks player positions
- Tracks entity positions
- Sends real-time updates to the map server via HTTP

## Installation

### For Development

1. Configure deployment environment:
   ```bash
   cp .env.example .env
   # Edit .env with your settings
   ```

2. Build the pack:
   ```bash
   pnpm build
   ```

3. Deploy to Minecraft:
   ```bash
   pnpm deploy
   ```
   Or build and deploy in one step:
   ```bash
   pnpm build:deploy
   ```

The deployment uses `@minecraft/core-build-tasks` to automatically copy files to your Minecraft `development_behavior_packs` folder based on your `.env` configuration.

### Required Experimental Features

This pack requires the following experimental features to be enabled in your world:

- **Beta APIs** - Required for `@minecraft/server-net` HTTP functionality

## Configuration

### Build Environment (.env)

Copy `.env.example` to `.env` and configure:

| Variable | Description |
|----------|-------------|
| `PROJECT_NAME` | Folder name in development_behavior_packs (default: `world-map-sync`) |
| `MINECRAFT_PRODUCT` | Target Minecraft version (`BedrockUWP`, `PreviewUWP`, `BedrockGDK`, etc.) |
| `CUSTOM_DEPLOYMENT_PATH` | Custom path when using `MINECRAFT_PRODUCT=Custom` |

### Runtime Configuration

The pack connects to the map server using settings in `config/index.ts`:
- Server URL: `http://localhost:3000`

## API Dependencies

- `@minecraft/server` v1.16.0+
- `@minecraft/server-net` v1.0.0-beta

## Project Structure

```
behavior-pack/
├── manifest.json          # Behavior pack manifest
├── pack_icon.png          # Pack icon (optional)
├── just.config.cts        # Build task configuration
├── .env                   # Local deployment settings (gitignored)
├── .env.example           # Example environment configuration
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

### Deploy to Minecraft

```bash
pnpm deploy
```

### Build and Deploy

```bash
pnpm build:deploy
```

### Clean build outputs

```bash
pnpm clean
```

### Clean deployed files from Minecraft

```bash
pnpm clean:deploy
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

## Commands

The behavior pack registers custom commands for map operations:

### `/mapsync:scan`

Force scan a block range and submit tiles to the map server.

```
/mapsync:scan <min> <max> [dimension]
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `min` | Location | Minimum corner coordinates |
| `max` | Location | Maximum corner coordinates |
| `dimension` | String (optional) | Dimension ID (defaults to player's dimension) |

### `/mapsync:autogen`

Toggle automatic tile generation around the player. When enabled, the pack will periodically scan and send tiles within the specified radius around the player.

```
/mapsync:autogen [radius] [interval]
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `radius` | Integer (optional) | Radius in blocks (16-256, default: 64) |
| `interval` | Integer (optional) | Scan interval in seconds (1-300, default: 10) |

**Usage:**
- `/mapsync:autogen` - Toggle off or show status
- `/mapsync:autogen 64 10` - Enable with 64-block radius, scanning every 10 seconds
- `/mapsync:autogen 128 30` - Enable with 128-block radius, scanning every 30 seconds

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

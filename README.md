# MineCarta

<p align="center">
  <img src="packages/server/public/logo.png" alt="MineCarta Logo" width="200">
</p>

> ⚠️ **Work in Progress** - This project is under active development. Most features are not yet implemented.

> 🔓 **Security Notice** - The web server component of this project does not implement authentication or authorization mechanisms. It is intended for use in trusted local network environments only. Please do not expose this server directly to the public internet, as doing so may result in unauthorized access to your world data.

A real-time web-based map visualization for Minecraft Bedrock Edition worlds. This project captures world state data from a Minecraft behavior pack and displays it through an interactive Google Maps-like interface.

## Overview

The project consists of two main components:

- **Minecraft Behavior Pack** - A TypeScript-based behavior pack that monitors world state (player positions, blocks, structures) and sends data to an external server via HTTP
- **Map Web Server** - A TypeScript web server that receives world data, stores it in a database, and serves a real-time map visualization using Leaflet.js

## Project Structure

```
packages/
├── behavior-pack/    # Minecraft Behavior Pack (TypeScript)
├── server/           # Web Server (Fastify + WebSocket)
└── shared/           # Shared types & utilities
```

## Features

- Pan/zoom map navigation
- Real-time player position tracking
- Layer controls for terrain and players
- WebSocket-based live updates

## Screenshots

![MineCarta Map View](assets/docs/screenshot1.png)

## Setup Guide

This guide walks you through setting up MineCarta to run with your Minecraft Bedrock Dedicated Server (BDS).

### Prerequisites

- **Minecraft Bedrock Dedicated Server (BDS)** - Download from [minecraft.net](https://www.minecraft.net/en-us/download/server/bedrock)
- **Docker** - For running the map server

### Step 1: Start the Map Server

The map server is available as a Docker image from GitHub Container Registry:

```bash
# Create a directory for map tile data
mkdir minecarta-data

# Run the container
docker run -d \
  --name minecarta \
  -p 3000:3000 \
  -v ./minecarta-data:/data \
  -e AUTH_TOKEN=your-secret-token \
  ghcr.io/jakeshirley/minecarta/server:latest
```

Replace `your-secret-token` with a secure token of your choice. You'll need this same token when configuring the behavior pack.

The map UI will be available at `http://localhost:3000/map.html`.

### Step 2: Install the Behavior Pack

1. Download the latest behavior pack release from the [Releases](https://github.com/JakeShirley/minecarta/releases) page
2. Extract the behavior pack to your BDS `behavior_packs` directory:
   ```
   <BDS>/behavior_packs/minecarta-sync/
   ```
3. Add the behavior pack to your world's `world_behavior_packs.json`:
   ```json
   [
       {
           "pack_id": "8b78eb38-7c61-4c53-811f-39c11e11bd72",
           "version": [1, 0, 0]
       }
   ]
   ```

### Step 3: Configure the Behavior Pack

The behavior pack requires configuration to connect to your map server. Run the included setup script from within the deployed behavior pack directory:

```powershell
cd <BDS>/behavior_packs/minecarta-sync
.\utilities\Setup-BdsConfig.ps1 -ServerUrl "http://host.docker.internal:3000" -AuthToken "your-secret-token"
```

> **Note:** Use `host.docker.internal` if BDS is running on the same machine as the Docker container. Otherwise, use the actual IP/hostname of the machine running the map server.

The script creates the required configuration files in the BDS `config` directory.

### Step 4: Enable Experimental Features

In your world settings, enable the following experimental feature:

- **Beta APIs** - Required for HTTP networking functionality

### Step 5: Start the Server

Start your Bedrock Dedicated Server. The behavior pack will automatically begin sending world data to the map server.

Open `http://localhost:3000/map.html` in your browser to view the live map!

### Configuration Options

#### Map Server Environment Variables

| Variable     | Default     | Description                          |
| ------------ | ----------- | ------------------------------------ |
| `PORT`       | `3000`      | Server port                          |
| `AUTH_TOKEN` | `dev-token` | Authentication token                 |
| `DATA_DIR`   | `/data`     | Directory for tile storage           |
| `LOG_LEVEL`  | `info`      | Log level (fatal/error/warn/info/debug/trace) |

#### Behavior Pack Configuration

Run `Setup-BdsConfig.ps1` with these optional parameters:

| Parameter               | Default   | Description                                |
| ----------------------- | --------- | ------------------------------------------ |
| `-PlayerUpdateInterval` | `20`      | Ticks between player updates (20 = 1 sec)  |
| `-TimeSyncInterval`     | `1200`    | Ticks between world time syncs             |
| `-LogLevel`             | `warning` | Log level (debug/info/warning/error/none)  |
| `-SendPlayerStats`      | `$true`   | Whether to send player health/hunger/armor |

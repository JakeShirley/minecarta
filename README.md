# MineCarta

<p align="center">
  <img src="packages/server/public/logo.png" alt="MineCarta Logo" width="200">
</p>

> ⚠️ **Work in Progress** - This project is under active development. Most features are not yet implemented.

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

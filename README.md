# Swingatron

Swingatron is a cross-platform music player built with Electron and Vue.js. It offers a sleek and intuitive interface for managing and playing your Swing Music library.

## Features

- Browse and play music from your Swing Music server
- Create and manage playlists
- Favorite tracks and albums
- Search your music library
- View recently played tracks
- Scan library for new music additions
- Fetch artist images from external sources
- **Discord Rich Presence** - Show what you're listening to on Discord

## Installation

Download the latest release for your operating system from the [Releases](https://github.com/cloudwithax/swingatron/releases) page.

## Discord Rich Presence Setup

To enable Discord Rich Presence, you need to create a Discord application and configure the client ID:

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications)
2. Click "New Application" and give it a name (e.g., "Swingatron")
3. Copy the **Application ID** from the "General Information" page
4. Open `src/main/discord-rpc.ts` and replace the `CLIENT_ID` value with your Application ID
5. (Optional) Upload custom images for your Rich Presence:
   - Go to "Rich Presence" → "Art Assets" in your Discord application
   - Upload images with the following names:
     - `swingatron_logo` - Main logo shown when playing music
     - `play` - Small icon shown when playing
     - `pause` - Small icon shown when paused
6. Rebuild the application

The Rich Presence will automatically show:

- Track title as the main detail
- Artist name as the state
- Album name as the large image tooltip
- Play/pause status with appropriate icons
- Elapsed time and remaining time when playing

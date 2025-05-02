# Lightfast Blender Integration

This folder contains the necessary files to integrate Blender with the Lightfast desktop application, allowing AI-powered control of Blender through natural language commands.

## Contents

- **blender_lightfast_addon.py**: The main Blender addon for connecting to Lightfast (no external dependencies!)
- **README_BLENDER_ADDON.md**: Detailed installation and usage instructions for the addon
- **example.py**: Example script demonstrating programmatic Blender integration

## Quick Start

1. Install the addon in Blender:

   - Open Blender
   - Go to Edit → Preferences → Add-ons
   - Click "Install..." and select `blender_lightfast_addon.py`
   - Enable the addon

2. Start the Lightfast desktop application

3. In Blender, open the Lightfast panel in the sidebar and click "Connect"

4. Use the Lightfast chat interface to control Blender with natural language commands, such as:
   - "Create a cube at position x=2, y=0, z=1"
   - "Create a sphere named 'Planet'"
   - "Create a monkey head at z=3"

## Development

This integration uses a WebSocket connection between the Lightfast desktop application and Blender. The communication protocol is JSON-based, with the desktop app sending commands and Blender returning results.

### Communication Flow

1. Lightfast Desktop (Node.js/Electron) hosts a WebSocket server
2. Blender addon connects as a client
3. AI generates commands for Blender based on user input
4. Commands are sent via WebSocket
5. Blender executes commands and returns results
6. Results are displayed in the Lightfast chat UI

### WebSocket Implementation

The Blender addon implements the WebSocket protocol using Python's built-in `socket` module, eliminating the need for external dependencies. The implementation includes:

- WebSocket handshake
- Frame encoding/decoding
- JSON message parsing
- Event-based message handling

The example.py file shows an alternative implementation using the websocket-client library if you prefer that approach for custom scripts.

### Adding New Features

To add new commands:

1. Update the Blender addon with new command handlers
2. Add the command schemas to the AI tools in the desktop app
3. Update the WebSocket message processing in both applications

## Documentation

For detailed information about the addon, see [README_BLENDER_ADDON.md](./README_BLENDER_ADDON.md).

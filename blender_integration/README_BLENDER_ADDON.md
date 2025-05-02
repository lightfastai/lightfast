# Lightfast Blender Integration Addon

This addon allows Blender to connect to the Lightfast desktop application via WebSocket, enabling two-way communication for creating and manipulating objects.

## Requirements

1. Blender 3.3 or newer
2. No external dependencies! (Uses Python's built-in socket module)

## Installation

1. Download `blender_lightfast_addon.py`
2. Open Blender
3. Go to `Edit → Preferences → Add-ons`
4. Click "Install..." and select the downloaded file
5. Enable the addon by checking the box next to "3D View: Lightfast Integration"

## Usage

1. Start the Lightfast desktop application first (it needs to run the WebSocket server)
2. In Blender, you'll find a new "Lightfast" tab in the 3D View sidebar (press `N` to show/hide)
3. By default, the addon tries to connect automatically to `localhost:8765`
4. You can manually connect/disconnect using the buttons in the sidebar
5. Use the "Test Create Cube" button to test object creation locally

## Connection Settings

The default settings are:

- Host: `localhost`
- Port: `8765` (matches the Lightfast desktop app's WebSocket server)
- Auto Connect: `ON` (automatically connect when Blender starts)

You can change these settings in the Lightfast panel or in the addon preferences.

## Troubleshooting

1. **Connection issues:**

   - Make sure the Lightfast desktop app is running
   - Check that the WebSocket server port matches (default: 8765)
   - Look for connection errors in Blender's system console (`Window → Toggle System Console` on Windows or check terminal output on macOS/Linux)

2. **Objects not being created:**
   - Confirm that the connection is established (status should show "Connected")
   - Check the console for any error messages

## How It Works

The addon uses Python's built-in `socket` module to:

1. Establish a TCP connection to the Lightfast WebSocket server
2. Perform the WebSocket handshake
3. Send and receive WebSocket frames
4. Parse JSON messages and execute commands

This approach eliminates the need for external dependencies, making the addon easier to install and use.

## Development

The addon uses the following components:

1. Socket connection with WebSocket protocol implementation
2. Command handlers: Process commands received from the desktop app
3. Blender UI: Panel and operators for user interaction

When extending the addon, add new command handlers in the pattern of `handle_create_object()`.

## License

This addon is part of the Lightfast project.

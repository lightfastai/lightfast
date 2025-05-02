"""
Example script to demonstrate programmatic Blender integration with Lightfast.

Usage:
1. Open Blender
2. Go to Scripting workspace
3. Load this script or copy-paste it
4. Click Run to execute

This script shows how to:
1. Create objects programmatically
2. Set up WebSocket communication
3. Send/receive messages from the Lightfast app

NOTE: This example uses the 'websocket-client' package for simplicity.
      If you prefer to avoid external dependencies, see the main addon
      (blender_lightfast_addon.py) which uses native Python sockets.
"""

import bpy
import json
import threading
import time

# Clear existing mesh objects
bpy.ops.object.select_all(action='DESELECT')
bpy.ops.object.select_by_type(type='MESH')
bpy.ops.object.delete()

# ----- Create some basic objects -----

# Create a cube
bpy.ops.mesh.primitive_cube_add(size=2, location=(0, 0, 0))
cube = bpy.context.active_object
cube.name = "MainCube"

# Create a sphere
bpy.ops.mesh.primitive_uv_sphere_add(radius=1, location=(3, 0, 0))
sphere = bpy.context.active_object
sphere.name = "MainSphere"

# Create a monkey (Suzanne)
bpy.ops.mesh.primitive_monkey_add(location=(-3, 0, 0))
monkey = bpy.context.active_object
monkey.name = "MainMonkey"

# ----- Example of WebSocket communication -----

# This is a simplified version of the communication logic
# For full implementation, use the addon in blender_lightfast_addon.py

try:
    # Try to import the websocket-client package
    import websocket
    
    # Define WebSocket connection details
    WS_HOST = "localhost"
    WS_PORT = 8765
    
    # Function to send a message to Lightfast
    def send_to_lightfast(message):
        try:
            ws.send(json.dumps(message))
            print(f"[Example] Sent message: {message}")
        except Exception as e:
            print(f"[Example] Error sending message: {e}")
    
    # Define WebSocket callbacks
    def on_message(ws, message):
        print(f"[Example] Received message: {message}")
        
        try:
            data = json.loads(message)
            
            # Example: Handle a command to create an object
            if "action" in data and data["action"] == "create_object":
                params = data["params"]
                
                # Create object based on type
                if params["type"].upper() == "CUBE":
                    bpy.ops.mesh.primitive_cube_add(size=2)
                elif params["type"].upper() == "SPHERE":
                    bpy.ops.mesh.primitive_uv_sphere_add(radius=1)
                elif params["type"].upper() == "MONKEY":
                    bpy.ops.mesh.primitive_monkey_add()
                
                # Set name if provided
                if "name" in params:
                    bpy.context.active_object.name = params["name"]
                
                # Set location if provided
                if "location" in params:
                    loc = params["location"]
                    bpy.context.active_object.location = (
                        loc.get("x", 0), 
                        loc.get("y", 0), 
                        loc.get("z", 0)
                    )
                
                # Send confirmation back
                send_to_lightfast({
                    "type": "object_created",
                    "success": True,
                    "object_name": bpy.context.active_object.name
                })
                
        except Exception as e:
            print(f"[Example] Error processing message: {e}")
    
    def on_error(ws, error):
        print(f"[Example] WebSocket error: {error}")
    
    def on_close(ws, close_status_code, close_msg):
        print("[Example] WebSocket connection closed")
    
    def on_open(ws):
        print("[Example] WebSocket connection opened")
        
        # Send a handshake message
        send_to_lightfast({
            "type": "handshake",
            "client": "blender_example",
            "blender_version": ".".join(map(str, bpy.app.version))
        })
    
    # Connect to the Lightfast WebSocket server
    print(f"[Example] Connecting to Lightfast at ws://{WS_HOST}:{WS_PORT}...")
    
    # Create WebSocket connection
    ws = websocket.WebSocketApp(
        f"ws://{WS_HOST}:{WS_PORT}",
        on_open=on_open,
        on_message=on_message,
        on_error=on_error,
        on_close=on_close
    )
    
    # Run WebSocket in a separate thread
    ws_thread = threading.Thread(target=ws.run_forever)
    ws_thread.daemon = True
    ws_thread.start()
    
    # Print success message
    print("[Example] WebSocket client started")
    print("[Example] Keep Blender open to maintain the connection")
    
except ImportError:
    print("[Example] Error: websocket-client package not installed")
    print("[Example] Install it using: pip install websocket-client")
except Exception as e:
    print(f"[Example] Error starting WebSocket client: {e}")

# Print completion message
print("\nExample script completed!")
print("Objects created: MainCube, MainSphere, MainMonkey") 
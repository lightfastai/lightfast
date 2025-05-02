bl_info = {
    "name": "Lightfast Integration",
    "author": "Lightfast Team",
    "version": (0, 1, 0),
    "blender": (3, 3, 0),
    "location": "View3D > Sidebar > Lightfast",
    "description": "Connect Blender to Lightfast Desktop App",
    "category": "3D View",
}

import bpy
import json
import threading
import time
import socket
import base64
import struct
import hashlib
import traceback
import random
import string
from bpy.props import StringProperty, BoolProperty, IntProperty

# WebSocket connection settings
DEFAULT_HOST = "localhost"
DEFAULT_PORT = 8765

# Global connection variable
socket_connection = None
socket_thread = None
connected = False
reconnect_attempts = 0
max_reconnect_attempts = 5
reconnect_delay = 2  # seconds
addon_enabled = False

# Add a global variable to track active create operations
_active_create_timer = None

def log(message):
    """Print a log message to the console"""
    print(f"[Lightfast] {message}")

def log_error(message, include_traceback=False):
    """Print an error message with optional traceback"""
    print(f"[Lightfast ERROR] {message}")
    if include_traceback:
        traceback.print_exc()

# ---------------------- Basic WebSocket Implementation ----------------------

def create_websocket_request(host, port):
    """Create a WebSocket handshake request"""
    # Generate a random key for the WebSocket handshake
    key = base64.b64encode(bytes(''.join(random.choices(string.ascii_letters + string.digits, k=16)), 'utf-8')).decode('utf-8')
    
    # Create the WebSocket handshake request
    request = (
        f"GET / HTTP/1.1\r\n"
        f"Host: {host}:{port}\r\n"
        f"Upgrade: websocket\r\n"
        f"Connection: Upgrade\r\n"
        f"Sec-WebSocket-Key: {key}\r\n"
        f"Sec-WebSocket-Version: 13\r\n"
        f"\r\n"
    )
    
    return request.encode('utf-8')

def parse_websocket_response(response):
    """Parse the WebSocket handshake response"""
    try:
        # Log the response for debugging
        response_str = response.decode('utf-8', errors='replace')
        log(f"Raw handshake response:\n{response_str}")
        
        # Check if the response contains the WebSocket acceptance
        if b"HTTP/1.1 101" in response and b"Upgrade: websocket" in response:
            log("WebSocket handshake response is valid")
            return True
        else:
            log_error("Invalid WebSocket response - missing expected headers")
            if b"HTTP/1.1" in response:
                status_line = response.split(b"\r\n")[0].decode('utf-8', errors='replace')
                log_error(f"Status line: {status_line}")
            return False
    except Exception as e:
        log_error(f"Error parsing WebSocket response: {e}", True)
        return False

def encode_websocket_frame(data):
    """Encode data as a WebSocket frame"""
    try:
        # Convert data to JSON string if it's not already a string
        if not isinstance(data, str):
            data = json.dumps(data)
        
        # Convert string to bytes
        payload = data.encode('utf-8')
        payload_length = len(payload)
        
        # Create header
        # We'll use a text frame (opcode 0x1)
        header = bytearray()
        header.append(0x81)  # FIN bit + opcode 0x1 (text)
        
        # Set payload length and masking bit
        if payload_length < 126:
            header.append(0x80 | payload_length)  # Masked flag (0x80) + payload length
        elif payload_length < 65536:
            header.append(0x80 | 126)  # Masked flag + 126 (indicates 2-byte length)
            header.extend(struct.pack(">H", payload_length))  # 2 bytes for length
        else:
            header.append(0x80 | 127)  # Masked flag + 127 (indicates 8-byte length)
            header.extend(struct.pack(">Q", payload_length))  # 8 bytes for length
        
        # Generate a random 4-byte masking key
        mask = struct.pack(">I", random.getrandbits(32))
        header.extend(mask)
        
        # Apply mask to payload
        masked_payload = bytearray(payload_length)
        for i in range(payload_length):
            masked_payload[i] = payload[i] ^ mask[i % 4]
        
        # Combine header and masked payload
        return header + masked_payload
    
    except Exception as e:
        log(f"Error encoding WebSocket frame: {e}")
        return None

def decode_websocket_frame(data):
    """Decode a WebSocket frame and return the payload"""
    try:
        if len(data) < 2:
            return None
        
        # Check if this is a final frame
        fin = (data[0] & 0x80) != 0
        # Get opcode
        opcode = data[0] & 0x0F
        
        # Check if this is a control frame
        if opcode == 0x8:  # Close frame
            log("Received WebSocket close frame")
            return {'type': 'close'}
        
        # Check if the frame is masked
        masked = (data[1] & 0x80) != 0
        
        # Get payload length
        payload_length = data[1] & 0x7F
        mask_offset = 2
        
        if payload_length == 126:
            # 2-byte length
            payload_length = struct.unpack(">H", data[2:4])[0]
            mask_offset = 4
        elif payload_length == 127:
            # 8-byte length
            payload_length = struct.unpack(">Q", data[2:10])[0]
            mask_offset = 10
        
        # Extract masking key if present
        if masked:
            mask_key = data[mask_offset:mask_offset+4]
            mask_offset += 4
        
        # Extract payload
        payload = data[mask_offset:mask_offset+payload_length]
        
        # Unmask payload if needed
        if masked:
            unmasked = bytearray(payload_length)
            for i in range(payload_length):
                unmasked[i] = payload[i] ^ mask_key[i % 4]
            payload = unmasked
        
        # Convert payload to string
        try:
            payload_str = payload.decode('utf-8')
            try:
                return json.loads(payload_str)
            except json.JSONDecodeError:
                return payload_str
        except UnicodeDecodeError:
            # Binary data
            return payload
    
    except Exception as e:
        log(f"Error decoding WebSocket frame: {e}")
        return None

# ---------------------- Socket Client Functions ----------------------

def socket_listener_thread(sock):
    """Thread function to listen for incoming messages"""
    global connected
    
    try:
        while connected:
            try:
                # Receive data from socket
                data = sock.recv(4096)
                if not data:
                    # Connection closed
                    log("Connection closed by server")
                    connected = False
                    break
                
                # Decode WebSocket frame
                message = decode_websocket_frame(data)
                if message:
                    if message == {'type': 'close'}:
                        connected = False
                        break
                    handle_message(message)
                
            except socket.timeout:
                # Socket timeout, just continue
                continue
            except Exception as e:
                log(f"Error receiving data: {e}")
                traceback.print_exc()
                connected = False
                break
    
    except Exception as e:
        log(f"Listener thread error: {e}")
        traceback.print_exc()
    
    finally:
        connected = False
        log("Listener thread stopped")

def handle_message(message):
    """Handle incoming messages from the desktop app"""
    try:
        log(f"Received message: {message}")
        
        # Process message based on action type
        if isinstance(message, dict) and "action" in message:
            if message["action"] == "create_object":
                handle_create_object(message["params"])
            else:
                log(f"Unknown action: {message['action']}")
    
    except Exception as e:
        log(f"Error processing message: {str(e)}")
        traceback.print_exc()

def send_message(sock, message):
    """Send a message to the server"""
    try:
        if not connected:
            log("Cannot send message: Not connected")
            return False
        
        # Encode the message as a WebSocket frame
        frame = encode_websocket_frame(message)
        if frame:
            sock.sendall(frame)
            return True
        return False
    
    except Exception as e:
        log(f"Error sending message: {e}")
        traceback.print_exc()
        return False

def start_socket_client():
    """Start the socket client connection"""
    global socket_connection, socket_thread, connected
    
    if socket_connection is not None:
        # Close existing connection
        try:
            socket_connection.close()
        except:
            pass
        socket_connection = None
    
    try:
        # Get host and port from preferences
        host = bpy.context.preferences.addons[__name__].preferences.host
        port = bpy.context.preferences.addons[__name__].preferences.port
        
        log(f"Connecting to {host}:{port}...")
        
        # Create socket
        log(f"Creating socket...")
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(5)  # 5-second timeout for operations
        
        # Connect to server
        log(f"Attempting to connect to {host}:{port}...")
        try:
            sock.connect((host, port))
            log("TCP connection established successfully")
        except socket.error as e:
            log_error(f"Failed to establish TCP connection: {e}", True)
            return False
        
        # Send WebSocket handshake
        log("Sending WebSocket handshake request...")
        handshake_request = create_websocket_request(host, port)
        sock.sendall(handshake_request)
        
        # Wait for handshake response
        log("Waiting for handshake response...")
        try:
            response = sock.recv(4096)
            log(f"Received {len(response)} bytes in handshake response")
        except socket.timeout:
            log_error("Timeout waiting for handshake response", True)
            sock.close()
            return False
        except Exception as e:
            log_error(f"Error receiving handshake response: {e}", True)
            sock.close()
            return False
        
        # Parse handshake response
        if not parse_websocket_response(response):
            log_error("WebSocket handshake failed - invalid response", True)
            log_error(f"Response (first 200 bytes): {response[:200]}")
            sock.close()
            return False
        
        # Set socket and connected flag
        socket_connection = sock
        connected = True
        
        # Create listener thread
        log("Starting listener thread...")
        socket_thread = threading.Thread(target=socket_listener_thread, args=(sock,))
        socket_thread.daemon = True
        socket_thread.start()
        
        # Send initial handshake message
        log("Sending initial handshake message...")
        handshake_message = {
            "type": "handshake",
            "client": "blender",
            "version": bl_info["version"],
            "blender_version": bpy.app.version
        }
        success = send_message(sock, handshake_message)
        if not success:
            log_error("Failed to send initial handshake message", True)
            stop_socket_client()
            return False
        
        log("Connected to Lightfast successfully")
        return True
    
    except Exception as e:
        log_error(f"Connection error: {e}", True)
        connected = False
        return False

def stop_socket_client():
    """Stop the socket client connection"""
    global socket_connection, connected
    
    if socket_connection is not None:
        try:
            if connected:
                # Send a proper disconnect message before closing
                disconnect_message = {
                    "type": "disconnect",
                    "client": "blender",
                    "message": "Disconnecting"
                }
                send_message(socket_connection, disconnect_message)
                
                # Small delay to allow the message to be sent
                time.sleep(0.2)
                
                # Instead of manually crafting a close frame, we'll just close the socket
                # The WebSocket protocol implementation on the server side will handle this correctly
                
            socket_connection.close()
        except Exception as e:
            log(f"Error during disconnection: {e}")
        socket_connection = None
    
    connected = False
    log("Disconnected from Lightfast")

# ---------------------- Command Handlers ----------------------

def handle_create_object(params):
    """Handle the create_object command"""
    global _active_create_timer
    
    try:
        # Extract parameters
        obj_type = params.get("type", "CUBE").upper()
        name = params.get("name", None)
        location = params.get("location", {"x": 0, "y": 0, "z": 0})
        
        # Kill all timers first to be absolutely sure we don't get repeats
        kill_all_timers()
            
        # Create the object in Blender (must be executed in the main thread)
        def create_object_in_blender():
            global _active_create_timer
            
            try:
                log(f"Creating object: {obj_type}")
                
                # Clear the timer reference immediately to prevent any chance of repeats
                _active_create_timer = None
                
                # Switch to object mode if in edit mode
                if bpy.context.mode != 'OBJECT':
                    bpy.ops.object.mode_set(mode='OBJECT')
                
                # Deselect all objects
                bpy.ops.object.select_all(action='DESELECT')
                
                # Create the object based on type
                if obj_type == "CUBE":
                    bpy.ops.mesh.primitive_cube_add(size=2)
                elif obj_type == "SPHERE":
                    bpy.ops.mesh.primitive_uv_sphere_add(radius=1)
                elif obj_type == "MONKEY":
                    bpy.ops.mesh.primitive_monkey_add()
                else:
                    # Default to cube if unknown type
                    bpy.ops.mesh.primitive_cube_add(size=2)
                    log(f"Unknown object type '{obj_type}', created cube instead")
                
                # Get the newly created object
                obj = bpy.context.active_object
                
                # Set object name if provided
                if name:
                    obj.name = name
                
                # Set object location
                obj.location.x = float(location.get("x", 0))
                obj.location.y = float(location.get("y", 0))
                obj.location.z = float(location.get("z", 0))
                
                # Send success response
                if socket_connection and connected:
                    response = {
                        "type": "object_created",
                        "success": True,
                        "object_name": obj.name,
                        "object_type": obj_type,
                        "location": {
                            "x": obj.location.x,
                            "y": obj.location.y,
                            "z": obj.location.z
                        }
                    }
                    send_message(socket_connection, response)
                
                log(f"Created {obj_type} at ({location.get('x', 0)}, {location.get('y', 0)}, {location.get('z', 0)})")
            except Exception as e:
                log(f"Error creating object: {str(e)}")
                traceback.print_exc()
                
                # Send error response
                if socket_connection and connected:
                    response = {
                        "type": "object_created",
                        "success": False,
                        "error": str(e)
                    }
                    send_message(socket_connection, response)
            
            # Absolutely make sure this doesn't repeat
            return None
        
        # Execute in the main Blender thread with one-shot timer
        _active_create_timer = create_object_in_blender
        bpy.app.timers.register(create_object_in_blender, first_interval=0.1, persistent=False)
        log(f"Registered one-time timer to create {obj_type}")
        
    except Exception as e:
        log(f"Error handling create_object: {str(e)}")
        traceback.print_exc()
        
        # Send error response
        if socket_connection and connected:
            response = {
                "type": "object_created",
                "success": False,
                "error": str(e)
            }
            send_message(socket_connection, response)

# ---------------------- Blender UI Classes ----------------------

class LightfastAddonPreferences(bpy.types.AddonPreferences):
    bl_idname = __name__
    
    host: StringProperty(
        name="Host",
        description="WebSocket server host",
        default=DEFAULT_HOST
    )
    
    port: IntProperty(
        name="Port",
        description="WebSocket server port",
        default=DEFAULT_PORT,
        min=1,
        max=65535
    )
    
    auto_connect: BoolProperty(
        name="Auto Connect",
        description="Automatically connect when Blender starts",
        default=True
    )
    
    def draw(self, context):
        layout = self.layout
        layout.prop(self, "host")
        layout.prop(self, "port")
        layout.prop(self, "auto_connect")

class LIGHTFAST_PT_panel(bpy.types.Panel):
    bl_label = "Lightfast Integration"
    bl_idname = "LIGHTFAST_PT_panel"
    bl_space_type = 'VIEW_3D'
    bl_region_type = 'UI'
    bl_category = 'Lightfast'
    
    def draw(self, context):
        layout = self.layout
        
        # Connection status
        box = layout.box()
        row = box.row()
        if connected:
            row.label(text="Status: Connected", icon='CHECKMARK')
        else:
            row.label(text="Status: Disconnected", icon='X')
        
        # Connection controls
        row = layout.row()
        if connected:
            row.operator("lightfast.disconnect", text="Disconnect", icon='CANCEL')
        else:
            row.operator("lightfast.connect", text="Connect", icon='URL')
        
        # Emergency Stop Button
        row = layout.row()
        row.alert = True  # Make the button red
        row.operator("lightfast.emergency_stop", text="EMERGENCY STOP", icon='ERROR')
        
        # Settings
        box = layout.box()
        box.label(text="Connection Settings:")
        preferences = context.preferences.addons[__name__].preferences
        box.prop(preferences, "host")
        box.prop(preferences, "port")
        
        # Test button
        layout.operator("lightfast.test_create_object", text="Test Create Cube", icon='MESH_CUBE')

class LIGHTFAST_OT_connect(bpy.types.Operator):
    bl_idname = "lightfast.connect"
    bl_label = "Connect to Lightfast"
    bl_description = "Connect to the Lightfast desktop app"
    
    def execute(self, context):
        global addon_enabled
        addon_enabled = True
        
        # Test if server is running before attempting connection
        try:
            host = bpy.context.preferences.addons[__name__].preferences.host
            port = bpy.context.preferences.addons[__name__].preferences.port
            
            # Create a test socket to see if the server is listening
            test_sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            test_sock.settimeout(2)
            
            log(f"Testing if Lightfast server is running at {host}:{port}...")
            result = test_sock.connect_ex((host, port))
            test_sock.close()
            
            if result != 0:
                self.report({'ERROR'}, f"Lightfast server not found at {host}:{port}. Is the Lightfast desktop app running?")
                log_error(f"Server test failed with code {result}. No server is listening at {host}:{port}")
                return {'CANCELLED'}
                
            log(f"Server found at {host}:{port}")
        except Exception as e:
            self.report({'ERROR'}, f"Error checking server: {str(e)}")
            log_error(f"Error testing server connection: {e}", True)
            return {'CANCELLED'}
        
        if start_socket_client():
            self.report({'INFO'}, "Connected to Lightfast")
        else:
            self.report({'ERROR'}, "Failed to connect to Lightfast")
        return {'FINISHED'}

class LIGHTFAST_OT_disconnect(bpy.types.Operator):
    bl_idname = "lightfast.disconnect"
    bl_label = "Disconnect from Lightfast"
    bl_description = "Disconnect from the Lightfast desktop app"
    
    def execute(self, context):
        global addon_enabled
        addon_enabled = False
        
        # Kill all timers first
        kill_all_timers()
        
        # Then disconnect
        stop_socket_client()
        self.report({'INFO'}, "Disconnected from Lightfast")
        return {'FINISHED'}

class LIGHTFAST_OT_test_create_object(bpy.types.Operator):
    bl_idname = "lightfast.test_create_object"
    bl_label = "Test Create Object"
    bl_description = "Test object creation functionality"
    
    def execute(self, context):
        # Create a test cube
        handle_create_object({
            "type": "CUBE",
            "name": "TestCube",
            "location": {"x": 0, "y": 0, "z": 0}
        })
        self.report({'INFO'}, "Test cube created")
        return {'FINISHED'}

# Add emergency stop functions to clear all timers
def kill_all_timers():
    """Emergency function to kill all Blender timers"""
    global _active_create_timer
    
    log("EMERGENCY: Killing all Blender timers!")
    
    # Clear our tracked timer
    _active_create_timer = None
    
    # Clear all registered timers in Blender
    timers_to_clear = []
    for timer in bpy.app.timers:
        timers_to_clear.append(timer)
    
    for timer in timers_to_clear:
        try:
            bpy.app.timers.unregister(timer)
            log(f"Unregistered timer: {timer.__name__ if hasattr(timer, '__name__') else 'unnamed'}")
        except Exception as e:
            log(f"Error while unregistering timer: {e}")
    
    log(f"Cleared {len(timers_to_clear)} timers")
    return None  # Don't repeat this timer

# Add classes for emergency control
class LIGHTFAST_OT_emergency_stop(bpy.types.Operator):
    bl_idname = "lightfast.emergency_stop"
    bl_label = "EMERGENCY STOP"
    bl_description = "Stop all timers and ongoing operations"
    
    def execute(self, context):
        kill_all_timers()
        self.report({'INFO'}, "Emergency stop executed: All timers killed")
        return {'FINISHED'}

# ---------------------- Registration ----------------------

classes = (
    LightfastAddonPreferences,
    LIGHTFAST_PT_panel,
    LIGHTFAST_OT_connect,
    LIGHTFAST_OT_disconnect,
    LIGHTFAST_OT_test_create_object,
    LIGHTFAST_OT_emergency_stop,
)

def register():
    # Register classes
    for cls in classes:
        bpy.utils.register_class(cls)
    
    # Auto-connect if enabled
    def delayed_auto_connect():
        try:
            if bpy.context.preferences.addons[__name__].preferences.auto_connect:
                global addon_enabled
                addon_enabled = True
                start_socket_client()
        except:
            pass
        return None  # Don't repeat the timer
    
    # Schedule auto-connect after Blender UI is fully loaded
    bpy.app.timers.register(delayed_auto_connect, first_interval=1.0)
    
    log("Addon registered")

def unregister():
    # Kill all timers first
    try:
        kill_all_timers()
    except:
        pass
        
    # Stop socket client
    global addon_enabled
    addon_enabled = False
    stop_socket_client()
    
    # Unregister classes
    for cls in reversed(classes):
        bpy.utils.unregister_class(cls)
    
    log("Addon unregistered")

if __name__ == "__main__":
    register() 
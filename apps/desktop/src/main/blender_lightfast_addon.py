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
import sys
import io
from bpy.props import StringProperty, BoolProperty, IntProperty

# WebSocket connection settings
DEFAULT_HOST = "localhost"
DEFAULT_PORT = 8765

# Global connection variables
socket_connection = None
socket_thread = None
connected = False
reconnect_attempts = 0
max_reconnect_attempts = 5
reconnect_delay = 2  # seconds
addon_enabled = False
response_callbacks = {}  # Dictionary to store callbacks for specific message IDs

# ---------------------- Improved Logging ----------------------


def log(message, level="INFO"):
    """Print a log message to the console with level"""
    if level == "INFO":
        print(f"[Lightfast] {message}")
    elif level == "WARNING":
        print(f"[Lightfast WARNING] {message}")
    elif level == "ERROR":
        print(f"[Lightfast ERROR] {message}")
    else:
        print(f"[Lightfast {level}] {message}")


def log_error(message, include_traceback=False):
    """Print an error message with optional traceback"""
    log(message, "ERROR")
    if include_traceback:
        traceback.print_exc()


# ---------------------- Improved WebSocket Implementation ----------------------


def create_websocket_handshake(host, port):
    """Create a proper WebSocket handshake request"""
    # Generate a random key for the WebSocket handshake
    key = base64.b64encode(
        bytes(
            "".join(random.choices(string.ascii_letters + string.digits, k=16)), "utf-8"
        )
    ).decode("utf-8")

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

    return request.encode("utf-8"), key


def verify_websocket_handshake(response, key):
    """Verify the WebSocket handshake response"""
    try:
        # Check if the response contains the expected headers
        response_str = response.decode("utf-8", errors="replace")

        if (
            "HTTP/1.1 101" not in response_str
            or "Upgrade: websocket" not in response_str
        ):
            log_error(f"Invalid WebSocket handshake response:\n{response_str[:200]}")
            return False

        # Optionally verify the Sec-WebSocket-Accept header (more strict verification)
        # This would require calculating the expected accept value from the key

        log("WebSocket handshake successful")
        return True

    except Exception as e:
        log_error(f"Error verifying WebSocket handshake: {str(e)}", True)
        return False


def encode_websocket_frame(data, opcode=0x01):
    """
    Encode data as a WebSocket frame
    opcode: 0x01 for text, 0x02 for binary
    """
    try:
        # Convert dict to JSON string if needed
        if isinstance(data, dict):
            try:
                log(f"Converting dict to JSON, keys: {list(data.keys())}")
                data = json.dumps(data)
                log(f"JSON conversion successful, length: {len(data)}")
            except Exception as e:
                log_error(f"JSON conversion error: {str(e)}")
                return None

        # Convert to bytes if it's a string
        if isinstance(data, str):
            try:
                payload = data.encode("utf-8")
                log(f"String encoded to bytes, length: {len(payload)}")
            except Exception as e:
                log_error(f"String encoding error: {str(e)}")
                return None
        elif isinstance(data, bytes):
            payload = data
            log(f"Data is already bytes, length: {len(payload)}")
        else:
            log_error(f"Unsupported data type for WebSocket frame: {type(data)}")
            return None

        payload_length = len(payload)
        log(f"Payload length: {payload_length} bytes")

        # Build header
        header = bytearray()
        # Set FIN bit and opcode (0x80 | opcode)
        header.append(0x80 | opcode)

        # Set payload length and masking bit
        if payload_length < 126:
            header.append(0x80 | payload_length)  # Set masking bit and length
            log("Using short length format (1 byte)")
        elif payload_length < 65536:
            header.append(0x80 | 126)  # Set masking bit and use 2-byte length
            header.extend(struct.pack(">H", payload_length))
            log("Using medium length format (2 bytes)")
        else:
            header.append(0x80 | 127)  # Set masking bit and use 8-byte length
            header.extend(struct.pack(">Q", payload_length))
            log("Using long length format (8 bytes)")

        # Generate masking key (4 random bytes)
        mask = bytes([random.randint(0, 255) for _ in range(4)])
        header.extend(mask)

        # Apply mask to payload
        masked = bytearray(payload_length)
        for i in range(payload_length):
            masked[i] = payload[i] ^ mask[i % 4]

        # Combine header and masked payload
        frame = bytes(header) + bytes(masked)
        log(f"WebSocket frame created, total size: {len(frame)} bytes")
        return frame

    except Exception as e:
        log_error(f"Error encoding WebSocket frame: {str(e)}", True)
        return None


def decode_websocket_frame(data):
    """
    Decode a WebSocket frame and return (opcode, payload, frame_length)
    """
    try:
        if len(data) < 2:
            return None, None, 0

        # Parse basic frame info
        fin = (data[0] & 0x80) != 0
        opcode = data[0] & 0x0F
        masked = (data[1] & 0x80) != 0
        payload_length = data[1] & 0x7F

        # Handle control frames (ping, pong, close)
        if opcode == 0x8:  # Close frame
            log("Received WebSocket close frame")
            return opcode, None, 2

        if opcode == 0x9:  # Ping frame
            # Should respond with pong
            log("Received ping frame")
            return opcode, None, 2

        if opcode == 0xA:  # Pong frame
            log("Received pong frame")
            return opcode, None, 2

        # Determine header size and actual payload length
        header_length = 2
        if payload_length == 126:
            if len(data) < 4:
                return None, None, 0
            payload_length = struct.unpack(">H", data[2:4])[0]
            header_length = 4
        elif payload_length == 127:
            if len(data) < 10:
                return None, None, 0
            payload_length = struct.unpack(">Q", data[2:10])[0]
            header_length = 10

        # Extract masking key if present
        if masked:
            if len(data) < header_length + 4:
                return None, None, 0
            mask = data[header_length : header_length + 4]
            header_length += 4

        # Check if we have enough data for the full frame
        full_length = header_length + payload_length
        if len(data) < full_length:
            return None, None, 0

        # Extract payload
        payload = data[header_length:full_length]

        # Unmask if needed
        if masked:
            unmasked = bytearray(payload_length)
            for i in range(payload_length):
                unmasked[i] = payload[i] ^ mask[i % 4]
            payload = bytes(unmasked)

        # Convert payload based on opcode
        if opcode == 0x1:  # Text frame
            try:
                payload_str = payload.decode("utf-8")
                try:
                    return opcode, json.loads(payload_str), full_length
                except json.JSONDecodeError:
                    return opcode, payload_str, full_length
            except UnicodeDecodeError:
                log_error("Failed to decode text frame as UTF-8")
                return opcode, payload, full_length
        else:  # Binary or other frames
            return opcode, payload, full_length

    except Exception as e:
        log_error(f"Error decoding WebSocket frame: {str(e)}", True)
        return None, None, 0


def handle_fragmented_receive(sock, buffer_size=4096, timeout=30.0):
    """
    Receive potentially fragmented WebSocket frames and reassemble them
    Returns complete messages as they are received
    """
    sock.settimeout(timeout)
    buffer = bytearray()

    try:
        while True:
            try:
                chunk = sock.recv(buffer_size)
                if not chunk:
                    # Connection closed
                    if buffer:
                        # Try to process any remaining data
                        opcode, payload, consumed = decode_websocket_frame(buffer)
                        if payload:
                            return payload
                    return None

                # Add new data to buffer
                buffer.extend(chunk)

                # Try to decode a frame
                opcode, payload, consumed = decode_websocket_frame(buffer)

                # If we have a complete frame
                if consumed > 0:
                    # Handle control frames
                    if opcode == 0x8:  # Close
                        return {"type": "close"}
                    elif opcode == 0x9:  # Ping
                        # Should respond with pong (not implemented here)
                        pass
                    elif opcode == 0xA:  # Pong
                        pass
                    elif payload:  # We have a complete message
                        # Remove the processed frame from buffer
                        buffer = buffer[consumed:]
                        return payload

                    # Remove the processed frame even if no payload (control frames)
                    buffer = buffer[consumed:]

            except socket.timeout:
                # Just continue on timeout, this is expected
                continue

    except Exception as e:
        log_error(f"Error in fragmented receive: {str(e)}", True)
        return None


# ---------------------- Socket Client Functions ----------------------


def socket_listener_thread(sock):
    """Thread function to listen for incoming messages"""
    global connected

    try:
        while connected:
            try:
                # Receive data using the fragmented receiver
                message = handle_fragmented_receive(sock)

                if message is None:
                    # Connection closed
                    log("Connection closed by server")
                    connected = False
                    break

                if message == {"type": "close"}:
                    log("Received close frame from server")
                    connected = False
                    break

                # Process the message
                handle_message(message)

            except socket.timeout:
                # This is expected, just continue
                continue
            except Exception as e:
                log_error(f"Error receiving data: {str(e)}", True)
                connected = False
                break
    except Exception as e:
        log_error(f"Listener thread error: {str(e)}", True)
    finally:
        connected = False
        log("Listener thread stopped")


def generate_message_id():
    """Generate a unique message ID for tracking responses"""
    return "".join(random.choices(string.ascii_letters + string.digits, k=12))


def send_message(sock, message, callback=None):
    """
    Send a message to the server with optional callback for response
    Returns the message ID that was used
    """
    try:
        if not connected:
            log("Cannot send message: Not connected", "WARNING")
            return None

        # Add a message ID for tracking responses if not present
        if isinstance(message, dict) and "id" not in message:
            message_id = generate_message_id()
            message["id"] = message_id
        elif isinstance(message, dict):
            message_id = message["id"]
        else:
            message_id = None

        # Register callback if provided
        if callback and message_id:
            response_callbacks[message_id] = callback

        # Encode and send the message
        log(
            f"Encoding message type: {message.get('type', 'unknown')} with ID: {message_id}"
        )
        frame = encode_websocket_frame(message)
        if frame:
            log(f"Frame encoded successfully, size: {len(frame)} bytes")
            try:
                sock.sendall(frame)
                log(f"Message sent successfully with ID: {message_id}")
                return message_id
            except Exception as e:
                log_error(f"Socket sendall error: {str(e)}")
                return None
        else:
            log_error("Failed to encode message")
            return None

    except Exception as e:
        log_error(f"Error sending message: {str(e)}", True)
        return None


def handle_message(message):
    """Handle incoming messages from the desktop app"""
    try:
        log(f"Received message: {message}")

        # Check if this is a response to a previous message
        if (
            isinstance(message, dict)
            and "id" in message
            and message["id"] in response_callbacks
        ):
            log(f"Found callback for message ID: {message['id']}")
            # Call the registered callback
            callback = response_callbacks.pop(message["id"])
            callback(message)
            return

        # Process message based on action type
        if isinstance(message, dict) and "action" in message:
            action = message["action"]
            params = message.get("params", {})
            message_id = message.get("id", None)

            log(f"Processing action: {action}, message ID: {message_id}")

            if not message_id:
                log_error(
                    f"Missing message_id for action: {action}. This will cause problems with responses."
                )

            if action == "execute_code":
                log(
                    f"Calling handle_execute_code with params: {params}, message_id: {message_id}"
                )
                handle_execute_code(params, message_id)
            elif action == "get_scene_info":
                log(
                    f"Calling handle_get_scene_info with params: {params}, message_id: {message_id}"
                )
                handle_get_scene_info(params, message_id)
            else:
                log(f"Unknown action: {action}", "WARNING")

                # Send error response if there's a message ID
                if message_id and socket_connection:
                    log(f"Sending error response for unknown action: {action}")
                    error_response = {
                        "id": message_id,
                        "success": False,
                        "error": f"Unknown action: {action}",
                    }
                    send_message(socket_connection, error_response)
        else:
            log(f"Unrecognized message format: {message}", "WARNING")
            if isinstance(message, dict) and "action" not in message:
                log_error("Message is missing 'action' field")
            if not isinstance(message, dict):
                log_error(f"Message is not a dictionary: {type(message)}")

    except Exception as e:
        log_error(f"Error processing message: {str(e)}", True)

        # Try to send error response if possible
        if isinstance(message, dict) and "id" in message and socket_connection:
            error_response = {
                "id": message["id"],
                "success": False,
                "error": f"Error processing message: {str(e)}",
            }
            send_message(socket_connection, error_response)


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
        prefs = bpy.context.preferences.addons[__name__].preferences
        host = prefs.host
        port = prefs.port

        log(f"Connecting to {host}:{port}...")

        # Create socket with timeout
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(30)  # 30-second timeout for operations

        # Connect to server
        try:
            sock.connect((host, port))
            log("TCP connection established")
        except socket.error as e:
            log_error(f"Failed to connect: {e}", True)
            return False

        # Send WebSocket handshake
        handshake_request, key = create_websocket_handshake(host, port)
        sock.sendall(handshake_request)

        # Wait for handshake response
        try:
            response = sock.recv(4096)
        except socket.timeout:
            log_error("Timeout waiting for handshake response")
            sock.close()
            return False
        except Exception as e:
            log_error(f"Error receiving handshake response: {e}", True)
            sock.close()
            return False

        # Verify handshake response
        if not verify_websocket_handshake(response, key):
            log_error("WebSocket handshake failed")
            sock.close()
            return False

        # Set as connected
        socket_connection = sock
        connected = True

        # Start listener thread
        log("Starting listener thread...")
        socket_thread = threading.Thread(target=socket_listener_thread, args=(sock,))
        socket_thread.daemon = True
        socket_thread.start()

        # Send initial handshake message
        handshake_message = {
            "type": "handshake",
            "client": "blender",
            "version": bl_info["version"],
            "blender_version": bpy.app.version,
        }
        if not send_message(sock, handshake_message):
            log_error("Failed to send handshake message")
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
    global socket_connection, connected, response_callbacks

    # Clear any pending callbacks
    response_callbacks.clear()

    if socket_connection is not None:
        try:
            if connected:
                # Send close frame
                close_frame = bytearray(
                    [0x88, 0x02, 0x03, 0xE8]
                )  # Close frame with status 1000 (normal)
                socket_connection.sendall(close_frame)
                time.sleep(0.1)  # Brief pause to allow for transmission

            socket_connection.close()
        except Exception as e:
            log(f"Error during disconnection: {e}", "WARNING")
        socket_connection = None

    connected = False
    log("Disconnected from Lightfast")


# ---------------------- Command Handlers ----------------------


def handle_execute_code(params, message_id=None):
    """Improved handler for executing arbitrary Python code in Blender"""
    code = params.get("code", "")
    if not code:
        log("Received empty code to execute", "WARNING")
        send_error_response(message_id, "Empty code received")
        return

    log(f"Executing code of length {len(code)}")

    def execute_in_main_thread():
        try:
            log("Running code in main thread")

            # Prepare commonly used modules
            namespace = {
                "bpy": bpy,
                # Add other common modules here if needed
            }

            # Capture stdout
            old_stdout = sys.stdout
            captured_output = io.StringIO()
            sys.stdout = captured_output

            # Track objects before execution to identify created objects
            objects_before = set(obj.name for obj in bpy.data.objects)
            collections_before = set(coll.name for coll in bpy.data.collections)

            success = True
            error_msg = ""
            error_type = ""
            tb_str = ""

            try:
                # Execute the code
                exec(code, namespace)
                output = captured_output.getvalue()

                # Check for new objects and collections
                objects_after = set(obj.name for obj in bpy.data.objects)
                collections_after = set(coll.name for coll in bpy.data.collections)

                new_objects = objects_after - objects_before
                new_collections = collections_after - collections_before

                if new_objects or new_collections:
                    output += "\n\n--- Creation Summary ---\n"
                    if new_objects:
                        output += f"Created {len(new_objects)} new object(s): {', '.join(new_objects)}\n"
                    if new_collections:
                        output += f"Created {len(new_collections)} new collection(s): {', '.join(new_collections)}\n"

            except Exception as e:
                # Get detailed error info
                success = False
                error_msg = str(e)
                error_type = type(e).__name__
                tb_str = traceback.format_exc()

                # Check for partial success by examining output
                output = captured_output.getvalue()

                # Check for new objects and collections even on error
                objects_after = set(obj.name for obj in bpy.data.objects)
                collections_after = set(coll.name for coll in bpy.data.collections)

                new_objects = objects_after - objects_before
                new_collections = collections_after - collections_before

                # If we've created objects/collections but got an error, it's a partial success
                if new_objects or new_collections:
                    output += "\n\n--- Partial Success Summary ---\n"
                    output += f"Error occurred: {error_msg}\n"
                    if new_objects:
                        output += f"Created {len(new_objects)} new object(s) before error: {', '.join(new_objects)}\n"
                    if new_collections:
                        output += f"Created {len(new_collections)} new collection(s) before error: {', '.join(new_collections)}\n"

                log_error(f"Error executing code: {error_msg}\n{tb_str}")

            # Prepare and send the response
            if socket_connection and connected and message_id:
                if success:
                    response = {
                        "id": message_id,
                        "type": "code_executed",
                        "success": True,
                        "output": output,
                    }
                else:
                    response = {
                        "id": message_id,
                        "type": "code_executed",
                        "success": False,
                        "error": error_msg,
                        "error_type": error_type,
                        "traceback": tb_str,
                        "output": output,  # Include output even for errors
                    }
                send_message(socket_connection, response)
                log(
                    f"Code execution response sent for message ID: {message_id}, success: {success}"
                )

        except Exception as e:
            log_error(f"Unhandled error in execute_code: {str(e)}", True)
            send_error_response(message_id, f"Unhandled error: {str(e)}")
        finally:
            # Always restore stdout
            sys.stdout = old_stdout

        # Don't repeat
        return None

    # Schedule for execution in the main thread
    try:
        bpy.app.timers.register(execute_in_main_thread, first_interval=0.0)
    except Exception as e:
        log_error(f"Failed to register timer: {str(e)}", True)
        send_error_response(message_id, f"Failed to schedule execution: {str(e)}")


def handle_get_scene_info(params, message_id=None):
    """Handler for getting Blender scene information"""
    log("Getting Blender scene info...")
    log(f"Message ID for scene info request: {message_id}")

    if not message_id:
        log_error(
            "No message_id provided for get_scene_info request. Response will fail."
        )

    def get_scene_info_in_main_thread():
        try:
            log(f"Starting to collect Blender scene info for message_id: {message_id}")

            # Get information about the current Blender scene
            try:
                # Collect information for all objects in the scene
                scene_info = {
                    "name": bpy.context.scene.name,
                    "object_count": len(bpy.context.scene.objects),
                    "objects": [],
                    "materials_count": len(bpy.data.materials),
                }

                log(
                    f"Scene: {scene_info['name']}, Objects: {scene_info['object_count']}, Materials: {scene_info['materials_count']}"
                )

                # Collect information for all objects in the scene
                for i, obj in enumerate(bpy.context.scene.objects):
                    print(obj.name)
                    obj_info = {
                        "name": obj.name,
                        "type": obj.type,
                        "location": [
                            round(float(obj.location.x), 2),
                            round(float(obj.location.y), 2),
                            round(float(obj.location.z), 2),
                        ],
                        "dimensions": [round(float(d), 2) for d in obj.dimensions],
                        "scale": [round(float(s), 3) for s in obj.scale],
                        "rotation": [round(float(r), 3) for r in obj.rotation_euler],
                    }

                    # # Compute world-space bounding box corners
                    try:
                        bbox_corners = []
                        for corner in obj.bound_box:
                            # corner is in local space; transform to world
                            local = bpy.mathutils.Vector(corner)
                            world = obj.matrix_world @ local
                            bbox_corners.append(
                                [
                                    round(float(world.x), 3),
                                    round(float(world.y), 3),
                                    round(float(world.z), 3),
                                ]
                            )
                        obj_info["bounding_box"] = bbox_corners
                    except Exception as e:
                        obj_info["bounding_box"] = None

                    # Mesh-specific info
                    if obj.type == "MESH" and obj.data:
                        obj_info["vertex_count"] = len(obj.data.vertices)
                        obj_info["face_count"] = len(obj.data.polygons)
                        obj_info["edge_count"] = len(obj.data.edges)
                        obj_info["materials"] = [
                            mat.name for mat in obj.data.materials if mat
                        ]

                    # Custom properties (user-defined only)
                    # custom_props = {
                    #     k: v
                    #     for k, v in obj.items()
                    #     if k not in obj.bl_rna.properties.keys()
                    # }
                    # if custom_props:
                    #     obj_info["custom_properties"] = custom_props

                    log(
                        f"Object {i+1}: {obj.name} ({obj.type}) at location {obj_info['location']}"
                    )
                    scene_info["objects"].append(obj_info)

                log(f"Scene info collected: {len(scene_info['objects'])} objects")

            except Exception as e:
                log_error(f"Error collecting scene info: {str(e)}", True)
                scene_info = {"error": str(e)}

            # Send response
            if socket_connection and connected and message_id:
                log(f"Preparing to send scene info for message ID: {message_id}")
                response = {
                    "id": message_id,
                    "type": "scene_info",
                    "success": True,
                    "scene_info": scene_info,
                }
                send_result = send_message(socket_connection, response)
                log(f"Send result: {send_result}")
                log(f"Scene info sent for message ID: {message_id}")
            else:
                if not socket_connection:
                    log_error("Cannot send scene info: socket_connection is None")
                if not connected:
                    log_error("Cannot send scene info: not connected")
                if not message_id:
                    log_error("Cannot send scene info: no message_id provided")

        except Exception as e:
            log_error(f"Error getting scene info: {str(e)}", True)
            if message_id:
                send_error_response(message_id, f"Error getting scene info: {str(e)}")
            else:
                log_error("Cannot send error response: no message_id provided")

        # Don't repeat
        return None

    # Schedule for execution in the main thread
    try:
        log(
            f"Registering get_scene_info function with Blender timer for message_id: {message_id}"
        )
        bpy.app.timers.register(get_scene_info_in_main_thread, first_interval=0.0)
    except Exception as e:
        log_error(f"Failed to register timer: {str(e)}", True)
        if message_id:
            send_error_response(
                message_id, f"Failed to schedule scene info retrieval: {str(e)}"
            )
        else:
            log_error("Cannot send error response: no message_id provided")


def send_error_response(message_id, error_message):
    """Helper to send an error response for a message"""
    if socket_connection and connected and message_id:
        response = {"id": message_id, "success": False, "error": error_message}
        send_message(socket_connection, response)
        log(f"Sent error response: {error_message}", "WARNING")


# ---------------------- Blender UI Classes ----------------------


class LightfastAddonPreferences(bpy.types.AddonPreferences):
    bl_idname = __name__

    host: StringProperty(
        name="Host",
        description="Host address for the Lightfast Connection",
        default=DEFAULT_HOST,
    )

    port: IntProperty(
        name="Port",
        description="Port for the Lightfast Connection",
        default=DEFAULT_PORT,
        min=1024,
        max=65535,
    )

    auto_connect: BoolProperty(
        name="Auto Connect",
        description="Automatically connect to Lightfast on startup",
        default=False,
    )

    def draw(self, context):
        layout = self.layout
        layout.prop(self, "host")
        layout.prop(self, "port")
        layout.prop(self, "auto_connect")

        row = layout.row()
        if connected:
            row.operator("lightfast.disconnect", text="Disconnect from Lightfast")
        else:
            row.operator("lightfast.connect", text="Connect to Lightfast")


class LIGHTFAST_OT_Connect(bpy.types.Operator):
    bl_idname = "lightfast.connect"
    bl_label = "Connect to Lightfast"
    bl_description = "Connect to the Lightfast Application"

    def execute(self, context):
        if start_socket_client():
            self.report({"INFO"}, "Connected to Lightfast")
            return {"FINISHED"}
        else:
            self.report({"ERROR"}, "Failed to connect to Lightfast")
            return {"CANCELLED"}


class LIGHTFAST_OT_Disconnect(bpy.types.Operator):
    bl_idname = "lightfast.disconnect"
    bl_label = "Disconnect from Lightfast"
    bl_description = "Disconnect from the Lightfast Application"

    def execute(self, context):
        stop_socket_client()
        self.report({"INFO"}, "Disconnected from Lightfast")
        return {"FINISHED"}


class LIGHTFAST_PT_Panel(bpy.types.Panel):
    bl_label = "Lightfast"
    bl_idname = "LIGHTFAST_PT_Panel"
    bl_space_type = "VIEW_3D"
    bl_region_type = "UI"
    bl_category = "Lightfast"

    def draw(self, context):
        layout = self.layout

        if connected:
            layout.label(text="Connected to Lightfast", icon="CHECKMARK")
            layout.operator("lightfast.disconnect", text="Disconnect")
        else:
            layout.label(text="Disconnected from Lightfast", icon="ERROR")
            layout.operator("lightfast.connect", text="Connect")


# ---------------------- Registration ----------------------

classes = (
    LightfastAddonPreferences,
    LIGHTFAST_OT_Connect,
    LIGHTFAST_OT_Disconnect,
    LIGHTFAST_PT_Panel,
)


def register():
    for cls in classes:
        bpy.utils.register_class(cls)

    log("Lightfast Addon registered")

    # Auto-connect if enabled in preferences
    if hasattr(bpy.context, "preferences") and bpy.context.preferences.addons.get(
        __name__
    ):
        prefs = bpy.context.preferences.addons[__name__].preferences
        if prefs.auto_connect:
            bpy.app.timers.register(lambda: start_socket_client(), first_interval=1.0)


def unregister():
    # Stop the socket client if it's running
    if connected:
        stop_socket_client()

    for cls in reversed(classes):
        bpy.utils.unregister_class(cls)

    log("Lightfast Addon unregistered")


# This allows running the script directly from Blender's Text editor
if __name__ == "__main__":
    register()

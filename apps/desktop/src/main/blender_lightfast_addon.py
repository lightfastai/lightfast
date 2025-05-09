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
    
    return request.encode('utf-8'), key

def verify_websocket_handshake(response, key):
    """Verify the WebSocket handshake response"""
    try:
        # Check if the response contains the expected headers
        response_str = response.decode('utf-8', errors='replace')
        
        if "HTTP/1.1 101" not in response_str or "Upgrade: websocket" not in response_str:
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
            data = json.dumps(data)
            
        # Convert to bytes if it's a string
        if isinstance(data, str):
            payload = data.encode('utf-8')
        elif isinstance(data, bytes):
            payload = data
        else:
            log_error(f"Unsupported data type for WebSocket frame: {type(data)}")
            return None
            
        payload_length = len(payload)
        
        # Build header
        header = bytearray()
        # Set FIN bit and opcode (0x80 | opcode)
        header.append(0x80 | opcode)
        
        # Set payload length and masking bit
        if payload_length < 126:
            header.append(0x80 | payload_length)  # Set masking bit and length
        elif payload_length < 65536:
            header.append(0x80 | 126)  # Set masking bit and use 2-byte length
            header.extend(struct.pack(">H", payload_length))
        else:
            header.append(0x80 | 127)  # Set masking bit and use 8-byte length
            header.extend(struct.pack(">Q", payload_length))
        
        # Generate masking key (4 random bytes)
        mask = bytes([random.randint(0, 255) for _ in range(4)])
        header.extend(mask)
        
        # Apply mask to payload
        masked = bytearray(payload_length)
        for i in range(payload_length):
            masked[i] = payload[i] ^ mask[i % 4]
        
        # Combine header and masked payload
        return bytes(header) + bytes(masked)
        
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
            mask = data[header_length:header_length+4]
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
                payload_str = payload.decode('utf-8')
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

def handle_fragmented_receive(sock, buffer_size=4096, timeout=5.0):
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
    return ''.join(random.choices(string.ascii_letters + string.digits, k=12))

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
        frame = encode_websocket_frame(message)
        if frame:
            sock.sendall(frame)
            log(f"Sent message with ID: {message_id}")
            return message_id
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
        if isinstance(message, dict) and "id" in message and message["id"] in response_callbacks:
            # Call the registered callback
            callback = response_callbacks.pop(message["id"])
            callback(message)
            return
            
        # Process message based on action type
        if isinstance(message, dict) and "action" in message:
            action = message["action"]
            params = message.get("params", {})
            message_id = message.get("id", None)
            
            if action == "execute_code":
                handle_execute_code(params, message_id)
            elif action == "get_state":
                handle_get_state(params, message_id)
            else:
                log(f"Unknown action: {action}", "WARNING")
                
                # Send error response if there's a message ID
                if message_id and socket_connection:
                    error_response = {
                        "id": message_id,
                        "success": False,
                        "error": f"Unknown action: {action}"
                    }
                    send_message(socket_connection, error_response)
        else:
            log(f"Unrecognized message format: {message}", "WARNING")
    
    except Exception as e:
        log_error(f"Error processing message: {str(e)}", True)
        
        # Try to send error response if possible
        if isinstance(message, dict) and "id" in message and socket_connection:
            error_response = {
                "id": message["id"],
                "success": False,
                "error": f"Error processing message: {str(e)}"
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
        sock.settimeout(5)  # 5-second timeout for operations
        
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
            "blender_version": bpy.app.version
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
                close_frame = bytearray([0x88, 0x02, 0x03, 0xE8])  # Close frame with status 1000 (normal)
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
            
            try:
                # Execute the code
                exec(code, namespace)
                output = captured_output.getvalue()
                
                # Send success response
                if socket_connection and connected and message_id:
                    response = {
                        "id": message_id,
                        "type": "code_executed",
                        "success": True,
                        "output": output
                    }
                    send_message(socket_connection, response)
                
                log(f"Code executed successfully, output length: {len(output)}")
                
            except Exception as e:
                # Get detailed error info
                error_msg = str(e)
                error_type = type(e).__name__
                tb_str = traceback.format_exc()
                
                log_error(f"Error executing code: {error_msg}\n{tb_str}")
                
                # Send error response
                if socket_connection and connected and message_id:
                    response = {
                        "id": message_id,
                        "type": "code_executed",
                        "success": False,
                        "error": error_msg,
                        "error_type": error_type,
                        "traceback": tb_str,
                        "partial_output": captured_output.getvalue()
                    }
                    send_message(socket_connection, response)
            finally:
                # Restore stdout
                sys.stdout = old_stdout
        
        except Exception as e:
            log_error(f"Unhandled error in execute_code: {str(e)}", True)
            send_error_response(message_id, f"Unhandled error: {str(e)}")
        
        # Don't repeat
        return None
    
    # Schedule for execution in the main thread
    try:
        bpy.app.timers.register(execute_in_main_thread, first_interval=0.0)
    except Exception as e:
        log_error(f"Failed to register timer: {str(e)}", True)
        send_error_response(message_id, f"Failed to schedule execution: {str(e)}")

def handle_get_state(params, message_id=None):
    """Improved handler for getting Blender state"""
    log("Getting Blender state")
    
    def get_state_in_main_thread():
        try:
            state = {}
            
            # Get current mode
            state["mode"] = bpy.context.mode
            
            # Get active object
            active_obj = bpy.context.active_object
            if active_obj:
                state["active_object"] = {
                    "name": active_obj.name,
                    "type": active_obj.type if hasattr(active_obj, 'type') else None,
                    "location": [float(v) for v in active_obj.location] if hasattr(active_obj, 'location') else None,
                    "dimensions": [float(v) for v in active_obj.dimensions] if hasattr(active_obj, 'dimensions') else None
                }
            else:
                state["active_object"] = None
            
            # Get selected objects
            state["selected_objects"] = [
                {
                    "name": obj.name,
                    "type": obj.type
                }
                for obj in bpy.context.selected_objects
            ]
            
            # Get scene info
            state["scene"] = {
                "name": bpy.context.scene.name,
                "frame_current": bpy.context.scene.frame_current,
                "frame_start": bpy.context.scene.frame_start,
                "frame_end": bpy.context.scene.frame_end
            }
            
            # Get viewport shading
            for area in bpy.context.screen.areas:
                if area.type == 'VIEW_3D':
                    for space in area.spaces:
                        if space.type == 'VIEW_3D':
                            state["viewport"] = {
                                "shading_type": space.shading.type,
                                "show_floor": space.overlay.show_floor,
                                "show_axis_x": space.overlay.show_axis_x,
                                "show_axis_y": space.overlay.show_axis_y,
                                "show_axis_z": space.overlay.show_axis_z
                            }
                            break
                    break
            
            # Send response
            if socket_connection and connected and message_id:
                response = {
                    "id": message_id,
                    "type": "blender_state",
                    "success": True,
                    "state": state
                }
                send_message(socket_connection, response)
                log("Sent Blender state")
            
        except Exception as e:
            log_error(f"Error getting state: {str(e)}", True)
            send_error_response(message_id, f"Error getting state: {str(e)}")
        
        # Don't repeat
        return None
    
    # Schedule for execution in the main thread
    try:
        bpy.app.timers.register(get_state_in_main_thread, first_interval=0.0)
    except Exception as e:
        log_error(f"Failed to register timer: {str(e)}", True)
        send_error_response(message_id, f"Failed to schedule state retrieval: {str(e)}")

def send_error_response(message_id, error_message):
    """Helper to send an error response for a message"""
    if socket_connection and connected and message_id:
        response = {
            "id": message_id,
            "success": False,
            "error": error_message
        }
        send_message(socket_connection, response)
        log(f"Sent error response: {error_message}", "WARNING")
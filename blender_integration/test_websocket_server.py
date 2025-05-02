#!/usr/bin/env python3
"""
Simple script to test if the WebSocket server is running and responding.

This script uses Python's built-in socket module to test the connection,
similar to how the Blender addon works.
"""

import socket
import sys
import time
import base64
import struct
import random
import string
import json

# Server details
HOST = "localhost"
PORT = 8765

def log(msg):
    """Print a log message with timestamp"""
    timestamp = time.strftime("%H:%M:%S", time.localtime())
    print(f"[{timestamp}] {msg}")

def create_websocket_request():
    """Create a WebSocket handshake request"""
    # Generate a random key for the WebSocket handshake
    key = base64.b64encode(bytes(''.join(random.choices(string.ascii_letters + string.digits, k=16)), 'utf-8')).decode('utf-8')
    
    # Create the WebSocket handshake request
    request = (
        f"GET / HTTP/1.1\r\n"
        f"Host: {HOST}:{PORT}\r\n"
        f"Upgrade: websocket\r\n"
        f"Connection: Upgrade\r\n"
        f"Sec-WebSocket-Key: {key}\r\n"
        f"Sec-WebSocket-Version: 13\r\n"
        f"\r\n"
    )
    
    return request.encode('utf-8')

def encode_websocket_frame(data):
    """Encode data as a WebSocket frame"""
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

def test_connection():
    """Test connection to the WebSocket server"""
    log(f"Testing connection to WebSocket server at {HOST}:{PORT}")
    
    # Check if the server is listening
    test_sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    test_sock.settimeout(3)
    
    try:
        result = test_sock.connect_ex((HOST, PORT))
        if result != 0:
            log(f"ERROR: Server is not listening at {HOST}:{PORT} (code {result})")
            test_sock.close()
            return False
            
        log(f"Server found at {HOST}:{PORT}")
        test_sock.close()
    except Exception as e:
        log(f"ERROR: Connection test failed: {e}")
        test_sock.close()
        return False
    
    # Now try a full WebSocket handshake
    log("Attempting WebSocket handshake...")
    
    try:
        # Create socket
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(5)
        
        # Connect
        sock.connect((HOST, PORT))
        log("TCP connection established")
        
        # Send handshake
        handshake = create_websocket_request()
        sock.sendall(handshake)
        log(f"Sent handshake request ({len(handshake)} bytes)")
        
        # Receive response
        response = sock.recv(4096)
        response_str = response.decode('utf-8', errors='replace')
        log(f"Received response ({len(response)} bytes):")
        log(response_str)
        
        # Check if it's a valid WebSocket upgrade
        if "HTTP/1.1 101" in response_str and "Upgrade: websocket" in response_str:
            log("SUCCESS: Valid WebSocket handshake response")
            
            # Try sending a message
            log("Sending test message...")
            test_message = {
                "type": "handshake",
                "client": "test_script",
                "version": "1.0.0"
            }
            frame = encode_websocket_frame(test_message)
            sock.sendall(frame)
            
            # Try receiving a response (with timeout)
            log("Waiting for response...")
            sock.settimeout(3)
            try:
                response = sock.recv(4096)
                log(f"Received message response ({len(response)} bytes)")
                # We don't decode the frame here as it's just a test
                return True
            except socket.timeout:
                log("WARNING: No response received within timeout")
                return True  # Still consider it a success if handshake worked
            
        else:
            log("ERROR: Invalid WebSocket handshake response")
            return False
            
    except Exception as e:
        log(f"ERROR: WebSocket handshake failed: {e}")
        return False
    finally:
        try:
            sock.close()
        except:
            pass

if __name__ == "__main__":
    log("WebSocket Server Test Script")
    log("===========================")
    
    success = test_connection()
    
    if success:
        log("TEST PASSED: Successfully connected to WebSocket server")
        sys.exit(0)
    else:
        log("TEST FAILED: Could not connect to WebSocket server")
        sys.exit(1) 
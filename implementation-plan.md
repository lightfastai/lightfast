# Lightfast Blender Addon Rewrite Implementation Plan

## 1. Architecture Change

Switch from the current WebSocket client architecture to a socket server architecture where:

- Blender addon will act as a TCP socket server
- Desktop app will act as a socket client
- Communication will use JSON messages over a plain TCP socket

This architecture better matches Blender's position as the resource provider and simplifies the communication protocol.

## 2. Core Components

### 2.1 Blender Socket Server

```python
class LightfastServer:
    def __init__(self, host='localhost', port=9876):
        self.host = host
        self.port = port
        self.running = False
        self.socket = None
        self.server_thread = None

    def start(self):
        """Start the server in a separate thread"""
        if self.running:
            return

        self.running = True

        # Create socket server
        self.socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        self.socket.bind((self.host, self.port))
        self.socket.listen(1)

        # Start server thread
        self.server_thread = threading.Thread(target=self._server_loop)
        self.server_thread.daemon = True
        self.server_thread.start()

    def _server_loop(self):
        """Main server loop accepting connections"""
        self.socket.settimeout(1.0)  # Allow for stopping the thread

        while self.running:
            try:
                client, address = self.socket.accept()
                # Handle client in a separate thread
                client_thread = threading.Thread(
                    target=self._handle_client,
                    args=(client,)
                )
                client_thread.daemon = True
                client_thread.start()
            except socket.timeout:
                # Just a timeout to check running condition
                continue
            except Exception as e:
                print(f"Error in server loop: {str(e)}")

    def _handle_client(self, client):
        """Handle client connection and command processing"""
        # Implementation for robust message handling
```

### 2.2 Command Processing System

```python
def execute_command(self, command):
    """Execute commands received from the client"""
    cmd_type = command.get("action")
    params = command.get("params", {})

    # Command handlers
    handlers = {
        "create_object": self.handle_create_object,
        "execute_code": self.handle_execute_code,
        "get_state": self.handle_get_state,
        # Add more command handlers
    }

    handler = handlers.get(cmd_type)
    if handler:
        try:
            return handler(**params)
        except Exception as e:
            return {"status": "error", "message": str(e)}
    else:
        return {"status": "error", "message": f"Unknown command: {cmd_type}"}
```

### 2.3 Code Execution System

```python
def handle_execute_code(self, code):
    """Handle executing arbitrary Python code in Blender"""
    def execute_in_main_thread():
        try:
            # Set up execution environment with common modules
            namespace = {"bpy": bpy, "mathutils": mathutils, "bmesh": bmesh}

            # Capture stdout for the result
            output_buffer = io.StringIO()
            with redirect_stdout(output_buffer):
                exec(code, namespace)

            output = output_buffer.getvalue()

            # Send success response with captured output
            self.send_response({
                "type": "code_executed",
                "success": True,
                "output": output
            })
        except Exception as e:
            # Capture the full traceback
            tb_str = traceback.format_exc()

            # Send detailed error response
            self.send_response({
                "type": "code_executed",
                "success": False,
                "error": str(e),
                "error_type": type(e).__name__,
                "traceback": tb_str
            })

        return None  # Don't repeat the timer

    # Register for execution in Blender's main thread
    bpy.app.timers.register(execute_in_main_thread, first_interval=0.0)

    # Return immediate acknowledgment
    return {"status": "processing", "message": "Code execution started"}
```

### 2.4 Message Handling and Buffering

```python
def _receive_message(self, client_socket):
    """
    Receive a complete message from the client.
    Handles buffering for large messages.
    """
    buffer = b''
    client_socket.settimeout(0.5)  # Short timeout for receiving chunks

    while True:
        try:
            chunk = client_socket.recv(8192)
            if not chunk:
                raise ConnectionError("Connection closed by client")

            buffer += chunk

            # Try to parse as JSON
            try:
                message = json.loads(buffer.decode('utf-8'))
                return message
            except json.JSONDecodeError:
                # Incomplete message, continue receiving
                continue
        except socket.timeout:
            # Check if we have a valid message after timeout
            try:
                message = json.loads(buffer.decode('utf-8'))
                return message
            except json.JSONDecodeError:
                # Still incomplete, continue receiving
                if not self.running:
                    raise ConnectionError("Server is shutting down")
                continue
```

### 2.5 Desktop App Socket Client Integration

```typescript
// Socket client to connect to Blender addon
class BlenderSocketClient {
  private socket: Socket | null = null;
  private isConnected = false;
  private responseHandlers = new Map<string, (response: any) => void>();

  constructor(private host: string = 'localhost', private port: number = 9876) {}

  connect(): Promise<boolean> {
    return new Promise((resolve, reject) => {
      try {
        this.socket = new Socket();

        this.socket.on('connect', () => {
          this.isConnected = true;
          console.log('Connected to Blender');
          resolve(true);
        });

        this.socket.on('data', (data) => {
          this.handleResponse(data);
        });

        this.socket.on('error', (error) => {
          console.error('Socket error:', error);
          this.isConnected = false;
          reject(error);
        });

        this.socket.on('close', () => {
          this.isConnected = false;
          console.log('Connection to Blender closed');
        });

        this.socket.connect(this.port, this.host);
      } catch (error) {
        reject(error);
      }
    });
  }

  sendCommand(action: string, params: any = {}): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.isConnected || !this.socket) {
        reject(new Error('Not connected to Blender'));
        return;
      }

      const command = {
        action,
        params,
        id: uuidv4() // Generate unique command ID
      };

      // Register response handler
      this.responseHandlers.set(command.id, (response) => {
        resolve(response);
      });

      // Send the command
      this.socket.write(JSON.stringify(command));
    });
  }

  // Handle responses from Blender
  private handleResponse(data: Buffer) {
    try {
      const response = JSON.parse(data.toString('utf-8'));

      // Find and call the appropriate response handler
      if (response.id && this.responseHandlers.has(response.id)) {
        const handler = this.responseHandlers.get(response.id);
        handler(response);
        this.responseHandlers.delete(response.id);
      }
    } catch (error) {
      console.error('Error parsing response:', error);
    }
  }
}
```

## 3. Implementation Phases

### Phase 1: Core Server Architecture

- Implement the `LightfastServer` class
- Implement socket creation and basic threading
- Basic message receiving and sending
- Simple command system

### Phase 2: Command Handlers

- Implement command handlers for core functionality:
  - create_object
  - execute_code
  - get_state
- Implement the execution wrapper for main thread operations

### Phase 3: Improved Message Handling

- Implement robust buffering for large messages
- Add message validation and error recovery
- Implement response queuing system

### Phase 4: Advanced Code Execution

- Implement namespaces with common Blender modules
- Add output and error capturing
- Support for long-running code execution
- Progress reporting for long operations

### Phase 5: Desktop Integration

- Update the desktop app to act as a socket client
- Implement command sending and response handling
- Add connection management and recovery
- Update UI components to use the new system

## 4. Error Handling Strategy

- Implement structured error responses
- Add detailed tracebacks for Python errors
- Implement connection recovery mechanisms
- Add timeouts for long-running operations

## 5. Testing Plan

- Test with increasing code sizes to verify large code execution
- Test various error conditions in code execution
- Test connection loss and recovery
- Performance testing with complex operations

## 6. Migration Strategy

1. Implement the new addon alongside the existing one
2. Add feature flags to switch between implementations
3. Test with real-world scenarios
4. Gradually phase out the old implementation

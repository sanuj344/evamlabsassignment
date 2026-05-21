import json
from typing import Dict, List
from fastapi import WebSocket

class ConnectionManager:
    def __init__(self):
        # Maps room_code -> list of active WebSocket connections
        self.active_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, room_code: str, websocket: WebSocket):
        await websocket.accept()
        room_code = room_code.upper()
        if room_code not in self.active_connections:
            self.active_connections[room_code] = []
        self.active_connections[room_code].append(websocket)

    def disconnect(self, room_code: str, websocket: WebSocket):
        room_code = room_code.upper()
        if room_code in self.active_connections:
            if websocket in self.active_connections[room_code]:
                self.active_connections[room_code].remove(websocket)
            if not self.active_connections[room_code]:
                del self.active_connections[room_code]

    async def broadcast(self, room_code: str, event_type: str, data: dict):
        room_code = room_code.upper()
        if room_code not in self.active_connections:
            return
            
        message = {
            "type": event_type,
            "payload": data
        }
        
        # Broadcast to all connected websockets in the room
        disconnected_sockets = []
        for connection in self.active_connections[room_code]:
            try:
                await connection.send_text(json.dumps(message))
            except Exception:
                # Store failed connections to clean them up
                disconnected_sockets.append(connection)
                
        # Clean up any stale sockets
        for socket in disconnected_sockets:
            self.disconnect(room_code, socket)

manager = ConnectionManager()
class_name = "ConnectionManager"

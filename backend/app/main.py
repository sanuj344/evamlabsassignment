from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query, status
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.db import engine, Base, SessionLocal
from app.api.routes import router as api_router
from app.realtime.connection import manager
from app.models.models import User, Room, Participant

# Create SQLite tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

# Configure CORS for frontend cross-origin requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Vite local server / other origins
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API Router
app.include_router(api_router, prefix=settings.API_V1_STR)

@app.websocket("/ws/rooms/{room_code}")
async def websocket_endpoint(
    websocket: WebSocket,
    room_code: str,
    token: str = Query(None)
):
    """
    WebSocket endpoint for real-time room communication.
    Authenticates by token, verifies membership, and maintains connection.
    """
    db = SessionLocal()
    try:
        # 1. Authenticate user by token
        if not token:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Missing token")
            return
            
        user = db.query(User).filter(User.token == token).first()
        if not user:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Invalid token")
            return
            
        # 2. Verify Room exists
        room = db.query(Room).filter(Room.code == room_code.upper()).first()
        if not room:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Room not found")
            return
            
        # 3. Verify user is Host or Participant
        is_host = room.host_id == user.id
        is_participant = db.query(Participant).filter(
            Participant.room_id == room.id,
            Participant.user_id == user.id
        ).first() is not None
        
        if not is_host and not is_participant:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Unauthorized membership")
            return
            
        # 4. Accept connection
        await manager.connect(room.code, websocket)
        
        # 5. Maintain connection and await client messages (or disconnects)
        try:
            while True:
                # We expect client actions via REST API. We just wait for disconnect or ping.
                data = await websocket.receive_text()
                # Optional: Echo or handle simple signals
        except WebSocketDisconnect:
            manager.disconnect(room.code, websocket)
            
    except Exception as e:
        # Fallback closure
        try:
            await websocket.close(code=status.WS_1011_INTERNAL_ERROR)
        except Exception:
            pass
    finally:
        db.close()

@app.get("/")
def read_root():
    return {"status": "ok", "service": settings.PROJECT_NAME}

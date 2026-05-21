from enum import Enum

class RoomStatus(str, Enum):
    LOBBY = "lobby"
    ACTIVE = "active"
    COMPLETED = "completed"

class RoundStatus(str, Enum):
    WAITING = "waiting"
    ACTIVE = "active"
    SCORING = "scoring"
    COMPLETED = "completed"

class JobStatus(str, Enum):
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    TIMED_OUT = "timed_out"

from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
from app.schemas.enums import RoomStatus, RoundStatus, JobStatus

# User schemas
class UserBase(BaseModel):
    username: str

class UserCreate(UserBase):
    pass

class UserResponse(UserBase):
    id: str
    created_at: datetime
    
    class Config:
        from_attributes = True

class AuthResponse(BaseModel):
    user: UserResponse
    token: str

# Generation Job schemas
class GenerationJobResponse(BaseModel):
    id: str
    submission_id: str
    status: JobStatus
    result_url: Optional[str] = None
    error: Optional[str] = None
    updated_at: datetime

    class Config:
        from_attributes = True

# Submission schemas
class SubmissionBase(BaseModel):
    prompt: str

class SubmissionCreate(SubmissionBase):
    pass

class SubmissionResponse(SubmissionBase):
    id: str
    round_id: str
    participant_id: str
    created_at: datetime
    jobs: List[GenerationJobResponse] = []

    class Config:
        from_attributes = True

# Round schemas
class RoundBase(BaseModel):
    round_number: int
    prompt_theme: str

class RoundCreate(BaseModel):
    prompt_theme: str

class RoundResponse(RoundBase):
    id: str
    room_id: str
    status: RoundStatus
    created_at: datetime
    submissions: List[SubmissionResponse] = []

    class Config:
        from_attributes = True

# Participant schemas
class ParticipantResponse(BaseModel):
    id: str
    user_id: str
    username: str
    score: int
    is_eliminated: bool
    joined_at: datetime

    class Config:
        from_attributes = True

# Room Event schemas
class RoomEventResponse(BaseModel):
    id: str
    event_type: str
    payload_json: str
    created_at: datetime

    class Config:
        from_attributes = True

# Room schemas
class RoomBase(BaseModel):
    code: str

class RoomCreate(BaseModel):
    pass

class RoomResponse(RoomBase):
    id: str
    host_id: str
    status: RoomStatus
    created_at: datetime

    class Config:
        from_attributes = True

class RoomDetailResponse(RoomResponse):
    host_username: str
    participants: List[ParticipantResponse] = []
    rounds: List[RoundResponse] = []
    events: List[RoomEventResponse] = []

    class Config:
        from_attributes = True

# Request Payloads
class JoinRoomRequest(BaseModel):
    code: str

class StartRoundRequest(BaseModel):
    prompt_theme: str

class ScoreSubmissionItem(BaseModel):
    submission_id: str
    rank: int  # 1, 2, or 3 (or other ranks)

class ScoreRequest(BaseModel):
    rankings: List[ScoreSubmissionItem]

class EliminateRequest(BaseModel):
    participant_id: str

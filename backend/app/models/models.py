import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.core.db import Base

def generate_uuid():
    return str(uuid.uuid4())

class User(Base):
    __tablename__ = "users"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    username = Column(String, nullable=False)
    token = Column(String, unique=True, index=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    hosted_rooms = relationship("Room", back_populates="host")
    participations = relationship("Participant", back_populates="user")

class Room(Base):
    __tablename__ = "rooms"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    code = Column(String, unique=True, index=True, nullable=False)
    host_id = Column(String, ForeignKey("users.id"), nullable=False)
    status = Column(String, default="lobby")  # RoomStatus (lobby, active, completed)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    host = relationship("User", back_populates="hosted_rooms")
    participants = relationship("Participant", back_populates="room", cascade="all, delete-orphan")
    rounds = relationship("Round", back_populates="room", cascade="all, delete-orphan")
    events = relationship("RoomEvent", back_populates="room", cascade="all, delete-orphan")

class Participant(Base):
    __tablename__ = "participants"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    room_id = Column(String, ForeignKey("rooms.id"), nullable=False)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    score = Column(Integer, default=0)
    is_eliminated = Column(Boolean, default=False)
    joined_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    room = relationship("Room", back_populates="participants")
    user = relationship("User", back_populates="participations")
    submissions = relationship("Submission", back_populates="participant", cascade="all, delete-orphan")

class Round(Base):
    __tablename__ = "rounds"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    room_id = Column(String, ForeignKey("rooms.id"), nullable=False)
    round_number = Column(Integer, nullable=False)
    prompt_theme = Column(String, nullable=False)
    status = Column(String, default="active")  # RoundStatus (active, scoring, completed)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    room = relationship("Room", back_populates="rounds")
    submissions = relationship("Submission", back_populates="round", cascade="all, delete-orphan")

class Submission(Base):
    __tablename__ = "submissions"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    round_id = Column(String, ForeignKey("rounds.id"), nullable=False)
    participant_id = Column(String, ForeignKey("participants.id"), nullable=False)
    prompt = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    round = relationship("Round", back_populates="submissions")
    participant = relationship("Participant", back_populates="submissions")
    jobs = relationship("GenerationJob", back_populates="submission", cascade="all, delete-orphan")

class GenerationJob(Base):
    __tablename__ = "generation_jobs"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    submission_id = Column(String, ForeignKey("submissions.id"), nullable=False)
    status = Column(String, default="queued")  # JobStatus (queued, running, completed, failed, timed_out)
    result_url = Column(String, nullable=True)
    error = Column(String, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    submission = relationship("Submission", back_populates="jobs")

class RoomEvent(Base):
    __tablename__ = "room_events"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    room_id = Column(String, ForeignKey("rooms.id"), nullable=False)
    event_type = Column(String, nullable=False)
    payload_json = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    room = relationship("Room", back_populates="events")
class_name = "RoomEvent"

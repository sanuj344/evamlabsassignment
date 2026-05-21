import secrets
import string
import random
import asyncio
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session
from app.core.db import get_db
from app.core.config import settings
from app.schemas.enums import RoomStatus, RoundStatus, JobStatus
from app.models.models import User, Room, Participant, Round, Submission, GenerationJob, RoomEvent
from app.schemas.schemas import (
    UserCreate, AuthResponse, RoomResponse, RoomDetailResponse,
    JoinRoomRequest, StartRoundRequest, RoundResponse, SubmissionCreate,
    SubmissionResponse, ScoreRequest, EliminateRequest, ParticipantResponse,
    RoomEventResponse, GenerationJobResponse
)
from app.api.dependencies import get_current_user, require_host, require_participant, require_room_member
from app.workers.job_worker import run_ai_generation_job, save_and_broadcast_event

router = APIRouter()

def generate_room_code(db: Session) -> str:
    """Generate a unique 4-character uppercase room code."""
    chars = string.ascii_uppercase
    while True:
        code = "".join(random.choice(chars) for _ in range(4))
        # Ensure it doesn't already exist
        exists = db.query(Room).filter(Room.code == code).first()
        if not exists:
            return code

@router.post("/auth/register", response_model=AuthResponse)
def register_user(user_in: UserCreate, db: Session = Depends(get_db)):
    """Create a new user and generate a persistent access token."""
    token = secrets.token_hex(16)
    user = User(
        username=user_in.username,
        token=token
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"user": user, "token": token}

@router.post("/rooms/create", response_model=RoomResponse)
async def create_room(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Host creates a new game room."""
    code = generate_room_code(db)
    room = Room(
        code=code,
        host_id=current_user.id,
        status=RoomStatus.LOBBY
    )
    db.add(room)
    db.commit()
    db.refresh(room)
    
    # Save room creation event
    await save_and_broadcast_event(
        db=db,
        room_id=room.id,
        room_code=room.code,
        event_type="room_created",
        payload={"host_username": current_user.username, "room_code": room.code}
    )
    
    return room

@router.post("/rooms/join", response_model=RoomResponse)
async def join_room(payload: JoinRoomRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Participant joins an existing game room by code."""
    room = db.query(Room).filter(Room.code == payload.code.upper()).first()
    if not room:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Room with code '{payload.code}' does not exist."
        )
        
    if room.status == RoomStatus.COMPLETED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This battle room has already finished."
        )
        
    # Check if Host is trying to join as participant
    if room.host_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You are the host of this room. You cannot join as a participant."
        )
        
    # Check if already a participant
    participant = db.query(Participant).filter(
        Participant.room_id == room.id,
        Participant.user_id == current_user.id
    ).first()
    
    if not participant:
        participant = Participant(
            room_id=room.id,
            user_id=current_user.id,
            score=0,
            is_eliminated=False
        )
        db.add(participant)
        db.commit()
        db.refresh(participant)
        
        # Save and broadcast participant join event
        await save_and_broadcast_event(
            db=db,
            room_id=room.id,
            room_code=room.code,
            event_type="participant_joined",
            payload={
                "participant_id": participant.id,
                "user_id": current_user.id,
                "username": current_user.username,
                "score": 0,
                "is_eliminated": False,
                "joined_at": participant.joined_at.isoformat()
            }
        )
    elif participant.is_eliminated:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You have been eliminated from this battle room."
        )
        
    return room

@router.get("/rooms/{room_code}", response_model=RoomDetailResponse)
def get_room_details(room_code: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Fetch authoritative state of the room, including participants, rounds, submissions and activity logs."""
    room = db.query(Room).filter(Room.code == room_code.upper()).first()
    if not room:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Room not found."
        )
        
    # Confirm permissions: current user must be Host or Participant
    is_host = room.host_id == current_user.id
    is_participant = db.query(Participant).filter(
        Participant.room_id == room.id,
        Participant.user_id == current_user.id
    ).first() is not None
    
    if not is_host and not is_participant:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. You are not a member of this room."
        )
        
    # Build details payload
    host_user = db.query(User).filter(User.id == room.host_id).first()
    host_username = host_user.username if host_user else "Unknown"
    
    # Fetch participants with user metadata
    participants = []
    for p in room.participants:
        participants.append(
            ParticipantResponse(
                id=p.id,
                user_id=p.user_id,
                username=p.user.username,
                score=p.score,
                is_eliminated=p.is_eliminated,
                joined_at=p.joined_at
            )
        )
        
    # Fetch rounds with submissions
    rounds = []
    for r in room.rounds:
        submissions = []
        for s in r.submissions:
            jobs = [
                GenerationJobResponse(
                    id=j.id,
                    submission_id=j.submission_id,
                    status=j.status,
                    result_url=j.result_url,
                    error=j.error,
                    updated_at=j.updated_at
                ) for j in s.jobs
            ]
            submissions.append(
                SubmissionResponse(
                    id=s.id,
                    round_id=s.round_id,
                    participant_id=s.participant_id,
                    prompt=s.prompt,
                    created_at=s.created_at,
                    jobs=jobs
                )
            )
        rounds.append(
            RoundResponse(
                id=r.id,
                room_id=r.room_id,
                round_number=r.round_number,
                prompt_theme=r.prompt_theme,
                status=r.status,
                created_at=r.created_at,
                submissions=submissions
            )
        )
        
    # Fetch events
    events = [
        RoomEventResponse(
            id=e.id,
            event_type=e.event_type,
            payload_json=e.payload_json,
            created_at=e.created_at
        ) for e in room.events
    ]
    
    return RoomDetailResponse(
        id=room.id,
        code=room.code,
        host_id=room.host_id,
        host_username=host_username,
        status=room.status,
        created_at=room.created_at,
        participants=participants,
        rounds=rounds,
        events=events
    )

@router.post("/rooms/{room_code}/start-round", response_model=RoundResponse)
async def start_round(
    room_code: str,
    payload: StartRoundRequest,
    room: Room = Depends(require_host),
    db: Session = Depends(get_db)
):
    """Host starts a new round with a specific AI art theme."""
    # Set all existing rounds in room to completed
    db.query(Round).filter(Round.room_id == room.id).update({"status": RoundStatus.COMPLETED})
    
    # Calculate round number
    round_count = db.query(Round).filter(Round.room_id == room.id).count()
    new_round_number = round_count + 1
    
    round_obj = Round(
        room_id=room.id,
        round_number=new_round_number,
        prompt_theme=payload.prompt_theme,
        status=RoundStatus.ACTIVE
    )
    
    # Update Room status to active
    room.status = RoomStatus.ACTIVE
    
    db.add(round_obj)
    db.commit()
    db.refresh(round_obj)
    
    # Broadcast event
    await save_and_broadcast_event(
        db=db,
        room_id=room.id,
        room_code=room.code,
        event_type="round_started",
        payload={
            "round_id": round_obj.id,
            "round_number": round_obj.round_number,
            "prompt_theme": round_obj.prompt_theme,
            "status": round_obj.status,
            "created_at": round_obj.created_at.isoformat()
        }
    )
    
    return RoundResponse(
        id=round_obj.id,
        room_id=round_obj.room_id,
        round_number=round_obj.round_number,
        prompt_theme=round_obj.prompt_theme,
        status=round_obj.status,
        created_at=round_obj.created_at,
        submissions=[]
    )

@router.post("/rooms/{room_code}/submit", response_model=SubmissionResponse)
async def submit_prompt(
    room_code: str,
    payload: SubmissionCreate,
    background_tasks: BackgroundTasks,
    participant: Participant = Depends(require_participant),
    db: Session = Depends(get_db)
):
    """Participant submits their text prompt for AI image generation."""
    # Fetch active round
    room = db.query(Room).filter(Room.code == room_code.upper()).first()
    active_round = db.query(Round).filter(
        Round.room_id == room.id,
        Round.status == RoundStatus.ACTIVE
    ).first()
    
    if not active_round:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="There is no active round in this room."
        )
        
    # Check if participant already submitted in this round
    already_submitted = db.query(Submission).filter(
        Submission.round_id == active_round.id,
        Submission.participant_id == participant.id
    ).first()
    
    if already_submitted:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You have already submitted a prompt for this round."
        )
        
    # Create submission
    submission = Submission(
        round_id=active_round.id,
        participant_id=participant.id,
        prompt=payload.prompt
    )
    db.add(submission)
    db.commit()
    db.refresh(submission)
    
    # Create GenerationJob in QUEUED state
    job = GenerationJob(
        submission_id=submission.id,
        status=JobStatus.QUEUED
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    
    # Broadcast submission created event
    await save_and_broadcast_event(
        db=db,
        room_id=room.id,
        room_code=room.code,
        event_type="submission_created",
        payload={
            "submission_id": submission.id,
            "round_id": submission.round_id,
            "participant_id": submission.participant_id,
            "participant_username": participant.user.username,
            "prompt": submission.prompt,
            "job_id": job.id,
            "job_status": job.status,
            "created_at": submission.created_at.isoformat()
        }
    )
    
    # Check if all active non-eliminated participants have submitted.
    # If yes, we can automatically update round status to SCORING.
    total_active_participants = db.query(Participant).filter(
        Participant.room_id == room.id,
        Participant.is_eliminated == False
    ).count()
    
    total_submissions = db.query(Submission).filter(
        Submission.round_id == active_round.id
    ).count()
    
    if total_submissions >= total_active_participants:
        active_round.status = RoundStatus.SCORING
        db.commit()
        await save_and_broadcast_event(
            db=db,
            room_id=room.id,
            room_code=room.code,
            event_type="round_scoring",
            payload={
                "round_id": active_round.id,
                "status": RoundStatus.SCORING
            }
        )
        
    # Dispatch AI Generator Job in the background
    background_tasks.add_task(
        run_ai_generation_job,
        submission_id=submission.id,
        prompt=submission.prompt,
        round_context=active_round.prompt_theme,
        room_id=room.id,
        room_code=room.code,
        job_id=job.id
    )
    
    # Map job response
    job_response = GenerationJobResponse(
        id=job.id,
        submission_id=job.submission_id,
        status=job.status,
        updated_at=job.updated_at
    )
    
    return SubmissionResponse(
        id=submission.id,
        round_id=submission.round_id,
        participant_id=submission.participant_id,
        prompt=submission.prompt,
        created_at=submission.created_at,
        jobs=[job_response]
    )

@router.post("/rooms/{room_code}/score")
async def score_submissions(
    room_code: str,
    payload: ScoreRequest,
    room: Room = Depends(require_host),
    db: Session = Depends(get_db)
):
    """Host ranks submissions and awards points: 1st -> 5, 2nd -> 3, 3rd -> 1."""
    active_round = db.query(Round).filter(
        Round.room_id == room.id,
        Round.status.in_([RoundStatus.ACTIVE, RoundStatus.SCORING])
    ).first()
    
    if not active_round:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="There is no active or scoring round to score."
        )
        
    scores_awarded = []
    
    # Process rankings
    for rank_item in payload.rankings:
        # Find submission
        submission = db.query(Submission).filter(Submission.id == rank_item.submission_id).first()
        if not submission or submission.round_id != active_round.id:
            continue
            
        participant = db.query(Participant).filter(Participant.id == submission.participant_id).first()
        if not participant:
            continue
            
        # Point scale: 1st -> 5, 2nd -> 3, 3rd -> 1. Others -> 0
        points = 0
        if rank_item.rank == 1:
            points = 5
        elif rank_item.rank == 2:
            points = 3
        elif rank_item.rank == 3:
            points = 1
            
        participant.score += points
        db.commit()
        
        scores_awarded.append({
            "participant_username": participant.user.username,
            "rank": rank_item.rank,
            "points": points,
            "new_score": participant.score
        })
        
    # Transition Round and Room back to LOBBY status
    active_round.status = RoundStatus.COMPLETED
    room.status = RoomStatus.LOBBY
    db.commit()
    
    # Broadcast event
    await save_and_broadcast_event(
        db=db,
        room_id=room.id,
        room_code=room.code,
        event_type="score_updated",
        payload={
            "round_id": active_round.id,
            "scores_awarded": scores_awarded
        }
    )
    
    return {"message": "Scoring completed successfully.", "scores": scores_awarded}

@router.post("/rooms/{room_code}/eliminate")
async def eliminate_participant(
    room_code: str,
    payload: EliminateRequest,
    room: Room = Depends(require_host),
    db: Session = Depends(get_db)
):
    """Host eliminates a participant from future play."""
    participant = db.query(Participant).filter(
        Participant.id == payload.participant_id,
        Participant.room_id == room.id
    ).first()
    
    if not participant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Participant not found in this room."
        )
        
    if participant.is_eliminated:
        return {"message": "Participant is already eliminated."}
        
    participant.is_eliminated = True
    db.commit()
    
    # Broadcast elimination event
    await save_and_broadcast_event(
        db=db,
        room_id=room.id,
        room_code=room.code,
        event_type="participant_eliminated",
        payload={
            "participant_id": participant.id,
            "username": participant.user.username
        }
    )
    
    return {"message": f"Participant {participant.user.username} has been eliminated."}

@router.post("/jobs/{job_id}/retry")
async def retry_job(
    job_id: str,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Retry a failed or timed out generation job."""
    job = db.query(GenerationJob).filter(GenerationJob.id == job_id).first()
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Generation job not found."
        )
        
    if job.status not in [JobStatus.FAILED, JobStatus.TIMED_OUT]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot retry a job in status '{job.status}'."
        )
        
    submission = job.submission
    active_round = submission.round
    room = active_round.room
    
    # Verify user is host or the submitting participant
    is_host = room.host_id == current_user.id
    is_submitter = submission.participant.user_id == current_user.id
    
    if not is_host and not is_submitter:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to retry this job."
        )
        
    # Reset job
    job.status = JobStatus.QUEUED
    job.result_url = None
    job.error = None
    db.commit()
    
    # Broadcast queued event
    await save_and_broadcast_event(
        db=db,
        room_id=room.id,
        room_code=room.code,
        event_type="job_queued",
        payload={
            "job_id": job.id,
            "submission_id": submission.id,
            "status": JobStatus.QUEUED
        }
    )
    
    # Run in background
    background_tasks.add_task(
        run_ai_generation_job,
        submission_id=submission.id,
        prompt=submission.prompt,
        round_context=active_round.prompt_theme,
        room_id=room.id,
        room_code=room.code,
        job_id=job.id
    )
    
    return {"message": "Job retry scheduled.", "job_id": job.id}
class_name = "APIRouter"

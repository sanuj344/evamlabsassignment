import asyncio
import json
from datetime import datetime
from sqlalchemy.orm import Session
from app.core.db import SessionLocal
from app.models.models import GenerationJob, RoomEvent, Room
from app.schemas.enums import JobStatus
from app.providers.ai_provider import get_ai_provider
from app.realtime.connection import manager

async def save_and_broadcast_event(db: Session, room_id: str, room_code: str, event_type: str, payload: dict):
    """
    Helper to save an event to the RoomEvent database table and broadcast it to all room connections.
    """
    event = RoomEvent(
        room_id=room_id,
        event_type=event_type,
        payload_json=json.dumps(payload),
        created_at=datetime.utcnow()
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    
    # Broadcast event to room
    event_data = {
        "id": event.id,
        "event_type": event_type,
        "payload_json": event.payload_json,
        "created_at": event.created_at.isoformat()
    }
    await manager.broadcast(room_code, event_type, event_data)
    return event

async def run_ai_generation_job(submission_id: str, prompt: str, round_context: str, room_id: str, room_code: str, job_id: str):
    """
    Asynchronously runs the AI Generation Job.
    Uses asyncio.wait_for to enforce a 15-second timeout watchdog.
    """
    db = SessionLocal()
    try:
        # 1. Transition Job to RUNNING
        job = db.query(GenerationJob).filter(GenerationJob.id == job_id).first()
        if not job:
            return
            
        job.status = JobStatus.RUNNING
        db.commit()
        
        # Broadcast running event
        await save_and_broadcast_event(
            db=db,
            room_id=room_id,
            room_code=room_code,
            event_type="job_running",
            payload={
                "job_id": job.id,
                "submission_id": submission_id,
                "status": JobStatus.RUNNING
            }
        )
        
        # 2. Execute AI Provider with a 15-second watchdog
        ai_provider = get_ai_provider()
        
        try:
            # Enforce 15.0 second timeout
            result = await asyncio.wait_for(
                ai_provider.generate(prompt=prompt, round_context=round_context),
                timeout=15.0
            )
            
            # 3. Update DB based on AI provider result
            job = db.query(GenerationJob).filter(GenerationJob.id == job_id).first()
            if result.success:
                job.status = JobStatus.COMPLETED
                job.result_url = result.result_url
                db.commit()
                
                await save_and_broadcast_event(
                    db=db,
                    room_id=room_id,
                    room_code=room_code,
                    event_type="job_completed",
                    payload={
                        "job_id": job.id,
                        "submission_id": submission_id,
                        "status": JobStatus.COMPLETED,
                        "result_url": job.result_url
                    }
                )
            else:
                job.status = JobStatus.FAILED
                job.error = result.error
                db.commit()
                
                await save_and_broadcast_event(
                    db=db,
                    room_id=room_id,
                    room_code=room_code,
                    event_type="job_failed",
                    payload={
                        "job_id": job.id,
                        "submission_id": submission_id,
                        "status": JobStatus.FAILED,
                        "error": job.error
                    }
                )
                
        except asyncio.TimeoutError:
            # 4. Handle Watchdog Timeout
            job = db.query(GenerationJob).filter(GenerationJob.id == job_id).first()
            job.status = JobStatus.TIMED_OUT
            job.error = "Generation timed out (watchdog watchdog triggered after 15 seconds)"
            db.commit()
            
            await save_and_broadcast_event(
                db=db,
                room_id=room_id,
                room_code=room_code,
                event_type="job_failed",
                payload={
                    "job_id": job.id,
                    "submission_id": submission_id,
                    "status": JobStatus.TIMED_OUT,
                    "error": job.error
                }
            )
            
    except Exception as e:
        # Fallback error catcher
        try:
            job = db.query(GenerationJob).filter(GenerationJob.id == job_id).first()
            if job:
                job.status = JobStatus.FAILED
                job.error = str(e)
                db.commit()
                await save_and_broadcast_event(
                    db=db,
                    room_id=room_id,
                    room_code=room_code,
                    event_type="job_failed",
                    payload={
                        "job_id": job.id,
                        "submission_id": submission_id,
                        "status": JobStatus.FAILED,
                        "error": str(e)
                    }
                )
        except Exception:
            pass
    finally:
        db.close()

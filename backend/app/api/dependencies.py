from fastapi import Header, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.db import get_db
from app.models.models import User, Room, Participant

async def get_current_user(
    x_user_token: str = Header(None, alias="x-user-token"),
    db: Session = Depends(get_db)
) -> User:
    if not x_user_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authentication token. Please sign in."
        )
    
    user = db.query(User).filter(User.token == x_user_token).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token."
        )
    return user

async def get_active_room(
    room_code: str,
    db: Session = Depends(get_db)
) -> Room:
    room = db.query(Room).filter(Room.code == room_code.upper()).first()
    if not room:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Room with code '{room_code}' not found."
        )
    return room

async def require_room_member(
    room_code: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Room:
    room = await get_active_room(room_code, db)
    
    # Check if host
    if room.host_id == current_user.id:
        return room
        
    # Check if participant
    participant = db.query(Participant).filter(
        Participant.room_id == room.id,
        Participant.user_id == current_user.id
    ).first()
    
    if not participant:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this room."
        )
    return room

async def require_host(
    room_code: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Room:
    room = await get_active_room(room_code, db)
    if room.host_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Permission denied. Only the room host can perform this action."
        )
    return room

async def require_participant(
    room_code: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Participant:
    room = await get_active_room(room_code, db)
    
    # Host is not allowed to participate/submit
    if room.host_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Permission denied. Hosts cannot participate or submit prompts."
        )
        
    participant = db.query(Participant).filter(
        Participant.room_id == room.id,
        Participant.user_id == current_user.id
    ).first()
    
    if not participant:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You must join the room as a participant first."
        )
        
    if participant.is_eliminated:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You have been eliminated from this battle room."
        )
        
    return participant

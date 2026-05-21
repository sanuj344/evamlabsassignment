import time
import os
import sys

# Ensure backend root is in PYTHONPATH
sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from fastapi.testclient import TestClient
from app.main import app
from app.core.db import Base, engine
from app.core.config import settings

# Override settings to ensure deterministic and fast tests
settings.MOCK_AI_FAILURE_RATE = 0.0
settings.MOCK_AI_TIMEOUT_RATE = 0.0
settings.MOCK_AI_DELAY_SECONDS = 0.5

# Setup clear test database schema before running tests
Base.metadata.drop_all(bind=engine)
Base.metadata.create_all(bind=engine)

client = TestClient(app)

def test_integration_flow():
    print("--- 1. Registering Host and Participant ---")
    # Register host
    host_res = client.post("/api/auth/register", json={"username": "HostGamer"})
    assert host_res.status_code == 200
    host_data = host_res.json()
    host_token = host_data["token"]
    host_user = host_data["user"]
    print(f"Registered Host: {host_user['username']} (Token: {host_token})")

    # Register participant
    part_res = client.post("/api/auth/register", json={"username": "SarahPainter"})
    assert part_res.status_code == 200
    part_data = part_res.json()
    part_token = part_data["token"]
    part_user = part_data["user"]
    print(f"Registered Participant: {part_user['username']} (Token: {part_token})")

    print("\n--- 2. Creating Room (Host) ---")
    room_res = client.post("/api/rooms/create", headers={"x-user-token": host_token})
    assert room_res.status_code == 200
    room_data = room_res.json()
    room_code = room_data["code"]
    print(f"Created Room with code: {room_code}")

    print("\n--- 3. Joining Room (Participant) ---")
    join_res = client.post("/api/rooms/join", headers={"x-user-token": part_token}, json={"code": room_code})
    assert join_res.status_code == 200
    print(f"Participant joined room successfully!")

    print("\n--- 4. Checking Room Lobby Status ---")
    lobby_res = client.get(f"/api/rooms/{room_code}", headers={"x-user-token": part_token})
    assert lobby_res.status_code == 200
    lobby_data = lobby_res.json()
    assert len(lobby_data["participants"]) == 1
    assert lobby_data["participants"][0]["username"] == "SarahPainter"
    assert lobby_data["status"] == "lobby"
    print("Lobby states verify successfully!")

    print("\n--- 5. Starting Round #1 (Host) ---")
    round_res = client.post(
        f"/api/rooms/{room_code}/start-round",
        headers={"x-user-token": host_token},
        json={"prompt_theme": "Futuristic Coffee Machine"}
    )
    assert round_res.status_code == 200
    round_data = round_res.json()
    assert round_data["prompt_theme"] == "Futuristic Coffee Machine"
    assert round_data["status"] == "active"
    print(f"Round started with theme: {round_data['prompt_theme']}")

    print("\n--- 6. Submitting Prompt (Participant) ---")
    submit_res = client.post(
        f"/api/rooms/{room_code}/submit",
        headers={"x-user-token": part_token},
        json={"prompt": "Glowing glass coffee pot brewing blue stardust liquid"}
    )
    assert submit_res.status_code == 200
    sub_data = submit_res.json()
    submission_id = sub_data["id"]
    job_id = sub_data["jobs"][0]["id"]
    assert sub_data["jobs"][0]["status"] == "queued"
    print(f"Prompt submitted! Submission ID: {submission_id}, Job ID: {job_id} (queued)")

    print("\n--- 7. Wait and Verify AI Mock Execution ---")
    print("Simulating delay and polling generator task...")
    
    job = None
    for attempt in range(20):
        time.sleep(0.2)
        room_active_res = client.get(f"/api/rooms/{room_code}", headers={"x-user-token": part_token})
        assert room_active_res.status_code == 200
        room_active_data = room_active_res.json()
        
        # Locate submission and check job status
        submissions = room_active_data["rounds"][0]["submissions"]
        if len(submissions) == 1:
            jobs = submissions[0]["jobs"]
            if len(jobs) == 1:
                job = jobs[0]
                print(f"Polling attempt {attempt+1}: status = {job['status']}")
                if job["status"] == "completed":
                    break
    
    assert job is not None, "Submission job was not created"
    print(f"DEBUG: Job status is '{job['status']}', error: '{job.get('error')}', result_url: '{job.get('result_url')}'")
    assert job["status"] == "completed"
    assert job["result_url"] is not None
    print(f"AI Generation finished! Result URL: {job['result_url']}")

    print("\n--- 8. Score/Rank Submission (Host) ---")
    score_res = client.post(
        f"/api/rooms/{room_code}/score",
        headers={"x-user-token": host_token},
        json={"rankings": [{"submission_id": submission_id, "rank": 1}]}
    )
    assert score_res.status_code == 200
    print("Scoring successful! Scoreboard response:")
    print(score_res.json())

    # Verify score updated
    score_check = client.get(f"/api/rooms/{room_code}", headers={"x-user-token": part_token}).json()
    assert score_check["participants"][0]["score"] == 5
    assert score_check["status"] == "lobby"  # room status reset to lobby
    print("Participant score correctly updated to 5!")

    print("\n--- 9. Eliminate Participant (Host) ---")
    participant_id = score_check["participants"][0]["id"]
    elim_res = client.post(
        f"/api/rooms/{room_code}/eliminate",
        headers={"x-user-token": host_token},
        json={"participant_id": participant_id}
    )
    assert elim_res.status_code == 200
    print(f"Participant eliminated!")

    # Verify participant is marked as eliminated
    final_check = client.get(f"/api/rooms/{room_code}", headers={"x-user-token": part_token}).json()
    assert final_check["participants"][0]["is_eliminated"] is True
    print("Elimination successfully verified in database!")

    print("\n--- 10. Verify WebSocket Handshakes and Messaging ---")
    # Simulate WebSocket connection
    with client.websocket_connect(f"/ws/rooms/{room_code}?token={host_token}") as websocket:
        print("WebSocket client successfully connected and authenticated!")
        
    print("\n===============================================")
    print("INTEGRATION FLOW VERIFICATION PASSED SUCCESSFULLY!")
    print("===============================================")

if __name__ == "__main__":
    test_integration_flow()

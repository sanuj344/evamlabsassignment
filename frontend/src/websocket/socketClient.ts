import { useRoomStore } from '../store/useRoomStore';

class RoomSocket {
  private roomCode: string;
  private token: string;
  private socket: WebSocket | null = null;
  private reconnectTimeout: number | null = null;
  private retryCount = 0;
  private maxReconnectDelay = 16000; // Max 16s delay
  private baseReconnectDelay = 1000; // Start at 1s
  private isManuallyClosed = false;

  constructor(roomCode: string, token: string) {
    this.roomCode = roomCode.toUpperCase();
    this.token = token;
  }

  public connect() {
    this.isManuallyClosed = false;
    if (this.socket) {
      this.socket.close();
    }

    const wsUrl = `ws://localhost:8001/ws/rooms/${this.roomCode}?token=${this.token}`;
    useRoomStore.getState().setWsStatus('connecting');

    try {
      this.socket = new WebSocket(wsUrl);

      this.socket.onopen = () => {
        this.retryCount = 0;
        useRoomStore.getState().setWsStatus('connected');
        useRoomStore.getState().setError(null);
        
        // Full Room State Reconciliation upon connection/reconnection
        useRoomStore.getState().syncRoom(this.roomCode, this.token);
      };

      this.socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          const { type, payload } = message;

          // Handle real-time updates based on event type
          switch (type) {
            case 'participant_joined':
            case 'round_started':
            case 'round_scoring':
            case 'score_updated':
            case 'participant_eliminated':
              // Perform full state resync to ensure single source of truth is authoritative
              useRoomStore.getState().syncRoom(this.roomCode, this.token);
              if (payload) {
                useRoomStore.getState().addEventToFeed(payload);
              }
              break;

            case 'submission_created':
              // Optimistically update active round with submission info
              useRoomStore.getState().addSubmissionToActiveRound(payload);
              if (payload) {
                useRoomStore.getState().addEventToFeed(payload);
              }
              break;

            case 'job_queued':
            case 'job_running':
            case 'job_completed':
            case 'job_failed':
              // Specifically update job progress/status inside our submissions list
              useRoomStore.getState().updateJobStateInRoom(payload);
              break;

            default:
              console.log('Received unhandled socket event:', type, payload);
          }
        } catch (err) {
          console.error('Failed to parse WebSocket message:', err);
        }
      };

      this.socket.onclose = () => {
        useRoomStore.getState().setWsStatus('disconnected');
        this.socket = null;

        if (!this.isManuallyClosed) {
          this.scheduleReconnect();
        }
      };

      this.socket.onerror = (error) => {
        console.error('WebSocket encountered an error:', error);
        // Will trigger onclose automatically
      };

    } catch (err: any) {
      console.error('WebSocket connection failed:', err);
      useRoomStore.getState().setWsStatus('disconnected');
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    // Exponential backoff with jitter
    const delay = Math.min(
      this.baseReconnectDelay * Math.pow(2, this.retryCount) + Math.random() * 500,
      this.maxReconnectDelay
    );

    console.log(`Reconnecting WebSocket in ${(delay / 1000).toFixed(1)} seconds... (Attempt ${this.retryCount + 1})`);
    
    this.reconnectTimeout = window.setTimeout(() => {
      this.retryCount++;
      this.connect();
    }, delay);
  }

  public disconnect() {
    this.isManuallyClosed = true;
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    useRoomStore.getState().setWsStatus('disconnected');
  }
}

// Map to store active WS clients per room
const activeSockets: Record<string, RoomSocket> = {};

export const wsController = {
  connect(roomCode: string, token: string) {
    const key = `${roomCode}-${token}`;
    
    // Disconnect existing if different
    Object.keys(activeSockets).forEach((k) => {
      if (k !== key) {
        activeSockets[k].disconnect();
        delete activeSockets[k];
      }
    });

    if (!activeSockets[key]) {
      activeSockets[key] = new RoomSocket(roomCode, token);
      activeSockets[key].connect();
    } else {
      activeSockets[key].connect(); // Re-establish if already registered
    }
  },

  disconnect() {
    Object.keys(activeSockets).forEach((k) => {
      activeSockets[k].disconnect();
      delete activeSockets[k];
    });
  }
};

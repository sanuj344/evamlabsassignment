import type { User, RoomDetail } from '../types';

const API_BASE = 'http://localhost:8001/api';

async function fetchWithError(url: string, options: RequestInit = {}): Promise<any> {
  const response = await fetch(url, options);
  if (!response.ok) {
    let errorDetail = 'API Request Failed';
    try {
      const data = await response.json();
      errorDetail = data.detail || errorDetail;
    } catch {
      // Ignore parsing errors
    }
    throw new Error(errorDetail);
  }
  return response.json();
}

export const api = {
  async register(username: string): Promise<{ user: User; token: string }> {
    return fetchWithError(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username }),
    });
  },

  async createRoom(token: string): Promise<{ code: string; host_id: string }> {
    return fetchWithError(`${API_BASE}/rooms/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-token': token,
      },
    });
  },

  async joinRoom(code: string, token: string): Promise<{ code: string }> {
    return fetchWithError(`${API_BASE}/rooms/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-token': token,
      },
      body: JSON.stringify({ code }),
    });
  },

  async getRoom(code: string, token: string): Promise<RoomDetail> {
    return fetchWithError(`${API_BASE}/rooms/${code.toUpperCase()}`, {
      method: 'GET',
      headers: {
        'x-user-token': token,
      },
    });
  },

  async startRound(code: string, promptTheme: string, token: string): Promise<any> {
    return fetchWithError(`${API_BASE}/rooms/${code.toUpperCase()}/start-round`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-token': token,
      },
      body: JSON.stringify({ prompt_theme: promptTheme }),
    });
  },

  async submitPrompt(code: string, prompt: string, token: string): Promise<any> {
    return fetchWithError(`${API_BASE}/rooms/${code.toUpperCase()}/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-token': token,
      },
      body: JSON.stringify({ prompt }),
    });
  },

  async scoreSubmissions(
    code: string,
    rankings: { submission_id: string; rank: number }[],
    token: string
  ): Promise<any> {
    return fetchWithError(`${API_BASE}/rooms/${code.toUpperCase()}/score`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-token': token,
      },
      body: JSON.stringify({ rankings }),
    });
  },

  async eliminateParticipant(code: string, participantId: string, token: string): Promise<any> {
    return fetchWithError(`${API_BASE}/rooms/${code.toUpperCase()}/eliminate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-token': token,
      },
      body: JSON.stringify({ participant_id: participantId }),
    });
  },

  async retryJob(jobId: string, token: string): Promise<any> {
    return fetchWithError(`${API_BASE}/jobs/${jobId}/retry`, {
      method: 'POST',
      headers: {
        'x-user-token': token,
      },
    });
  },
};

import { create } from 'zustand';
import type { User, RoomDetail } from '../types';
import { api } from '../services/api';

interface RoomState {
  user: User | null;
  room: RoomDetail | null;
  wsStatus: 'disconnected' | 'connecting' | 'connected';
  error: string | null;
  
  // Actions
  setUser: (user: User | null) => void;
  setRoom: (room: RoomDetail | null) => void;
  setWsStatus: (status: 'disconnected' | 'connecting' | 'connected') => void;
  setError: (error: string | null) => void;
  syncRoom: (code: string, token: string) => Promise<void>;
  addEventToFeed: (event: any) => void;
  updateJobStateInRoom: (jobPayload: { job_id: string; submission_id: string; status: any; result_url?: string; error?: string }) => void;
  addSubmissionToActiveRound: (submissionPayload: any) => void;
}

// Load user from localStorage on initial load
const getSavedUser = (): User | null => {
  try {
    const saved = localStorage.getItem('battle_user');
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
};

export const useRoomStore = create<RoomState>((set) => ({
  user: getSavedUser(),
  room: null,
  wsStatus: 'disconnected',
  error: null,

  setUser: (user) => {
    set({ user });
    if (user) {
      localStorage.setItem('battle_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('battle_user');
    }
  },

  setRoom: (room) => set({ room }),

  setWsStatus: (wsStatus) => set({ wsStatus }),

  setError: (error) => set({ error }),

  syncRoom: async (code, token) => {
    try {
      const roomDetails = await api.getRoom(code, token);
      set({ room: roomDetails, error: null });
    } catch (err: any) {
      set({ error: err.message || 'Failed to sync room state.' });
    }
  },

  addEventToFeed: (event) => {
    set((state) => {
      if (!state.room) return {};
      
      // Avoid duplicate events
      if (state.room.events.some((e) => e.id === event.id)) return {};
      
      return {
        room: {
          ...state.room,
          events: [...state.room.events, event],
        },
      };
    });
  },

  updateJobStateInRoom: (jobPayload) => {
    set((state) => {
      if (!state.room) return {};

      const updatedRounds = state.room.rounds.map((round) => {
        const updatedSubmissions = round.submissions.map((sub) => {
          if (sub.id === jobPayload.submission_id) {
            const updatedJobs = sub.jobs.map((job) => {
              if (job.id === jobPayload.job_id) {
                return {
                  ...job,
                  status: jobPayload.status,
                  result_url: jobPayload.result_url || job.result_url,
                  error: jobPayload.error || job.error,
                  updated_at: new Date().toISOString(),
                };
              }
              return job;
            });
            
            // If the job wasn't present, add it
            const hasJob = sub.jobs.some((job) => job.id === jobPayload.job_id);
            if (!hasJob) {
              updatedJobs.push({
                id: jobPayload.job_id,
                submission_id: jobPayload.submission_id,
                status: jobPayload.status,
                result_url: jobPayload.result_url,
                error: jobPayload.error,
                updated_at: new Date().toISOString(),
              });
            }

            return { ...sub, jobs: updatedJobs };
          }
          return sub;
        });
        return { ...round, submissions: updatedSubmissions };
      });

      return {
        room: {
          ...state.room,
          rounds: updatedRounds,
        },
      };
    });
  },

  addSubmissionToActiveRound: (submissionPayload) => {
    set((state) => {
      if (!state.room) return {};

      const updatedRounds = state.room.rounds.map((round) => {
        if (round.id === submissionPayload.round_id) {
          // Avoid duplicate submissions
          const exists = round.submissions.some((sub) => sub.id === submissionPayload.submission_id);
          if (exists) return round;

          const newSub = {
            id: submissionPayload.submission_id,
            round_id: submissionPayload.round_id,
            participant_id: submissionPayload.participant_id,
            prompt: submissionPayload.prompt,
            created_at: submissionPayload.created_at,
            jobs: [
              {
                id: submissionPayload.job_id,
                submission_id: submissionPayload.submission_id,
                status: submissionPayload.job_status,
                updated_at: submissionPayload.created_at,
              },
            ],
          };

          return {
            ...round,
            submissions: [...round.submissions, newSub],
          };
        }
        return round;
      });

      return {
        room: {
          ...state.room,
          rounds: updatedRounds,
        },
      };
    });
  },
}));

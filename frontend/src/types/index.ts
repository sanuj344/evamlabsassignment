export type RoomStatus = 'lobby' | 'active' | 'completed';
export type RoundStatus = 'waiting' | 'active' | 'scoring' | 'completed';
export type JobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'timed_out';

export interface User {
  id: string;
  username: string;
  token: string;
  created_at: string;
}

export interface Participant {
  id: string;
  user_id: string;
  username: string;
  score: number;
  is_eliminated: boolean;
  joined_at: string;
}

export interface GenerationJob {
  id: string;
  submission_id: string;
  status: JobStatus;
  result_url?: string;
  error?: string;
  updated_at: string;
}

export interface Submission {
  id: string;
  round_id: string;
  participant_id: string;
  prompt: string;
  created_at: string;
  jobs: GenerationJob[];
}

export interface Round {
  id: string;
  room_id: string;
  round_number: number;
  prompt_theme: string;
  status: RoundStatus;
  created_at: string;
  submissions: Submission[];
}

export interface RoomEvent {
  id: string;
  event_type: string;
  payload_json: string;
  created_at: string;
}

export interface RoomDetail {
  id: string;
  code: string;
  host_id: string;
  host_username: string;
  status: RoomStatus;
  created_at: string;
  participants: Participant[];
  rounds: Round[];
  events: RoomEvent[];
}

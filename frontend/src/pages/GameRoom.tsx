import React, { useState, useEffect } from 'react';
import { useRoomStore } from '../store/useRoomStore';
import { api } from '../services/api';
import { wsController } from '../websocket/socketClient';
import { Leaderboard } from '../components/Leaderboard';
import { LiveFeed } from '../components/LiveFeed';
import { JobProgressCard } from '../components/Skeletons';
import { 
  Play, LogOut, Image, CheckCircle, Trophy, Ban, Send
} from 'lucide-react';

export const GameRoom: React.FC = () => {
  const user = useRoomStore((state) => state.user);
  const room = useRoomStore((state) => state.room);
  const wsStatus = useRoomStore((state) => state.wsStatus);
  const setRoom = useRoomStore((state) => state.setRoom);

  // Form states
  const [promptTheme, setPromptTheme] = useState('');
  const [promptInput, setPromptInput] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  // Host Scoring rankings state: Map of submission_id -> rank (1, 2, or 3)
  const [rankings, setRankings] = useState<Record<string, number>>({});

  // Reset scoring state when round transitions
  const activeRound = room?.rounds.find((r) => r.status === 'active' || r.status === 'scoring');
  useEffect(() => {
    setRankings({});
    setErrorText(null);
  }, [activeRound?.status]);

  if (!room || !user) return null;

  const isHost = room.host_id === user.id;
  
  // Find current user's participant profile (if not host)
  const currentParticipant = room.participants.find((p) => p.user_id === user.id);
  const isEliminated = currentParticipant?.is_eliminated || false;

  const handleLeaveRoom = () => {
    wsController.disconnect();
    setRoom(null);
  };

  const handleStartRound = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!promptTheme.trim()) return;

    setActionLoading(true);
    setErrorText(null);
    try {
      await api.startRound(room.code, promptTheme.trim(), user.token);
      setPromptTheme('');
    } catch (err: any) {
      setErrorText(err.message || 'Failed to start round.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSubmitPrompt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!promptInput.trim()) return;

    setActionLoading(true);
    setErrorText(null);
    try {
      await api.submitPrompt(room.code, promptInput.trim(), user.token);
      setPromptInput('');
    } catch (err: any) {
      setErrorText(err.message || 'Failed to submit prompt.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAssignRank = (submissionId: string, rank: number) => {
    setRankings((prev) => {
      const next = { ...prev };
      
      // If this submission already has this rank, toggle it off
      if (next[submissionId] === rank) {
        delete next[submissionId];
        return next;
      }

      // Remove this rank from any other submission that had it
      Object.keys(next).forEach((key) => {
        if (next[key] === rank) {
          delete next[key];
        }
      });

      // Assign rank
      next[submissionId] = rank;
      return next;
    });
  };

  const handleFinalizeScoring = async () => {
    setActionLoading(true);
    setErrorText(null);

    const rankingsPayload = Object.entries(rankings).map(([submission_id, rank]) => ({
      submission_id,
      rank,
    }));

    try {
      await api.scoreSubmissions(room.code, rankingsPayload, user.token);
      setRankings({});
    } catch (err: any) {
      setErrorText(err.message || 'Failed to submit rankings.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleEliminate = async (participantId: string) => {
    if (!window.confirm('Are you sure you want to eliminate this participant from this room?')) {
      return;
    }
    try {
      await api.eliminateParticipant(room.code, participantId, user.token);
    } catch (err: any) {
      alert(err.message || 'Failed to eliminate participant.');
    }
  };

  const handleRetryJob = async (jobId: string) => {
    try {
      await api.retryJob(jobId, user.token);
    } catch (err: any) {
      alert(err.message || 'Failed to retry job.');
    }
  };

  const handleReconnect = () => {
    wsController.connect(room.code, user.token);
  };

  // Check if current participant has submitted in active round
  const hasSubmitted = activeRound?.submissions.some(
    (s) => s.participant_id === currentParticipant?.id
  ) || false;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Navigation Bar */}
      <header className="bg-white border-b border-slate-200/80 sticky top-0 z-30 shadow-sm px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center justify-center text-indigo-600 font-bold">
            ⚔️
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-slate-800">Battle Room: {room.code}</h2>
              <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded text-slate-500 font-bold uppercase">
                {room.status}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium">Host: <span className="font-semibold text-slate-600">{room.host_username}</span></p>
          </div>
        </div>

        <button
          onClick={handleLeaveRoom}
          className="flex items-center gap-1 px-3 py-1.5 border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-500 hover:text-slate-800 text-xs font-semibold rounded-xl shadow-sm transition-all"
        >
          <LogOut className="w-3.5 h-3.5" />
          Leave Room
        </button>
      </header>

      {/* Main Layout Grid */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 p-6 max-w-7xl w-full mx-auto">
        
        {/* Left Gameplay Arena (8 cols) */}
        <main className="lg:col-span-8 space-y-6">
          
          {/* LOBBY VIEW */}
          {room.status === 'lobby' && (
            <div className="bg-white border border-slate-200/80 rounded-3xl p-8 shadow-premium glass-panel-heavy text-center space-y-8 flex flex-col items-center justify-center min-h-[400px]">
              <div className="w-16 h-16 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600 text-3xl animate-bounce">
                🎮
              </div>
              <div className="space-y-2 max-w-md">
                <h1 className="text-2xl font-extrabold text-slate-800">Waiting for players to join...</h1>
                <p className="text-sm text-slate-400 font-medium">
                  Share the Room Code <span className="font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">{room.code}</span> with friends. Once everyone is in, the host can start the challenge.
                </p>
              </div>

              {/* Host Setup Panel */}
              {isHost ? (
                <form onSubmit={handleStartRound} className="w-full max-w-md space-y-4 pt-4 border-t border-slate-100">
                  <div className="space-y-2 text-left">
                    <label htmlFor="theme" className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                      Define the AI Art Theme
                    </label>
                    <input
                      id="theme"
                      type="text"
                      required
                      placeholder="e.g. Cyberpunk Cat in Tokyo rain, neon lights"
                      value={promptTheme}
                      onChange={(e) => setPromptTheme(e.target.value)}
                      disabled={actionLoading}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-indigo-500 focus:bg-white rounded-2xl text-sm text-slate-800 placeholder-slate-400 font-semibold focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all"
                    />
                  </div>

                  {errorText && (
                    <div className="text-xs text-rose-600 bg-rose-50 border border-rose-100 px-3.5 py-2.5 rounded-xl font-medium">
                      ⚠️ {errorText}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={actionLoading || !promptTheme.trim()}
                    className="w-full flex items-center justify-center gap-1.5 py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl shadow-md transition-all disabled:opacity-60"
                  >
                    <Play className="w-4 h-4 fill-white" />
                    Start Round #{(room.rounds.length || 0) + 1}
                  </button>
                </form>
              ) : (
                <div className="space-y-3 pt-4">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 bg-slate-100/50 px-4 py-2 rounded-full border border-slate-200/50">
                    <span className="w-2 h-2 bg-indigo-500 rounded-full animate-ping" />
                    Waiting for Host to configure the round theme...
                  </div>
                </div>
              )}

              {/* Host Quick Administration Section (Eliminate / Score Panel in Lobby) */}
              {isHost && room.participants.length > 0 && (
                <div className="w-full max-w-md pt-6 border-t border-slate-100 text-left space-y-3">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Lobby Administration
                  </h4>
                  <div className="space-y-1.5">
                    {room.participants.map((p) => (
                      <div key={p.id} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-200/50 text-xs">
                        <span className="font-semibold text-slate-700">
                          {p.username} {p.is_eliminated && <span className="text-rose-500">(Eliminated)</span>}
                        </span>
                        {!p.is_eliminated && (
                          <button
                            onClick={() => handleEliminate(p.id)}
                            className="flex items-center gap-1 px-2.5 py-1 text-rose-600 hover:bg-rose-50 border border-rose-200/40 hover:border-rose-200 rounded-lg transition-all font-semibold"
                          >
                            <Ban className="w-3.5 h-3.5" />
                            Eliminate
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ACTIVE GAME ROOM VIEW */}
          {room.status === 'active' && activeRound && (
            <div className="space-y-6">
              
              {/* Theme & Stage Banner */}
              <div className="bg-gradient-to-r from-indigo-500 to-indigo-700 text-white rounded-3xl p-6 shadow-premium relative overflow-hidden">
                <div className="absolute right-0 top-0 bottom-0 opacity-10 pointer-events-none translate-x-1/4 select-none text-9xl font-extrabold">
                  ART
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-white/20 rounded-full border border-white/10 backdrop-blur-sm">
                      Stage: {activeRound.status.toUpperCase()}
                    </span>
                    <span className="text-xs font-semibold text-indigo-100">
                      Round #{activeRound.round_number}
                    </span>
                  </div>
                  <h1 className="text-xl md:text-2xl font-black">
                    Theme: <span className="underline decoration-indigo-300 underline-offset-4">"{activeRound.prompt_theme}"</span>
                  </h1>
                </div>
              </div>

              {/* PARTICIPANT SUBMISSION ZONE */}
              {!isHost && !isEliminated && activeRound.status === 'active' && (
                <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-premium space-y-4">
                  {!hasSubmitted ? (
                    <form onSubmit={handleSubmitPrompt} className="space-y-4">
                      <div className="space-y-1.5">
                        <label htmlFor="promptInput" className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                          Draft Your Text Prompt
                        </label>
                        <textarea
                          id="promptInput"
                          required
                          rows={3}
                          placeholder="Describe the image you want the AI to generate based on the theme..."
                          value={promptInput}
                          onChange={(e) => setPromptInput(e.target.value)}
                          disabled={actionLoading}
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-indigo-500 focus:bg-white rounded-2xl text-sm text-slate-800 placeholder-slate-400 font-semibold focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all resize-none"
                        />
                      </div>

                      {errorText && (
                        <div className="text-xs text-rose-600 bg-rose-50 border border-rose-100 px-3.5 py-2.5 rounded-xl font-medium">
                          ⚠️ {errorText}
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={actionLoading || !promptInput.trim()}
                        className="w-full flex items-center justify-center gap-1.5 py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl shadow-md transition-all disabled:opacity-60"
                      >
                        <Send className="w-4 h-4" />
                        Submit & Generate AI Image
                      </button>
                    </form>
                  ) : (
                    <div className="flex items-center gap-3 p-4 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-semibold text-slate-500">
                      <CheckCircle className="w-5 h-5 text-emerald-500" />
                      <span>Your prompt was successfully submitted! Scroll below to check its AI rendering status.</span>
                    </div>
                  )}
                </div>
              )}

              {/* PARTICIPANT ELIMINATED MESSAGE */}
              {!isHost && isEliminated && (
                <div className="bg-rose-50 border border-rose-100 text-rose-800 rounded-3xl p-6 shadow-premium text-center space-y-2">
                  <span className="text-3xl">💀</span>
                  <h3 className="font-extrabold text-base">You are eliminated</h3>
                  <p className="text-xs text-rose-700 font-medium">
                    You have been eliminated from this battle. You can no longer submit prompts, but can stay to spectate the creations and rankings live.
                  </p>
                </div>
              )}

              {/* GALLERY & SUBMISSIONS RENDERING */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                  <Image className="w-4 h-4 text-slate-500" />
                  Creations Grid ({activeRound.submissions.length})
                </h3>

                {activeRound.submissions.length === 0 ? (
                  <div className="bg-white border border-slate-200/80 rounded-3xl p-12 text-center shadow-premium space-y-2">
                    <span className="text-3xl">🎨</span>
                    <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">No submissions yet</p>
                    <p className="text-xs text-slate-400 font-medium">Waiting for players to submit prompts.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                    {activeRound.submissions.map((sub) => {
                      const participant = room.participants.find((p) => p.id === sub.participant_id);
                      const username = participant?.username || 'Spectator';
                      
                      // Find active AI job
                      const job = sub.jobs[0];
                      const jobStatus = job?.status || 'queued';
                      const resultUrl = job?.result_url;
                      const jobError = job?.error;
                      const jobId = job?.id;

                      const isCreator = currentParticipant?.id === sub.participant_id;
                      const showRetry = (isHost || isCreator) && (jobStatus === 'failed' || jobStatus === 'timed_out');

                      // Render image if completed
                      if (jobStatus === 'completed' && resultUrl) {
                        const rankAssigned = rankings[sub.id];

                        return (
                          <div
                            key={sub.id}
                            className={`w-full bg-white border rounded-2xl overflow-hidden shadow-premium flex flex-col justify-between aspect-square relative group transition-all duration-300 ${
                              rankAssigned === 1
                                ? 'border-amber-400 ring-4 ring-amber-400/10'
                                : rankAssigned === 2
                                ? 'border-slate-400 ring-4 ring-slate-400/10'
                                : rankAssigned === 3
                                ? 'border-amber-700 ring-4 ring-amber-700/10'
                                : 'border-slate-100 hover:border-slate-200'
                            }`}
                          >
                            {/* Images and Overlay info */}
                            <div className="relative aspect-square w-full bg-slate-50 flex items-center justify-center overflow-hidden">
                              <img
                                src={resultUrl}
                                alt={sub.prompt}
                                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                loading="lazy"
                              />

                              {/* Ranking badges */}
                              {rankAssigned && (
                                <div className="absolute top-3 left-3 bg-white border shadow-md px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1 z-10">
                                  {rankAssigned === 1 ? '🥇 1st Place' : rankAssigned === 2 ? '🥈 2nd Place' : '🥉 3rd Place'}
                                </div>
                              )}

                              {/* Hover Overlay showing prompt */}
                              <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 p-4 flex flex-col justify-end text-left">
                                <p className="text-[10px] text-indigo-300 font-bold uppercase tracking-wider">Prompt</p>
                                <p className="text-xs text-white font-semibold italic line-clamp-4 leading-relaxed">
                                  "{sub.prompt}"
                                </p>
                              </div>
                            </div>

                            {/* Creator Metadata footer */}
                            <div className="p-3 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
                              <span className="text-xs font-bold text-slate-700">🎨 {username}</span>
                              
                              {/* Host Scoring buttons */}
                              {isHost && activeRound.status === 'scoring' && (
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => handleAssignRank(sub.id, 1)}
                                    className={`w-7 h-7 rounded-lg text-xs font-bold flex items-center justify-center shadow-sm border transition-all ${
                                      rankAssigned === 1
                                        ? 'bg-amber-400 border-amber-400 text-white'
                                        : 'bg-white border-slate-200 hover:bg-amber-50 text-slate-600'
                                    }`}
                                    title="Award 1st Place (+5 pts)"
                                  >
                                    1st
                                  </button>
                                  <button
                                    onClick={() => handleAssignRank(sub.id, 2)}
                                    className={`w-7 h-7 rounded-lg text-xs font-bold flex items-center justify-center shadow-sm border transition-all ${
                                      rankAssigned === 2
                                        ? 'bg-slate-400 border-slate-400 text-white'
                                        : 'bg-white border-slate-200 hover:bg-slate-100 text-slate-600'
                                    }`}
                                    title="Award 2nd Place (+3 pts)"
                                  >
                                    2nd
                                  </button>
                                  <button
                                    onClick={() => handleAssignRank(sub.id, 3)}
                                    className={`w-7 h-7 rounded-lg text-xs font-bold flex items-center justify-center shadow-sm border transition-all ${
                                      rankAssigned === 3
                                        ? 'bg-amber-700 border-amber-700 text-white'
                                        : 'bg-white border-slate-200 hover:bg-amber-50 text-slate-600'
                                    }`}
                                    title="Award 3rd Place (+1 pt)"
                                  >
                                    3rd
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      }

                      // Render Loading progress state
                      return (
                        <JobProgressCard
                          key={sub.id}
                          status={jobStatus}
                          prompt={sub.prompt}
                          creatorName={username}
                          error={jobError}
                          jobId={jobId}
                          onRetry={() => jobId && handleRetryJob(jobId)}
                          showRetryButton={showRetry}
                        />
                      );
                    })}
                  </div>
                )}
              </div>

              {/* HOST SCORING PANEL */}
              {isHost && activeRound.status === 'scoring' && activeRound.submissions.length > 0 && (
                <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-premium space-y-4">
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-slate-700 flex items-center gap-1.5">
                      <Trophy className="w-4 h-4 text-amber-500" />
                      Host Evaluation Room
                    </h3>
                    <p className="text-xs text-slate-400 font-medium leading-relaxed">
                      Evaluate prompt masterpieces. Assign 1st (🥇), 2nd (🥈), or 3rd (🥉) place ranks to trigger scoreboard additions. Duplicate selections are automatically cleaned.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2 text-xs">
                    <div className="px-3 py-1.5 bg-amber-50 border border-amber-200/50 rounded-xl font-semibold text-amber-800">
                      🥇 1st: {Object.entries(rankings).find(([_, r]) => r === 1) ? 'Assigned' : 'None Selected'}
                    </div>
                    <div className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-700">
                      🥈 2nd: {Object.entries(rankings).find(([_, r]) => r === 2) ? 'Assigned' : 'None Selected'}
                    </div>
                    <div className="px-3 py-1.5 bg-amber-50/50 border border-amber-200/20 rounded-xl font-semibold text-amber-900">
                      🥉 3rd: {Object.entries(rankings).find(([_, r]) => r === 3) ? 'Assigned' : 'None Selected'}
                    </div>
                  </div>

                  {errorText && (
                    <div className="text-xs text-rose-600 bg-rose-50 border border-rose-100 px-3.5 py-2.5 rounded-xl font-medium">
                      ⚠️ {errorText}
                    </div>
                  )}

                  <button
                    onClick={handleFinalizeScoring}
                    disabled={actionLoading || Object.keys(rankings).length === 0}
                    className="w-full flex items-center justify-center gap-1.5 py-3 px-4 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-2xl shadow-md transition-all disabled:opacity-60"
                  >
                    Submit Rankings & Finish Round
                  </button>
                </div>
              )}

              {/* PARTICIPANTS WAITING FOR SCORING SCREEN */}
              {!isHost && activeRound.status === 'scoring' && (
                <div className="bg-white border border-slate-200/80 rounded-3xl p-8 shadow-premium text-center space-y-4 flex flex-col items-center">
                  <div className="w-12 h-12 bg-amber-50 border border-amber-100 rounded-full flex items-center justify-center text-amber-500 animate-pulse text-xl">
                    🥇
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-sm font-bold text-slate-800">Host is scoring creations</h4>
                    <p className="text-xs text-slate-400 font-medium">
                      The Host is currently reviewing prompt generations and awarding medal standings.
                    </p>
                  </div>
                  <div className="w-2/3 max-w-xs bg-slate-100 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-amber-400 h-full w-full animate-[shimmer_2s_infinite_linear]" />
                  </div>
                </div>
              )}

            </div>
          )}

        </main>

        {/* Right Sideboards (4 cols) */}
        <aside className="lg:col-span-4 space-y-6">
          <Leaderboard
            participants={room.participants}
            hostUsername={room.host_username}
            hostId={room.host_id}
            currentUserId={user.id}
            wsStatus={wsStatus}
            onReconnect={handleReconnect}
          />
          <LiveFeed events={room.events} />
        </aside>

      </div>
    </div>
  );
};

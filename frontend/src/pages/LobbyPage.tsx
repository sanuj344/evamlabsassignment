import React, { useState } from 'react';
import { useRoomStore } from '../store/useRoomStore';
import { api } from '../services/api';
import { wsController } from '../websocket/socketClient';
import { Plus, Users, Loader2, LogOut, ArrowRight } from 'lucide-react';

export const LobbyPage: React.FC = () => {
  const [roomCode, setRoomCode] = useState('');
  const [loadingHost, setLoadingHost] = useState(false);
  const [loadingJoin, setLoadingJoin] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  const user = useRoomStore((state) => state.user);
  const setUser = useRoomStore((state) => state.setUser);
  const syncRoom = useRoomStore((state) => state.syncRoom);

  const handleLogout = () => {
    setUser(null);
  };

  const handleCreateRoom = async () => {
    if (!user) return;
    setLoadingHost(true);
    setErrorText(null);

    try {
      const room = await api.createRoom(user.token);
      
      // Connect WebSocket & Sync room state
      wsController.connect(room.code, user.token);
      await syncRoom(room.code, user.token);
    } catch (err: any) {
      setErrorText(err.message || 'Failed to create room.');
    } finally {
      setLoadingHost(false);
    }
  };

  const handleJoinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !roomCode.trim()) return;

    setLoadingJoin(true);
    setErrorText(null);

    try {
      const formattedCode = roomCode.trim().toUpperCase();
      await api.joinRoom(formattedCode, user.token);
      
      // Connect WebSocket & Sync room state
      wsController.connect(formattedCode, user.token);
      await syncRoom(formattedCode, user.token);
    } catch (err: any) {
      setErrorText(err.message || 'Failed to join room. Verify code is active.');
    } finally {
      setLoadingJoin(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center px-4 bg-slate-50 bg-grid-pattern relative overflow-hidden">
      {/* Background accents */}
      <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-indigo-50 rounded-full blur-3xl opacity-40 pointer-events-none" />
      
      <div className="w-full max-w-lg space-y-6 relative">
        {/* User Session Bar */}
        <div className="flex items-center justify-between p-4 bg-white/90 border border-slate-200/60 rounded-2xl shadow-sm glass-panel font-medium text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse" />
            <span>Active alias: <span className="font-bold text-slate-800">{user?.username}</span></span>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1 hover:text-rose-600 font-semibold transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out
          </button>
        </div>

        {/* Dashboard Box */}
        <div className="bg-white/95 border border-slate-200/80 rounded-3xl p-8 shadow-premium glass-panel-heavy space-y-8">
          <div className="text-center space-y-1">
            <h2 className="text-2xl font-bold text-slate-800">Creative Arena</h2>
            <p className="text-xs text-slate-400 font-medium">Create a private battle room or enter a join code.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Host Section */}
            <div className="space-y-4 p-5 bg-slate-50/50 border border-slate-100 rounded-2xl flex flex-col justify-between">
              <div className="space-y-2">
                <div className="w-10 h-10 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center justify-center text-indigo-600">
                  <Plus className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-bold text-slate-700">Host Room</h3>
                <p className="text-xs text-slate-400 font-medium leading-relaxed">
                  Start a private challenge. You control theme selections, round timings, and score/eliminate entries.
                </p>
              </div>

              <button
                onClick={handleCreateRoom}
                disabled={loadingHost || loadingJoin}
                className="w-full mt-4 flex items-center justify-center gap-1.5 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold rounded-xl shadow-md hover:shadow-indigo-500/10 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loadingHost ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    Create Room
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>

            {/* Join Section */}
            <div className="space-y-4 p-5 bg-slate-50/50 border border-slate-100 rounded-2xl flex flex-col justify-between">
              <form onSubmit={handleJoinRoom} className="space-y-4 h-full flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="w-10 h-10 bg-slate-100 border border-slate-200 rounded-xl flex items-center justify-center text-slate-600">
                    <Users className="w-5 h-5" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-700">Join Battle</h3>
                  
                  <div className="space-y-1">
                    <input
                      type="text"
                      required
                      placeholder="Room Code (e.g. ABCD)"
                      value={roomCode}
                      onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                      maxLength={4}
                      className="w-full text-center tracking-widest px-3 py-2 bg-white border border-slate-200 hover:border-slate-300 focus:border-indigo-500 rounded-xl text-slate-800 placeholder-slate-400 font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/10 uppercase"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loadingJoin || loadingHost || !roomCode.trim()}
                  className="w-full mt-4 flex items-center justify-center gap-1.5 py-2.5 px-4 bg-slate-800 hover:bg-slate-950 text-white font-bold rounded-xl shadow-md transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {loadingJoin ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Entering...
                    </>
                  ) : (
                    <>
                      Join Room
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>

          {errorText && (
            <div className="text-xs text-rose-600 bg-rose-50 border border-rose-100 px-3.5 py-2.5 rounded-xl font-semibold flex items-center gap-1.5">
              <span>⚠️</span>
              {errorText}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

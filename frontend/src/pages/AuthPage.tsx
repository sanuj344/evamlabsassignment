import React, { useState } from 'react';
import { useRoomStore } from '../store/useRoomStore';
import { api } from '../services/api';
import { Sparkles, Loader2, ArrowRight } from 'lucide-react';

export const AuthPage: React.FC = () => {
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [errMessage, setErrMessage] = useState<string | null>(null);
  
  const setUser = useRoomStore((state) => state.setUser);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;
    
    setLoading(true);
    setErrMessage(null);
    
    try {
      const data = await api.register(username.trim());
      // Save full user model with token
      setUser({
        id: data.user.id,
        username: data.user.username,
        token: data.token,
        created_at: data.user.created_at,
      });
    } catch (err: any) {
      setErrMessage(err.message || 'An error occurred during sign-in.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center px-4 bg-slate-50 bg-grid-pattern relative overflow-hidden">
      {/* Visual background accents */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-100 rounded-full blur-3xl opacity-30 pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-sky-100 rounded-full blur-3xl opacity-30 pointer-events-none" />
      
      <div className="w-full max-w-md space-y-8 relative">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-indigo-50 border border-indigo-100 rounded-2xl shadow-sm text-indigo-600 mb-2">
            <Sparkles className="w-7 h-7" />
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
            AI Creative <span className="text-indigo-600">Battle Room</span>
          </h1>
          <p className="text-sm text-slate-500 max-w-xs mx-auto font-medium">
            Join multiplayer AI art challenges, generate stunning creations, and rank prompts.
          </p>
        </div>

        {/* Auth Box */}
        <div className="bg-white/95 border border-slate-200/80 rounded-3xl p-8 shadow-premium glass-panel-heavy space-y-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="username" className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                Enter Your Alias
              </label>
              <input
                id="username"
                type="text"
                required
                maxLength={20}
                placeholder="e.g. PixelWarrior"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={loading}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-indigo-500 focus:bg-white rounded-2xl text-slate-800 placeholder-slate-400 font-semibold focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </div>

            {errMessage && (
              <div className="text-xs text-rose-600 bg-rose-50 border border-rose-100 px-3.5 py-2.5 rounded-xl font-medium flex items-center gap-1.5">
                <span>⚠️</span>
                {errMessage}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !username.trim()}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold rounded-2xl shadow-md hover:shadow-indigo-500/10 hover:translate-y-[-1px] active:translate-y-[0px] focus:outline-none focus:ring-4 focus:ring-indigo-500/20 transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Creating Identity...
                </>
              ) : (
                <>
                  Enter Arena
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-slate-400 font-semibold uppercase tracking-wider">
          Poiro Developer Assignment
        </p>
      </div>
    </div>
  );
};

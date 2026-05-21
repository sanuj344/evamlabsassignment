import React from 'react';
import type { Participant } from '../types';
import { Award, Crown, Zap, ZapOff, RefreshCw } from 'lucide-react';

interface LeaderboardProps {
  participants: Participant[];
  hostUsername: string;
  hostId: string;
  currentUserId: string;
  wsStatus: 'disconnected' | 'connecting' | 'connected';
  onReconnect?: () => void;
}

export const Leaderboard: React.FC<LeaderboardProps> = ({
  participants,
  hostUsername,
  hostId,
  currentUserId,
  wsStatus,
  onReconnect,
}) => {
  // Sort participants by score descending
  const rankedParticipants = [...participants].sort((a, b) => b.score - a.score);

  const getWsBadge = () => {
    switch (wsStatus) {
      case 'connected':
        return (
          <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/50">
            <Zap className="w-3 h-3 fill-emerald-500 text-emerald-500 animate-pulse" />
            Live
          </span>
        );
      case 'connecting':
        return (
          <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200/50">
            <RefreshCw className="w-3 h-3 text-amber-500 animate-spin" />
            Connecting
          </span>
        );
      case 'disconnected':
        return (
          <button
            onClick={onReconnect}
            className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-rose-600 bg-rose-50 hover:bg-rose-100 active:bg-rose-200 px-2 py-0.5 rounded-full border border-rose-200 transition-all"
            title="Click to manually reconnect"
          >
            <ZapOff className="w-3 h-3 text-rose-500" />
            Disconnected
          </button>
        );
    }
  };

  return (
    <div className="w-full bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-premium space-y-4">
      {/* WS Status Badge & Title */}
      <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
          🏆 Standings
        </h3>
        {getWsBadge()}
      </div>

      <div className="px-4 pb-4 space-y-4">
        {/* Host Details */}
        <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-xl">
          <div className="flex items-center gap-2">
            <Crown className="w-4 h-4 text-amber-500 fill-amber-400" />
            <div className="text-left">
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Host</p>
              <p className="text-xs font-semibold text-slate-700">
                {hostUsername} {hostId === currentUserId && <span className="text-[10px] text-indigo-500 font-medium">(You)</span>}
              </p>
            </div>
          </div>
          <span className="text-[10px] bg-white border border-slate-200/60 px-2 py-0.5 rounded text-slate-500 font-semibold shadow-sm">
            Admin
          </span>
        </div>

        {/* Participant List */}
        <div className="space-y-2 max-h-[250px] overflow-y-auto">
          {rankedParticipants.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-xs text-slate-400 font-medium">Waiting for players to join...</p>
            </div>
          ) : (
            rankedParticipants.map((p, index) => {
              const isCurrentUser = p.user_id === currentUserId;
              const rank = index + 1;
              let rankIcon = null;

              if (!p.is_eliminated) {
                if (rank === 1) rankIcon = <Award className="w-4 h-4 text-amber-500 shrink-0" />;
                else if (rank === 2) rankIcon = <Award className="w-4 h-4 text-slate-400 shrink-0" />;
                else if (rank === 3) rankIcon = <Award className="w-4 h-4 text-amber-700 shrink-0" />;
              }

              return (
                <div
                  key={p.id}
                  className={`flex items-center justify-between p-2.5 rounded-xl border transition-all duration-300 ${
                    p.is_eliminated
                      ? 'bg-slate-50/50 border-slate-100 text-slate-400 opacity-60'
                      : isCurrentUser
                      ? 'bg-indigo-50/40 border-indigo-100 text-indigo-900 shadow-sm'
                      : 'bg-white border-slate-100 hover:border-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-slate-400 w-4 text-center">
                      {p.is_eliminated ? '💀' : `#${rank}`}
                    </span>
                    <div className="text-left">
                      <p className={`text-xs font-semibold flex items-center gap-1 ${p.is_eliminated ? 'line-through' : 'text-slate-700'}`}>
                        {p.username}
                        {isCurrentUser && (
                          <span className="text-[9px] bg-indigo-100 text-indigo-700 px-1 py-0.5 rounded-sm font-semibold">
                            YOU
                          </span>
                        )}
                      </p>
                      {p.is_eliminated && (
                        <p className="text-[9px] text-rose-500 font-bold uppercase tracking-wide">
                          Eliminated
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {rankIcon}
                    <span className={`text-xs font-bold ${p.is_eliminated ? 'text-slate-400' : 'text-slate-800'}`}>
                      {p.score} pts
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

import React, { useEffect, useRef } from 'react';
import type { RoomEvent } from '../types';
import { Sparkles, Play, ShieldAlert, Award, UserPlus, FileText, CheckCircle, XCircle } from 'lucide-react';

interface LiveFeedProps {
  events: RoomEvent[];
}

export const LiveFeed: React.FC<LiveFeedProps> = ({ events }) => {
  const feedEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to the bottom of the feed when new events arrive
  useEffect(() => {
    feedEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [events]);

  const renderEventMessage = (event: RoomEvent) => {
    let payload: any = {};
    try {
      payload = JSON.parse(event.payload_json);
    } catch {
      return <span className="text-slate-500 font-mono">Raw event: {event.event_type}</span>;
    }

    const timeString = new Date(event.created_at).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    const baseStyle = "flex items-start gap-2.5 text-xs py-2 px-3 rounded-xl border transition-all duration-300 ";

    switch (event.event_type) {
      case 'room_created':
        return (
          <div className={`${baseStyle} bg-slate-50 text-slate-700 border-slate-100`}>
            <Sparkles className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-semibold text-slate-800">{payload.host_username}</span>
              <span className="text-slate-500"> created Room </span>
              <span className="font-bold text-indigo-600 bg-indigo-50 px-1 py-0.5 rounded border border-indigo-100/50">{payload.room_code}</span>
              <div className="text-[10px] text-slate-400 font-medium">{timeString}</div>
            </div>
          </div>
        );
      case 'participant_joined':
        return (
          <div className={`${baseStyle} bg-slate-50 text-slate-700 border-slate-100`}>
            <UserPlus className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-semibold text-slate-800">{payload.username}</span>
              <span className="text-slate-500"> joined the battle</span>
              <div className="text-[10px] text-slate-400 font-medium">{timeString}</div>
            </div>
          </div>
        );
      case 'round_started':
        return (
          <div className={`${baseStyle} bg-indigo-50/55 text-indigo-800 border-indigo-100/50`}>
            <Play className="w-4 h-4 text-indigo-500 fill-indigo-500 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-bold">Round #{payload.round_number} Started</span>
              <p className="text-slate-600">Theme: <span className="font-semibold italic text-indigo-900">"{payload.prompt_theme}"</span></p>
              <div className="text-[10px] text-indigo-400/80 font-medium">{timeString}</div>
            </div>
          </div>
        );
      case 'submission_created':
        return (
          <div className={`${baseStyle} bg-slate-50 text-slate-700 border-slate-100`}>
            <FileText className="w-4 h-4 text-sky-500 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-semibold text-slate-800">{payload.participant_username}</span>
              <span className="text-slate-500"> submitted a prompt</span>
              <div className="text-[10px] text-slate-400 font-medium">{timeString}</div>
            </div>
          </div>
        );
      case 'job_running':
        return (
          <div className={`${baseStyle} bg-slate-50/50 text-slate-600 border-slate-100/50`}>
            <Sparkles className="w-4 h-4 text-indigo-400 animate-pulse shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="text-slate-500">AI generator started working...</span>
              <div className="text-[10px] text-slate-400 font-medium">{timeString}</div>
            </div>
          </div>
        );
      case 'job_completed':
        return (
          <div className={`${baseStyle} bg-emerald-50/40 text-emerald-800 border-emerald-100/30`}>
            <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-semibold">AI image generated successfully</span>
              <div className="text-[10px] text-emerald-400/80 font-medium">{timeString}</div>
            </div>
          </div>
        );
      case 'job_failed':
        return (
          <div className={`${baseStyle} bg-rose-50/45 text-rose-800 border-rose-100/40`}>
            <XCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-semibold">AI generation failed: </span>
              <span className="text-[11px] text-rose-600 block line-clamp-1">{payload.error || 'Timed out'}</span>
              <div className="text-[10px] text-rose-400/80 font-medium">{timeString}</div>
            </div>
          </div>
        );
      case 'score_updated':
        return (
          <div className={`${baseStyle} bg-amber-50/50 text-amber-800 border-amber-100/50`}>
            <Award className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold">Scores Awarded!</span>
              <ul className="space-y-0.5 text-[11px] list-disc list-inside text-slate-600">
                {payload.scores_awarded?.map((score: any, idx: number) => (
                  <li key={idx}>
                    <span className="font-semibold text-slate-800">{score.participant_username}</span>: +{score.points} pts (Rank {score.rank})
                  </li>
                ))}
              </ul>
              <div className="text-[10px] text-amber-400/80 font-medium">{timeString}</div>
            </div>
          </div>
        );
      case 'participant_eliminated':
        return (
          <div className={`${baseStyle} bg-rose-50 text-rose-800 border-rose-100`}>
            <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-bold text-slate-900">{payload.username}</span>
              <span className="text-rose-700"> was eliminated from the battle!</span>
              <div className="text-[10px] text-rose-400 font-medium">{timeString}</div>
            </div>
          </div>
        );
      default:
        return (
          <div className={`${baseStyle} bg-slate-50 text-slate-600 border-slate-100`}>
            <div className="space-y-0.5">
              <span className="font-semibold text-slate-700">{event.event_type}</span>
              <div className="text-[10px] text-slate-400 font-medium">{timeString}</div>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="w-full flex flex-col h-full bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-premium">
      <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
          ⚡ Battle Log
        </h3>
        <span className="text-[10px] bg-slate-200/80 px-2 py-0.5 rounded-full text-slate-600 font-semibold uppercase tracking-wider">
          Live
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-[350px] md:max-h-none">
        {events.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center space-y-2 h-full">
            <span className="text-2xl">⏳</span>
            <p className="text-xs text-slate-400 font-medium">Waiting for events to trigger...</p>
          </div>
        ) : (
          events.map((event) => (
            <div key={event.id} className="transition-all duration-300">
              {renderEventMessage(event)}
            </div>
          ))
        )}
        <div ref={feedEndRef} />
      </div>
    </div>
  );
};

import React from 'react';
import { Loader2, AlertCircle, RefreshCw, Clock } from 'lucide-react';
import type { JobStatus } from '../types';

export const ShimmerCard: React.FC = () => {
  return (
    <div className="w-full bg-white border border-slate-100 rounded-2xl p-4 shadow-sm space-y-3">
      <div className="w-1/3 h-4 bg-slate-200 rounded-md shimmer" />
      <div className="aspect-square w-full bg-slate-100 rounded-xl shimmer" />
      <div className="w-2/3 h-4 bg-slate-200 rounded-md shimmer" />
    </div>
  );
};

export const ShimmerGalleryGrid: React.FC<{ count?: number }> = ({ count = 3 }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <ShimmerCard key={i} />
      ))}
    </div>
  );
};

interface JobProgressCardProps {
  status: JobStatus;
  prompt: string;
  creatorName: string;
  error?: string;
  jobId?: string;
  onRetry?: () => void;
  showRetryButton?: boolean;
}

export const JobProgressCard: React.FC<JobProgressCardProps> = ({
  status,
  prompt,
  creatorName,
  error,
  onRetry,
  showRetryButton = false,
}) => {
  const getStatusConfig = () => {
    switch (status) {
      case 'queued':
        return {
          title: 'Queued',
          desc: 'Waiting in line for AI generation...',
          color: 'bg-amber-50 text-amber-700 border-amber-200',
          icon: <Clock className="w-5 h-5 text-amber-500 animate-pulse" />,
          progress: 15,
        };
      case 'running':
        return {
          title: 'Generating',
          desc: 'AI is painting your prompt details...',
          color: 'bg-indigo-50 text-indigo-700 border-indigo-200',
          icon: <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" />,
          progress: 50,
        };
      case 'failed':
        return {
          title: 'Generation Failed',
          desc: error || 'An error occurred during image generation.',
          color: 'bg-rose-50 text-rose-700 border-rose-200',
          icon: <AlertCircle className="w-5 h-5 text-rose-500" />,
          progress: 100,
        };
      case 'timed_out':
        return {
          title: 'Timed Out',
          desc: 'Generation exceeded the 15s watchdog limit.',
          color: 'bg-slate-100 text-slate-700 border-slate-300',
          icon: <AlertCircle className="w-5 h-5 text-slate-500" />,
          progress: 100,
        };
      default:
        return {
          title: 'Pending',
          desc: 'Initializing...',
          color: 'bg-slate-50 text-slate-600 border-slate-200',
          icon: <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />,
          progress: 5,
        };
    }
  };

  const config = getStatusConfig();

  return (
    <div className={`w-full border rounded-2xl p-5 shadow-premium glass-panel-heavy flex flex-col justify-between aspect-square transition-all duration-300 ${config.color}`}>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold tracking-wide uppercase px-2.5 py-1 rounded-full bg-white/80 shadow-sm border border-slate-100/50">
            🎨 {creatorName}
          </span>
          <div className="flex items-center gap-1.5 font-medium text-sm">
            {config.icon}
            {config.title}
          </div>
        </div>

        <div className="space-y-1.5">
          <p className="text-xs text-slate-500 font-medium">Prompt</p>
          <p className="text-sm font-medium text-slate-800 line-clamp-4 italic">
            "{prompt}"
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Progress Bar */}
        <div className="space-y-1.5">
          <div className="w-full bg-slate-200/50 rounded-full h-1.5 overflow-hidden">
            <div
              className={`h-full transition-all duration-1000 ease-out ${
                status === 'failed' || status === 'timed_out' ? 'bg-rose-500' : 'bg-indigo-600'
              }`}
              style={{ width: `${config.progress}%` }}
            />
          </div>
          <p className="text-[11px] text-slate-500 font-medium truncate">
            {config.desc}
          </p>
        </div>

        {/* Retry Actions for Failures */}
        {(status === 'failed' || status === 'timed_out') && showRetryButton && onRetry && (
          <button
            onClick={onRetry}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 active:bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl shadow-sm transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Retry Generation
          </button>
        )}
      </div>
    </div>
  );
};

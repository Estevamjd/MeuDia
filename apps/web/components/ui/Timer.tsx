'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { clsx } from 'clsx';
import { Button } from './Button';
import { Pause, Play, RotateCcw } from 'lucide-react';

interface TimerProps {
  initialSeconds: number;
  onComplete?: () => void;
  autoStart?: boolean;
  className?: string;
}

export function Timer({ initialSeconds, onComplete, autoStart = true, className }: TimerProps) {
  const [seconds, setSeconds] = useState(initialSeconds);
  const [isRunning, setIsRunning] = useState(autoStart);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!isRunning || seconds <= 0) {
      clearTimer();
      if (seconds <= 0) onCompleteRef.current?.();
      return;
    }

    intervalRef.current = setInterval(() => {
      setSeconds((s) => s - 1);
    }, 1000);

    return clearTimer;
  }, [isRunning, seconds, clearTimer]);

  // Pausar quando a aba perde foco, retomar quando volta
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        setIsRunning(false);
      } else if (seconds > 0) {
        setIsRunning(true);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [seconds]);

  const percentage = (seconds / initialSeconds) * 100;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const circumference = 2 * Math.PI * 40;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className={clsx('flex flex-col items-center gap-3', className)}>
      <div className="relative h-24 w-24">
        <svg className="-rotate-90" width="96" height="96" viewBox="0 0 96 96">
          <circle
            cx="48"
            cy="48"
            r="40"
            stroke="currentColor"
            strokeWidth="4"
            fill="none"
            className="text-card2"
          />
          <circle
            cx="48"
            cy="48"
            r="40"
            stroke="currentColor"
            strokeWidth="4"
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="text-orange transition-all duration-1000"
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center font-syne text-xl font-bold text-text">
          {mins}:{secs.toString().padStart(2, '0')}
        </span>
      </div>
      <div className="flex gap-2">
        <Button
          variant="icon"
          onClick={() => setIsRunning((r) => !r)}
          aria-label={isRunning ? 'Pausar' : 'Retomar'}
        >
          {isRunning ? <Pause size={18} /> : <Play size={18} />}
        </Button>
        <Button
          variant="icon"
          onClick={() => {
            setSeconds(initialSeconds);
            setIsRunning(false);
          }}
          aria-label="Resetar timer"
        >
          <RotateCcw size={18} />
        </Button>
      </div>
    </div>
  );
}

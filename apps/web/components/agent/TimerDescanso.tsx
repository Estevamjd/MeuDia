'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { X, Plus, SkipForward } from 'lucide-react';
import { obterDicaDescanso } from '@meudia/ai';

interface TimerDescansoProps {
  isOpen: boolean;
  tempoInicial: number; // segundos
  serieAtual: number;
  totalSeries: number;
  proximaSerie?: {
    carga: number | null;
    reps: string;
  };
  onComplete: () => void;
  onSkip: () => void;
  onClose: () => void;
}

export function TimerDescanso({
  isOpen,
  tempoInicial,
  serieAtual,
  totalSeries,
  proximaSerie,
  onComplete,
  onSkip,
  onClose,
}: TimerDescansoProps) {
  const [seconds, setSeconds] = useState(tempoInicial);
  const [isRunning, setIsRunning] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const dica = obterDicaDescanso(serieAtual, totalSeries);

  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // Resetar quando abrir
  useEffect(() => {
    if (isOpen) {
      setSeconds(tempoInicial);
      setIsRunning(true);
    }
  }, [isOpen, tempoInicial]);

  // Timer countdown
  useEffect(() => {
    if (!isRunning || seconds <= 0 || !isOpen) {
      clearTimer();
      if (seconds <= 0 && isOpen) {
        onCompleteRef.current();
      }
      return;
    }

    intervalRef.current = setInterval(() => {
      setSeconds((s) => s - 1);
    }, 1000);

    return clearTimer;
  }, [isRunning, seconds, isOpen, clearTimer]);

  // Pausar ao mudar de aba
  useEffect(() => {
    const handler = () => {
      if (document.hidden) setIsRunning(false);
      else setIsRunning(true);
    };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, []);

  // ESC para fechar
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const percentage = tempoInicial > 0 ? (seconds / tempoInicial) * 100 : 0;
  const circumference = 2 * Math.PI * 52;
  const offset = circumference - (percentage / 100) * circumference;

  // Cor baseada no tempo restante
  let timerColor = 'text-accent3'; // teal
  if (seconds <= 10) timerColor = 'text-red';
  else if (seconds <= 30) timerColor = 'text-yellow';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/85" />

      {/* Card central */}
      <div className="relative z-10 w-[300px] rounded-2xl border border-border bg-surface p-8 text-center animate-fadeSlide">
        {/* Fechar */}
        <button
          onClick={onClose}
          className="absolute right-3 top-3 rounded-lg p-1 text-muted transition-colors hover:text-text hover:bg-card2"
          aria-label="Fechar timer"
        >
          <X size={16} />
        </button>

        {/* Label */}
        <p className="text-xs text-muted mb-4">Descansando...</p>

        {/* SVG countdown circle */}
        <div className="relative mx-auto h-32 w-32 mb-4">
          <svg className="-rotate-90" width="128" height="128" viewBox="0 0 128 128">
            <circle
              cx="64"
              cy="64"
              r="52"
              stroke="currentColor"
              strokeWidth="5"
              fill="none"
              className="text-card2"
            />
            <circle
              cx="64"
              cy="64"
              r="52"
              stroke="currentColor"
              strokeWidth="5"
              fill="none"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              strokeLinecap="round"
              className={`${timerColor} transition-all duration-1000`}
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center font-syne text-4xl font-bold text-text">
            {mins}:{secs.toString().padStart(2, '0')}
          </span>
        </div>

        {/* Próxima série */}
        {proximaSerie && (
          <p className="text-sm text-accent mb-2">
            Próxima: {proximaSerie.carga ? `${proximaSerie.carga}kg` : ''} · {proximaSerie.reps} reps
          </p>
        )}

        {/* Dica */}
        <p className="text-xs text-muted italic mb-5 px-2">{dica}</p>

        {/* Botões */}
        <div className="flex gap-3 justify-center">
          <button
            onClick={onSkip}
            className="flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-sm text-muted transition-colors hover:bg-card2 hover:text-text"
          >
            <SkipForward size={14} />
            Pular
          </button>
          <button
            onClick={() => setSeconds((s) => s + 30)}
            className="flex items-center gap-1.5 rounded-lg border border-accent/30 bg-accent/10 px-4 py-2 text-sm text-accent transition-colors hover:bg-accent/20"
          >
            <Plus size={14} />
            30s
          </button>
        </div>
      </div>
    </div>
  );
}

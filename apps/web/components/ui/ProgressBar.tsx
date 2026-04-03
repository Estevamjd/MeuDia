'use client';

import { clsx } from 'clsx';

interface ProgressBarProps {
  value: number;
  max?: number;
  label?: string;
  showValue?: boolean;
  color?: 'accent' | 'green' | 'orange' | 'accent2' | 'accent3' | 'red';
  className?: string;
}

const colorStyles: Record<string, string> = {
  accent: 'bg-accent',
  green: 'bg-green',
  orange: 'bg-orange',
  accent2: 'bg-accent2',
  accent3: 'bg-accent3',
  red: 'bg-red',
};

export function ProgressBar({
  value,
  max = 100,
  label,
  showValue = false,
  color = 'accent',
  className,
}: ProgressBarProps) {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);

  return (
    <div className={clsx('flex flex-col gap-1', className)}>
      {(label || showValue) && (
        <div className="flex items-center justify-between">
          {label && <span className="text-xs text-muted">{label}</span>}
          {showValue && (
            <span className="text-xs font-medium text-text">
              {value}/{max}
            </span>
          )}
        </div>
      )}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-card2">
        <div
          className={clsx(
            'h-full rounded-full transition-all duration-700 ease-out',
            colorStyles[color],
          )}
          style={{ width: `${percentage}%` }}
          role="progressbar"
          aria-valuenow={value}
          aria-valuemin={0}
          aria-valuemax={max}
          aria-label={label}
        />
      </div>
    </div>
  );
}

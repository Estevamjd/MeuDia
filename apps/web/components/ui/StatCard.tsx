import { clsx } from 'clsx';
import { Badge } from './Badge';
import type { ReactNode } from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: ReactNode;
  tag?: {
    text: string;
    color: 'green' | 'red' | 'yellow' | 'purple' | 'teal' | 'orange';
  };
  className?: string;
}

export function StatCard({ label, value, icon, tag, className }: StatCardProps) {
  return (
    <div
      className={clsx(
        'animate-fadeSlide rounded-card border border-border bg-card p-5',
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted">{label}</span>
        {icon && <span className="text-muted">{icon}</span>}
      </div>
      <div className="mt-2 flex items-end gap-2">
        <span className="font-syne text-2xl font-bold text-text">{value}</span>
        {tag && <Badge color={tag.color}>{tag.text}</Badge>}
      </div>
    </div>
  );
}

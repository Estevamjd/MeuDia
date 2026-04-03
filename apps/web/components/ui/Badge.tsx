import { clsx } from 'clsx';
import type { ReactNode } from 'react';

type BadgeColor = 'green' | 'red' | 'yellow' | 'purple' | 'teal' | 'orange';

interface BadgeProps {
  children: ReactNode;
  color?: BadgeColor;
  className?: string;
}

const colorStyles: Record<BadgeColor, string> = {
  green: 'bg-green/[0.14] text-green',
  red: 'bg-red/[0.14] text-red',
  yellow: 'bg-yellow/[0.14] text-yellow',
  purple: 'bg-accent/[0.14] text-accent',
  teal: 'bg-accent3/[0.14] text-accent3',
  orange: 'bg-orange/[0.14] text-orange',
};

export function Badge({ children, color = 'purple', className }: BadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium',
        colorStyles[color],
        className,
      )}
    >
      {children}
    </span>
  );
}

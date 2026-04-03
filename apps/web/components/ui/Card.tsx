'use client';

import { clsx } from 'clsx';
import type { ReactNode } from 'react';

type CardVariant = 'default' | 'green' | 'orange';

interface CardProps {
  children: ReactNode;
  variant?: CardVariant;
  className?: string;
  hoverable?: boolean;
  onClick?: () => void;
}

const variantStyles: Record<CardVariant, string> = {
  default: 'border-border hover:border-accent/30',
  green: 'border-green/20 hover:border-green/40',
  orange: 'border-orange/20 hover:border-orange/40',
};

export function Card({
  children,
  variant = 'default',
  className,
  hoverable = false,
  onClick,
}: CardProps) {
  return (
    <div
      className={clsx(
        'animate-fadeSlide rounded-card border bg-card p-5',
        variantStyles[variant],
        hoverable && 'cursor-pointer transition-transform duration-200 hover:-translate-y-0.5',
        className,
      )}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
    >
      {children}
    </div>
  );
}

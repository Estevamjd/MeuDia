'use client';

import { clsx } from 'clsx';
import type { InputHTMLAttributes, ReactNode } from 'react';
import { forwardRef } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, icon, className, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-muted">
            {label}
          </label>
        )}
        <div className="relative">
          {icon && (
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">
              {icon}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            className={clsx(
              'w-full rounded-lg border border-border bg-card2 px-3 py-2.5 text-sm text-text',
              'placeholder:text-muted/60',
              'transition-colors duration-200',
              'focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/30',
              icon && 'pl-10',
              error && 'border-red focus:border-red focus:ring-red/30',
              className,
            )}
            {...props}
          />
        </div>
        {error && (
          <span className="text-xs text-red" role="alert">
            {error}
          </span>
        )}
      </div>
    );
  },
);

Input.displayName = 'Input';

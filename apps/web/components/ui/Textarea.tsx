'use client';

import { clsx } from 'clsx';
import type { TextareaHTMLAttributes } from 'react';
import { forwardRef } from 'react';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, className, id, ...props }, ref) => {
    const textareaId = id || label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={textareaId} className="text-sm font-medium text-muted">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          className={clsx(
            'w-full rounded-lg border border-border bg-card2 px-3 py-2.5 text-sm text-text',
            'placeholder:text-muted/60 resize-none',
            'transition-colors duration-200',
            'focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/30',
            error && 'border-red focus:border-red focus:ring-red/30',
            className,
          )}
          rows={3}
          {...props}
        />
        {error && (
          <span className="text-xs text-red" role="alert">
            {error}
          </span>
        )}
      </div>
    );
  },
);

Textarea.displayName = 'Textarea';

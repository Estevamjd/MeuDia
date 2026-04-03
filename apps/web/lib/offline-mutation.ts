'use client';

import { enqueue } from './offline-queue';

/**
 * Wraps a mutation function to support offline queueing.
 * When offline, enqueues the action and returns a placeholder.
 * When online, executes normally.
 */
export function withOfflineSupport<TArgs, TResult>(
  action: string,
  mutationFn: (args: TArgs) => Promise<TResult>,
  payloadMapper: (args: TArgs) => unknown,
): (args: TArgs) => Promise<TResult> {
  return async (args: TArgs) => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      enqueue(action, payloadMapper(args));
      // Return a fake result so the UI doesn't break
      return {} as TResult;
    }
    return mutationFn(args);
  };
}

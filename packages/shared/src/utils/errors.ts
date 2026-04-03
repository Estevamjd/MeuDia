export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public status?: number,
    public userMessage?: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

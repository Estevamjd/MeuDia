import { AppError, isAppError } from '../errors';

describe('AppError', () => {
  it('creates with message and code', () => {
    const error = new AppError('something failed', 'ERR_TEST');

    expect(error.message).toBe('something failed');
    expect(error.code).toBe('ERR_TEST');
  });

  it('accepts an optional status', () => {
    const error = new AppError('not found', 'ERR_NOT_FOUND', 404);

    expect(error.status).toBe(404);
  });

  it('has undefined status by default', () => {
    const error = new AppError('fail', 'ERR');

    expect(error.status).toBeUndefined();
  });

  it('is an instanceof Error', () => {
    const error = new AppError('fail', 'ERR');

    expect(error).toBeInstanceOf(Error);
  });

  it('has name set to AppError', () => {
    const error = new AppError('fail', 'ERR');

    expect(error.name).toBe('AppError');
  });

  it('accepts an optional userMessage', () => {
    const error = new AppError('internal detail', 'ERR', 500, 'Algo deu errado');

    expect(error.userMessage).toBe('Algo deu errado');
  });

  it('has undefined userMessage by default', () => {
    const error = new AppError('fail', 'ERR');

    expect(error.userMessage).toBeUndefined();
  });
});

describe('isAppError', () => {
  it('returns true for AppError instances', () => {
    const error = new AppError('fail', 'ERR');

    expect(isAppError(error)).toBe(true);
  });

  it('returns false for plain Error instances', () => {
    expect(isAppError(new Error('plain'))).toBe(false);
  });

  it('returns false for non-error values', () => {
    expect(isAppError('string')).toBe(false);
    expect(isAppError(null)).toBe(false);
    expect(isAppError(undefined)).toBe(false);
  });
});

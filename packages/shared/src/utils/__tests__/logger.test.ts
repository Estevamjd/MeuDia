import { logger } from '../logger';

describe('logger', () => {
  it('exports debug, info, warn, and error functions', () => {
    expect(typeof logger.debug).toBe('function');
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.error).toBe('function');
  });

  it('debug does not throw', () => {
    expect(() => logger.debug('test message')).not.toThrow();
  });

  it('info does not throw', () => {
    expect(() => logger.info('test message')).not.toThrow();
  });

  it('warn does not throw', () => {
    expect(() => logger.warn('test message')).not.toThrow();
  });

  it('error does not throw', () => {
    expect(() => logger.error('test message')).not.toThrow();
  });

  it('accepts additional arguments without throwing', () => {
    expect(() => logger.info('msg', { key: 'value' }, 42)).not.toThrow();
  });
});

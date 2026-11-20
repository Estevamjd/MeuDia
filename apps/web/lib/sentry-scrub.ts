import type { Breadcrumb, ErrorEvent, Event } from '@sentry/nextjs';

/** Remove credenciais de URL sem depender de origem absoluta. */
export function semQueryFragment(value: string): string {
  return value.split(/[?#]/, 1)[0]!;
}

function limparNome(value: string): string {
  return value.replace(/(?:https?:\/\/|file:\/\/|\/)[^\s)]+/g, semQueryFragment);
}

export function sanitizarErroParaSentry(error: unknown): Error {
  const sanitized = new Error('Falha no servidor');
  if (error instanceof Error && ['Error', 'TypeError', 'RangeError', 'ReferenceError', 'URIError', 'EvalError', 'AppError'].includes(error.name)) sanitized.name = error.name;
  if (error instanceof Error && error.stack) {
    const frames = error.stack.split('\n').flatMap((line) => {
      // V8: função opcional, async/new, rotas Next e file://; mantém linha/coluna.
      const match = line.match(/^\s+at (?:(.*?) \()?(.+?):(\d+):(\d+)\)?$/);
      if (!match) return [];
      const [, fn, path, row, col] = match;
      if (!path || /[\r\n]/.test(path)) return [];
      const location = `${semQueryFragment(path)}:${row}:${col}`;
      return [`    at ${fn ? `${fn} (${location})` : location}`];
    });
    sanitized.stack = `${sanitized.name}: ${sanitized.message}\n${frames.join('\n')}`;
  }
  return sanitized;
}

export function beforeBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb | null {
  if (['console', 'ui.click', 'ui.input'].includes(breadcrumb.category ?? '')) return null;
  if (['fetch', 'xhr', 'http', 'navigation'].includes(breadcrumb.category ?? '')) {
    if (breadcrumb.message) breadcrumb.message = limparNome(breadcrumb.message);
    if (breadcrumb.data) {
      for (const key of ['url', 'from', 'to']) {
        if (typeof breadcrumb.data[key] === 'string') breadcrumb.data[key] = semQueryFragment(breadcrumb.data[key]);
      }
    }
  }
  return breadcrumb;
}

export function scrubEvent<T extends Event>(event: T): T {
  delete event.user;
  delete event.extra;
  const message = 'Falha na aplicação';
  if (event.message !== undefined) event.message = message;
  if (event.logentry) event.logentry = { message };
  for (const exception of event.exception?.values ?? []) {
    exception.value = message;
    for (const frame of exception.stacktrace?.frames ?? []) {
      if (frame.filename) frame.filename = semQueryFragment(frame.filename);
      if (frame.abs_path) frame.abs_path = semQueryFragment(frame.abs_path);
    }
  }
  if (event.contexts) {
    const contexts: NonNullable<Event['contexts']> = {};
    // Campos técnicos conhecidos; nunca copie contextos ou propriedades arbitrárias.
    for (const key of ['os', 'browser', 'runtime'] as const) {
      const context = event.contexts[key];
      if (!context) continue;
      const technical: Record<string, string> = {};
      for (const field of ['name', 'version', 'build', 'kernel_version']) {
        const value = context[field];
        if (typeof value === 'string' && /^[a-zA-Z0-9 ._()+-]{1,80}$/.test(value)) technical[field] = value;
      }
      contexts[key] = technical;
    }
    const stack = event.contexts.react?.componentStack;
    if (typeof stack === 'string') {
      const error = new Error();
      error.stack = stack;
      contexts.react = { componentStack: sanitizarErroParaSentry(error).stack?.split('\n').slice(1).join('\n') };
    }
    event.contexts = contexts;
  }
  if (event.tags) {
    for (const [key, value] of Object.entries(event.tags)) {
      if (typeof value === 'string' && /(?:[a-z][a-z\d+.-]*:\/\/|[/?#])/i.test(value)) delete event.tags[key];
    }
  }
  // Também cobre breadcrumbs já anexados pelo SDK ao evento.
  if (event.breadcrumbs) event.breadcrumbs = event.breadcrumbs.flatMap((breadcrumb) => {
    const clean = beforeBreadcrumb(breadcrumb);
    return clean ? [clean] : [];
  });
  if (event.request) {
    delete event.request.query_string;
    delete event.request.data;
    delete event.request.cookies;
    // Allowlist vazia: headers customizados também podem carregar credenciais/PII.
    delete event.request.headers;
    if (event.request.url) event.request.url = semQueryFragment(event.request.url);
  }
  if (event.transaction) event.transaction = limparNome(event.transaction);
  for (const span of event.spans ?? []) {
    if (span.description) span.description = limparNome(span.description);
    if (span.data) {
      for (const key of Object.keys(span.data)) {
        if (typeof span.data[key] === 'string' && /url|uri|http\.target|http\.query/i.test(key)) {
          span.data[key] = /query/i.test(key) ? undefined : semQueryFragment(span.data[key]);
        }
      }
    }
  }
  return event;
}

export const sentryPrivacy = {
  sendDefaultPii: false,
  beforeBreadcrumb,
  beforeSend: (event: ErrorEvent) => scrubEvent(event),
  beforeSendTransaction: <T extends Event & { type: 'transaction' }>(event: T) => scrubEvent(event),
};

import { MessageCircle, PenLine } from 'lucide-react';
import type { Transacao } from '@meudia/shared';

/** `whatsapp` só quando o banco diz (coluna `origem`, 009); o resto (inclui legado sem a coluna) é lançamento manual. */
export function origemDe(t: Pick<Transacao, 'origem'>): 'whatsapp' | 'manual' {
  return t.origem === 'whatsapp' ? 'whatsapp' : 'manual';
}

/** Selo "WhatsApp" ou "Manual" de cada lançamento; não quebra nem corta (`.selo-origem`). */
export function OrigemSelo({ t }: { t: Pick<Transacao, 'origem'> }) {
  const origem = origemDe(t);
  return origem === 'whatsapp' ? (
    <span className="selo-origem selo-origem-whatsapp" data-origem="whatsapp">
      <MessageCircle size={10} aria-hidden="true" />
      WhatsApp
    </span>
  ) : (
    <span className="selo-origem selo-origem-manual" data-origem="manual">
      <PenLine size={10} aria-hidden="true" />
      Manual
    </span>
  );
}

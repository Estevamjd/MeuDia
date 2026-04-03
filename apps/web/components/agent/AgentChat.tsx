'use client';

import { useState, useRef, useEffect } from 'react';
import { clsx } from 'clsx';
import { Send, Bot, User, Loader2 } from 'lucide-react';
import type { MensagemChat, AcaoRapida } from '@meudia/shared';

interface AgentChatProps {
  mensagens: MensagemChat[];
  isLoading: boolean;
  isSending: boolean;
  onEnviar: (mensagem: string) => void;
  onAcao: (acao: string, payload?: Record<string, unknown>) => void;
  sugestoesIniciais?: AcaoRapida[];
}

export function AgentChat({
  mensagens,
  isLoading,
  isSending,
  onEnviar,
  onAcao,
  sugestoesIniciais,
}: AgentChatProps) {
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll ao receber novas mensagens
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [mensagens]);

  const handleEnviar = () => {
    const texto = input.trim();
    if (!texto || isSending) return;
    onEnviar(texto);
    setInput('');
    inputRef.current?.focus();
  };

  return (
    <div className="flex h-full flex-col">
      {/* Mensagens */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={20} className="animate-spin text-muted" />
          </div>
        ) : mensagens.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-accent to-accent2 mb-3">
              <Bot size={24} className="text-white" />
            </div>
            <p className="text-sm font-medium text-text">Agente MeuDia</p>
            <p className="mt-1 text-xs text-muted max-w-[240px]">
              Pergunte sobre treinos, hábitos, agenda ou finanças. Estou aqui para ajudar!
            </p>

            {/* Sugestões iniciais */}
            {sugestoesIniciais && sugestoesIniciais.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2 justify-center">
                {sugestoesIniciais.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      if (s.payload?.comando) {
                        onEnviar(s.payload.comando as string);
                      } else {
                        onAcao(s.acao, s.payload);
                      }
                    }}
                    className="rounded-lg border border-border bg-card2 px-3 py-1.5 text-[11px] text-muted transition-colors hover:border-accent/30 hover:text-accent"
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          mensagens.map((msg) => (
            <div
              key={msg.id}
              className={clsx(
                'flex gap-2',
                msg.role === 'user' ? 'flex-row-reverse' : 'flex-row',
              )}
            >
              {/* Avatar */}
              <div
                className={clsx(
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
                  msg.role === 'agent'
                    ? 'bg-gradient-to-br from-accent to-accent2'
                    : 'bg-card2',
                )}
              >
                {msg.role === 'agent' ? (
                  <Bot size={14} className="text-white" />
                ) : (
                  <User size={14} className="text-muted" />
                )}
              </div>

              {/* Balão */}
              <div
                className={clsx(
                  'max-w-[85%] rounded-xl px-3 py-2 text-sm',
                  msg.role === 'user'
                    ? 'bg-accent/20 text-text'
                    : 'bg-card2 text-text/90',
                )}
              >
                <p className="whitespace-pre-wrap leading-relaxed">{msg.conteudo}</p>

                {/* Ações rápidas da resposta */}
                {msg.role === 'agent' && msg.acoes && msg.acoes.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {msg.acoes.map((acao: AcaoRapida, i: number) => (
                      <button
                        key={i}
                        onClick={() => {
                          if (acao.payload?.comando) {
                            onEnviar(acao.payload.comando as string);
                          } else {
                            onAcao(acao.acao, acao.payload);
                          }
                        }}
                        className="rounded-md bg-accent/15 px-2 py-0.5 text-[11px] font-medium text-accent transition-colors hover:bg-accent/25"
                      >
                        {acao.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))
        )}

        {/* Indicador de digitando */}
        {isSending && (
          <div className="flex gap-2">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent to-accent2">
              <Bot size={14} className="text-white" />
            </div>
            <div className="rounded-xl bg-card2 px-3 py-2">
              <div className="flex gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-muted animate-bounce [animation-delay:0ms]" />
                <span className="h-1.5 w-1.5 rounded-full bg-muted animate-bounce [animation-delay:150ms]" />
                <span className="h-1.5 w-1.5 rounded-full bg-muted animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-border p-3">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleEnviar();
              }
            }}
            placeholder="Pergunte algo ao agente..."
            className="flex-1 rounded-lg border border-border bg-card2 px-3 py-2 text-sm text-text placeholder:text-muted/50 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/30"
            disabled={isSending}
          />
          <button
            onClick={handleEnviar}
            disabled={!input.trim() || isSending}
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-white transition-all hover:bg-accent/80 disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label="Enviar mensagem"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';
import type { ItemRefeicao } from '@meudia/shared';
import { Modal } from '../ui/Modal';
import { LinkAcao, classeBotaoCheio, classeTextoCaderno } from '../caderno';

export type ModoEditor = 'editar' | 'substituir' | 'registrar';

interface Linha {
  nome: string;
  gramas: string;
  kcal: string;
  proteina: string;
}

const paraTexto = (n: number | null | undefined) => (typeof n === 'number' ? String(n).replace('.', ',') : '');
const lerOpcional = (t: string): number | null | 'invalido' => {
  const s = t.trim().replace(',', '.');
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? n : 'invalido';
};
const linhaVazia = (): Linha => ({ nome: '', gramas: '', kcal: '', proteina: '' });

/** Linhas do formulário → itens. Campo vazio = null ("sem valor"), nunca 0. Nome vazio é ignorado. */
export function linhasParaItens(linhas: readonly Linha[]): ItemRefeicao[] | string {
  const itens: ItemRefeicao[] = [];
  for (const l of linhas) {
    const nome = l.nome.trim();
    if (!nome) continue;
    const gramas = lerOpcional(l.gramas);
    const kcal = lerOpcional(l.kcal);
    const proteina = lerOpcional(l.proteina);
    if (gramas === 'invalido' || kcal === 'invalido' || proteina === 'invalido') return `Confira os números de "${nome}".`;
    itens.push({ nome, quantidade: gramas, calorias: kcal === null ? null : Math.round(kcal), proteina, fonte: 'manual' });
  }
  return itens.length > 0 ? itens : 'Adicione pelo menos um item.';
}

const TITULOS: Record<ModoEditor, (nome: string) => string> = {
  editar: (n) => `Editar ${n.toLowerCase()}`,
  substituir: (n) => `Substituir ${n.toLowerCase()}`,
  registrar: (n) => `Registrar ${n.toLowerCase()}`,
};

/**
 * Itens de uma refeição: nome, gramas, kcal e proteína. Sem a tabela TACO no banco, todo valor é digitado
 * ("fora da TACO"); vazio fica "sem valor". Substituir começa sem itens; receitas favoritas ainda não existem.
 */
export function EditarRefeicao({
  aberto,
  modo,
  nome,
  itens,
  salvando,
  onFechar,
  onSalvar,
}: {
  aberto: boolean;
  modo: ModoEditor;
  nome: string;
  itens: readonly ItemRefeicao[];
  salvando: boolean;
  onFechar: () => void;
  onSalvar: (itens: ItemRefeicao[]) => void;
}) {
  const [linhas, setLinhas] = useState<Linha[]>(() =>
    modo === 'substituir' || itens.length === 0
      ? [linhaVazia()]
      : itens.map((i) => ({ nome: i.nome, gramas: paraTexto(i.quantidade), kcal: paraTexto(i.calorias), proteina: paraTexto(i.proteina) })),
  );
  const [erro, setErro] = useState<string | null>(null);

  const mudar = (i: number, campo: keyof Linha, valor: string) =>
    setLinhas((ls) => ls.map((l, j) => (j === i ? { ...l, [campo]: valor } : l)));

  const salvar = () => {
    const r = linhasParaItens(linhas);
    if (typeof r === 'string') {
      setErro(r);
      return;
    }
    setErro(null);
    onSalvar(r);
  };

  return (
    // O Modal genérico não rola: com vários itens o Salvar saía da tela no 390. Altura máxima + rolagem só aqui.
    <Modal isOpen={aberto} onClose={onFechar} title={TITULOS[modo](nome)} className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
      <form
        className={`flex flex-col gap-4 ${classeTextoCaderno}`}
        onSubmit={(e) => {
          e.preventDefault();
          salvar();
        }}
      >
        <p className="text-[13px] text-muted-text">
          {modo === 'substituir'
            ? 'Troque os itens desta refeição. Receitas favoritas ainda não existem no app.'
            : 'Deixe kcal ou proteína em branco se não souber: fica "sem valor", não 0.'}
          {modo === 'registrar' && ' Salvar marca a refeição como feita.'}
        </p>
        {linhas.map((l, i) => (
          <fieldset key={i} className="border-b border-white/[0.07] pb-3">
            <legend className="sr-only">Item {i + 1}</legend>
            <div className="flex items-center justify-between">
              <label className="block text-[10.5px] uppercase tracking-[1.6px] text-muted-text" htmlFor={`item-nome-${i}`}>
                Item {i + 1}
              </label>
              {linhas.length > 1 && (
                <LinkAcao onClick={() => setLinhas((ls) => ls.filter((_, j) => j !== i))} ariaLabel={`Tirar item ${i + 1}`}>
                  tirar
                </LinkAcao>
              )}
            </div>
            <input
              id={`item-nome-${i}`}
              value={l.nome}
              onChange={(e) => mudar(i, 'nome', e.target.value)}
              placeholder="Ex.: arroz"
              maxLength={120}
              className="h-11 w-full border-b border-white/25 bg-transparent text-[15px] text-text placeholder:text-muted-text focus:border-accent3 focus:outline-none"
            />
            <div className="mt-2 grid grid-cols-3 gap-3">
              {(
                [
                  ['gramas', 'Gramas', 'g'],
                  ['kcal', 'Kcal', 'kcal'],
                  ['proteina', 'Proteína', 'g'],
                ] as const
              ).map(([campo, rotulo, unidade]) => (
                <label key={campo} className="block text-[12px] text-muted-text">
                  {rotulo}
                  <span className="flex items-baseline gap-1">
                    <input
                      inputMode="decimal"
                      aria-label={`${rotulo} do item ${i + 1}`}
                      value={l[campo]}
                      onChange={(e) => mudar(i, campo, e.target.value)}
                      placeholder="—"
                      className="h-11 w-full border-b border-white/25 bg-transparent text-[15px] font-bold text-text tabular-nums placeholder:font-normal placeholder:text-muted-text focus:border-accent3 focus:outline-none"
                    />
                    <span className="text-[12px]">{unidade}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        ))}
        <div>
          <LinkAcao onClick={() => setLinhas((ls) => [...ls, linhaVazia()])}>+ item</LinkAcao>
        </div>
        {erro && (
          <p role="alert" className="border-l-2 border-red pl-3 text-[13px] text-text">
            {erro}
          </p>
        )}
        <button type="submit" disabled={salvando} className={classeBotaoCheio}>
          {salvando ? 'Salvando…' : 'Salvar'}
        </button>
      </form>
    </Modal>
  );
}

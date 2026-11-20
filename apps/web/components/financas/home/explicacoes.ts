import type { RitmoDiario } from '@meudia/shared';
import { formatBRL } from '../../../lib/financas-ui';
import { VALOR_OCULTO } from '../../../lib/carteiras-ui';

/**
 * Explicações do ⓘ (InfoDica) da Início. Cada texto descreve só o que o código calcula; o comentário aponta a fonte.
 * Mudou o cálculo, mude o texto aqui.
 */
export const EXPLICACOES = {
  /**
   * `ritmoDiarioDoMes` (packages/shared/src/utils/saldo.ts): max(0, sobraDoMes().valor) ÷ dias até o fim do mês contando
   * hoje, para baixo em centavos (dias × por dia ≤ sobra). A sobra usa a renda prevista (`rendaDoMes`). Sobra ≤ 0: R$ 0,00.
   */
  porDia: {
    rotulo: 'Pode gastar por dia',
    texto:
      'É o que deve sobrar no mês (contando a renda prevista) dividido pelos dias que faltam, contando hoje. Gastando até isso por dia, a sobra prevista não acaba antes do fim do mês; se não sobra nada, fica em zero.',
  },
  /**
   * `sobraDoMes().valor` (saldo.ts) = renda.total − totalContasFixas − gastosExtras. gastosExtras = despesas do mês sem
   * ajuste e sem as que são "Paguei" de conta (essas já estão em totalContasFixas). A % é `pctComprometida` (despesas ÷ renda).
   */
  deveSobrar: {
    rotulo: 'Deve sobrar',
    texto:
      'Renda do mês (recebida ou prevista) menos as contas fixas, pagas ou não, e os demais gastos lançados no mês (o Paguei já está nas contas). Ajustes de saldo, bancos e Cofrinho não entram; a % é quanto da renda já tem destino.',
  },
  /** `painel.cofrinho.saldo` (014, `saldoCofrinho` em packages/shared/src/utils/cofrinho.ts) via `montarDashboard().cofrinho`. */
  cofrinho: {
    rotulo: 'Cofrinho',
    texto: 'Dinheiro que você já guardou. Só muda com Guardar, Tirar, Corrigir ou guardando a sobra do mês; gastos não mexem aqui.',
  },
  /**
   * Banco sem a 014 (`painel.cofrinho` ausente, `montarDashboard().cofrinhoLegado`): o valor é `painel.saldoHoje` =
   * `saldoHoje` (saldo.ts), soma dos bancos ativos marcados "somar no total" (saldo inicial, receitas, despesas,
   * transferências e correções até hoje).
   */
  cofrinhoLegado: {
    rotulo: 'Cofrinho',
    texto: 'É o saldo de hoje dos seus bancos que entram no total, somados. Receitas, gastos e correções de saldo mudam esse valor.',
  },
  /** `rendaDoMes` (saldo.ts): receitas não-ajuste com data no mês + rendas fixas ativas sem "Recebi" na competência. */
  voceRecebe: {
    rotulo: 'Você recebe',
    texto:
      'Receitas lançadas neste mês (o Recebi vira uma delas) mais as rendas fixas que ainda não tiveram Recebi. Com o selo "previsão", parte desse valor ainda não caiu.',
  },
  /** `sobraDoMes().totalContasFixas` (saldo.ts): ocorrências do mês; paga = valor do "Paguei", a pagar = valor cadastrado. */
  contasFixas: {
    rotulo: 'Contas fixas',
    texto: 'Todas as contas fixas deste mês, pagas ou não. A paga conta pelo valor pago; a que falta pagar, pelo valor cadastrado.',
  },
  /** `sobraDoMes().gastosExtras` (saldo.ts): `gastoDoMes` das despesas do mês sem ajuste e sem as que são "Paguei" de conta. */
  gastosDoMes: {
    rotulo: 'Gastos do mês',
    texto:
      'Despesas lançadas neste mês que não são pagamento de conta fixa (o Paguei já está em Contas fixas). Cada parcela do cartão conta no mês dela; ajustes de saldo não entram.',
  },
  /** Mesma `sobraDoMes().valor` do cartão Resumo, mostrada como resultado da conta do cartão Ritmo. */
  contaDeveSobrar: {
    rotulo: 'Deve sobrar',
    texto: 'Você recebe − Contas fixas − Gastos do mês. É esse valor que o "Pode gastar por dia" divide pelos dias que faltam.',
  },
  /**
   * `progressoMeta` (packages/shared/src/utils/metas.ts): guardado ÷ alvo em % inteiro para baixo (99 no máximo até
   * alcançar; 100 só alcançada). A marca (`pctEsperado`, linha reta da criação ao prazo) só com prazo depois da criação
   * e meta não alcançada (`CartaoMeta`).
   */
  meta: {
    rotulo: 'Meta',
    texto:
      'Quanto você já guardou desta meta, em % inteiro arredondado para baixo (100% só quando alcança). Com prazo e meta ainda não alcançada, a marca na barra mostra onde você estaria hoje guardando por igual até o prazo.',
  },
  /**
   * `sugestaoMeta` (metas.ts) no `CartaoMeta`: alcançada ou sobra ≤ 0 = "—". Prazo em mês futuro (`mesesAtePrazo` > 0):
   * porMes = falta ÷ meses do próximo até o do prazo, para cima em centavos ("acima da sobra" quando passa da sobra).
   * Sem prazo, prazo neste mês ou vencido: metade da sobra (para baixo em centavos) ou a sobra inteira se a metade der 0.
   */
  metaPorMes: {
    rotulo: 'Por mês',
    texto:
      'Sem sobra no mês ou com a meta alcançada, fica "—". Senão, com prazo depois deste mês é o que falta dividido pelos meses do próximo até o do prazo (para cima); sem isso, metade da sobra (ou ela toda, se a metade der zero).',
  },
  /** `montarHome().contasAVencer` (home/montarHome.ts): ocorrências do mês sem "Paguei", vencidas primeiro e depois por vencimento, até 2. */
  contasAVencer: {
    rotulo: 'Contas a vencer',
    texto: 'Contas fixas deste mês que ainda não têm Paguei, as vencidas primeiro e depois por data. Aqui aparecem até 2; "Ver todas" mostra o resto.',
  },
  /** `painel.rendasAReceber` (montarDashboard.ts) = rendas do mês sem "Recebi"; elas entram em `rendaDoMes().aReceber`. */
  aReceber: {
    rotulo: 'A receber',
    texto: 'Renda fixa deste mês que ainda não teve Recebi. Até você tocar em Recebi, ela entra como previsão no "Você recebe".',
  },
  /** `montarResumoMes().categorias` (resumo/montarResumoMes.ts): `gastosPorCategoria` das despesas do mês sem ajuste; % sobre todas as despesas. */
  paraOndeFoi: {
    rotulo: 'Para onde foi',
    texto:
      'Despesas lançadas neste mês por categoria (as 5 maiores; o resto vai em Outros), sem ajustes de saldo. A % é sobre todas as despesas do mês, contando os Paguei das contas.',
  },
} as const satisfies Record<string, { rotulo: string; texto: string }>;

export interface ContaDoRitmo {
  texto: string;
  /** `cartao-ritmo-conta` (a divisão) ou `cartao-ritmo-nota` (sem folga: a nota de sempre do cartão). */
  testid: 'cartao-ritmo-conta' | 'cartao-ritmo-nota';
}

/**
 * Linha sob o "Pode gastar por dia": a conta de verdade, com as mesmas entradas de `ritmoDiarioDoMes` (o Deve sobrar e
 * os dias até o fim do mês contando hoje). Valor da sobra em `formatBRL` (centavos, como o cartão); sem divisão por zero.
 */
export function contaDoRitmo(ritmo: RitmoDiario, sobraValor: number, escondido: boolean): ContaDoRitmo {
  if (ritmo.estado === 'encerrado' || ritmo.diasRestantes <= 0) return { texto: 'Mês encerrado: não há dias para dividir', testid: 'cartao-ritmo-conta' };
  if (ritmo.estado === 'sem_folga') {
    // Mesma nota de antes (Wave 3A): sem folga não há o que dividir.
    const texto = ritmo.excedente > 0 ? (escondido ? 'Passou do que entra' : `Passou ${formatBRL(ritmo.excedente)} do que entra`) : 'Sem folga este mês';
    return { texto, testid: 'cartao-ritmo-nota' };
  }
  const sobra = escondido ? VALOR_OCULTO : formatBRL(sobraValor);
  if (ritmo.diasRestantes === 1) return { texto: `${sobra} que sobram, só para hoje`, testid: 'cartao-ritmo-conta' };
  return { texto: `${sobra} que sobram ÷ ${ritmo.diasRestantes} dias`, testid: 'cartao-ritmo-conta' };
}

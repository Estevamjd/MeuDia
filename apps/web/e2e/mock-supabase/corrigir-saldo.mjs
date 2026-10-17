import crypto from 'node:crypto';

// Síncrono: o mock serializa leitura e ajuste sem intercalar requisições.
export function corrigirSaldo({ uid, args, rowsOf, carteiraAtivaDe, PgError, hojeSP, defaults }) {
    const { p_carteira_id: id, p_valor_real: real, p_chave: chave } = args;
    if (!chave || typeof real !== 'number' || !Number.isFinite(real) || Math.abs(real) > 9999999999.99 || Math.abs(real * 100 - Math.round(real * 100)) > 0.0001) throw new PgError(400, '22023', 'Valor/chave inválidos');
    const carteira = carteiraAtivaDe(uid, id);
    const anterior = rowsOf('transacoes').find((t) => t.user_id === uid && t.chave_ajuste === chave);
    if (anterior) {
      if (anterior.carteira_id !== id) throw new PgError(400, '22023', 'Chave já usada em outra carteira');
      return [anterior];
    }
    const diaAncora = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo' }).format(new Date(carteira.saldo_inicial_em));
    const posterior = (t) => t.user_id === uid && t.data <= hojeSP() && (t.data > diaAncora || (t.data === diaAncora && t.created_at > carteira.saldo_inicial_em));
    const saldo = Number(carteira.saldo_inicial)
      + rowsOf('transacoes').filter((t) => t.carteira_id === id && posterior(t)).reduce((v, t) => v + (t.tipo === 'receita' ? 1 : -1) * Number(t.valor), 0)
      + rowsOf('transferencias').filter((t) => (t.origem_id === id || t.destino_id === id) && posterior(t)).reduce((v, t) => v + (t.destino_id === id ? 1 : -1) * Number(t.valor), 0);
    const diferenca = Math.round((real - saldo) * 100) / 100;
    if (!diferenca) return [];
    const ajuste = { id: crypto.randomUUID(), ...defaults(), user_id: uid, carteira_id: id, banco: carteira.nome, tipo: diferenca > 0 ? 'receita' : 'despesa', categoria: 'Ajuste de saldo', descricao: 'Correção de saldo', valor: Math.abs(diferenca), data: hojeSP(), ajuste: true, chave_ajuste: chave };
    rowsOf('transacoes').push(ajuste);
    return [ajuste];
}

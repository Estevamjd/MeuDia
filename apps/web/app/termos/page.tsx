import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Termos de Uso — MeuDia',
  description: 'Termos de uso do MeuDia',
};

export default function TermosPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-16 text-text">
      <Link href="/inicio" className="mb-8 inline-block text-sm text-accent hover:underline">
        &larr; Voltar ao app
      </Link>

      <h1 className="mb-6 font-syne text-3xl font-bold">Termos de Uso</h1>
      <p className="mb-4 text-sm text-muted">Ultima atualizacao: Março 2026</p>

      <section className="space-y-4 text-sm leading-relaxed text-muted">
        <h2 className="text-lg font-semibold text-text">1. Aceitacao</h2>
        <p>
          Ao utilizar o MeuDia, voce concorda com estes termos. Se nao concordar,
          por favor nao utilize o aplicativo.
        </p>

        <h2 className="text-lg font-semibold text-text">2. Descricao do servico</h2>
        <p>
          O MeuDia e um assistente pessoal de produtividade que ajuda a gerenciar
          treinos, habitos, agenda, financas e notas. O servico e fornecido como esta,
          sem garantias de disponibilidade ininterrupta.
        </p>

        <h2 className="text-lg font-semibold text-text">3. Conta do usuario</h2>
        <p>
          Voce e responsavel por manter a seguranca da sua conta. Nao compartilhe
          suas credenciais de acesso com terceiros.
        </p>

        <h2 className="text-lg font-semibold text-text">4. Uso aceitavel</h2>
        <p>
          O MeuDia deve ser usado apenas para fins pessoais e legais. E proibido
          tentar acessar dados de outros usuarios ou comprometer a seguranca do sistema.
        </p>

        <h2 className="text-lg font-semibold text-text">5. Propriedade intelectual</h2>
        <p>
          Todo o conteudo, design e codigo do MeuDia sao protegidos por direitos autorais.
          Os dados que voce insere no app permanecem de sua propriedade.
        </p>

        <h2 className="text-lg font-semibold text-text">6. Encerramento</h2>
        <p>
          Voce pode encerrar sua conta a qualquer momento. Nos reservamos o direito
          de suspender contas que violem estes termos.
        </p>

        <h2 className="text-lg font-semibold text-text">7. Alteracoes</h2>
        <p>
          Podemos atualizar estes termos periodicamente. Alteracoes significativas
          serao comunicadas pelo app.
        </p>
      </section>
    </div>
  );
}

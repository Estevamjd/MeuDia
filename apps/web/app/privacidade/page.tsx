import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacidade — MeuDia',
  description: 'Politica de privacidade do MeuDia',
};

export default function PrivacidadePage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-16 text-text">
      <Link href="/inicio" className="mb-8 inline-block text-sm text-accent hover:underline">
        &larr; Voltar ao app
      </Link>

      <h1 className="mb-6 font-syne text-3xl font-bold">Politica de Privacidade</h1>
      <p className="mb-4 text-sm text-muted">Ultima atualizacao: Março 2026</p>

      <section className="space-y-4 text-sm leading-relaxed text-muted">
        <h2 className="text-lg font-semibold text-text">1. Dados coletados</h2>
        <p>
          O MeuDia coleta apenas as informacoes necessarias para o funcionamento do app:
          e-mail para autenticacao, dados de treinos, habitos, compromissos, notas e
          transacoes financeiras que voce registra voluntariamente.
        </p>

        <h2 className="text-lg font-semibold text-text">2. Armazenamento</h2>
        <p>
          Seus dados sao armazenados de forma segura no Supabase com criptografia em
          transito (TLS) e Row Level Security (RLS), garantindo que apenas voce tenha
          acesso aos seus dados.
        </p>

        <h2 className="text-lg font-semibold text-text">3. Compartilhamento</h2>
        <p>
          Nao vendemos, alugamos ou compartilhamos seus dados pessoais com terceiros.
          Seus dados sao usados exclusivamente para fornecer os servicos do MeuDia.
        </p>

        <h2 className="text-lg font-semibold text-text">4. Cookies</h2>
        <p>
          Utilizamos apenas cookies essenciais para autenticacao e funcionamento do app.
          Nao usamos cookies de rastreamento ou publicidade.
        </p>

        <h2 className="text-lg font-semibold text-text">5. Exclusao de dados</h2>
        <p>
          Voce pode solicitar a exclusao completa da sua conta e todos os dados associados
          a qualquer momento atraves das configuracoes do app.
        </p>

        <h2 className="text-lg font-semibold text-text">6. Contato</h2>
        <p>
          Para duvidas sobre privacidade, entre em contato pelo e-mail disponivel
          na pagina do app.
        </p>
      </section>
    </div>
  );
}

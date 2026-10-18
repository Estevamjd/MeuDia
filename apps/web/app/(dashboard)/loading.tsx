import { Skeleton, SkeletonCard, SkeletonList } from '../../components/ui/Skeleton';

/**
 * Esqueleto da troca de aba. Também é o limite que o `<Link>` pré-carrega em produção: com ele o toque na
 * BottomNav troca a tela na hora, sem esperar a ida ao servidor (middleware + RSC) da rota nova.
 */
export default function CarregandoDashboard() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Carregando">
      <Skeleton className="h-9 w-40" />
      <SkeletonCard />
      <SkeletonList count={3} />
    </div>
  );
}

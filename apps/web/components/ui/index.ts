export { Badge } from './Badge';
export { Button } from './Button';
export { Input } from './Input';
export { Select } from './Select';
export { ProgressBar } from './ProgressBar';
export { StatCard } from './StatCard';
export { WeekProgress } from './WeekProgress';
export { Timer } from './Timer';
export { AIBanner } from './AIBanner';
// DonutChart/LineChart/BarChart (recharts) ficam fora do barrel: quem usar importa o arquivo por next/dynamic
// (lib/__tests__/recharts-dinamico.test.ts), para o recharts não entrar no JS inicial de quem só quer um Button.
export { Modal } from './Modal';
export { ConfirmDialog } from './ConfirmDialog';
export { ToastProvider, useToast } from './Toast';
export { Skeleton, SkeletonCard, SkeletonList } from './Skeleton';
export { EmptyState } from './EmptyState';
export { ErrorBoundary } from './ErrorBoundary';
export { OfflineIndicator } from './OfflineIndicator';
export { NumeroAnimado } from './NumeroAnimado';

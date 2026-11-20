import { RuntimeAppConfig } from '../../components/RuntimeAppConfig';
import { DashboardShell } from './DashboardShell';

// Server: APP_MODE por request (RuntimeAppConfig) em volta do shell cliente.
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <RuntimeAppConfig>
      <DashboardShell>{children}</DashboardShell>
    </RuntimeAppConfig>
  );
}

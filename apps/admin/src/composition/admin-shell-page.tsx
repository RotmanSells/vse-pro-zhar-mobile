import { getAdminShellModel } from '../application/admin-shell-model';
import { AdminShell } from '../presentation/admin-shell';

export function AdminShellPage() {
  return <AdminShell model={getAdminShellModel()} />;
}

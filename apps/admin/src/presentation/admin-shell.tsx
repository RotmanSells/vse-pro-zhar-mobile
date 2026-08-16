import type { AdminShellModel } from '../application/admin-shell-model';

export function AdminShell({ model }: { readonly model: AdminShellModel }) {
  return (
    <main>
      <h1>{model.heading}</h1>
      <p>{model.message}</p>
    </main>
  );
}

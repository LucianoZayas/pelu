import { requireRole } from '@/lib/auth/require';
import { ImportarClient } from './importar-client';

export default async function ImportarPage() {
  await requireRole('admin');
  return <ImportarClient />;
}

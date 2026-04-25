import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { listarObras } from '@/features/obras/queries';
import { ObrasTable } from '@/features/obras/components/obras-table';
import { requireSession } from '@/lib/auth/require';

export default async function ObrasPage() {
  const user = await requireSession();
  const obras = await listarObras();
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Obras</h1>
        {user.rol === 'admin' && (
          <Link href="/obras/nueva" className={buttonVariants()}>Nueva obra</Link>
        )}
      </div>
      <ObrasTable obras={obras} />
    </div>
  );
}

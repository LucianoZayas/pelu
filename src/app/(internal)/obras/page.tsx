import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { Upload } from 'lucide-react';
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
        <div className="flex gap-2">
          <a href="/api/export/obras" className={buttonVariants({ variant: 'outline' })}>Exportar XLSX</a>
          {user.rol === 'admin' && (
            <>
              <Link href="/obras/nueva" className={buttonVariants()}>Nueva obra</Link>
              <Link href="/obras/importar" className={buttonVariants({ variant: 'outline' })}>
                <Upload className="mr-2 h-4 w-4" />
                Nueva obra desde Excel
              </Link>
            </>
          )}
        </div>
      </div>
      <ObrasTable obras={obras} />
    </div>
  );
}

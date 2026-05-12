import { LoginForm } from './login-form';
import { iniciarSesionGoogle } from './actions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <div className="min-h-screen grid place-items-center bg-slate-50">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Macna · Ingresar</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <LoginForm next={next} />
          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
            <div className="relative flex justify-center text-xs uppercase"><span className="bg-card px-2 text-muted-foreground">o</span></div>
          </div>
          <form action={iniciarSesionGoogle}><Button variant="outline" className="w-full">Continuar con Google</Button></form>
        </CardContent>
      </Card>
    </div>
  );
}

export type Rol = 'admin' | 'operador';

export interface SessionUser {
  id: string;
  email: string;
  nombre: string;
  rol: Rol;
}

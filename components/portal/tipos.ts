export type Rol = 'admin' | 'titular' | 'miembro';

export interface Organizacion {
  id: string;
  nombre: string;
  razon_social: string | null;
  pais: string;
  activa: boolean;
  notas: string | null;
  creado_en: string;
  prefijo_crm?: string | null;
  seguimiento_cobranza?: boolean;
  zapsign_modelo?: string | null;
  zapsign_conectado?: boolean;
}

export interface Perfil {
  id: string;
  email: string;
  nombre: string | null;
  rol: Rol;
  organizacion_id: string | null;
  areas: string[];
  activo: boolean;
  creado_en: string;
  ultimo_ingreso: string | null;
}

export interface Area {
  clave: string;
  nombre: string;
  orden: number;
}

export interface EntradaRegistro {
  id: number;
  usuario_id: string | null;
  actor_id: string | null;
  accion: string;
  detalle: Record<string, unknown>;
  creado_en: string;
}

export interface Agenda {
  id: string;
  organizacion_id: string | null;
  titulo: string;
  descripcion: string | null;
  duracion_min: number | null;
  url: string;
  orden: number;
  activa: boolean;
}

export type SeccionDocumento = 'servicio' | 'equipo' | 'otros';

export interface Documento {
  id: string;
  seccion: SeccionDocumento;
  organizacion_id: string | null;
  titulo: string;
  descripcion: string | null;
  version: string | null;
  areas: string[];
  archivo_ruta: string | null;
  archivo_nombre: string | null;
  archivo_bytes: number | null;
  url: string | null;
  orden: number;
  activo: boolean;
  creado_en: string;
  actualizado_en: string;
}

export const ROTULO_ROL: Record<Rol, string> = {
  admin: 'Admin FIRMA',
  titular: 'Titular del cliente',
  miembro: 'Miembro del equipo',
};

export const PAISES: Record<string, string> = {
  AR: 'Argentina',
  ES: 'España',
  US: 'Estados Unidos',
  UY: 'Uruguay',
  MX: 'México',
  OTRO: 'Otro',
};

export function fechaCorta(iso: string | null): string {
  if (!iso) return 'Nunca';
  return new Date(iso).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });
}

/** miembro es el rol anterior a csm. Se conserva para cuentas viejas y ya no se asigna. */
export type Rol = 'admin' | 'titular' | 'csm' | 'closer' | 'setter' | 'miembro';
export type RolCliente = Exclude<Rol, 'admin'>;

/** Roles que se asignan hoy a la gente de un cliente, en el orden del panel. */
export const ROLES_CLIENTE: RolCliente[] = ['titular', 'csm', 'closer', 'setter'];

export interface Permisos {
  crm: boolean;
  casos: boolean;
  /** Contratos y documentos legales. Sin esto, solo protocolos y formación. */
  documentosLegales: boolean;
  agenda: boolean;
  /** Administración de la empresa: pagos, equipo y servicios */
  gestion: boolean;
}

/** Lo que ve cada rol. La base de datos aplica las mismas reglas (migración 0012). */
export function permisosDe(rol: Rol): Permisos {
  switch (rol) {
    case 'admin':
    case 'titular':
      return { crm: true, casos: true, documentosLegales: true, agenda: true, gestion: true };
    case 'csm':
    case 'miembro':
      return { crm: true, casos: true, documentosLegales: true, agenda: true, gestion: false };
    case 'closer':
      return { crm: true, casos: false, documentosLegales: false, agenda: true, gestion: false };
    case 'setter':
      return { crm: false, casos: false, documentosLegales: false, agenda: false, gestion: false };
  }
}

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
  logo_url?: string | null;
  drive_carpeta_revision?: string | null;
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
  /** Cargo que se muestra en lugar del rol, por ejemplo CEO & Founder. No cambia los permisos. */
  cargo?: string | null;
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
  es_protocolo?: boolean;
  orden: number;
  activo: boolean;
  creado_en: string;
  actualizado_en: string;
}

export const ROTULO_ROL: Record<Rol, string> = {
  admin: 'Admin FIRMA',
  titular: 'Titular',
  csm: 'CSM',
  closer: 'Closer',
  setter: 'Setter',
  miembro: 'Miembro del equipo',
};

/** Lo que se lee debajo del nombre: el cargo si tiene uno, si no el rol. */
export const cargoDe = (perfil: Pick<Perfil, 'rol' | 'cargo'>): string => perfil.cargo?.trim() || ROTULO_ROL[perfil.rol];

export const AYUDA_ROL: Record<RolCliente, string> = {
  titular: 'Todo lo de su empresa, incluidos el equipo, los pagos y los servicios.',
  csm: 'Todo menos la administración de la empresa (equipo, pagos y servicios).',
  closer: 'CRM y agenda, sin casos de conflicto. De documentos, solo protocolos y formación.',
  setter: 'Solo protocolos y formación.',
  miembro: 'Rol anterior, equivale a CSM.',
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

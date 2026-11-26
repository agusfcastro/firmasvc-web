import React, { useEffect, useRef, useState } from 'react';
import {
  BookOpen,
  BriefcaseBusiness,
  CalendarDays,
  ChevronRight,
  ChevronsUpDown,
  Eye,
  FileSignature,
  FileText,
  House,
  Kanban,
  LogOut,
  Menu,
  Layers,
  Phone,
  ReceiptText,
  ScrollText,
  Search,
  ShieldAlert,
  ShieldCheck,
  Trophy,
  Users,
  Wallet,
  WifiOff,
  X,
  Building2,
  ChevronsLeft,
  ClipboardList,
  ListChecks,
  Mail,
  PanelLeftOpen,
  Plus,
  Sparkles,
  Target,
  type LucideIcon,
} from 'lucide-react';
import { Button as BotonHero, Dropdown, Label as RotuloHero } from '@heroui/react';
import { DensidadBotones } from '../Button';
import { supabase } from './supabase';
import { navegar, marcarSalida } from './navegacion';
import { salirVistaPrevia, useVistaPrevia } from './vistaPrevia';
import { useLogoOrg } from './logos';
import { ROTULO_ROL, cargoDe, permisosDe, veAsuntos, type Perfil, type Permisos } from './tipos';
import { ROTULO_PLAN, type Plan } from './planes';
import { BurbujaTina } from './tina/BurbujaTina';
import { TINA_ACTIVA } from './tina/activa';
import { CampanaAvisos, PanelAvisos, vaciarAvisos } from './avisos/CentroAvisos';
import { Buscador, abrirBuscador, atajoBuscador, type AccesoSeccion } from './Buscador';
import { desactivarPush } from './push';
import { LimiteError } from './LimiteError';
import { simboloMoneda } from '../../api/_lib/variables';
import { PESTANAS_ADMIN } from './admin/pestanas';

import simboloClaro from '../../assets/brand/simbolo-claro.png';
import palabraOscura from '../../assets/brand/wordmark-oscuro.png';

/* ------------------------------------------------------------------ */
/* Enlace interno sin recargar la página                              */
/* ------------------------------------------------------------------ */
export const Enlace: React.FC<React.AnchorHTMLAttributes<HTMLAnchorElement> & { a: string }> = ({ a, onClick, children, ...resto }) => (
  <a
    href={a}
    onClick={(e) => {
      onClick?.(e);
      if (e.defaultPrevented || e.metaKey || e.ctrlKey) return;
      e.preventDefault();
      navegar(a);
    }}
    {...resto}
  >
    {children}
  </a>
);

async function salir() {
  marcarSalida();
  // Este dispositivo deja de recibir avisos de esta cuenta, por si lo usa otra persona.
  await desactivarPush().catch(() => undefined);
  // Solo esta sesión: sin scope, Supabase cierra la cuenta en todos los dispositivos.
  await supabase?.auth.signOut({ scope: 'local' });
  vaciarAvisos();
  navegar('/portal/ingresar');
}

/* ------------------------------------------------------------------ */
/* Secciones del portal según el rol                                   */
/* ------------------------------------------------------------------ */
type ClaveSeccion = 'inicio' | 'asuntos' | 'firmas' | 'documentos' | 'protocolos' | 'crm' | 'equipo' | 'agenda' | 'pagos' | 'admin';

interface Seccion {
  clave: ClaveSeccion;
  a: string;
  titulo: string;
  /** Rótulo corto para la barra inferior del celular. */
  corto: string;
  icono: LucideIcon;
  /** principal va arriba y sin título; negocio, abajo en Tu negocio. */
  grupo: 'principal' | 'negocio' | 'firma';
  activo: boolean;
}

function seccionesDe(perfil: Perfil, permisos: Permisos, ruta: string): Seccion[] {
  const s = (clave: ClaveSeccion, a: string, titulo: string, corto: string, icono: LucideIcon, grupo: Seccion['grupo'], activo: boolean): Seccion => ({ clave, a, titulo, corto, icono, grupo, activo });
  // Arriba lo de todos los días. Abajo, en Tu negocio, lo legal y la administración.
  return [
    s('inicio', '/portal', 'Inicio', 'Inicio', House, 'principal', ruta === '/portal'),
    // Invoices y recibos se abren desde Clientes; la bitácora, desde el pie de la barra lateral.
    ...(permisos.crm ? [s('crm', '/portal/crm', 'Clientes', 'Clientes', Kanban, 'principal', ruta.startsWith('/portal/crm'))] : []),
    // Objetivos, victorias y reportes (0076): lo usa toda la gente de la empresa, también setters.
    s('equipo', '/portal/equipo', 'Equipo', 'Equipo', Trophy, 'principal', ruta === '/portal/equipo' || ruta.startsWith('/portal/equipo/')),
    ...(permisos.agenda ? [s('agenda', '/portal/agenda', 'Agenda', 'Agenda', CalendarDays, 'principal', ruta === '/portal/agenda')] : []),
    // Pagos solo para titulares y FIRMA. El resto del equipo no ve nada de pagos.
    ...(permisos.gestion ? [s('pagos', '/portal/pagos', 'Pagos', 'Pagos', Wallet, 'negocio', ruta === '/portal/pagos')] : []),
    s('protocolos', '/portal/protocolos', 'Protocolos', 'Protocolos', BookOpen, 'negocio', ruta === '/portal/protocolos'),
    ...(permisos.documentosLegales
      ? [s('documentos', '/portal/documentos', 'Documentos', 'Documentos', FileText, 'negocio', ruta.startsWith('/portal/documentos') || ruta.startsWith('/portal/pedidos'))]
      : []),
    ...(permisos.documentosLegales ? [s('firmas', '/portal/firmas', 'Firmas', 'Firmas', FileSignature, 'negocio', ruta.startsWith('/portal/firmas'))] : []),
    // Asuntos son los temas de FIRMA con el dueño del negocio, no con sus clientes.
    ...(veAsuntos(perfil) ? [s('asuntos', '/portal/asuntos', 'Asuntos', 'Asuntos', BriefcaseBusiness, 'negocio', ruta.startsWith('/portal/asuntos'))] : []),
    ...(perfil.rol === 'admin' ? [s('admin', '/portal/admin', 'Administración', 'Admin', ShieldCheck, 'firma', ruta.startsWith('/portal/admin'))] : []),
  ];
}

/** Lo que el buscador ofrece como sección: el menú más las pantallas que no tienen ítem propio. */
function accesosDe(perfil: Perfil, permisos: Permisos, secciones: Seccion[]): AccesoSeccion[] {
  return [
    ...secciones.map((x) => ({ a: x.a, titulo: x.titulo, icono: x.icono })),
    ...(permisos.crm
      ? [
          { a: '/portal/crm/comprobantes', titulo: 'Invoices y recibos', icono: ReceiptText },
          ...(permisos.casos ? [{ a: '/portal/crm/casos', titulo: 'Casos de conflicto', icono: ShieldAlert }] : []),
          { a: '/portal/crm/servicios', titulo: 'Servicios', icono: Layers },
          { a: '/portal/crm/equipo', titulo: 'Equipo', icono: Users },
          { a: '/portal/crm/llamadas', titulo: 'Llamadas', icono: Phone },
        ]
      : []),
    ...(perfil.rol === 'titular' ? [{ a: '/portal/bitacora', titulo: 'Bitácora de la cuenta', icono: ScrollText }] : []),
  ];
}

const TITULO_GRUPO: Record<Seccion['grupo'], string> = { principal: '', negocio: 'Tu negocio', firma: 'FIRMA' };

/* ------------------------------------------------------------------ */
/* Datos chicos que muestra el marco, con caché por sesión             */
/* ------------------------------------------------------------------ */
interface OrgInfo {
  nombre: string;
  plan: Plan | null;
}
const cacheOrg = new Map<string, OrgInfo | null>();

function useOrgInfo(orgId: string | null | undefined): OrgInfo | null {
  const [info, setInfo] = useState<OrgInfo | null>(() => (orgId ? cacheOrg.get(orgId) ?? null : null));
  useEffect(() => {
    if (!supabase || !orgId) return setInfo(null);
    if (cacheOrg.has(orgId)) return setInfo(cacheOrg.get(orgId) ?? null);
    let vigente = true;
    void supabase
      .from('organizaciones')
      .select('nombre, plan')
      .eq('id', orgId)
      .maybeSingle()
      .then(({ data }) => {
        const v = data ? { nombre: (data as OrgInfo).nombre, plan: ((data as OrgInfo).plan ?? null) as Plan | null } : null;
        cacheOrg.set(orgId, v);
        if (vigente) setInfo(v);
      });
    return () => {
      vigente = false;
    };
  }, [orgId]);
  return info;
}

/** Cuántas cosas esperan en Asuntos y en Firmas. Se refresca como mucho una vez por minuto. */
interface Contadores {
  asuntos?: number;
  firmas?: number;
}
const cacheContadores = new Map<string, { t: number; v: Contadores }>();

function useContadores(permisos: Permisos | null, orgId: string | null | undefined, esAdmin: boolean, conAsuntos: boolean): Contadores {
  const clave = `${orgId ?? 'todas'}:${esAdmin ? 'firma' : 'cliente'}:${conAsuntos ? 1 : 0}${permisos?.documentosLegales ? 1 : 0}`;
  const [v, setV] = useState<Contadores>(() => cacheContadores.get(clave)?.v ?? {});
  useEffect(() => {
    if (!supabase || !permisos) return;
    const previo = cacheContadores.get(clave);
    if (previo && Date.now() - previo.t < 60_000) return setV(previo.v);
    let vigente = true;
    void (async () => {
      const contar = async (tabla: string, estado: string) => {
        let q = supabase!.from(tabla).select('id', { count: 'exact', head: true }).eq('estado', estado);
        if (orgId) q = q.eq('organizacion_id', orgId);
        const { count } = await q;
        return count ?? 0;
      };
      const [asuntos, firmas] = await Promise.all([
        // Al cliente le cuenta lo que espera su respuesta. A FIRMA, lo que está en curso de su lado.
        conAsuntos ? contar('asuntos', esAdmin ? 'en_curso' : 'espera_cliente') : Promise.resolve(undefined),
        permisos.documentosLegales ? contar('firma_sobres', 'en_curso') : Promise.resolve(undefined),
      ]);
      const nuevo = { asuntos, firmas };
      cacheContadores.set(clave, { t: Date.now(), v: nuevo });
      if (vigente) setV(nuevo);
    })();
    return () => {
      vigente = false;
    };
  }, [clave]); // eslint-disable-line react-hooks/exhaustive-deps
  return v;
}

/* ------------------------------------------------------------------ */
/* Selector de negocio, para quien es miembro de más de uno            */
/* ------------------------------------------------------------------ */
interface Negocio {
  id: string;
  nombre: string;
}

/** Para un usuario del cliente, la política de organizaciones devuelve el negocio activo y los de sus membresías. */
const cacheNegocios = new Map<string, Negocio[]>();

function useMisNegocios(perfil: Perfil | null | undefined): Negocio[] {
  const [negocios, setNegocios] = useState<Negocio[]>(() => (perfil ? cacheNegocios.get(perfil.id) ?? [] : []));
  useEffect(() => {
    if (!supabase || !perfil || perfil.rol === 'admin') return;
    // Cada pantalla monta su marco: sin caché, la lista se volvía a pedir en cada cambio de sección.
    const previo = cacheNegocios.get(perfil.id);
    if (previo) return setNegocios(previo);
    let vigente = true;
    const id = perfil.id;
    void supabase
      .from('organizaciones')
      .select('id, nombre')
      .order('nombre')
      .then(({ data, error }) => {
        const lista = (data as Negocio[]) ?? [];
        if (!error) cacheNegocios.set(id, lista);
        if (vigente) setNegocios(lista);
      });
    return () => {
      vigente = false;
    };
  }, [perfil?.id, perfil?.rol]); // eslint-disable-line react-hooks/exhaustive-deps
  return negocios;
}

/** Select nativo invisible sobre el bloque de la empresa: se toca el bloque y se elige el negocio. */
const SelectorNegocio: React.FC<{ perfil: Perfil; negocios: Negocio[] }> = ({ perfil, negocios }) => {
  const [cambiando, setCambiando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cambiar(org: string) {
    if (!supabase || org === perfil.organizacion_id) return;
    setCambiando(true);
    setError(null);
    const { error: e } = await supabase.rpc('cambiar_organizacion', { org });
    if (e) {
      setCambiando(false);
      setError('No se pudo cambiar de negocio.');
      return;
    }
    // Todo lo que está en pantalla es del negocio anterior: se vuelve a cargar desde el inicio.
    window.location.assign('/portal');
  }

  return (
    <>
      <select
        aria-label="Cambiar de negocio"
        value={perfil.organizacion_id ?? ''}
        disabled={cambiando}
        onChange={(e) => void cambiar(e.target.value)}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
      >
        {negocios.map((n) => (
          <option key={n.id} value={n.id}>
            {n.nombre}
          </option>
        ))}
      </select>
      {error && (
        <span role="alert" className="absolute left-0 right-0 top-full mt-1 text-peligro-claro text-[12px]">
          {error}
        </span>
      )}
    </>
  );
};

/** false mientras el navegador avisa que no hay red. */
function useConexion(): boolean {
  const [hay, setHay] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  useEffect(() => {
    const si = () => setHay(true);
    const no = () => setHay(false);
    window.addEventListener('online', si);
    window.addEventListener('offline', no);
    return () => {
      window.removeEventListener('online', si);
      window.removeEventListener('offline', no);
    };
  }, []);
  return hay;
}

const iniciales = (texto: string): string =>
  texto
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');

/* ------------------------------------------------------------------ */
/* Barra lateral (computadora) y panel del menú (celular)              */
/* ------------------------------------------------------------------ */
/**
 * Menú del celular. Una hoja que sube desde abajo con las secciones como en la barra de la
 * computadora, el ícono arriba y el nombre corto abajo.
 */
const HojaMenu: React.FC<{
  perfil: Perfil;
  secciones: Seccion[];
  contadores: Contadores;
  orgNombre: string | null;
  orgPlan: Plan | null;
  logoCliente: string | null;
  vista: boolean;
  alElegir?: () => void;
}> = ({ perfil, secciones, contadores, orgNombre, orgPlan, logoCliente, vista, alElegir }) => {
  const esAdmin = perfil.rol === 'admin' && !vista;
  const grupos = (['principal', 'negocio', 'firma'] as const).map((g) => ({ g, items: secciones.filter((x) => x.grupo === g) })).filter((x) => x.items.length);
  const cuenta = (c: ClaveSeccion) => (c === 'asuntos' ? contadores.asuntos : c === 'firmas' ? contadores.firmas : undefined);
  const nombre = perfil.nombre || perfil.email;
  const negocios = useMisNegocios(!vista && perfil.rol !== 'admin' ? perfil : null);
  const varios = negocios.length > 1;
  const titulos: Record<Seccion['grupo'], string> = esAdmin ? { principal: '', negocio: 'Gestión', firma: 'FIRMA' } : TITULO_GRUPO;

  return (
    <div className="flex flex-col gap-6 px-4 pt-6 pb-5 text-lateral-texto">
      <span aria-hidden="true" className="absolute top-2 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-marfil/20" />

      <div className={`relative flex items-center gap-3 mr-12 p-2 -m-2 rounded-[14px] ${varios ? 'focus-within:outline focus-within:outline-2 focus-within:outline-marfil' : ''}`}>
        {logoCliente && !esAdmin ? (
          <span className="w-11 h-11 shrink-0 rounded-[12px] bg-white grid place-items-center overflow-hidden">
            <img src={logoCliente} alt="" className="max-w-[36px] max-h-[36px] object-contain" />
          </span>
        ) : (
          <span aria-hidden="true" className="w-11 h-11 shrink-0 rounded-[12px] grid place-items-center bg-marfil text-tinta text-[14px] font-bold">
            {esAdmin ? 'F' : iniciales(orgNombre ?? '·')}
          </span>
        )}
        <span className="flex flex-col min-w-0 leading-tight">
          <span className="text-marfil text-[16px] font-semibold truncate">{esAdmin ? 'FIRMA' : orgNombre ?? '·'}</span>
          <span className="text-[13px] text-lateral-tenue truncate mt-0.5">{esAdmin ? 'Administración' : [cargoDe(perfil), orgPlan ? `Plan ${ROTULO_PLAN[orgPlan]}` : null].filter(Boolean).join(' · ')}</span>
        </span>
        {varios && (
          <>
            <ChevronsUpDown size={16} aria-hidden="true" className="ml-auto shrink-0 text-lateral-tenue" />
            <SelectorNegocio perfil={perfil} negocios={negocios} />
          </>
        )}
      </div>

      <nav aria-label="Secciones del portal" className="flex flex-col gap-5">
        {grupos.map(({ g, items }) => (
          <div key={g} className="flex flex-col gap-2.5">
            {titulos[g] && <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.16em] [font-stretch:125%] text-lateral-tenue">{titulos[g]}</p>}
            <div className="grid grid-cols-4 gap-x-1 gap-y-3">
              {items.map((x) => {
                const Icono = x.icono;
                const n = cuenta(x.clave);
                return (
                  <Enlace
                    key={x.clave}
                    a={x.a}
                    onClick={alElegir}
                    aria-current={x.activo ? 'page' : undefined}
                    className={`flex flex-col items-center gap-1.5 py-1 rounded-[14px] text-[12px] leading-tight text-center ${x.activo ? 'text-marfil font-semibold' : 'text-lateral-texto font-medium'}`}
                  >
                    <span className={`relative w-12 h-11 grid place-items-center rounded-[14px] ${x.activo ? 'bg-grafito' : 'bg-marfil/[0.06]'}`}>
                      <Icono size={21} strokeWidth={1.75} aria-hidden="true" />
                      {n ? <Cuenta n={n} clase="absolute -top-1.5 -right-1.5" /> : null}
                    </span>
                    <span className="max-w-full truncate px-0.5">{x.corto}</span>
                  </Enlace>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="flex flex-col gap-1 pt-4 border-t border-marfil/10">
        {perfil.rol === 'titular' && !vista && (
          <Enlace
            a="/portal/bitacora"
            onClick={alElegir}
            aria-current={window.location.pathname.startsWith('/portal/bitacora') ? 'page' : undefined}
            className="flex items-center gap-3 min-h-[44px] px-1 rounded-[10px] text-[14px] text-lateral-texto hover:text-marfil aria-[current=page]:text-marfil"
          >
            <span className="w-8 grid place-items-center shrink-0">
              <ScrollText size={17} strokeWidth={1.75} aria-hidden="true" />
            </span>
            Bitácora de la cuenta
          </Enlace>
        )}
        <div className="flex items-center gap-3 px-1 pt-1">
          <span aria-hidden="true" className="w-8 h-8 shrink-0 rounded-full grid place-items-center bg-grafito text-marfil text-[12px] font-bold">
            {iniciales(nombre)}
          </span>
          <span className="flex flex-col min-w-0 flex-1 leading-tight">
            <span className="text-marfil text-[14px] font-medium truncate">{nombre}</span>
            <span className="text-[12.5px] text-lateral-tenue truncate">{perfil.nombre ? perfil.email : ROTULO_ROL[perfil.rol]}</span>
          </span>
          <button type="button" onClick={salir} className="flex items-center gap-2 h-10 px-3 shrink-0 rounded-[10px] border border-marfil/15 text-[13.5px] text-marfil hover:bg-marfil/[0.06]">
            <LogOut size={16} aria-hidden="true" />
            Salir
          </button>
        </div>
      </div>
    </div>
  );
};

/** Hoja del menú en el celular. Sube desde abajo y se cierra tocando afuera, con la X o con Escape. */
const PanelMenu: React.FC<{ abierto: boolean; alCerrar: () => void; children: React.ReactNode }> = ({ abierto, alCerrar, children }) => {
  const cerrarRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!abierto) return;
    cerrarRef.current?.focus();
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && alCerrar();
    const desborde = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', tecla);
    return () => {
      document.body.style.overflow = desborde;
      document.removeEventListener('keydown', tecla);
    };
  }, [abierto, alCerrar]);
  if (!abierto) return null;
  return (
    <div className="desk:hidden fixed inset-0 z-50 flex flex-col justify-end" role="dialog" aria-modal="true" aria-label="Menú del portal">
      <button type="button" aria-label="Cerrar el menú" tabIndex={-1} onClick={alCerrar} className="hoja-fondo absolute inset-0 bg-tinta/55" />
      <div className="lateral hoja-menu relative w-full max-h-[88vh] overflow-y-auto overscroll-contain rounded-t-[22px] bg-tinta pb-[env(safe-area-inset-bottom)]">
        <button ref={cerrarRef} type="button" onClick={alCerrar} aria-label="Cerrar el menú" className="absolute right-3 top-[26px] z-10 w-10 h-10 grid place-items-center rounded-[10px] text-lateral-texto hover:text-marfil hover:bg-marfil/[0.06]">
          <X size={20} aria-hidden="true" />
        </button>
        {children}
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Barra de íconos y panel de la sección (computadora), estilo ClickUp */
/* ------------------------------------------------------------------ */
/**
 * En computadora el menú es una barra angosta de íconos con su nombre abajo y, al lado,
 * el panel de la sección con sus pantallas (Clientes, Equipo y Administración). El panel
 * se oculta y el portal recuerda cómo lo dejaste. En el celular quedan la barra de abajo, los chips
 * de la sección y la hoja del menú.
 */
const CLAVE_PANEL = 'firma-panel-seccion';
const PanelSeccionCtx = React.createContext<{ hay: boolean; abierto: boolean }>({ hay: false, abierto: false });

/** true cuando, en computadora, el panel de la sección está abierto y ya muestra las pantallas de la sección. */
export const usePanelSeccion = (): boolean => {
  const { hay, abierto } = React.useContext(PanelSeccionCtx);
  return hay && abierto;
};

/**
 * Navegación propia de una página (pestañas, accesos del encabezado). Cuando la sección tiene
 * panel, en el celular la reemplazan los chips de arriba y en computadora el panel, si está abierto.
 */
export const NavegacionDePagina: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { hay, abierto } = React.useContext(PanelSeccionCtx);
  return <div className={!hay ? 'contents' : abierto ? 'hidden' : 'hidden desk:contents'}>{children}</div>;
};

interface ItemPanel {
  a: string;
  titulo: string;
  icono: LucideIcon;
  activo: boolean;
  cuenta?: number;
}
interface PanelDeSeccion {
  titulo: string;
  grupos: { titulo?: string; items: ItemPanel[] }[];
  accion?: { a: string; titulo: string };
}

const SUBRUTAS_CRM = ['casos', 'reuniones', 'llamadas', 'comprobantes', 'servicios', 'equipo'];
const ICONO_ADMIN: Record<string, LucideIcon> = {
  '/portal/admin': Users,
  '/portal/admin/clientes': Building2,
  '/portal/admin/agendas': CalendarDays,
  '/portal/admin/documentos': FileText,
  '/portal/admin/formularios': ListChecks,
  '/portal/admin/abonos': Wallet,
  '/portal/admin/newsletter': Mail,
  '/portal/admin/calidad': Sparkles,
  '/portal/admin/registro': ScrollText,
};

function panelDe(clave: ClaveSeccion | undefined, ruta: string, permisos: Permisos, soloLectura: boolean, cuentas: CuentasCrm): PanelDeSeccion | null {
  if (clave === 'crm') {
    const en = (s: string) => ruta === `/portal/crm/${s}` || ruta.startsWith(`/portal/crm/${s}/`);
    return {
      titulo: 'Clientes',
      accion: soloLectura ? undefined : { a: '/portal/crm/nuevo', titulo: 'Nuevo cliente' },
      grupos: [
        {
          items: [
            { a: '/portal/crm', titulo: 'Todos los clientes', icono: Kanban, activo: !SUBRUTAS_CRM.some(en) },
            ...(permisos.casos ? [{ a: '/portal/crm/casos', titulo: 'Casos de conflicto', icono: ShieldAlert, activo: en('casos'), cuenta: cuentas.casos }] : []),
            { a: '/portal/crm/reuniones', titulo: 'Reuniones', icono: CalendarDays, activo: en('reuniones'), cuenta: cuentas.reuniones },
            { a: '/portal/crm/llamadas', titulo: 'Llamadas', icono: Phone, activo: en('llamadas') },
            { a: '/portal/crm/comprobantes', titulo: 'Invoices y recibos', icono: ReceiptText, activo: en('comprobantes') },
          ],
        },
        {
          titulo: 'Configuración',
          items: [
            { a: '/portal/crm/servicios', titulo: 'Servicios', icono: Layers, activo: en('servicios') },
            { a: '/portal/crm/equipo', titulo: 'Equipo comercial', icono: Users, activo: en('equipo') },
          ],
        },
      ],
    };
  }
  if (clave === 'equipo') {
    const en = (s: string) => ruta === `/portal/equipo/${s}`;
    return {
      titulo: 'Equipo',
      grupos: [
        {
          items: [
            { a: '/portal/equipo', titulo: 'Personas', icono: Users, activo: !en('victorias') && !en('objetivos') && !en('reportes') },
            { a: '/portal/equipo/victorias', titulo: 'Victorias', icono: Trophy, activo: en('victorias') },
            { a: '/portal/equipo/objetivos', titulo: 'Objetivos', icono: Target, activo: en('objetivos') },
            { a: '/portal/equipo/reportes', titulo: 'Reportes', icono: ClipboardList, activo: en('reportes') },
          ],
        },
      ],
    };
  }
  if (clave === 'admin') {
    return {
      titulo: 'Administración',
      grupos: [{ items: PESTANAS_ADMIN.map((p) => ({ a: p.ruta, titulo: p.titulo, icono: ICONO_ADMIN[p.ruta] ?? ShieldCheck, activo: ruta === p.ruta })) }],
    };
  }
  return null;
}

/** Casos de conflicto en curso y reuniones por completar de la empresa, para el panel de Clientes. Se piden como mucho una vez por minuto. */
interface CuentasCrm {
  casos?: number;
  reuniones?: number;
}
const cacheCrm = new Map<string, { t: number; c: CuentasCrm }>();
function useCuentasCrm(orgId: string | null, activo: boolean, conCasos: boolean): CuentasCrm {
  const clave = orgId ? `${orgId}:${conCasos ? 'casos' : ''}` : '';
  const [c, setC] = useState<CuentasCrm>(() => (clave ? cacheCrm.get(clave)?.c ?? {} : {}));
  useEffect(() => {
    if (!supabase || !activo || !orgId) return;
    const previo = cacheCrm.get(clave);
    if (previo && Date.now() - previo.t < 60_000) return setC(previo.c);
    let vigente = true;
    const ahora = new Date().toISOString();
    void Promise.all([
      conCasos ? supabase.from('crm_casos').select('id', { count: 'exact', head: true }).eq('organizacion_id', orgId).neq('etapa', 'cerrado') : null,
      // Las mismas que cuenta Clientes, sin tipo o agendadas que ya pasaron.
      supabase.from('crm_reuniones').select('id', { count: 'exact', head: true }).eq('organizacion_id', orgId).or(`tipo.is.null,and(estado.eq.agendada,inicio.lt.${ahora})`),
    ]).then(([casos, reuniones]) => {
      const nuevo: CuentasCrm = {
        casos: casos && !casos.error ? (casos.count ?? 0) : undefined,
        reuniones: reuniones.error ? undefined : (reuniones.count ?? 0),
      };
      cacheCrm.set(clave, { t: Date.now(), c: nuevo });
      if (vigente) setC(nuevo);
    });
    return () => {
      vigente = false;
    };
  }, [orgId, activo, conCasos, clave]);
  return c;
}

/** Abierto o cerrado, guardado en este navegador. Abierto la primera vez. */
function usePanelAbierto(): [boolean, (v: boolean) => void] {
  const [abierto, setAbierto] = useState(() => {
    try {
      return window.localStorage.getItem(CLAVE_PANEL) !== 'cerrado';
    } catch {
      return true;
    }
  });
  const cambiar = (v: boolean) => {
    setAbierto(v);
    try {
      window.localStorage.setItem(CLAVE_PANEL, v ? 'abierto' : 'cerrado');
    } catch {
      /* sin almacenamiento */
    }
  };
  return [abierto, cambiar];
}

const Cuenta: React.FC<{ n: number; clase?: string }> = ({ n, clase = '' }) => (
  <span className={`min-w-[18px] h-[18px] px-1 grid place-items-center rounded-pastilla bg-marfil text-tinta text-[10.5px] font-bold tabular-nums ${clase}`} aria-label={`${n} pendientes`}>
    {n > 99 ? '99+' : n}
  </span>
);

/** Un ítem de la barra de íconos: el ícono y, abajo, su nombre corto. */
const ItemBarra: React.FC<{
  a?: string;
  alTocar?: () => void;
  icono: LucideIcon;
  rotulo: string;
  titulo?: string;
  activo?: boolean;
  cuenta?: number;
  haspopup?: 'dialog';
}> = ({ a, alTocar, icono: Icono, rotulo, titulo, activo, cuenta, haspopup }) => {
  const clase = `group flex flex-col items-center gap-0.5 w-[72px] py-1 rounded-[12px] text-[11px] leading-tight text-center transition-colors duration-150 ${activo ? 'text-marfil font-semibold' : 'text-lateral-texto font-medium hover:text-marfil'}`;
  const contenido = (
    <>
      <span className={`relative w-10 h-[30px] grid place-items-center rounded-[10px] ${activo ? 'bg-grafito' : 'group-hover:bg-marfil/[0.08]'}`}>
        <Icono size={19} strokeWidth={1.75} aria-hidden="true" />
        {cuenta ? <Cuenta n={cuenta} clase="absolute -top-1 -right-1.5" /> : null}
      </span>
      <span className="max-w-full truncate px-0.5">{rotulo}</span>
    </>
  );
  return a ? (
    <Enlace a={a} title={titulo} aria-current={activo ? 'page' : undefined} className={clase}>
      {contenido}
    </Enlace>
  ) : (
    <button type="button" onClick={alTocar} title={titulo} aria-haspopup={haspopup} className={clase}>
      {contenido}
    </button>
  );
};

const Separacion = () => <span aria-hidden="true" className="w-9 h-px my-1 shrink-0 bg-marfil/[0.12]" />;

const BarraEscritorio: React.FC<{
  perfil: Perfil;
  secciones: Seccion[];
  contadores: Contadores;
  orgNombre: string | null;
  logoCliente: string | null;
  vista: boolean;
  panel: PanelDeSeccion | null;
  panelAbierto: boolean;
  alPanel: (abierto: boolean) => void;
}> = ({ perfil, secciones, contadores, orgNombre, logoCliente, vista, panel, panelAbierto, alPanel }) => {
  const esAdmin = perfil.rol === 'admin' && !vista;
  const negocios = useMisNegocios(!vista && perfil.rol !== 'admin' ? perfil : null);
  const varios = negocios.length > 1;
  const nombre = perfil.nombre || perfil.email;
  const cuenta = (c: ClaveSeccion) => (c === 'asuntos' ? contadores.asuntos : c === 'firmas' ? contadores.firmas : undefined);
  const grupo = (g: Seccion['grupo']) =>
    secciones
      .filter((x) => x.grupo === g)
      .map((x) => <ItemBarra key={x.clave} a={x.a} icono={x.icono} rotulo={x.corto} titulo={x.titulo} activo={x.activo} cuenta={cuenta(x.clave)} />);
  const empresa = esAdmin ? 'FIRMA' : orgNombre ?? '';

  return (
    <div className="lateral flex h-screen">
      <nav aria-label="Secciones del portal" className="w-[84px] shrink-0 flex flex-col items-center gap-0.5 pt-4 pb-3 bg-tinta overflow-y-auto scrollbar-hide">
        <Enlace a="/portal" aria-label="Inicio del portal" className="px-1 pb-2.5">
          <img src={palabraOscura} alt="firma" className="h-[19px] w-auto" />
        </Enlace>
        <div className="relative flex flex-col items-center gap-1 w-[72px] py-1" title={empresa}>
          {logoCliente && !esAdmin ? (
            <span className="w-9 h-9 rounded-[10px] bg-white grid place-items-center overflow-hidden">
              <img src={logoCliente} alt="" className="max-w-[30px] max-h-[30px] object-contain" />
            </span>
          ) : (
            <span aria-hidden="true" className="w-9 h-9 rounded-[10px] grid place-items-center bg-marfil text-tinta text-[13px] font-bold">
              {esAdmin ? 'F' : iniciales(orgNombre ?? '·')}
            </span>
          )}
          <span className="max-w-full truncate px-0.5 text-[10.5px] text-lateral-tenue">{empresa.split(/\s+/)[0]}</span>
          {varios && <SelectorNegocio perfil={perfil} negocios={negocios} />}
        </div>
        <ItemBarra icono={Search} rotulo="Buscar" titulo={`Buscar (${atajoBuscador()})`} alTocar={abrirBuscador} haspopup="dialog" />
        <Separacion />
        {grupo('principal')}
        {secciones.some((x) => x.grupo === 'negocio') && <Separacion />}
        {grupo('negocio')}
        {secciones.some((x) => x.grupo === 'firma') && <Separacion />}
        {grupo('firma')}
        <span className="flex-1 min-h-3" />
        {panel && !panelAbierto && <ItemBarra icono={PanelLeftOpen} rotulo="Panel" titulo={`Mostrar el panel de ${panel.titulo}`} alTocar={() => alPanel(true)} />}
        {perfil.rol === 'titular' && !vista && (
          <ItemBarra a="/portal/bitacora" icono={ScrollText} rotulo="Bitácora" titulo="Bitácora de la cuenta" activo={window.location.pathname.startsWith('/portal/bitacora')} />
        )}
        <CampanaAvisos variante="barra" />
        <Dropdown>
          <BotonHero variant="ghost" aria-label={`Tu cuenta, ${nombre}`} className="h-auto w-[72px] flex-col gap-0.5 px-0 py-1 rounded-[12px] text-lateral-texto text-[11px] font-medium hover:text-marfil hover:bg-transparent">
            <span aria-hidden="true" className="w-[30px] h-[30px] rounded-full grid place-items-center bg-grafito text-marfil text-[11px] font-bold">
              {iniciales(nombre)}
            </span>
            Vos
          </BotonHero>
          <Dropdown.Popover placement="end bottom" className="min-w-[240px]">
            <div className="px-3 pt-3 pb-2 leading-tight">
              <p className="text-[14px] font-semibold truncate">{nombre}</p>
              <p className="text-[12.5px] text-piedra truncate mt-0.5">{perfil.nombre ? perfil.email : ROTULO_ROL[perfil.rol]}</p>
            </div>
            <Dropdown.Menu onAction={(k) => k === 'salir' && void salir()}>
              <Dropdown.Item id="salir" textValue="Salir del portal">
                <LogOut size={16} aria-hidden="true" />
                <RotuloHero>Salir del portal</RotuloHero>
              </Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown.Popover>
        </Dropdown>
      </nav>

      {panel && panelAbierto && (
        <nav aria-label={`Pantallas de ${panel.titulo}`} className="w-[220px] shrink-0 flex flex-col gap-0.5 px-2.5 pt-5 pb-4 bg-carbon text-lateral-texto overflow-y-auto scrollbar-hide border-l border-marfil/[0.06]">
          <div className="flex items-center justify-between gap-2 pl-2 pb-4">
            <p className="text-marfil text-[18px] font-bold truncate">{panel.titulo}</p>
            <span className="flex gap-1.5 shrink-0">
              {panel.accion && (
                <Enlace a={panel.accion.a} title={panel.accion.titulo} aria-label={panel.accion.titulo} className="w-8 h-8 grid place-items-center rounded-[9px] border border-marfil/15 text-marfil hover:bg-marfil/[0.08]">
                  <Plus size={16} aria-hidden="true" />
                </Enlace>
              )}
              <button type="button" onClick={() => alPanel(false)} title="Ocultar el panel" aria-label="Ocultar el panel" className="w-8 h-8 grid place-items-center rounded-[9px] border border-marfil/15 text-marfil hover:bg-marfil/[0.08]">
                <ChevronsLeft size={16} aria-hidden="true" />
              </button>
            </span>
          </div>
          {panel.grupos.map((g, i) => (
            <div key={i} className="flex flex-col gap-0.5">
              {g.titulo && <p className="px-2.5 pt-4 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-lateral-tenue">{g.titulo}</p>}
              {g.items.map((x) => {
                const Icono = x.icono;
                return (
                  <Enlace
                    key={x.a}
                    a={x.a}
                    aria-current={x.activo ? 'page' : undefined}
                    className={`flex items-center gap-2.5 min-h-[38px] px-2.5 rounded-[10px] text-[14px] transition-colors duration-150 ${x.activo ? 'bg-grafito text-marfil font-semibold' : 'hover:bg-marfil/[0.06] hover:text-marfil'}`}
                  >
                    <Icono size={17} strokeWidth={1.75} aria-hidden="true" className="shrink-0" />
                    <span className="flex-1 truncate">{x.titulo}</span>
                    {x.cuenta ? <Cuenta n={x.cuenta} /> : null}
                  </Enlace>
                );
              })}
            </div>
          ))}
        </nav>
      )}
    </div>
  );
};

/** En el celular, las pantallas de la sección van en una fila de chips fija debajo de la barra de arriba. */
const ChipsSeccion: React.FC<{ panel: PanelDeSeccion }> = ({ panel }) => {
  const fila = useRef<HTMLDivElement>(null);
  const activa = panel.grupos.flatMap((g) => g.items).find((x) => x.activo)?.a;
  // La pantalla abierta queda a la vista aunque esté al final de la fila.
  useEffect(() => {
    const cont = fila.current;
    const el = cont?.querySelector<HTMLElement>('[aria-current="page"]');
    if (cont && el) cont.scrollLeft = el.offsetLeft - (cont.clientWidth - el.offsetWidth) / 2;
  }, [activa]);
  return (
    <nav aria-label={`Pantallas de ${panel.titulo}`} className="desk:hidden sticky top-14 z-30 bg-marfil/95 backdrop-blur border-b border-borde-suave">
      <div ref={fila} className="relative flex items-center gap-2 px-4 py-2.5 overflow-x-auto scrollbar-hide">
        {panel.grupos.map((g, i) => (
          <React.Fragment key={i}>
            {i > 0 && <span aria-hidden="true" className="w-px h-5 shrink-0 bg-tinta/15" />}
            {g.items.map((x) => {
              const Icono = x.icono;
              return (
                <Enlace
                  key={x.a}
                  a={x.a}
                  aria-current={x.activo ? 'page' : undefined}
                  className={`shrink-0 inline-flex items-center gap-1.5 h-9 px-3.5 rounded-pastilla border text-[13.5px] whitespace-nowrap transition-colors duration-150 ${x.activo ? 'bg-tinta border-tinta text-marfil font-semibold' : 'bg-papel border-borde-suave text-tinta hover:border-tinta/30'}`}
                >
                  <Icono size={15} strokeWidth={1.75} aria-hidden="true" />
                  {x.titulo}
                  {x.cuenta ? (
                    <span className={`min-w-[19px] h-[19px] px-1 grid place-items-center rounded-pastilla text-[11px] font-bold tabular-nums ${x.activo ? 'bg-marfil text-tinta' : 'bg-tinta text-marfil'}`} aria-label={`${x.cuenta} pendientes`}>
                      {x.cuenta > 99 ? '99+' : x.cuenta}
                    </span>
                  ) : null}
                </Enlace>
              );
            })}
          </React.Fragment>
        ))}
      </div>
    </nav>
  );
};

/* ------------------------------------------------------------------ */
/* Marco general del portal                                            */
/* ------------------------------------------------------------------ */
/** orgId fija de qué cliente es el logo y el nombre del lateral. Sin él, el de la empresa del usuario (o la de la vista previa). */
export const Marco: React.FC<{ perfil?: Perfil | null; orgId?: string | null; children: React.ReactNode; ancho?: 'angosto' | 'normal' }> = ({ perfil, orgId, children, ancho = 'normal' }) => {
  const vista = useVistaPrevia();
  const orgDelMarco = orgId ?? vista?.orgId ?? perfil?.organizacion_id ?? null;
  const logoCliente = useLogoOrg(orgDelMarco);
  const org = useOrgInfo(orgDelMarco);
  const ruta = window.location.pathname.replace(/\/$/, '');
  const permisos = perfil ? permisosDe(perfil.rol) : null;
  const esAdmin = perfil?.rol === 'admin' && !vista;
  const secciones = perfil && permisos ? seccionesDe(perfil, permisos, ruta) : [];
  const contadores = useContadores(permisos, esAdmin ? null : orgDelMarco, esAdmin, perfil ? veAsuntos(perfil) : false);
  const [menu, setMenu] = useState(false);
  const conexion = useConexion();
  const claveActiva = secciones.find((x) => x.activo)?.clave;
  const cuentasCrm = useCuentasCrm(esAdmin ? null : orgDelMarco, claveActiva === 'crm', Boolean(permisos?.casos));
  const panel = permisos ? panelDe(claveActiva, ruta, permisos, Boolean(vista), cuentasCrm) : null;
  const [panelAbierto, setPanelAbierto] = usePanelAbierto();
  const conPanel = Boolean(panel && panelAbierto);

  // El título de la pestaña dice en qué sección estás: sirve en el historial y con varias pestañas abiertas.
  const tituloSeccion = secciones.find((x) => x.activo)?.titulo ?? null;
  useEffect(() => {
    document.title = tituloSeccion && tituloSeccion !== 'Inicio' ? `${tituloSeccion} · FIRMA` : 'Portal de clientes · FIRMA';
    return () => {
      document.title = 'Portal de clientes · FIRMA';
    };
  }, [tituloSeccion]);

  // La barra inferior muestra las cuatro secciones que más se usan. El resto vive en Más.
  const ORDEN_INFERIOR: ClaveSeccion[] = ['inicio', 'crm', 'equipo', 'agenda', 'pagos', 'protocolos', 'documentos', 'firmas', 'asuntos', 'admin'];
  const inferiores = ORDEN_INFERIOR.map((c) => secciones.find((x) => x.clave === c)).filter((x): x is Seccion => Boolean(x)).slice(0, 4);
  const menuCelular = perfil ? (
    <HojaMenu perfil={perfil} secciones={secciones} contadores={contadores} orgNombre={vista?.orgNombre ?? org?.nombre ?? null} orgPlan={org?.plan ?? null} logoCliente={logoCliente} vista={Boolean(vista)} alElegir={() => setMenu(false)} />
  ) : null;

  return (
    <DensidadBotones.Provider value="compacta">
      <PanelSeccionCtx.Provider value={{ hay: Boolean(panel), abierto: panelAbierto }}>
      <div
        data-panel={conPanel ? 'abierto' : 'cerrado'}
        className={`portal min-h-screen bg-marfil text-tinta desk:grid ${perfil ? (conPanel ? 'desk:grid-cols-[304px_minmax(0,1fr)]' : 'desk:grid-cols-[84px_minmax(0,1fr)]') : ''}`}
      >
        {/* Con teclado: salta el menú y va directo al contenido. */}
        <a href="#contenido" className="sr-only focus:not-sr-only focus:fixed focus:z-[60] focus:left-3 focus:top-3 focus:px-4 focus:py-2.5 focus:rounded-[10px] focus:bg-papel focus:text-tinta focus:text-[14px] focus:font-semibold focus:shadow-flotante">
          Saltar al contenido
        </a>
        {perfil && (
          <div className="hidden desk:block bg-tinta">
            <aside className="sticky top-0 h-screen" aria-label="Barra lateral">
              <BarraEscritorio
                perfil={perfil}
                secciones={secciones}
                contadores={contadores}
                orgNombre={vista?.orgNombre ?? org?.nombre ?? null}
                logoCliente={logoCliente}
                vista={Boolean(vista)}
                panel={panel}
                panelAbierto={panelAbierto}
                alPanel={setPanelAbierto}
              />
            </aside>
          </div>
        )}

        <div className="portal-cuerpo flex flex-col min-w-0 min-h-screen">
          {/* Barra superior del celular */}
          <header className="desk:hidden sticky top-0 z-40 h-14 px-4 flex items-center gap-3 bg-tinta text-marfil">
            <Enlace a="/portal" aria-label="Inicio del portal" className="shrink-0">
              <img src={palabraOscura} alt="firma" className="h-[22px] w-auto" />
            </Enlace>
            <span className="flex-1 min-w-0 text-right text-[13px] text-lateral-texto truncate">{esAdmin ? 'Administración' : vista?.orgNombre ?? org?.nombre ?? ''}</span>
            {perfil && (
              <button type="button" onClick={abrirBuscador} aria-label="Buscar en el portal" aria-haspopup="dialog" className="w-10 h-10 -mr-1.5 grid place-items-center shrink-0 rounded-[10px] text-lateral-texto hover:text-marfil hover:bg-marfil/[0.06]">
                <Search size={19} aria-hidden="true" />
              </button>
            )}
            {perfil && <CampanaAvisos className="-mr-1.5" />}
            {perfil && (
              <button type="button" onClick={() => setMenu(true)} aria-label="Abrir el menú" aria-expanded={menu} className="w-10 h-10 -mr-2 grid place-items-center shrink-0 rounded-[10px] hover:bg-marfil/[0.06]">
                <Menu size={20} aria-hidden="true" />
              </button>
            )}
          </header>

          {panel && <ChipsSeccion panel={panel} />}

          {vista && (
            <div className="bg-grafito text-marfil text-sm">
              <div className="wrap flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5">
                <Eye size={16} aria-hidden="true" />
                <span className="flex-1 min-w-[200px]">
                  Viendo como <strong>{vista.nombre ?? ROTULO_ROL[vista.rol]}</strong>, {ROTULO_ROL[vista.rol].toLowerCase()} de {vista.orgNombre}
                  {vista.rol !== 'titular' && vista.areas.length > 0 ? ` (${vista.areas.join(', ')})` : ''}. Solo lectura.
                </span>
                <button type="button" onClick={salirVistaPrevia} className="font-medium underline underline-offset-4 hover:no-underline min-h-[40px]">
                  Salir de la vista
                </button>
              </div>
            </div>
          )}

          {!conexion && (
            <div role="status" className="bg-aviso-suave text-aviso text-[13.5px] font-medium">
              <div className="wrap flex items-center gap-2.5 py-2.5">
                <WifiOff size={16} aria-hidden="true" className="shrink-0" />
                Sin conexión. Lo que ves puede estar desactualizado y los cambios no se guardan hasta que vuelva.
              </div>
            </div>
          )}

          <main id="contenido" tabIndex={-1} className={`flex-1 focus:outline-none ${ancho === 'angosto' ? 'wrap max-w-[560px] py-10' : ''}`}>
            {children}
          </main>

          <footer className="wrap w-full">
            <p className="py-6 border-t border-separador text-[12.5px] text-piedra leading-relaxed">
              Portal de clientes de FIRMA · Información confidencial, alcanzada por el secreto profesional ·{' '}
              <a href="mailto:agustin@firmasvc.com" className="underline underline-offset-2 hover:text-bosque">
                agustin@firmasvc.com
              </a>
            </p>
          </footer>
        </div>

        {/* Barra inferior del celular */}
        {perfil && inferiores.length > 0 && (
          <nav aria-label="Secciones principales" className="desk:hidden fixed inset-x-0 bottom-0 z-40 bg-papel border-t border-borde-suave pb-[env(safe-area-inset-bottom)]">
            <div className="grid" style={{ gridTemplateColumns: `repeat(${inferiores.length + 1}, minmax(0, 1fr))` }}>
              {inferiores.map((x) => {
                const Icono = x.icono;
                const n = x.clave === 'asuntos' ? contadores.asuntos : x.clave === 'firmas' ? contadores.firmas : undefined;
                return (
                  <Enlace
                    key={x.clave}
                    a={x.a}
                    aria-current={x.activo ? 'page' : undefined}
                    className={`relative flex flex-col items-center justify-center gap-1 h-16 text-[11.5px] ${x.activo ? 'text-bosque font-semibold' : 'text-piedra'}`}
                  >
                    {x.activo && <span aria-hidden="true" className="absolute top-0 inset-x-[28%] h-[3px] rounded-b-full bg-tinta" />}
                    <span className="relative">
                      <Icono size={21} strokeWidth={1.75} aria-hidden="true" />
                      {n ? (
                        <span className="absolute -top-1.5 -right-2.5 min-w-[17px] h-[17px] px-1 grid place-items-center rounded-pastilla bg-bosque text-marfil text-[10.5px] font-semibold tabular-nums" aria-label={`${n} pendientes`}>
                          {n}
                        </span>
                      ) : null}
                    </span>
                    {x.corto}
                  </Enlace>
                );
              })}
              <button type="button" onClick={() => setMenu(true)} aria-haspopup="dialog" aria-expanded={menu} aria-label="Más secciones" className="flex flex-col items-center justify-center gap-1 h-16 text-[11.5px] text-piedra">
                <Menu size={21} strokeWidth={1.75} aria-hidden="true" />
                Más
              </button>
            </div>
          </nav>
        )}

        <PanelMenu abierto={menu} alCerrar={() => setMenu(false)}>
          {menuCelular}
        </PanelMenu>

        {perfil && permisos && (
          <>
            <PanelAvisos />
            <Buscador perfil={perfil} orgId={perfil.rol === 'admin' ? null : perfil.organizacion_id} secciones={accesosDe(perfil, permisos, secciones)} />
          </>
        )}

        {/* Tina está desactivada desde el 26 de noviembre de 2026 (TINA_ACTIVA). Con la llave prendida atiende a los
            usuarios de los clientes Eminent; FIRMA, la vista previa y Starter no la ven. */}
        {TINA_ACTIVA && perfil && perfil.rol !== 'admin' && !vista && perfil.organizacion_id && org?.plan !== 'starter' && (
          // Si el chat falla, se oculta la burbuja y el resto del portal sigue andando.
          <LimiteError respaldo={null}>
            <BurbujaTina nombre={perfil.nombre ?? null} />
          </LimiteError>
        )}
      </div>
      </PanelSeccionCtx.Provider>
    </DensidadBotones.Provider>
  );
};

/* ------------------------------------------------------------------ */
/* Encabezado de página, a escala de aplicación                        */
/* ------------------------------------------------------------------ */
export const Encabezado: React.FC<{
  eyebrow?: React.ReactNode;
  titulo: React.ReactNode;
  bajada?: React.ReactNode;
  acciones?: React.ReactNode;
  grande?: boolean;
}> = ({ eyebrow, titulo, bajada, acciones, grande }) => (
  <section className="wrap pt-8 pb-2 desk:pt-12">
    <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
      <div className="flex flex-col gap-3 min-w-0 max-w-[820px]">
        {eyebrow && <p className="p-volanta text-piedra">{eyebrow}</p>}
        <h1 className={grande ? 'p-titulo-grande' : 'p-titulo'}>{titulo}</h1>
        {bajada && <p className="text-piedra text-[16px] leading-[1.5] max-w-[62ch]">{bajada}</p>}
      </div>
      {acciones && (
        // En el celular las acciones van en una fila que se desliza, así no empujan el contenido hacia abajo.
        <div className="relative flex flex-nowrap tab:flex-wrap items-center gap-2.5 max-w-full overflow-x-auto scrollbar-hide -mx-4 px-4 tab:mx-0 tab:px-0 [&>*]:shrink-0 max-tab:[&>.bg-bosque]:-order-1">
          {acciones}
        </div>
      )}
    </div>
  </section>
);

/* ------------------------------------------------------------------ */
/* Cifras al estilo del contador del hero                              */
/* ------------------------------------------------------------------ */
export interface Cifra {
  titulo: string;
  valor: React.ReactNode;
  alerta?: boolean;
  nota?: React.ReactNode;
}

/** Monto con la moneda chica adelante, como el contador del hero. Los soles van con S/. */
export const Monto: React.FC<{ n: number | null | undefined; moneda?: string }> = ({ n, moneda = 'USD' }) => (
  <>
    <span className="text-[0.48em] font-bold text-piedra mr-1.5 align-[0.3em] tracking-normal">{simboloMoneda(moneda)}</span>
    {n === null || n === undefined ? '·' : Math.round(Number(n)).toLocaleString('es-AR')}
  </>
);

/** Totales de varias monedas, uno por renglón y sin convertir. Con una sola moneda es un Monto común. */
export const MontosPorMoneda: React.FC<{ montos: Record<string, number> }> = ({ montos }) => {
  const claves = Object.keys(montos).sort((a, b) => (a === 'USD' ? -1 : b === 'USD' ? 1 : a.localeCompare(b)));
  if (claves.length <= 1) return <Monto n={claves.length ? montos[claves[0]] : 0} moneda={claves[0] ?? 'USD'} />;
  return (
    <span className="flex flex-col gap-1.5">
      {claves.map((m) => (
        <span key={m}>
          <Monto n={montos[m]} moneda={m} />
        </span>
      ))}
    </span>
  );
};

export const Cifras: React.FC<{ items: Cifra[]; cargando?: boolean }> = ({ items, cargando }) => (
  <div className="cifras">
    {items.map((c) => (
      <div key={c.titulo} className="cifra">
        <span className={`cifra-valor ${c.alerta ? 'text-peligro' : 'text-bosque'}`}>{cargando ? '·' : c.valor}</span>
        <span className="eyebrow stat-label text-piedra">{c.titulo}</span>
        {c.nota && <span className="text-xs text-piedra">{c.nota}</span>}
      </div>
    ))}
  </div>
);

/* ------------------------------------------------------------------ */
/* Título de sección                                                    */
/* ------------------------------------------------------------------ */
export const TituloSeccion: React.FC<{ eyebrow?: string; titulo: React.ReactNode; acciones?: React.ReactNode }> = ({ eyebrow, titulo, acciones }) => (
  <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
    <div className="flex flex-col gap-2">
      {eyebrow && <p className="eyebrow text-piedra">{eyebrow}</p>}
      <h2 className="h3">{titulo}</h2>
    </div>
    {acciones && <div className="flex flex-wrap gap-3">{acciones}</div>}
  </div>
);

/** Bloque de una ficha: tarjeta con un solo título y sus acciones a la derecha. Sin volanta arriba. */
export const Bloque: React.FC<{ titulo: React.ReactNode; acciones?: React.ReactNode; children: React.ReactNode; sinRelleno?: boolean }> = ({ titulo, acciones, children, sinRelleno }) => (
  <section className="bg-papel border border-borde-suave rounded-[18px] min-w-0">
    <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-b border-separador">
      <h2 className="font-heading font-bold text-[17px] leading-tight tracking-[-0.02em]">{titulo}</h2>
      {acciones && <div className="flex flex-wrap gap-2">{acciones}</div>}
    </div>
    <div className={sinRelleno ? 'min-w-0' : 'px-5 py-4 min-w-0'}>{children}</div>
  </section>
);

/* ------------------------------------------------------------------ */
/* Pestañas con subrayado verde                                         */
/* ------------------------------------------------------------------ */
export function Pestanas<T extends string>({ items, activa, alCambiar }: { items: { clave: T; titulo: string; cuenta?: number }[]; activa: T; alCambiar: (c: T) => void }) {
  return (
    <div className="flex gap-6 overflow-x-auto scrollbar-hide border-b border-borde-suave" role="tablist">
      {items.map((i) => (
        <button
          key={i.clave}
          type="button"
          role="tab"
          aria-selected={activa === i.clave}
          onClick={() => alCambiar(i.clave)}
          className={`inline-flex items-center gap-1.5 min-h-[44px] -mb-px text-[14px] font-medium whitespace-nowrap border-b-2 transition-colors duration-150 ${activa === i.clave ? 'border-bosque text-bosque' : 'border-transparent text-piedra hover:text-tinta'}`}
        >
          {i.titulo}
          {i.cuenta !== undefined && (
            <span className={`min-w-[20px] h-[20px] px-1.5 grid place-items-center rounded-pastilla tabular-nums text-[11.5px] ${activa === i.clave ? 'bg-bosque-suave text-bosque' : 'bg-separador text-piedra'}`}>{i.cuenta}</span>
          )}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Interruptor                                                          */
/* ------------------------------------------------------------------ */
export const Interruptor: React.FC<{ activo: boolean; alCambiar?: (v: boolean) => void; etiqueta: string; ayuda?: string; deshabilitado?: boolean }> = ({ activo, alCambiar, etiqueta, ayuda, deshabilitado }) => (
  <label className={`inline-flex items-start gap-3 ${deshabilitado ? 'opacity-60' : 'cursor-pointer'}`}>
    <button
      type="button"
      role="switch"
      aria-checked={activo}
      disabled={deshabilitado}
      onClick={() => alCambiar?.(!activo)}
      className={`relative shrink-0 w-11 h-6 mt-0.5 border rounded-control transition-colors duration-150 ${activo ? 'bg-bosque border-bosque' : 'bg-white border-borde'}`}
    >
      <span className={`absolute top-[3px] w-4 h-4 transition-all duration-150 ${activo ? 'left-[23px] bg-marfil' : 'left-[3px] bg-tinta'}`} />
    </button>
    <span className="flex flex-col">
      <span className="text-sm font-medium">{etiqueta}</span>
      {ayuda && <span className="text-xs text-piedra mt-0.5 max-w-[42ch]">{ayuda}</span>}
    </span>
  </label>
);

/* ------------------------------------------------------------------ */
/* Formularios                                                         */
/* ------------------------------------------------------------------ */
export const Campo: React.FC<{ etiqueta: string; ayuda?: string; children: React.ReactNode }> = ({ etiqueta, ayuda, children }) => (
  <label className="block">
    <span className="block text-[13px] font-medium text-tinta mb-1.5">{etiqueta}</span>
    {children}
    {ayuda && <span className="block text-[12.5px] leading-[1.45] text-piedra mt-1.5">{ayuda}</span>}
  </label>
);

/** Borde con 3,6 a 1 sobre blanco (WCAG pide 3 a 1) y foco de 2 px en tinta. */
export const claseInput =
  'w-full h-11 px-3.5 bg-white border border-borde rounded-control text-[15px] placeholder:text-piedra/70 transition-[border-color,box-shadow] duration-150 hover:border-tinta focus:outline-none focus:border-bosque focus:ring-2 focus:ring-bosque/25 disabled:bg-marfil-oscuro disabled:text-piedra disabled:hover:border-borde';

export const Aviso: React.FC<{ tipo?: 'error' | 'ok' | 'info'; children: React.ReactNode }> = ({ tipo = 'info', children }) => {
  const estilos = {
    error: 'border-peligro-borde bg-peligro-suave text-peligro-fuerte',
    ok: 'border-borde-suave bg-niebla text-tinta',
    info: 'border-borde-suave bg-papel text-tinta',
  }[tipo];
  return (
    <div role={tipo === 'error' ? 'alert' : 'status'} className={`border rounded-control px-4 py-3 text-sm leading-[1.5] ${estilos}`}>
      {children}
    </div>
  );
};

export const Cargando: React.FC = () => (
  <div className="min-h-screen bg-marfil flex flex-col items-center justify-center gap-4">
    <img src={simboloClaro} alt="" aria-hidden="true" className="w-16 opacity-30 animate-pulse" />
    <span className="eyebrow text-piedra">Cargando</span>
  </div>
);

/** Estado con punto de color, en el registro tipográfico de los eyebrow. */
export const Etiqueta: React.FC<{ children: React.ReactNode; tono?: 'bosque' | 'piedra' | 'alerta' | 'tinta' }> = ({ children, tono = 'piedra' }) => {
  const c = {
    bosque: 'text-marfil bg-tinta',
    piedra: 'text-tinta bg-niebla',
    alerta: 'text-peligro bg-peligro-suave',
    tinta: 'text-tinta bg-transparent ring-1 ring-inset ring-tinta',
  }[tono];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-[3px] rounded-pastilla text-[12px] font-semibold whitespace-nowrap ${c}`}>
      <span aria-hidden="true" className="w-1.5 h-1.5 rounded-full bg-current" />
      {children}
    </span>
  );
};

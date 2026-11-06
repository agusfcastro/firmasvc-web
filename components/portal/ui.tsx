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
  ReceiptText,
  ScrollText,
  ShieldCheck,
  Wallet,
  X,
  type LucideIcon,
} from 'lucide-react';
import { DensidadBotones } from '../Button';
import { supabase } from './supabase';
import { navegar } from './navegacion';
import { salirVistaPrevia, useVistaPrevia } from './vistaPrevia';
import { useLogoOrg } from './logos';
import { ROTULO_ROL, cargoDe, permisosDe, veAsuntos, type Perfil, type Permisos } from './tipos';
import { ROTULO_PLAN, type Plan } from './planes';
import { BurbujaTina } from './tina/BurbujaTina';

import simboloClaro from '../../assets/brand/simbolo-claro.png';
import simboloOscuro from '../../assets/brand/simbolo-oscuro.png';
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
  // Solo esta sesión: sin scope, Supabase cierra la cuenta en todos los dispositivos.
  await supabase?.auth.signOut({ scope: 'local' });
  navegar('/portal/ingresar');
}

/* ------------------------------------------------------------------ */
/* Secciones del portal según el rol                                   */
/* ------------------------------------------------------------------ */
type ClaveSeccion = 'inicio' | 'asuntos' | 'firmas' | 'documentos' | 'protocolos' | 'crm' | 'comprobantes' | 'agenda' | 'pagos' | 'bitacora' | 'admin';

interface Seccion {
  clave: ClaveSeccion;
  a: string;
  titulo: string;
  /** Rótulo corto para la barra inferior del celular. */
  corto: string;
  icono: LucideIcon;
  grupo: 'expediente' | 'negocio' | 'firma';
  activo: boolean;
}

function seccionesDe(perfil: Perfil, permisos: Permisos, ruta: string): Seccion[] {
  const s = (clave: ClaveSeccion, a: string, titulo: string, corto: string, icono: LucideIcon, grupo: Seccion['grupo'], activo: boolean): Seccion => ({ clave, a, titulo, corto, icono, grupo, activo });
  return [
    s('inicio', '/portal', 'Inicio', 'Inicio', House, 'expediente', ruta === '/portal'),
    ...(veAsuntos(perfil) ? [s('asuntos', '/portal/asuntos', 'Asuntos', 'Asuntos', BriefcaseBusiness, 'expediente', ruta.startsWith('/portal/asuntos'))] : []),
    ...(permisos.documentosLegales ? [s('firmas', '/portal/firmas', 'Firmas', 'Firmas', FileSignature, 'expediente', ruta.startsWith('/portal/firmas'))] : []),
    ...(permisos.documentosLegales
      ? [s('documentos', '/portal/documentos', 'Documentos', 'Documentos', FileText, 'expediente', ruta.startsWith('/portal/documentos') || ruta.startsWith('/portal/pedidos'))]
      : []),
    s('protocolos', '/portal/protocolos', 'Protocolos', 'Protocolos', BookOpen, 'expediente', ruta === '/portal/protocolos'),
    ...(permisos.crm
      ? [
          s('crm', '/portal/crm', 'Clientes', 'Clientes', Kanban, 'negocio', ruta.startsWith('/portal/crm') && !ruta.startsWith('/portal/crm/comprobantes')),
          s('comprobantes', '/portal/crm/comprobantes', 'Invoices y recibos', 'Recibos', ReceiptText, 'negocio', ruta.startsWith('/portal/crm/comprobantes')),
        ]
      : []),
    ...(permisos.agenda ? [s('agenda', '/portal/agenda', 'Agenda', 'Agenda', CalendarDays, 'negocio', ruta === '/portal/agenda')] : []),
    // Pagos solo para titulares y FIRMA. El resto del equipo no ve nada de pagos.
    ...(permisos.gestion ? [s('pagos', '/portal/pagos', 'Pagos', 'Pagos', Wallet, 'negocio', ruta === '/portal/pagos')] : []),
    ...(perfil.rol === 'titular' ? [s('bitacora', '/portal/bitacora', 'Bitácora', 'Bitácora', ScrollText, 'negocio', ruta === '/portal/bitacora')] : []),
    ...(perfil.rol === 'admin' ? [s('admin', '/portal/admin', 'Administración', 'Admin', ShieldCheck, 'firma', ruta.startsWith('/portal/admin'))] : []),
  ];
}

const TITULO_GRUPO: Record<Seccion['grupo'], string> = { expediente: 'Expediente', negocio: 'Tu negocio', firma: 'FIRMA' };

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
function useMisNegocios(perfil: Perfil | null | undefined): Negocio[] {
  const [negocios, setNegocios] = useState<Negocio[]>([]);
  useEffect(() => {
    if (!supabase || !perfil || perfil.rol === 'admin') return;
    let vigente = true;
    void supabase
      .from('organizaciones')
      .select('id, nombre')
      .order('nombre')
      .then(({ data }) => {
        if (vigente) setNegocios((data as Negocio[]) ?? []);
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
const Lateral: React.FC<{
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
  const grupos = (['expediente', 'negocio', 'firma'] as const).map((g) => ({ g, items: secciones.filter((x) => x.grupo === g) })).filter((x) => x.items.length);
  const cuenta = (c: ClaveSeccion) => (c === 'asuntos' ? contadores.asuntos : c === 'firmas' ? contadores.firmas : undefined);
  const nombre = perfil.nombre || perfil.email;
  const tieneAgenda = secciones.some((x) => x.clave === 'agenda');
  const negocios = useMisNegocios(!vista && perfil.rol !== 'admin' ? perfil : null);
  const varios = negocios.length > 1;
  const titulos = esAdmin ? { expediente: 'Clientes', negocio: 'Gestión', firma: 'FIRMA' } : TITULO_GRUPO;

  return (
    <div className="lateral relative flex flex-col gap-5 min-h-full px-4 pt-6 pb-4 bg-tinta text-lateral-texto overflow-hidden">
      <img src={simboloOscuro} alt="" aria-hidden="true" className="absolute -right-20 bottom-28 w-[300px] max-w-none opacity-[0.05] pointer-events-none select-none" />

      <Enlace a="/portal" onClick={alElegir} className="relative self-start px-2 py-1" aria-label="Inicio del portal">
        <img src={palabraOscura} alt="firma" className="h-[26px] w-auto" />
      </Enlace>

      <div className={`relative flex items-center gap-3 p-3 rounded-[14px] border border-marfil/10 bg-marfil/[0.04] ${varios ? 'hover:bg-marfil/[0.08] focus-within:outline focus-within:outline-2 focus-within:outline-marfil' : ''}`}>
        {logoCliente && !esAdmin ? (
          <span className="w-9 h-9 shrink-0 rounded-[10px] bg-white grid place-items-center overflow-hidden">
            <img src={logoCliente} alt="" className="max-w-[30px] max-h-[30px] object-contain" />
          </span>
        ) : (
          <span aria-hidden="true" className="w-9 h-9 shrink-0 rounded-[10px] grid place-items-center bg-marfil text-tinta text-[13px] font-bold">
            {esAdmin ? 'F' : iniciales(orgNombre ?? '·')}
          </span>
        )}
        <span className="flex flex-col min-w-0 leading-tight">
          <span className="text-marfil text-[14px] font-medium truncate">{esAdmin ? 'FIRMA' : orgNombre ?? '·'}</span>
          <span className="text-[12.5px] text-lateral-tenue truncate mt-0.5">{esAdmin ? 'Administración' : [cargoDe(perfil), orgPlan ? `Plan ${ROTULO_PLAN[orgPlan]}` : null].filter(Boolean).join(' · ')}</span>
        </span>
        {varios && (
          <>
            <ChevronsUpDown size={16} aria-hidden="true" className="ml-auto shrink-0 text-lateral-tenue" />
            <SelectorNegocio perfil={perfil} negocios={negocios} />
          </>
        )}
      </div>

      <nav aria-label="Secciones del portal" className="relative flex flex-col gap-5">
        {grupos.map(({ g, items }) => (
          <div key={g} className="flex flex-col gap-0.5">
            <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.16em] [font-stretch:125%] text-lateral-tenue">{titulos[g]}</p>
            {items.map((x) => {
              const Icono = x.icono;
              const n = cuenta(x.clave);
              return (
                <Enlace
                  key={x.clave}
                  a={x.a}
                  onClick={alElegir}
                  aria-current={x.activo ? 'page' : undefined}
                  className={`relative flex items-center gap-3 min-h-[40px] px-3 rounded-[10px] text-[14.5px] transition-colors duration-150 ${x.activo ? 'bg-grafito text-marfil font-semibold' : 'hover:bg-marfil/[0.06] hover:text-marfil'}`}
                >
                  <Icono size={18} strokeWidth={1.75} aria-hidden="true" className="shrink-0" />
                  <span className="flex-1 truncate">{x.titulo}</span>
                  {n ? (
                    <span className="min-w-[22px] h-[22px] px-1.5 grid place-items-center rounded-pastilla bg-marfil text-tinta text-[12px] font-bold tabular-nums" aria-label={`${n} pendientes`}>
                      {n}
                    </span>
                  ) : null}
                </Enlace>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="relative mt-auto flex flex-col gap-4">
        {tieneAgenda && !esAdmin && (
          <div className="p-4 rounded-[14px] border border-marfil/10 bg-marfil/[0.05] [@media(max-height:880px)]:hidden">
            <p className="font-bold text-marfil text-[15px] tracking-[-0.01em]">¿Una duda legal?</p>
            <p className="text-[13px] leading-[1.45] mt-1 mb-3">Agendá 30 minutos con Agustín Castro y salís con la respuesta.</p>
            <Enlace a="/portal/agenda" onClick={alElegir} className="inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-marfil hover:underline underline-offset-4">
              Agendar reunión <ChevronRight size={15} aria-hidden="true" />
            </Enlace>
          </div>
        )}
        <div className="flex items-center gap-3 pt-4 px-1 border-t border-marfil/10">
          <span aria-hidden="true" className="w-8 h-8 shrink-0 rounded-full grid place-items-center bg-grafito text-marfil text-[12px] font-bold">
            {iniciales(nombre)}
          </span>
          <span className="flex flex-col min-w-0 flex-1 leading-tight">
            <span className="text-marfil text-[13.5px] font-medium truncate">{nombre}</span>
            <span className="text-[12px] text-lateral-tenue truncate">{perfil.nombre ? perfil.email : ROTULO_ROL[perfil.rol]}</span>
          </span>
          <button type="button" onClick={salir} aria-label="Salir del portal" title="Salir" className="w-10 h-10 grid place-items-center shrink-0 rounded-[10px] text-lateral-tenue hover:text-marfil hover:bg-marfil/[0.06]">
            <LogOut size={17} aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
};

/** Panel del menú en el celular, con la misma barra lateral. */
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
    <div className="desk:hidden fixed inset-0 z-50 flex" role="dialog" aria-modal="true" aria-label="Menú del portal">
      <button type="button" aria-label="Cerrar el menú" tabIndex={-1} onClick={alCerrar} className="absolute inset-0 bg-tinta/55" />
      <div className="relative ml-auto h-full w-[min(320px,88vw)] overflow-y-auto bg-tinta">
        <button ref={cerrarRef} type="button" onClick={alCerrar} aria-label="Cerrar el menú" className="absolute right-3 top-5 z-10 w-10 h-10 grid place-items-center text-lateral-texto hover:text-marfil">
          <X size={20} aria-hidden="true" />
        </button>
        {children}
      </div>
    </div>
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

  // La barra inferior muestra las cuatro secciones que más se usan. El resto vive en Más.
  const ORDEN_INFERIOR: ClaveSeccion[] = ['inicio', 'asuntos', 'firmas', 'documentos', 'crm', 'protocolos', 'agenda', 'pagos', 'admin'];
  const inferiores = ORDEN_INFERIOR.map((c) => secciones.find((x) => x.clave === c)).filter((x): x is Seccion => Boolean(x)).slice(0, 4);
  const lateral = perfil ? (
    <Lateral perfil={perfil} secciones={secciones} contadores={contadores} orgNombre={vista?.orgNombre ?? org?.nombre ?? null} orgPlan={org?.plan ?? null} logoCliente={logoCliente} vista={Boolean(vista)} alElegir={() => setMenu(false)} />
  ) : null;

  return (
    <DensidadBotones.Provider value="compacta">
      <div className="portal min-h-screen bg-marfil text-tinta desk:grid desk:grid-cols-[264px_minmax(0,1fr)]">
        {lateral && (
          <div className="hidden desk:block bg-tinta">
            <aside className="sticky top-0 h-screen overflow-y-auto scrollbar-hide" aria-label="Barra lateral">
              {lateral}
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
              <button type="button" onClick={() => setMenu(true)} aria-label="Abrir el menú" aria-expanded={menu} className="w-10 h-10 -mr-2 grid place-items-center shrink-0 rounded-[10px] hover:bg-marfil/[0.06]">
                <Menu size={20} aria-hidden="true" />
              </button>
            )}
          </header>

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

          <main className={`flex-1 ${ancho === 'angosto' ? 'wrap max-w-[560px] py-10' : ''}`}>{children}</main>

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
              <button type="button" onClick={() => setMenu(true)} className="flex flex-col items-center justify-center gap-1 h-16 text-[11.5px] text-piedra">
                <Menu size={21} strokeWidth={1.75} aria-hidden="true" />
                Más
              </button>
            </div>
          </nav>
        )}

        <PanelMenu abierto={menu} alCerrar={() => setMenu(false)}>
          {lateral}
        </PanelMenu>

        {/* Tina atiende a los usuarios de los clientes. FIRMA y la vista previa no la ven. */}
        {perfil && perfil.rol !== 'admin' && !vista && perfil.organizacion_id && <BurbujaTina nombre={perfil.nombre ?? null} />}
      </div>
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

/** Monto con la moneda chica adelante, como el contador del hero. */
export const Monto: React.FC<{ n: number | null | undefined; moneda?: string }> = ({ n, moneda = 'USD' }) => (
  <>
    <span className="text-[0.48em] font-bold text-piedra mr-1.5 align-[0.3em] tracking-normal">{moneda}</span>
    {n === null || n === undefined ? '·' : Math.round(Number(n)).toLocaleString('es-AR')}
  </>
);

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

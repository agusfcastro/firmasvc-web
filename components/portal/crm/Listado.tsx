import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CalendarDays, ChevronLeft, ChevronRight, Download, GanttChart, Layers, List, Phone, Plus, ReceiptText, Search, ShieldAlert, Users } from 'lucide-react';
import { Button } from '../../Button';
import { supabase } from '../supabase';
import { navegar } from '../navegacion';
import { Aviso, Cifras, Encabezado, Enlace, Etiqueta, MontosPorMoneda, Pestanas, claseInput } from '../ui';
import { useVistaPrevia } from '../vistaPrevia';
import { TONO_FIRMA, dinero, fecha, hoyISO, type ClienteResumen, type IntegranteEquipo } from './tipos';
import { TIPO_REUNION, fechaHora, type TipoReunion } from './reuniones';
import { LineaTiempo } from './LineaTiempo';
import { mensajeAmable } from '../errores';

type Filtro = 'todos' | 'vencidas' | 'revisar' | 'Pendiente' | 'En firma' | 'Firmado' | 'Baja' | 'sin_reunion';

const FILTROS: { clave: Filtro; titulo: string }[] = [
  { clave: 'todos', titulo: 'Todos' },
  { clave: 'vencidas', titulo: 'Vencidas' },
  { clave: 'Pendiente', titulo: 'Firma pendiente' },
  { clave: 'En firma', titulo: 'En firma' },
  { clave: 'Firmado', titulo: 'Firmados' },
  { clave: 'Baja', titulo: 'Bajas' },
  { clave: 'revisar', titulo: 'A revisar' },
  { clave: 'sin_reunion', titulo: 'Sin reunión agendada' },
];

/** Filtros por persona y servicio. Vacío es todos; «sin» es sin asignar. */
interface Filtros {
  am: string;
  closer: string;
  setter: string;
  servicio: string;
}
const SIN_FILTROS: Filtros = { am: '', closer: '', setter: '', servicio: '' };

interface ProximaReunion {
  inicio: string;
  tipo: TipoReunion | null;
}

function csv(filas: ClienteResumen[], nombre: (id: string | null | undefined) => string | null, proxima: (id: string) => ProximaReunion | undefined): string {
  const cols: [string, (c: ClienteResumen) => unknown][] = [
    ['Código', (c) => c.codigo],
    ['Nombre o razón social', (c) => c.nombre],
    ['Tipo', (c) => (c.tipo === 'empresa' ? 'Empresa' : 'Persona')],
    ['Identificación fiscal', (c) => c.id_fiscal],
    ['Representante', (c) => c.representante],
    ['DNI', (c) => c.dni],
    ['Email', (c) => c.email],
    ['Servicio', (c) => c.servicio],
    ['Moneda', (c) => c.moneda],
    ['Monto total', (c) => c.monto_total],
    ['Cobrado', (c) => c.cobrado],
    ['Pendiente', (c) => c.pendiente],
    ['Próximo vencimiento', (c) => c.proximo_vencimiento],
    ['Cuotas pactadas', (c) => c.cuotas_pactadas],
    ['Cuotas vencidas', (c) => c.cuotas_vencidas],
    ['Monto próxima cuota', (c) => c.proxima_cuota_monto],
    ['Por cobrar en 30 días', (c) => c.por_cobrar_30_dias],
    ['Estado firma', (c) => c.estado_firma],
    ['Account Manager', (c) => nombre(c.responsable_id) ?? c.responsable],
    ['Closer', (c) => nombre(c.closer_id)],
    ['Setter', (c) => nombre(c.setter_id)],
    ['Próxima reunión', (c) => proxima(c.id)?.inicio.slice(0, 16).replace('T', ' ')],
    ['Onboarding', (c) => c.fecha_onboarding?.slice(0, 16).replace('T', ' ')],
    ['Notas', (c) => c.notas],
  ];
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.map((c) => c[0]).join(';'), ...filas.map((f) => cols.map(([, g]) => esc(g(f))).join(';'))].join('\n');
}

/** Cómo terminó el último envío a firma, cuando no se firmó. */
const ENVIO_FALLIDO: Record<string, string> = { rechazado: 'Firma rechazada', vencido: 'Envío vencido', anulado: 'Envío anulado' };

export const Listado: React.FC<{ orgId: string; orgNombre: string; selector?: React.ReactNode; cobranza: boolean; interruptor?: React.ReactNode; verCasos?: boolean }> = ({
  orgId,
  orgNombre,
  selector,
  cobranza,
  interruptor,
  verCasos = true,
}) => {
  const [filas, setFilas] = useState<ClienteResumen[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [busqueda, setBusqueda] = useState('');
  const [pagina, setPagina] = useState(0);
  const [porPagina, setPorPagina] = useState<number>(() => {
    try {
      const v = Number(window.localStorage.getItem('firma-crm-por-pagina'));
      return [10, 20, 50].includes(v) ? v : 20;
    } catch {
      return 20;
    }
  });
  const soloLectura = Boolean(useVistaPrevia());

  // Casos de conflicto en curso, para el acceso del encabezado. Sin la migración 0007 no se muestra el número.
  const [casosAbiertos, setCasosAbiertos] = useState<number | null>(null);
  useEffect(() => {
    if (!supabase) return;
    let vigente = true;
    supabase
      .from('crm_casos')
      .select('id', { count: 'exact', head: true })
      .eq('organizacion_id', orgId)
      .neq('etapa', 'cerrado')
      .then(({ count, error: e }) => {
        if (vigente) setCasosAbiertos(e ? null : (count ?? 0));
      });
    return () => {
      vigente = false;
    };
  }, [orgId]);

  // Último envío a firma de cada cliente. Si se rechazó, venció o se anuló y el cliente sigue pendiente, se avisa en la fila.
  const [envioFallido, setEnvioFallido] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!supabase) return;
    let vigente = true;
    supabase
      .from('firma_sobres')
      .select('crm_cliente_id, estado')
      .eq('organizacion_id', orgId)
      .not('crm_cliente_id', 'is', null)
      .order('creado_en', { ascending: false })
      .limit(1000)
      .then(({ data }) => {
        if (!vigente) return;
        const ultimo: Record<string, string> = {};
        for (const x of (data ?? []) as { crm_cliente_id: string; estado: string }[]) if (!(x.crm_cliente_id in ultimo)) ultimo[x.crm_cliente_id] = x.estado;
        setEnvioFallido(Object.fromEntries(Object.entries(ultimo).filter(([, e]) => e in ENVIO_FALLIDO)));
      });
    return () => {
      vigente = false;
    };
  }, [orgId]);

  // Closer y responsable salen del equipo comercial (migración del equipo). El texto libre queda de respaldo.
  const [equipo, setEquipo] = useState<IntegranteEquipo[]>([]);
  useEffect(() => {
    if (!supabase) return;
    supabase
      .from('equipo_miembros')
      .select('*')
      .eq('organizacion_id', orgId)
      .then(({ data }) => setEquipo((data as IntegranteEquipo[]) ?? []));
  }, [orgId]);
  const nombreEquipo = (id: string | null | undefined) => (id ? equipo.find((m) => m.id === id)?.nombre ?? null : null);

  // Filtros por Account Manager, closer, setter y servicio. Quedan guardados por empresa.
  const claveFiltros = `firma-crm-filtros:${orgId}`;
  const [filtros, setFiltros] = useState<Filtros>(SIN_FILTROS);
  useEffect(() => {
    try {
      const guardados = JSON.parse(window.localStorage.getItem(claveFiltros) || 'null') as Partial<Filtros> | null;
      setFiltros({ ...SIN_FILTROS, ...(guardados ?? {}) });
    } catch {
      setFiltros(SIN_FILTROS);
    }
  }, [claveFiltros]);
  function cambiarFiltro(campo: keyof Filtros, valor: string) {
    const nuevos = { ...filtros, [campo]: valor };
    setFiltros(nuevos);
    try {
      window.localStorage.setItem(claveFiltros, JSON.stringify(nuevos));
    } catch {
      /* sin almacenamiento */
    }
  }
  const hayFiltros = Object.values(filtros).some(Boolean);

  // Lista o línea de tiempo. Queda guardada para la próxima vez.
  const [vista, setVista] = useState<'lista' | 'tiempo'>(() => {
    try {
      return window.localStorage.getItem('firma-crm-vista') === 'tiempo' ? 'tiempo' : 'lista';
    } catch {
      return 'lista';
    }
  });
  function cambiarVista(v: 'lista' | 'tiempo') {
    setVista(v);
    try {
      window.localStorage.setItem('firma-crm-vista', v);
    } catch {
      /* sin almacenamiento */
    }
  }

  // Duración de cada servicio en meses (0079), para el fin del contrato.
  const [duraciones, setDuraciones] = useState<Record<string, number>>({});
  useEffect(() => {
    if (!supabase) return;
    let vigente = true;
    supabase
      .from('crm_servicios')
      .select('*')
      .eq('organizacion_id', orgId)
      .then(({ data }) => {
        if (!vigente) return;
        const mapa: Record<string, number> = {};
        for (const s of (data ?? []) as { clave: string; duracion_meses?: number | null }[]) if (s.duracion_meses) mapa[s.clave] = s.duracion_meses;
        setDuraciones(mapa);
      });
    return () => {
      vigente = false;
    };
  }, [orgId]);

  // Próxima reunión agendada de cada cliente y reuniones que falta completar (sin tipo o agendadas que ya pasaron).
  const [proximas, setProximas] = useState<Record<string, ProximaReunion>>({});
  const [porCompletar, setPorCompletar] = useState<number | null>(null);
  useEffect(() => {
    if (!supabase) return;
    let vigente = true;
    const ahora = new Date().toISOString();
    Promise.all([
      supabase.from('crm_reuniones').select('cliente_id, inicio, tipo').eq('organizacion_id', orgId).eq('estado', 'agendada').gte('inicio', ahora).not('cliente_id', 'is', null).order('inicio').limit(2000),
      supabase
        .from('crm_reuniones')
        .select('id', { count: 'exact', head: true })
        .eq('organizacion_id', orgId)
        .or(`tipo.is.null,and(estado.eq.agendada,inicio.lt.${ahora})`),
    ]).then(([a, b]) => {
      if (!vigente) return;
      // Sin la migración 0078 la tabla no existe: no se muestra nada de reuniones.
      const mapa: Record<string, ProximaReunion> = {};
      for (const r of (a.data ?? []) as { cliente_id: string; inicio: string; tipo: TipoReunion | null }[]) if (!(r.cliente_id in mapa)) mapa[r.cliente_id] = { inicio: r.inicio, tipo: r.tipo };
      setProximas(mapa);
      setPorCompletar(b.error ? null : (b.count ?? 0));
    });
    return () => {
      vigente = false;
    };
  }, [orgId]);
  const conRol = (roles: string[], campo: 'responsable_id' | 'closer_id' | 'setter_id') =>
    equipo
      .filter((m) => (m.activo && roles.includes(m.rol_comercial)) || filas.some((f) => f[campo] === m.id))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  const opcionesAm = conRol(['account_manager', 'csm'], 'responsable_id');
  const opcionesCloser = conRol(['closer'], 'closer_id');
  const opcionesSetter = conRol(['setter'], 'setter_id');
  const servicios = Array.from(new Set(filas.map((f) => f.servicio).filter((x): x is string => Boolean(x)))).sort((a, b) => a.localeCompare(b, 'es'));

  const cobranzaRef = cobranza;
  useEffect(() => {
    if (!supabase) return;
    setCargando(true);
    supabase
      .from('crm_clientes_resumen')
      .select('*')
      .eq('organizacion_id', orgId)
      .order('codigo', { ascending: false })
      .then(({ data, error: e }) => {
        if (e) setError(mensajeAmable(e));
        setFilas(((data as ClienteResumen[]) ?? []).map((f) => ({ ...f, cobrado: Number(f.cobrado), pendiente: Number(f.pendiente), cuotas_vencidas: cobranzaRef ? Number(f.cuotas_vencidas) : 0, cuotas_pactadas: Number(f.cuotas_pactadas ?? 0), monto_total: f.monto_total === null ? null : Number(f.monto_total), proxima_cuota_monto: f.proxima_cuota_monto === null || f.proxima_cuota_monto === undefined ? null : Number(f.proxima_cuota_monto), por_cobrar_30_dias: Number(f.por_cobrar_30_dias ?? 0) })));
        setCargando(false);
      });
  }, [orgId, cobranzaRef]);

  const activos = filas.filter((f) => f.estado_firma !== 'Baja');
  const conVencidas = activos.filter((f) => f.cuotas_vencidas > 0);
  // Los montos se suman por moneda y no se convierten: dólares y soles van en renglones separados.
  const porMoneda = (valor: (f: ClienteResumen) => number) =>
    activos.reduce<Record<string, number>>((a, f) => {
      const m = f.moneda || 'USD';
      a[m] = (a[m] ?? 0) + valor(f);
      return a;
    }, {});
  const resumen = {
    firmados: filas.filter((f) => f.estado_firma === 'Firmado').length,
    pendientes: filas.filter((f) => f.estado_firma === 'Pendiente' || f.estado_firma === 'En firma').length,
    acordado: porMoneda((f) => f.monto_total ?? 0),
    cobrado: porMoneda((f) => f.cobrado),
    porCobrar: porMoneda((f) => f.pendiente),
    proximos30: porMoneda((f) => f.por_cobrar_30_dias),
  };
  const monedasActivas = Object.keys(resumen.acordado);
  const variasMonedas = monedasActivas.length > 1;
  const coincide = (valor: string | null | undefined, filtro: string) => !filtro || (filtro === 'sin' ? !valor : valor === filtro);
  const filtradas = filas.filter(
    (f) => coincide(f.responsable_id, filtros.am) && coincide(f.closer_id, filtros.closer) && coincide(f.setter_id, filtros.setter) && coincide(f.servicio, filtros.servicio),
  );
  const sinReunion = (f: ClienteResumen) => f.estado_firma !== 'Baja' && !proximas[f.id];
  const cuenta = (c: Filtro) =>
    c === 'todos'
      ? filtradas.length
      : c === 'vencidas'
        ? filtradas.filter((f) => f.cuotas_vencidas > 0 && f.estado_firma !== 'Baja').length
        : c === 'revisar'
          ? filtradas.filter((f) => f.revisar_pagos).length
          : c === 'sin_reunion'
            ? filtradas.filter(sinReunion).length
            : filtradas.filter((f) => f.estado_firma === c).length;

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return filtradas.filter((f) => {
      if (filtro === 'sin_reunion' && !sinReunion(f)) return false;
      if (filtro === 'vencidas' && !(f.cuotas_vencidas > 0 && f.estado_firma !== 'Baja')) return false;
      if (filtro === 'revisar' && !f.revisar_pagos) return false;
      if ((filtro === 'Pendiente' || filtro === 'En firma' || filtro === 'Firmado' || filtro === 'Baja') && f.estado_firma !== filtro) return false;
      if (!q) return true;
      return [f.codigo, f.nombre, f.representante, f.id_fiscal, f.email, f.dni, f.responsable, nombreEquipo(f.responsable_id), nombreEquipo(f.closer_id), nombreEquipo(f.setter_id)].some((v) =>
        (v ?? '').toLowerCase().includes(q),
      );
    });
  }, [filas, filtro, busqueda, equipo, filtros, proximas]); // eslint-disable-line react-hooks/exhaustive-deps

  // Paginación de la tabla. Vuelve a la primera página al cambiar el filtro o la búsqueda.
  useEffect(() => {
    setPagina(0);
  }, [filtro, busqueda, porPagina, orgId, filtros]);
  const paginas = Math.max(1, Math.ceil(visibles.length / porPagina));
  const paginaActual = Math.min(pagina, paginas - 1);
  const desde = paginaActual * porPagina;
  const filasPagina = visibles.slice(desde, desde + porPagina);

  function cambiarPorPagina(n: number) {
    setPorPagina(n);
    try {
      window.localStorage.setItem('firma-crm-por-pagina', String(n));
    } catch {
      /* sin almacenamiento */
    }
  }

  function descargar() {
    const blob = new Blob(['\ufeff' + csv(visibles, nombreEquipo, (id) => proximas[id])], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `crm-${hoyISO()}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  // El porcentaje cobrado solo tiene sentido con una sola moneda.
  const unica = monedasActivas[0];
  const pct = !variasMonedas && unica && resumen.acordado[unica] ? Math.round(((resumen.cobrado[unica] ?? 0) / resumen.acordado[unica]) * 100) : 0;
  const notaMonedas = variasMonedas ? 'Por moneda, sin convertir' : undefined;

  return (
    <>
      <Encabezado
        eyebrow="CRM legal"
        titulo={
          <>
            Clientes de <span className="text-bosque">{orgNombre}</span>
          </>
        }
        acciones={
          <>
            {selector}
            {verCasos && (
              <Button variant="ghost" size="lg" onClick={() => navegar('/portal/crm/casos')} className="self-end">
                <ShieldAlert size={18} /> Casos de conflicto
                {casosAbiertos ? (
                  <span className="inline-flex items-center justify-center min-w-6 h-6 px-1.5 rounded-pastilla bg-peligro text-marfil text-xs font-semibold tabular-nums">
                    {casosAbiertos}
                    <span className="sr-only">{casosAbiertos === 1 ? ' caso abierto' : ' casos abiertos'}</span>
                  </span>
                ) : null}
              </Button>
            )}
            <Button variant="ghost" size="lg" onClick={() => navegar('/portal/crm/servicios')} className="self-end">
              <Layers size={18} /> Servicios
            </Button>
            <Button variant="ghost" size="lg" onClick={() => navegar('/portal/crm/equipo')} className="self-end">
              <Users size={18} /> Equipo
            </Button>
            <Button variant="ghost" size="lg" onClick={() => navegar('/portal/crm/reuniones')} className="self-end">
              <CalendarDays size={18} /> Reuniones
              {porCompletar ? (
                <span className="inline-flex items-center justify-center min-w-6 h-6 px-1.5 rounded-pastilla bg-tinta text-marfil text-xs font-semibold tabular-nums">
                  {porCompletar}
                  <span className="sr-only">{porCompletar === 1 ? ' reunión por completar' : ' reuniones por completar'}</span>
                </span>
              ) : null}
            </Button>
            <Button variant="ghost" size="lg" onClick={() => navegar('/portal/crm/llamadas')} className="self-end">
              <Phone size={18} /> Llamadas
            </Button>
            <Button variant="ghost" size="lg" onClick={() => navegar('/portal/crm/comprobantes')} className="self-end">
              <ReceiptText size={18} /> Invoices y recibos
            </Button>
            {!soloLectura && (
              <Button size="lg" onClick={() => navegar('/portal/crm/nuevo')} className="self-end">
                <Plus size={18} /> Nuevo cliente
              </Button>
            )}
          </>
        }
      />

      <div className="wrap py-10 desk:py-14 flex flex-col gap-10">
        {error && <Aviso tipo="error">{error}</Aviso>}

        {interruptor && <div className="flex justify-end -mt-2">{interruptor}</div>}

        <Cifras
          cargando={cargando}
          items={cobranza ? [
            { titulo: 'Contratos firmados', valor: resumen.firmados },
            { titulo: 'Firmas pendientes', valor: resumen.pendientes },
            { titulo: 'Monto acordado', valor: <MontosPorMoneda montos={resumen.acordado} />, nota: notaMonedas },
            { titulo: 'Cobrado', valor: <MontosPorMoneda montos={resumen.cobrado} />, nota: variasMonedas ? notaMonedas : `${pct}% del acordado` },
            { titulo: 'Por cobrar el próximo mes', valor: <MontosPorMoneda montos={resumen.proximos30} />, nota: 'Vence en los próximos 30 días' },
            { titulo: 'Con cuotas vencidas', valor: conVencidas.length, alerta: conVencidas.length > 0 },
          ] : [
            { titulo: 'Contratos firmados', valor: resumen.firmados },
            { titulo: 'Firmas pendientes', valor: resumen.pendientes },
            { titulo: 'Monto acordado', valor: <MontosPorMoneda montos={resumen.acordado} />, nota: notaMonedas },
            { titulo: 'Planes a revisar', valor: filas.filter((f) => f.revisar_pagos).length, alerta: filas.some((f) => f.revisar_pagos) },
          ]}
        />

        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap gap-3 items-center justify-between">
            <div className="relative flex-1 min-w-[220px] max-w-[420px]">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-piedra" aria-hidden="true" />
              <input className={`${claseInput} pl-10`} placeholder="Buscar por nombre, código, mail o DNI" aria-label="Buscar cliente" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
            </div>
            <div className="flex items-center gap-3">
              <div role="group" aria-label="Vista" className="inline-flex bg-niebla rounded-[12px] p-1 gap-0.5">
                {(
                  [
                    ['lista', 'Lista', List],
                    ['tiempo', 'Línea de tiempo', GanttChart],
                  ] as const
                ).map(([v, t, Icono]) => (
                  <button
                    key={v}
                    type="button"
                    aria-pressed={vista === v}
                    onClick={() => cambiarVista(v)}
                    className={`inline-flex items-center gap-1.5 h-9 px-3.5 rounded-[9px] text-[14px] ${vista === v ? 'bg-papel font-semibold shadow-[0_1px_2px_rgba(0,0,0,0.08)]' : 'text-piedra hover:text-tinta'}`}
                  >
                    <Icono size={15} aria-hidden="true" /> {t}
                  </button>
                ))}
              </div>
              <Button variant="ghost" size="sm" onClick={descargar} disabled={!visibles.length}>
                <Download size={16} /> Exportar CSV
              </Button>
            </div>
          </div>

          <div className="grid gap-3 tab:grid-cols-2 desk:grid-cols-4 items-end">
            {(
              [
                ['am', 'Account Manager', opcionesAm.map((m) => [m.id, m.nombre + (m.activo ? '' : ' · inactivo')])],
                ['closer', 'Closer', opcionesCloser.map((m) => [m.id, m.nombre + (m.activo ? '' : ' · inactivo')])],
                ['setter', 'Setter', opcionesSetter.map((m) => [m.id, m.nombre + (m.activo ? '' : ' · inactivo')])],
                ['servicio', 'Servicio', servicios.map((x) => [x, x])],
              ] as [keyof Filtros, string, [string, string][]][]
            ).map(([campo, etiqueta, opciones]) => (
              <label key={campo} className="flex flex-col gap-1.5">
                <span className="text-[12.5px] font-medium text-piedra">{etiqueta}</span>
                <select className={claseInput} value={filtros[campo]} onChange={(e) => cambiarFiltro(campo, e.target.value)}>
                  <option value="">Todos</option>
                  <option value="sin">Sin asignar</option>
                  {opciones.map(([valor, texto]) => (
                    <option key={valor} value={valor}>
                      {texto}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          {hayFiltros && (
            <div className="-mt-3">
              <button type="button" className="text-sm text-piedra underline underline-offset-4 hover:text-bosque" onClick={() => {
                setFiltros(SIN_FILTROS);
                try {
                  window.localStorage.removeItem(claveFiltros);
                } catch {
                  /* sin almacenamiento */
                }
              }}>
                Quitar los filtros
              </button>
            </div>
          )}

          <Pestanas<Filtro> items={FILTROS.filter((f) => cobranza || f.clave !== 'vencidas').map((f) => ({ ...f, cuenta: cargando ? undefined : cuenta(f.clave) }))} activa={filtro} alCambiar={setFiltro} />

          {vista === 'tiempo' ? (
            <LineaTiempo filas={visibles} duracion={(s) => (s ? duraciones[s] ?? null : null)} nombreEquipo={nombreEquipo} />
          ) : (
          <>
          <div className="overflow-x-auto">
            <table className="tabla min-w-[1040px]">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Servicio</th>
                  <th className="num">Acordado</th>
                  <th>{cobranza ? 'Cobrado' : 'Plan pactado'}</th>
                  {cobranza && <th>Próxima cuota</th>}
                  <th>Firma</th>
                  <th>Próxima reunión</th>
                  <th>Equipo</th>
                </tr>
              </thead>
              <tbody>
                {!cargando && visibles.length === 0 && (
                  <tr>
                    <td colSpan={cobranza ? 8 : 7} className="text-piedra py-10">
                      No hay clientes para mostrar con este filtro.
                    </td>
                  </tr>
                )}
                {filasPagina.map((f) => {
                  const avance = f.monto_total ? Math.min(100, Math.round((f.cobrado / f.monto_total) * 100)) : 0;
                  const vencida = f.cuotas_vencidas > 0 && f.estado_firma !== 'Baja';
                  return (
                    <tr key={f.id} className="fila-link" onClick={(e) => !(e.target as HTMLElement).closest('a, button') && navegar(`/portal/crm/${f.id}`)}>
                      <td className="min-w-[220px]">
                        <Enlace a={`/portal/crm/${f.id}`} className="font-heading font-bold text-[16px] leading-tight hover:text-bosque">
                          {f.nombre}
                        </Enlace>
                        <div className="text-xs text-piedra mt-1 flex flex-wrap items-center gap-x-2">
                          <span className="tabular-nums">{f.codigo}</span>
                          {f.tipo === 'empresa' && <span>{f.representante ? `Empresa · ${f.representante}` : 'Empresa'}</span>}
                          {f.revisar_pagos && (
                            <span className="inline-flex items-center gap-1 text-peligro">
                              <AlertTriangle size={12} aria-hidden="true" /> revisar pagos
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <span className="font-medium">{f.servicio ?? '·'}</span>
                      </td>
                      <td className="num">{dinero(f.monto_total, f.moneda)}</td>
                      <td className="min-w-[150px]">
                        {cobranza ? (
                          <>
                            <div className="tabular-nums whitespace-nowrap">{dinero(f.cobrado, f.moneda)}</div>
                            <div className="mt-2 h-1 bg-marfil-oscuro" aria-hidden="true">
                              <div className="h-1 bg-bosque" style={{ width: `${avance}%` }} />
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="tabular-nums whitespace-nowrap">{f.cobrado > 0 ? `Anticipo ${dinero(f.cobrado, f.moneda)}` : 'Sin anticipo'}</div>
                            <div className="text-xs text-piedra mt-0.5">{f.cuotas_pactadas === 0 ? 'Sin cuotas' : f.cuotas_pactadas === 1 ? '1 cuota' : `${f.cuotas_pactadas} cuotas`}</div>
                          </>
                        )}
                      </td>
                      {cobranza && (
                        <td className="whitespace-nowrap">
                          {f.pendiente > 0 ? (
                            <>
                              <div className={vencida ? 'text-peligro font-medium' : ''}>{fecha(f.proximo_vencimiento)}</div>
                              {f.proxima_cuota_monto !== null && <div className="text-xs text-piedra mt-0.5 tabular-nums">{dinero(f.proxima_cuota_monto, f.moneda)}</div>}
                              {vencida && <div className="text-xs text-peligro mt-0.5">{f.cuotas_vencidas === 1 ? '1 cuota vencida' : `${f.cuotas_vencidas} cuotas vencidas`}</div>}
                            </>
                          ) : (
                            <span className="text-bosque font-medium">Pagado</span>
                          )}
                        </td>
                      )}
                      <td>
                        <div className="flex items-center gap-2.5">
                          <Etiqueta tono={TONO_FIRMA[f.estado_firma]}>{f.estado_firma}</Etiqueta>
                          {f.estado_firma === 'Pendiente' && envioFallido[f.id] && <Etiqueta tono="alerta">{ENVIO_FALLIDO[envioFallido[f.id]]}</Etiqueta>}
                        </div>
                      </td>
                      <td className="whitespace-nowrap">
                        {proximas[f.id] ? (
                          <>
                            <div>{fechaHora(proximas[f.id].inicio)}</div>
                            <div className="text-xs text-piedra mt-0.5">{proximas[f.id].tipo ? TIPO_REUNION[proximas[f.id].tipo as TipoReunion] : 'Sin tipo'}</div>
                          </>
                        ) : (
                          <span className="text-piedra">·</span>
                        )}
                      </td>
                      <td className="text-piedra">
                        <div>{nombreEquipo(f.responsable_id) ?? f.responsable ?? '·'}</div>
                        {nombreEquipo(f.closer_id) && <div className="text-xs mt-0.5">Closer {nombreEquipo(f.closer_id)}</div>}
                        {nombreEquipo(f.setter_id) && <div className="text-xs mt-0.5">Setter {nombreEquipo(f.setter_id)}</div>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-4 text-sm">
            <label className="flex items-center gap-2.5 text-piedra">
              Mostrar
              <select
                className="h-10 pl-3 pr-8 bg-white border border-tinta/22 text-tinta font-medium focus:outline-none focus:border-bosque focus:ring-1 focus:ring-bosque"
                value={porPagina}
                onChange={(e) => cambiarPorPagina(Number(e.target.value))}
              >
                {[10, 20, 50].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
              clientes por página
            </label>
            <div className="flex items-center gap-3">
              <span className="text-piedra tabular-nums">
                {visibles.length === 0 ? '0' : `${desde + 1}–${Math.min(desde + porPagina, visibles.length)}`} de {visibles.length}
                {visibles.length !== filas.length ? ` (${filas.length} en total)` : ''}
              </span>
              <button
                type="button"
                aria-label="Página anterior"
                disabled={paginaActual === 0}
                onClick={() => setPagina(paginaActual - 1)}
                className="w-10 h-10 inline-flex items-center justify-center border border-tinta/22 bg-white transition-colors duration-150 hover:border-tinta disabled:opacity-40 disabled:hover:border-tinta/22"
              >
                <ChevronLeft size={16} aria-hidden="true" />
              </button>
              <span className="tabular-nums font-medium">
                {paginaActual + 1} / {paginas}
              </span>
              <button
                type="button"
                aria-label="Página siguiente"
                disabled={paginaActual >= paginas - 1}
                onClick={() => setPagina(paginaActual + 1)}
                className="w-10 h-10 inline-flex items-center justify-center border border-tinta/22 bg-white transition-colors duration-150 hover:border-tinta disabled:opacity-40 disabled:hover:border-tinta/22"
              >
                <ChevronRight size={16} aria-hidden="true" />
              </button>
            </div>
          </div>
          </>
          )}
        </div>
      </div>
    </>
  );
};

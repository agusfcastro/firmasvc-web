import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ChevronLeft, ChevronRight, Download, Layers, Plus, Search, ShieldAlert } from 'lucide-react';
import { Button } from '../../Button';
import { supabase } from '../supabase';
import { navegar } from '../navegacion';
import { Aviso, Cifras, Encabezado, Etiqueta, Monto, Pestanas, claseInput } from '../ui';
import { useVistaPrevia } from '../vistaPrevia';
import { TONO_FIRMA, dinero, fecha, hoyISO, type ClienteResumen } from './tipos';

type Filtro = 'todos' | 'vencidas' | 'revisar' | 'Pendiente' | 'Firmado' | 'Baja';

const FILTROS: { clave: Filtro; titulo: string }[] = [
  { clave: 'todos', titulo: 'Todos' },
  { clave: 'vencidas', titulo: 'Vencidas' },
  { clave: 'Pendiente', titulo: 'Firma pendiente' },
  { clave: 'Firmado', titulo: 'Firmados' },
  { clave: 'Baja', titulo: 'Bajas' },
  { clave: 'revisar', titulo: 'A revisar' },
];

function csv(filas: ClienteResumen[]): string {
  const cols: [string, (c: ClienteResumen) => unknown][] = [
    ['Código', (c) => c.codigo],
    ['Nombre', (c) => c.nombre],
    ['DNI', (c) => c.dni],
    ['Email', (c) => c.email],
    ['Servicio', (c) => c.servicio],
    ['Monto total', (c) => c.monto_total],
    ['Cobrado', (c) => c.cobrado],
    ['Pendiente', (c) => c.pendiente],
    ['Próximo vencimiento', (c) => c.proximo_vencimiento],
    ['Cuotas pactadas', (c) => c.cuotas_pactadas],
    ['Cuotas vencidas', (c) => c.cuotas_vencidas],
    ['Monto próxima cuota', (c) => c.proxima_cuota_monto],
    ['Por cobrar en 30 días', (c) => c.por_cobrar_30_dias],
    ['Estado firma', (c) => c.estado_firma],
    ['Responsable', (c) => c.responsable],
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
        if (e) setError(e.message);
        setFilas(((data as ClienteResumen[]) ?? []).map((f) => ({ ...f, cobrado: Number(f.cobrado), pendiente: Number(f.pendiente), cuotas_vencidas: cobranzaRef ? Number(f.cuotas_vencidas) : 0, cuotas_pactadas: Number(f.cuotas_pactadas ?? 0), monto_total: f.monto_total === null ? null : Number(f.monto_total), proxima_cuota_monto: f.proxima_cuota_monto === null || f.proxima_cuota_monto === undefined ? null : Number(f.proxima_cuota_monto), por_cobrar_30_dias: Number(f.por_cobrar_30_dias ?? 0) })));
        setCargando(false);
      });
  }, [orgId, cobranzaRef]);

  const activos = filas.filter((f) => f.estado_firma !== 'Baja');
  const conVencidas = activos.filter((f) => f.cuotas_vencidas > 0);
  const resumen = {
    firmados: filas.filter((f) => f.estado_firma === 'Firmado').length,
    pendientes: filas.filter((f) => f.estado_firma === 'Pendiente').length,
    acordado: activos.reduce((a, f) => a + (f.monto_total ?? 0), 0),
    cobrado: activos.reduce((a, f) => a + f.cobrado, 0),
    porCobrar: activos.reduce((a, f) => a + f.pendiente, 0),
    proximos30: activos.reduce((a, f) => a + f.por_cobrar_30_dias, 0),
  };
  const cuenta = (c: Filtro) =>
    c === 'todos' ? filas.length : c === 'vencidas' ? conVencidas.length : c === 'revisar' ? filas.filter((f) => f.revisar_pagos).length : filas.filter((f) => f.estado_firma === c).length;

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return filas.filter((f) => {
      if (filtro === 'vencidas' && !(f.cuotas_vencidas > 0 && f.estado_firma !== 'Baja')) return false;
      if (filtro === 'revisar' && !f.revisar_pagos) return false;
      if ((filtro === 'Pendiente' || filtro === 'Firmado' || filtro === 'Baja') && f.estado_firma !== filtro) return false;
      if (!q) return true;
      return [f.codigo, f.nombre, f.email, f.dni, f.responsable].some((v) => (v ?? '').toLowerCase().includes(q));
    });
  }, [filas, filtro, busqueda]);

  // Paginación de la tabla. Vuelve a la primera página al cambiar el filtro o la búsqueda.
  useEffect(() => {
    setPagina(0);
  }, [filtro, busqueda, porPagina, orgId]);
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
    const blob = new Blob(['\ufeff' + csv(visibles)], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `crm-${hoyISO()}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const pct = resumen.acordado ? Math.round((resumen.cobrado / resumen.acordado) * 100) : 0;

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
                  <span className="inline-flex items-center justify-center min-w-6 h-6 px-1.5 bg-[#8a2b20] text-marfil text-xs font-medium tabular-nums">
                    {casosAbiertos}
                    <span className="sr-only">{casosAbiertos === 1 ? ' caso abierto' : ' casos abiertos'}</span>
                  </span>
                ) : null}
              </Button>
            )}
            <Button variant="ghost" size="lg" onClick={() => navegar('/portal/crm/servicios')} className="self-end">
              <Layers size={18} /> Servicios
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
            { titulo: 'Monto acordado', valor: <Monto n={resumen.acordado} /> },
            { titulo: 'Cobrado', valor: <Monto n={resumen.cobrado} />, nota: `${pct}% del acordado` },
            { titulo: 'Por cobrar el próximo mes', valor: <Monto n={resumen.proximos30} />, nota: 'Vence en los próximos 30 días' },
            { titulo: 'Con cuotas vencidas', valor: conVencidas.length, alerta: conVencidas.length > 0 },
          ] : [
            { titulo: 'Contratos firmados', valor: resumen.firmados },
            { titulo: 'Firmas pendientes', valor: resumen.pendientes },
            { titulo: 'Monto acordado', valor: <Monto n={resumen.acordado} /> },
            { titulo: 'Planes a revisar', valor: filas.filter((f) => f.revisar_pagos).length, alerta: filas.some((f) => f.revisar_pagos) },
          ]}
        />

        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap gap-3 items-center justify-between">
            <div className="relative flex-1 min-w-[220px] max-w-[420px]">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-piedra" aria-hidden="true" />
              <input className={`${claseInput} pl-10`} placeholder="Buscar por nombre, código, mail o DNI" aria-label="Buscar cliente" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
            </div>
            <Button variant="ghost" size="sm" onClick={descargar} disabled={!visibles.length}>
              <Download size={16} /> Exportar CSV
            </Button>
          </div>

          <Pestanas<Filtro> items={FILTROS.filter((f) => cobranza || f.clave !== 'vencidas').map((f) => ({ ...f, cuenta: cargando ? undefined : cuenta(f.clave) }))} activa={filtro} alCambiar={setFiltro} />

          <div className="overflow-x-auto">
            <table className="tabla min-w-[900px]">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Servicio</th>
                  <th className="num">Acordado</th>
                  <th>{cobranza ? 'Cobrado' : 'Plan pactado'}</th>
                  {cobranza && <th>Próxima cuota</th>}
                  <th>Firma</th>
                  <th>Responsable</th>
                </tr>
              </thead>
              <tbody>
                {!cargando && visibles.length === 0 && (
                  <tr>
                    <td colSpan={cobranza ? 7 : 6} className="text-piedra py-10">
                      No hay clientes para mostrar con este filtro.
                    </td>
                  </tr>
                )}
                {filasPagina.map((f) => {
                  const avance = f.monto_total ? Math.min(100, Math.round((f.cobrado / f.monto_total) * 100)) : 0;
                  const vencida = f.cuotas_vencidas > 0 && f.estado_firma !== 'Baja';
                  return (
                    <tr key={f.id} className="fila-link" onClick={() => navegar(`/portal/crm/${f.id}`)}>
                      <td className="min-w-[220px]">
                        <a
                          href={`/portal/crm/${f.id}`}
                          onClick={(e) => e.preventDefault()}
                          className="font-heading font-bold text-[16px] leading-tight hover:text-bosque"
                        >
                          {f.nombre}
                        </a>
                        <div className="text-xs text-piedra mt-1 flex flex-wrap items-center gap-x-2">
                          <span className="tabular-nums">{f.codigo}</span>
                          {f.revisar_pagos && (
                            <span className="inline-flex items-center gap-1 text-[#8a2b20]">
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
                              <div className={vencida ? 'text-[#8a2b20] font-medium' : ''}>{fecha(f.proximo_vencimiento)}</div>
                              {f.proxima_cuota_monto !== null && <div className="text-xs text-piedra mt-0.5 tabular-nums">{dinero(f.proxima_cuota_monto, f.moneda)}</div>}
                              {vencida && <div className="text-xs text-[#8a2b20] mt-0.5">{f.cuotas_vencidas === 1 ? '1 cuota vencida' : `${f.cuotas_vencidas} cuotas vencidas`}</div>}
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
                      <td className="text-piedra">{f.responsable ?? '·'}</td>
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
                className="h-10 pl-3 pr-8 bg-white border border-[rgba(27,31,27,0.22)] text-tinta font-medium focus:outline-none focus:border-bosque focus:ring-1 focus:ring-bosque"
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
                className="w-10 h-10 inline-flex items-center justify-center border border-[rgba(27,31,27,0.22)] bg-white transition-colors duration-150 hover:border-tinta disabled:opacity-40 disabled:hover:border-[rgba(27,31,27,0.22)]"
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
                className="w-10 h-10 inline-flex items-center justify-center border border-[rgba(27,31,27,0.22)] bg-white transition-colors duration-150 hover:border-tinta disabled:opacity-40 disabled:hover:border-[rgba(27,31,27,0.22)]"
              >
                <ChevronRight size={16} aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

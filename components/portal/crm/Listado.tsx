import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Download, Plus, Search } from 'lucide-react';
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
    ['Cuotas vencidas', (c) => c.cuotas_vencidas],
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

export const Listado: React.FC<{ orgId: string; orgNombre: string; selector?: React.ReactNode }> = ({ orgId, orgNombre, selector }) => {
  const [filas, setFilas] = useState<ClienteResumen[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [busqueda, setBusqueda] = useState('');
  const soloLectura = Boolean(useVistaPrevia());

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
        setFilas(((data as ClienteResumen[]) ?? []).map((f) => ({ ...f, cobrado: Number(f.cobrado), pendiente: Number(f.pendiente), monto_total: f.monto_total === null ? null : Number(f.monto_total) })));
        setCargando(false);
      });
  }, [orgId]);

  const activos = filas.filter((f) => f.estado_firma !== 'Baja');
  const conVencidas = activos.filter((f) => f.cuotas_vencidas > 0);
  const resumen = {
    firmados: filas.filter((f) => f.estado_firma === 'Firmado').length,
    pendientes: filas.filter((f) => f.estado_firma === 'Pendiente').length,
    acordado: activos.reduce((a, f) => a + (f.monto_total ?? 0), 0),
    cobrado: activos.reduce((a, f) => a + f.cobrado, 0),
    porCobrar: activos.reduce((a, f) => a + f.pendiente, 0),
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
        bajada="Contratos, firmas y plan de pagos de cada cliente, con el respaldo legal de FIRMA."
        acciones={
          <>
            {selector}
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

        <Cifras
          cargando={cargando}
          items={[
            { titulo: 'Contratos firmados', valor: resumen.firmados },
            { titulo: 'Firmas pendientes', valor: resumen.pendientes },
            { titulo: 'Monto acordado', valor: <Monto n={resumen.acordado} /> },
            { titulo: 'Cobrado', valor: <Monto n={resumen.cobrado} />, nota: `${pct}% del acordado` },
            { titulo: 'Por cobrar', valor: <Monto n={resumen.porCobrar} /> },
            { titulo: 'Con cuotas vencidas', valor: conVencidas.length, alerta: conVencidas.length > 0 },
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

          <Pestanas items={FILTROS.map((f) => ({ ...f, cuenta: cargando ? undefined : cuenta(f.clave) }))} activa={filtro} alCambiar={setFiltro} />

          <div className="overflow-x-auto">
            <table className="tabla min-w-[900px]">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Servicio</th>
                  <th className="num">Acordado</th>
                  <th>Cobrado</th>
                  <th>Próxima cuota</th>
                  <th>Firma</th>
                  <th>Responsable</th>
                </tr>
              </thead>
              <tbody>
                {!cargando && visibles.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-piedra py-10">
                      No hay clientes para mostrar con este filtro.
                    </td>
                  </tr>
                )}
                {visibles.map((f) => {
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
                        <div className="tabular-nums whitespace-nowrap">{dinero(f.cobrado, f.moneda)}</div>
                        <div className="mt-2 h-1 bg-marfil-oscuro" aria-hidden="true">
                          <div className="h-1 bg-bosque" style={{ width: `${avance}%` }} />
                        </div>
                      </td>
                      <td className="whitespace-nowrap">
                        {f.pendiente > 0 ? (
                          <>
                            <div className={vencida ? 'text-[#8a2b20] font-medium' : ''}>{fecha(f.proximo_vencimiento)}</div>
                            {vencida && <div className="text-xs text-[#8a2b20] mt-0.5">{f.cuotas_vencidas === 1 ? '1 cuota vencida' : `${f.cuotas_vencidas} cuotas vencidas`}</div>}
                          </>
                        ) : (
                          <span className="text-bosque font-medium">Pagado</span>
                        )}
                      </td>
                      <td>
                        <Etiqueta tono={TONO_FIRMA[f.estado_firma]}>{f.estado_firma}</Etiqueta>
                      </td>
                      <td className="text-piedra">{f.responsable ?? '·'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-piedra">
            {visibles.length} de {filas.length} clientes
          </p>
        </div>
      </div>
    </>
  );
};

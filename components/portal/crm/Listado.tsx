import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Download, Plus, Search } from 'lucide-react';
import { Button } from '../../Button';
import { supabase } from '../supabase';
import { navegar } from '../navegacion';
import { Aviso, Etiqueta, claseInput } from '../ui';
import { useVistaPrevia } from '../vistaPrevia';
import { TONO_FIRMA, dinero, fecha, hoyISO, type ClienteResumen } from './tipos';

type Filtro = 'todos' | 'vencidas' | 'revisar' | 'Pendiente' | 'Firmado' | 'Baja';

const FILTROS: { clave: Filtro; titulo: string }[] = [
  { clave: 'todos', titulo: 'Todos' },
  { clave: 'vencidas', titulo: 'Cuotas vencidas' },
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

export const Listado: React.FC<{ orgId: string }> = ({ orgId }) => {
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
  const resumen = {
    firmados: filas.filter((f) => f.estado_firma === 'Firmado').length,
    pendientes: filas.filter((f) => f.estado_firma === 'Pendiente').length,
    acordado: activos.reduce((a, f) => a + (f.monto_total ?? 0), 0),
    cobrado: activos.reduce((a, f) => a + f.cobrado, 0),
    porCobrar: activos.reduce((a, f) => a + f.pendiente, 0),
    vencidas: activos.filter((f) => f.cuotas_vencidas > 0).length,
  };

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
    const blob = new Blob(['﻿' + csv(visibles)], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `crm-${hoyISO()}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const tarjetas = [
    { titulo: 'Contratos firmados', valor: String(resumen.firmados) },
    { titulo: 'Firmas pendientes', valor: String(resumen.pendientes) },
    { titulo: 'Monto acordado', valor: dinero(resumen.acordado) },
    { titulo: 'Cobrado', valor: dinero(resumen.cobrado) },
    { titulo: 'Por cobrar', valor: dinero(resumen.porCobrar) },
    { titulo: 'Clientes con cuotas vencidas', valor: String(resumen.vencidas), alerta: resumen.vencidas > 0 },
  ];

  return (
    <div className="space-y-8">
      {error && <Aviso tipo="error">{error}</Aviso>}

      <div className="grid grid-cols-2 tab:grid-cols-3 wide:grid-cols-6 gap-px bg-[rgba(27,31,27,0.15)] border border-[rgba(27,31,27,0.15)]">
        {tarjetas.map((t) => (
          <div key={t.titulo} className="bg-marfil p-4">
            <div className="text-xs text-piedra mb-1">{t.titulo}</div>
            <div className={`text-xl font-heading font-bold tabular-nums ${t.alerta ? 'text-[#8a2b20]' : ''}`}>{cargando ? '·' : t.valor}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        {!soloLectura && (
          <Button onClick={() => navegar('/portal/crm/nuevo')}>
            <Plus size={16} /> Nuevo cliente
          </Button>
        )}
        <div className="relative flex-1 min-w-[200px] max-w-[360px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-piedra" />
          <input className={`${claseInput} pl-9`} placeholder="Buscar por nombre, código, mail o DNI" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
        </div>
        <div className="flex-1" />
        <Button variant="ghost" size="sm" onClick={descargar} disabled={!visibles.length}>
          <Download size={16} /> Exportar
        </Button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {FILTROS.map((f) => (
          <button
            key={f.clave}
            type="button"
            onClick={() => setFiltro(f.clave)}
            aria-pressed={filtro === f.clave}
            className={`px-3 h-9 text-sm whitespace-nowrap border ${filtro === f.clave ? 'bg-tinta text-marfil border-tinta' : 'bg-white border-[rgba(27,31,27,0.25)] hover:border-tinta'}`}
          >
            {f.titulo}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto border border-[rgba(27,31,27,0.15)]">
        <table className="w-full text-sm">
          <thead className="bg-marfil-oscuro text-left">
            <tr>
              <th className="p-3 font-medium">Cliente</th>
              <th className="p-3 font-medium">Servicio</th>
              <th className="p-3 font-medium text-right">Acordado</th>
              <th className="p-3 font-medium text-right">Cobrado</th>
              <th className="p-3 font-medium">Próxima cuota</th>
              <th className="p-3 font-medium">Firma</th>
              <th className="p-3 font-medium">Responsable</th>
            </tr>
          </thead>
          <tbody>
            {!cargando && visibles.length === 0 && (
              <tr>
                <td colSpan={7} className="p-6 text-piedra">
                  No hay clientes para mostrar.
                </td>
              </tr>
            )}
            {visibles.map((f) => (
              <tr
                key={f.id}
                onClick={() => navegar(`/portal/crm/${f.id}`)}
                className="border-t border-[rgba(27,31,27,0.1)] bg-white hover:bg-marfil cursor-pointer align-top"
              >
                <td className="p-3">
                  <div className="font-medium">
                    <a
                      href={`/portal/crm/${f.id}`}
                      onClick={(e) => {
                        e.preventDefault();
                      }}
                    >
                      {f.nombre}
                    </a>
                  </div>
                  <div className="text-xs text-piedra">
                    {f.codigo}
                    {f.revisar_pagos && (
                      <span className="ml-2 inline-flex items-center gap-1 text-[#8a2b20]">
                        <AlertTriangle size={12} /> revisar pagos
                      </span>
                    )}
                  </div>
                </td>
                <td className="p-3">{f.servicio ?? '·'}</td>
                <td className="p-3 text-right tabular-nums whitespace-nowrap">{dinero(f.monto_total, f.moneda)}</td>
                <td className="p-3 text-right tabular-nums whitespace-nowrap">{dinero(f.cobrado, f.moneda)}</td>
                <td className="p-3 whitespace-nowrap">
                  {f.pendiente > 0 ? (
                    <>
                      <div className={f.cuotas_vencidas > 0 && f.estado_firma !== 'Baja' ? 'text-[#8a2b20] font-medium' : ''}>{fecha(f.proximo_vencimiento)}</div>
                      {f.cuotas_vencidas > 0 && f.estado_firma !== 'Baja' && <div className="text-xs text-[#8a2b20]">{f.cuotas_vencidas === 1 ? '1 vencida' : `${f.cuotas_vencidas} vencidas`}</div>}
                    </>
                  ) : (
                    <span className="text-bosque">Pagado</span>
                  )}
                </td>
                <td className="p-3">
                  <Etiqueta tono={TONO_FIRMA[f.estado_firma]}>{f.estado_firma}</Etiqueta>
                </td>
                <td className="p-3">{f.responsable ?? '·'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-piedra">{visibles.length} de {filas.length} clientes</p>
    </div>
  );
};

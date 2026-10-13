import React, { useEffect, useState } from 'react';
import { ArrowLeft, Check, ExternalLink, Lock, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { Button } from '../../Button';
import { supabase } from '../supabase';
import { navegar } from '../navegacion';
import { Aviso, Campo, Etiqueta, claseInput } from '../ui';
import { TONO_FIRMA, dinero, fecha, hoyISO, type CambioHistorial, type ClienteCrm, type ContratoReservado, type EstadoFirma, type Pago, type Servicio } from './tipos';

const ROTULOS: Record<string, string> = {
  nombre: 'Nombre', dni: 'DNI', email: 'Mail', telefono: 'Teléfono', servicio: 'Servicio', monto_total: 'Monto total',
  modalidad: 'Modalidad', fecha_onboarding: 'Onboarding', estado_firma: 'Estado de la firma', link_contrato_servicio: 'Contrato de servicio',
  responsable: 'Responsable', notas: 'Notas', revisar_pagos: 'Revisar pagos', monto: 'Monto', vencimiento: 'Vencimiento', estado: 'Estado',
  fecha_pago: 'Fecha de pago', nota: 'Nota', link_contrato_cliente: 'Contrato del cliente', link_documento: 'Documento generado',
};
const OCULTOS = new Set(['id', 'organizacion_id', 'cliente_id', 'creado_por', 'codigo', 'plan_pagos_original']);

function aLocal(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function valorLegible(v: unknown): string {
  if (v === null || v === undefined || v === '') return 'vacío';
  if (typeof v === 'boolean') return v ? 'sí' : 'no';
  return String(v).length > 60 ? String(v).slice(0, 57) + '…' : String(v);
}

export const Ficha: React.FC<{ id: string; esAdmin: boolean; puedeGestionar: boolean }> = ({ id, esAdmin, puedeGestionar }) => {
  const [cliente, setCliente] = useState<ClienteCrm | null>(null);
  const [borrador, setBorrador] = useState<ClienteCrm | null>(null);
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [contrato, setContrato] = useState<ContratoReservado | null>(null);
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [historial, setHistorial] = useState<CambioHistorial[]>([]);
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [nueva, setNueva] = useState<{ monto: string; vencimiento: string; nota: string } | null>(null);
  const [noExiste, setNoExiste] = useState(false);

  async function cargar() {
    if (!supabase) return;
    const { data: c } = await supabase.from('crm_clientes').select('*').eq('id', id).maybeSingle();
    if (!c) return setNoExiste(true);
    setCliente(c as ClienteCrm);
    setBorrador(c as ClienteCrm);
    const [p, s, k, h] = await Promise.all([
      supabase.from('crm_pagos').select('*').eq('cliente_id', id).order('estado', { ascending: true }).order('vencimiento', { ascending: true, nullsFirst: false }),
      supabase.from('crm_servicios').select('*').eq('organizacion_id', c.organizacion_id).eq('activo', true).order('clave'),
      puedeGestionar ? supabase.from('crm_contratos').select('*').eq('cliente_id', id).maybeSingle() : Promise.resolve({ data: null }),
      puedeGestionar ? supabase.from('crm_historial').select('*').eq('cliente_id', id).order('creado_en', { ascending: false }).limit(50) : Promise.resolve({ data: [] }),
    ]);
    setPagos(((p.data as Pago[]) ?? []).map((x) => ({ ...x, monto: Number(x.monto) })));
    setServicios((s.data as Servicio[]) ?? []);
    setContrato((k.data as ContratoReservado) ?? { cliente_id: id, link_contrato_cliente: null, link_documento: null });
    setHistorial((h.data as CambioHistorial[]) ?? []);
  }

  useEffect(() => {
    void cargar();
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (noExiste) return <Aviso tipo="error">No existe ese cliente o no tenés acceso.</Aviso>;
  if (!cliente || !borrador) return <p className="text-piedra text-sm">Cargando…</p>;

  const moneda = cliente.moneda;
  const cobrado = pagos.filter((p) => p.estado === 'pagado').reduce((a, p) => a + p.monto, 0);
  const pendiente = pagos.filter((p) => p.estado === 'pendiente').reduce((a, p) => a + p.monto, 0);
  const diferencia = Math.round(((cliente.monto_total ?? 0) - cobrado - pendiente) * 100) / 100;
  const hoy = hoyISO();

  async function guardarDatos(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase || !borrador) return;
    setGuardando(true);
    setMensaje(null);
    const cambios: Partial<ClienteCrm> = {
      nombre: borrador.nombre.trim(),
      dni: borrador.dni?.trim() || null,
      email: borrador.email?.trim().toLowerCase() || null,
      telefono: borrador.telefono?.trim() || null,
      servicio: borrador.servicio || null,
      monto_total: borrador.monto_total === null || (borrador.monto_total as unknown) === '' ? null : Number(borrador.monto_total),
      modalidad: borrador.modalidad,
      fecha_onboarding: borrador.fecha_onboarding || null,
      responsable: borrador.responsable?.trim() || null,
      notas: borrador.notas?.trim() || null,
    };
    if (esAdmin) {
      cambios.estado_firma = borrador.estado_firma;
      cambios.link_contrato_servicio = borrador.link_contrato_servicio?.trim() || null;
      cambios.revisar_pagos = borrador.revisar_pagos;
    }
    const { error } = await supabase.from('crm_clientes').update(cambios).eq('id', id);
    if (!error && esAdmin && contrato) {
      const { error: e2 } = await supabase.from('crm_contratos').upsert({
        cliente_id: id,
        organizacion_id: cliente!.organizacion_id,
        link_contrato_cliente: contrato.link_contrato_cliente?.trim() || null,
        link_documento: contrato.link_documento?.trim() || null,
      });
      if (e2) {
        setGuardando(false);
        return setMensaje({ tipo: 'error', texto: e2.message });
      }
    }
    setGuardando(false);
    setMensaje(error ? { tipo: 'error', texto: error.message } : { tipo: 'ok', texto: 'Cambios guardados.' });
    if (!error) void cargar();
  }

  async function actualizarPago(p: Pago, cambios: Partial<Pago>) {
    if (!supabase) return;
    const { error } = await supabase.from('crm_pagos').update(cambios).eq('id', p.id);
    if (error) setMensaje({ tipo: 'error', texto: error.message });
    void cargar();
  }

  async function borrarPago(p: Pago) {
    if (!supabase || !window.confirm(`¿Eliminar la cuota de ${dinero(p.monto, moneda)}?`)) return;
    const { error } = await supabase.from('crm_pagos').delete().eq('id', p.id);
    if (error) setMensaje({ tipo: 'error', texto: error.message });
    void cargar();
  }

  async function agregarPago(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase || !nueva) return;
    const monto = Number(nueva.monto.replace(',', '.'));
    if (!(monto > 0)) return setMensaje({ tipo: 'error', texto: 'El monto tiene que ser mayor a cero.' });
    const { error } = await supabase.from('crm_pagos').insert({
      cliente_id: id,
      organizacion_id: cliente!.organizacion_id,
      monto,
      vencimiento: nueva.vencimiento || null,
      nota: nueva.nota.trim() || null,
    });
    if (error) return setMensaje({ tipo: 'error', texto: error.message });
    setNueva(null);
    void cargar();
  }

  const set = <K extends keyof ClienteCrm>(k: K, v: ClienteCrm[K]) => setBorrador({ ...borrador, [k]: v });

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-center gap-4">
        <button type="button" onClick={() => navegar('/portal/crm')} className="inline-flex items-center gap-2 text-sm hover:text-bosque">
          <ArrowLeft size={16} /> Volver al listado
        </button>
        <div className="flex-1" />
        <Etiqueta tono={TONO_FIRMA[cliente.estado_firma]}>{cliente.estado_firma}</Etiqueta>
      </div>

      <div>
        <p className="text-sm text-piedra">{cliente.codigo}</p>
        <h2 className="h2">{cliente.nombre}</h2>
      </div>

      {mensaje && <Aviso tipo={mensaje.tipo}>{mensaje.texto}</Aviso>}
      {cliente.revisar_pagos && (
        <Aviso tipo="error">
          El plan de pagos se migró desde la planilla y necesita revisión. Texto original: «{cliente.plan_pagos_original}»
        </Aviso>
      )}

      {/* Pagos */}
      <section>
        <h3 className="h3 mb-4">Plan de pagos</h3>
        <div className="grid grid-cols-2 tab:grid-cols-4 gap-px bg-[rgba(27,31,27,0.15)] border border-[rgba(27,31,27,0.15)] mb-4">
          {[
            ['Acordado', dinero(cliente.monto_total, moneda)],
            ['Cobrado', dinero(cobrado, moneda)],
            ['Pendiente', dinero(pendiente, moneda)],
            ['Diferencia', diferencia === 0 ? 'Cierra' : dinero(diferencia, moneda)],
          ].map(([t, v]) => (
            <div key={t} className="bg-marfil p-4">
              <div className="text-xs text-piedra">{t}</div>
              <div className={`text-lg font-bold tabular-nums ${t === 'Diferencia' && diferencia !== 0 ? 'text-[#8a2b20]' : ''}`}>{v}</div>
            </div>
          ))}
        </div>
        {diferencia !== 0 && (
          <p className="text-sm text-[#8a2b20] mb-4">
            Las cuotas no suman el monto acordado. {diferencia > 0 ? 'Falta asignar' : 'Sobran'} {dinero(Math.abs(diferencia), moneda)}.
          </p>
        )}

        <div className="overflow-x-auto border border-[rgba(27,31,27,0.15)]">
          <table className="w-full text-sm">
            <thead className="bg-marfil-oscuro text-left">
              <tr>
                <th className="p-3 font-medium">Vencimiento</th>
                <th className="p-3 font-medium text-right">Monto</th>
                <th className="p-3 font-medium">Estado</th>
                <th className="p-3 font-medium">Nota</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {pagos.map((p) => {
                const vencida = p.estado === 'pendiente' && p.vencimiento && p.vencimiento < hoy;
                return (
                  <tr key={p.id} className="border-t border-[rgba(27,31,27,0.1)] bg-white">
                    <td className="p-2">
                      {p.estado === 'pendiente' ? (
                        <input
                          type="date"
                          className={`${claseInput} h-9 ${vencida ? 'text-[#8a2b20] border-[#8a2b20]' : ''}`}
                          defaultValue={p.vencimiento ?? ''}
                          onBlur={(e) => e.target.value !== (p.vencimiento ?? '') && actualizarPago(p, { vencimiento: e.target.value || null })}
                        />
                      ) : (
                        <span className="px-1">{p.fecha_pago ? `Pagó ${fecha(p.fecha_pago)}` : 'Pagado'}</span>
                      )}
                    </td>
                    <td className="p-2 text-right">
                      {p.estado === 'pendiente' ? (
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          className={`${claseInput} h-9 w-32 text-right`}
                          defaultValue={p.monto}
                          onBlur={(e) => Number(e.target.value) > 0 && Number(e.target.value) !== p.monto && actualizarPago(p, { monto: Number(e.target.value) })}
                        />
                      ) : (
                        <span className="tabular-nums px-1">{dinero(p.monto, moneda)}</span>
                      )}
                    </td>
                    <td className="p-3">
                      {p.estado === 'pagado' ? <Etiqueta tono="bosque">Pagado</Etiqueta> : vencida ? <Etiqueta tono="alerta">Vencida</Etiqueta> : <Etiqueta>Pendiente</Etiqueta>}
                    </td>
                    <td className="p-2">
                      <input
                        className={`${claseInput} h-9 min-w-[160px]`}
                        defaultValue={p.nota ?? ''}
                        placeholder="Nota"
                        onBlur={(e) => e.target.value !== (p.nota ?? '') && actualizarPago(p, { nota: e.target.value.trim() || null })}
                      />
                    </td>
                    <td className="p-2">
                      <div className="flex gap-2 justify-end whitespace-nowrap">
                        {p.estado === 'pendiente' ? (
                          <button type="button" title="Marcar como pagada" className="inline-flex items-center gap-1 px-2 h-9 border border-bosque text-bosque hover:bg-bosque hover:text-marfil" onClick={() => actualizarPago(p, { estado: 'pagado', fecha_pago: hoy })}>
                            <Check size={14} /> Pagada
                          </button>
                        ) : (
                          <button type="button" title="Volver a pendiente" className="inline-flex items-center gap-1 px-2 h-9 border border-[rgba(27,31,27,0.25)] hover:border-tinta" onClick={() => actualizarPago(p, { estado: 'pendiente', fecha_pago: null })}>
                            <RotateCcw size={14} /> Deshacer
                          </button>
                        )}
                        {puedeGestionar && (
                          <button type="button" title="Eliminar" aria-label="Eliminar cuota" className="px-2 h-9 text-[#8a2b20] hover:bg-[#f6e7e4]" onClick={() => borrarPago(p)}>
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {pagos.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-4 text-piedra">
                    Sin cuotas cargadas.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {nueva ? (
          <form onSubmit={agregarPago} className="mt-4 flex flex-wrap gap-3 items-end bg-white border border-[rgba(27,31,27,0.15)] p-4">
            <Campo etiqueta={`Monto (${moneda})`}>
              <input required type="number" step="0.01" min="0.01" className={`${claseInput} w-36`} value={nueva.monto} onChange={(e) => setNueva({ ...nueva, monto: e.target.value })} />
            </Campo>
            <Campo etiqueta="Vencimiento">
              <input type="date" className={claseInput} value={nueva.vencimiento} onChange={(e) => setNueva({ ...nueva, vencimiento: e.target.value })} />
            </Campo>
            <div className="flex-1 min-w-[180px]">
              <Campo etiqueta="Nota">
                <input className={claseInput} value={nueva.nota} onChange={(e) => setNueva({ ...nueva, nota: e.target.value })} />
              </Campo>
            </div>
            <Button type="submit">Agregar</Button>
            <Button type="button" variant="ghost" onClick={() => setNueva(null)}>
              Cancelar
            </Button>
          </form>
        ) : (
          <Button variant="ghost" size="sm" className="mt-4" onClick={() => setNueva({ monto: diferencia > 0 ? String(diferencia) : '', vencimiento: '', nota: '' })}>
            <Plus size={16} /> Agregar cuota
          </Button>
        )}
      </section>

      {/* Datos */}
      <form onSubmit={guardarDatos} className="space-y-6">
        <h3 className="h3">Datos del cliente</h3>
        <div className="grid gap-5 tab:grid-cols-2">
          <Campo etiqueta="Nombre completo">
            <input required className={claseInput} value={borrador.nombre} onChange={(e) => set('nombre', e.target.value)} />
          </Campo>
          <Campo etiqueta="DNI">
            <input className={claseInput} value={borrador.dni ?? ''} onChange={(e) => set('dni', e.target.value)} />
          </Campo>
          <Campo etiqueta="Mail">
            <input type="email" className={claseInput} value={borrador.email ?? ''} onChange={(e) => set('email', e.target.value)} />
          </Campo>
          <Campo etiqueta="Teléfono">
            <input className={claseInput} value={borrador.telefono ?? ''} onChange={(e) => set('telefono', e.target.value)} />
          </Campo>
          <Campo etiqueta="Servicio">
            <select className={claseInput} value={borrador.servicio ?? ''} onChange={(e) => set('servicio', e.target.value)}>
              <option value="">Sin definir</option>
              {servicios.map((s) => (
                <option key={s.id} value={s.clave}>
                  {s.clave}
                  {s.nombre ? ` · ${s.nombre}` : ''}
                </option>
              ))}
              {borrador.servicio && !servicios.some((s) => s.clave === borrador.servicio) && <option value={borrador.servicio}>{borrador.servicio}</option>}
            </select>
          </Campo>
          <Campo etiqueta={`Monto total acordado (${moneda})`}>
            <input type="number" step="0.01" className={claseInput} value={borrador.monto_total ?? ''} onChange={(e) => set('monto_total', e.target.value === '' ? null : (e.target.value as unknown as number))} />
          </Campo>
          <Campo etiqueta="Modalidad">
            <select className={claseInput} value={borrador.modalidad} onChange={(e) => set('modalidad', e.target.value as ClienteCrm['modalidad'])}>
              <option value="Cuotas">Cuotas</option>
              <option value="PIF">PIF (pago total)</option>
            </select>
          </Campo>
          <Campo etiqueta="Onboarding">
            <input
              type="datetime-local"
              className={claseInput}
              value={aLocal(borrador.fecha_onboarding)}
              onChange={(e) => set('fecha_onboarding', e.target.value ? new Date(e.target.value).toISOString() : null)}
            />
          </Campo>
          <Campo etiqueta="Responsable (CSM o AM)">
            <input className={claseInput} value={borrador.responsable ?? ''} onChange={(e) => set('responsable', e.target.value)} />
          </Campo>
        </div>
        <Campo etiqueta="Notas" ayuda="Cualquier información que pueda ser relevante.">
          <textarea rows={3} className={`${claseInput} h-auto py-2`} value={borrador.notas ?? ''} onChange={(e) => set('notas', e.target.value)} />
        </Campo>

        <div className="border border-[rgba(27,31,27,0.15)] bg-white p-5 space-y-5">
          <div className="flex items-center gap-2">
            <Lock size={16} className="text-piedra" />
            <h4 className="font-medium">Contratos y firma</h4>
            <span className="text-xs text-piedra">{esAdmin ? 'Lo gestiona FIRMA' : 'Solo lectura, lo gestiona FIRMA'}</span>
          </div>
          <div className="grid gap-5 tab:grid-cols-2">
            <Campo etiqueta="Estado de la firma">
              <select disabled={!esAdmin} className={claseInput} value={borrador.estado_firma} onChange={(e) => set('estado_firma', e.target.value as EstadoFirma)}>
                <option>Pendiente</option>
                <option>Firmado</option>
                <option>Baja</option>
              </select>
            </Campo>
            <Campo etiqueta="Contrato de servicio" ayuda="Para revisar los datos cargados. No se firma desde acá.">
              {esAdmin ? (
                <input className={claseInput} value={borrador.link_contrato_servicio ?? ''} onChange={(e) => set('link_contrato_servicio', e.target.value)} />
              ) : borrador.link_contrato_servicio ? (
                <a href={borrador.link_contrato_servicio} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline underline-offset-4 h-11">
                  Ver contrato de servicio <ExternalLink size={14} />
                </a>
              ) : (
                <span className="text-piedra text-sm">Sin cargar</span>
              )}
            </Campo>
            {puedeGestionar && contrato && (
              <>
                <Campo etiqueta="Contrato del cliente" ayuda="Reservado. Solo lo ven FIRMA y el titular.">
                  {esAdmin ? (
                    <input className={claseInput} value={contrato.link_contrato_cliente ?? ''} onChange={(e) => setContrato({ ...contrato, link_contrato_cliente: e.target.value })} />
                  ) : contrato.link_contrato_cliente ? (
                    <a href={contrato.link_contrato_cliente} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline underline-offset-4 h-11">
                      Ver contrato firmado <ExternalLink size={14} />
                    </a>
                  ) : (
                    <span className="text-piedra text-sm">Sin cargar</span>
                  )}
                </Campo>
                <Campo etiqueta="Documento generado">
                  {esAdmin ? (
                    <input className={claseInput} value={contrato.link_documento ?? ''} onChange={(e) => setContrato({ ...contrato, link_documento: e.target.value })} />
                  ) : contrato.link_documento ? (
                    <a href={contrato.link_documento} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline underline-offset-4 h-11">
                      Ver documento <ExternalLink size={14} />
                    </a>
                  ) : (
                    <span className="text-piedra text-sm">Sin cargar</span>
                  )}
                </Campo>
              </>
            )}
          </div>
          {esAdmin && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={borrador.revisar_pagos} onChange={(e) => set('revisar_pagos', e.target.checked)} />
              Marcar plan de pagos para revisar
            </label>
          )}
        </div>

        <Button type="submit" disabled={guardando}>
          {guardando ? 'Guardando…' : 'Guardar cambios'}
        </Button>
      </form>

      {puedeGestionar && historial.length > 0 && (
        <section>
          <h3 className="h3 mb-4">Historial de cambios</h3>
          <ul className="space-y-2 text-sm">
            {historial.map((h) => (
              <li key={h.id} className="border-l-2 border-[rgba(27,31,27,0.2)] pl-3">
                <span className="text-piedra">{new Date(h.creado_en).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })} · </span>
                {h.operacion === 'insert' ? (h.tabla === 'crm_pagos' ? 'Cuota agregada' : 'Alta') : h.operacion === 'delete' ? 'Cuota eliminada' : 'Cambio'}
                {h.operacion === 'update' &&
                  (Object.entries(h.cambios) as [string, { antes: unknown; despues: unknown }][])
                    .filter(([k]) => !OCULTOS.has(k))
                    .map(([k, v]) => (
                      <span key={k} className="block text-xs text-piedra">
                        {ROTULOS[k] ?? k}: {valorLegible(v.antes)} → {valorLegible(v.despues)}
                      </span>
                    ))}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
};

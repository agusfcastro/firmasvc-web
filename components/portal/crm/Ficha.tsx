import React, { useEffect, useState } from 'react';
import { ArrowLeft, Check, ExternalLink, Lock, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { Button } from '../../Button';
import { supabase } from '../supabase';
import { Aviso, Campo, Cifras, Encabezado, Enlace, Etiqueta, Monto, TituloSeccion, claseInput } from '../ui';
import { useVistaPrevia } from '../vistaPrevia';
import { TONO_FIRMA, dinero, fecha, hoyISO, type CambioHistorial, type ClienteCrm, type ContratoReservado, type EstadoFirma, type Pago, type Servicio } from './tipos';
import { CAMPOS_CASO, VALORES_CASO } from './reglasCasos';
import { CasosCliente } from './Casos';
import { ContratoFirma } from './contratoFirma';

const ROTULOS: Record<string, string> = {
  nombre: 'Nombre', dni: 'DNI', email: 'Mail', telefono: 'Teléfono', domicilio: 'Domicilio', servicio: 'Servicio', monto_total: 'Monto total',
  modalidad: 'Modalidad', fecha_onboarding: 'Onboarding', estado_firma: 'Estado de la firma', link_contrato_servicio: 'Contrato de servicio',
  responsable: 'Responsable', notas: 'Notas', condiciones: 'Condiciones acordadas', revisar_pagos: 'Revisar pagos', monto: 'Monto', vencimiento: 'Vencimiento', estado: 'Estado',
  fecha_pago: 'Fecha de pago', nota: 'Nota', link_contrato_cliente: 'Contrato del cliente', link_documento: 'Documento generado',
  firma_url: 'Link de firma', contrato_estado: 'Contrato', contrato_error: 'Error del contrato',
  ...CAMPOS_CASO,
};
const OCULTOS = new Set(['id', 'organizacion_id', 'cliente_id', 'asunto_id', 'creado_por', 'codigo', 'plan_pagos_original', 'zapsign_doc', 'contrato_generado_en']);

function aLocal(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function valorLegible(v: unknown, campo?: string): string {
  if (v === null || v === undefined || v === '') return 'vacío';
  if (typeof v === 'boolean') return v ? 'sí' : 'no';
  const rotulo = campo ? VALORES_CASO[campo]?.[String(v)] : undefined;
  if (rotulo) return rotulo;
  return String(v).length > 60 ? String(v).slice(0, 57) + '…' : String(v);
}

function tituloCambio(h: CambioHistorial): string {
  if (h.tabla === 'crm_casos') {
    if (h.operacion === 'insert') return 'Caso registrado';
    if (h.operacion === 'delete') return 'Caso eliminado';
    return h.cambios.etapa?.despues === 'cerrado' ? 'Caso cerrado' : 'Caso modificado';
  }
  if (h.operacion === 'insert') return h.tabla === 'crm_pagos' ? 'Cuota agregada' : h.tabla === 'crm_contratos' ? 'Contrato cargado' : 'Alta del cliente';
  if (h.operacion === 'delete') return 'Cuota eliminada';
  return h.tabla === 'crm_pagos' ? 'Cuota modificada' : 'Ficha modificada';
}

export const Ficha: React.FC<{ id: string; esAdmin: boolean; puedeGestionar: boolean; verCasos?: boolean; orgNombre: string; cobranza: boolean }> = ({
  id,
  esAdmin,
  puedeGestionar,
  verCasos = true,
  orgNombre,
  cobranza,
}) => {
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
  const soloLectura = Boolean(useVistaPrevia());
  const [casosAbiertos, setCasosAbiertos] = useState(0);

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

  if (noExiste)
    return (
      <div className="wrap py-14">
        <Aviso tipo="error">No existe ese cliente o no tenés acceso.</Aviso>
      </div>
    );
  if (!cliente || !borrador) return <div className="wrap py-14 eyebrow text-piedra">Cargando</div>;

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
      domicilio: borrador.domicilio?.trim() || null,
      servicio: borrador.servicio || null,
      monto_total: borrador.monto_total === null || (borrador.monto_total as unknown) === '' ? null : Number(borrador.monto_total),
      modalidad: borrador.modalidad,
      fecha_onboarding: borrador.fecha_onboarding || null,
      responsable: borrador.responsable?.trim() || null,
      notas: borrador.notas?.trim() || null,
      condiciones: borrador.condiciones?.trim() || null,
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

  const tablaPagos = (
    <div className="overflow-x-auto">
      <table className="tabla tabla-media min-w-[780px]">
        <thead>
          <tr>
            <th>Vencimiento</th>
            <th className="num">Monto</th>
            <th>Estado</th>
            <th>Nota</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {pagos.map((p) => {
            const vencida = p.estado === 'pendiente' && p.vencimiento && p.vencimiento < hoy;
            return (
              <tr key={p.id}>
                <td className="!py-2.5">
                  {p.estado === 'pendiente' ? (
                    <input
                      type="date"
                      aria-label="Vencimiento"
                      className={`${claseInput} h-10 w-[160px] ${vencida ? 'text-[#8a2b20] border-[#8a2b20]' : ''}`}
                      defaultValue={p.vencimiento ?? ''}
                      onBlur={(e) => e.target.value !== (p.vencimiento ?? '') && actualizarPago(p, { vencimiento: e.target.value || null })}
                    />
                  ) : (
                    <span className="text-piedra">{p.fecha_pago ? `Pagó el ${fecha(p.fecha_pago)}` : 'Pagado'}</span>
                  )}
                </td>
                <td className="num !py-2.5">
                  {p.estado === 'pendiente' ? (
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      aria-label="Monto"
                      className={`${claseInput} h-10 w-28 text-right`}
                      defaultValue={p.monto}
                      onBlur={(e) => Number(e.target.value) > 0 && Number(e.target.value) !== p.monto && actualizarPago(p, { monto: Number(e.target.value) })}
                    />
                  ) : (
                    <span className="font-medium">{dinero(p.monto, moneda)}</span>
                  )}
                </td>
                <td>
                  {p.estado === 'pagado' ? <Etiqueta tono="bosque">Pagada</Etiqueta> : vencida ? <Etiqueta tono="alerta">Vencida</Etiqueta> : <Etiqueta>Pendiente</Etiqueta>}
                </td>
                <td className="!py-2.5">
                  <input
                    aria-label="Nota"
                    className={`${claseInput} h-10 min-w-[180px]`}
                    defaultValue={p.nota ?? ''}
                    placeholder="Agregar nota"
                    onBlur={(e) => e.target.value !== (p.nota ?? '') && actualizarPago(p, { nota: e.target.value.trim() || null })}
                  />
                </td>
                <td className="!py-2.5">
                  <div className="flex gap-2 justify-end whitespace-nowrap">
                    {p.estado === 'pendiente' ? (
                      <button type="button" className="inline-flex items-center gap-1.5 px-3 h-10 bg-bosque text-marfil text-sm font-medium hover:bg-bosque-dark disabled:opacity-40" onClick={() => actualizarPago(p, { estado: 'pagado', fecha_pago: hoy })}>
                        <Check size={15} /> Marcar pagada
                      </button>
                    ) : (
                      <button type="button" className="inline-flex items-center gap-1.5 px-3 h-10 border border-tinta text-sm font-medium hover:bg-tinta hover:text-marfil disabled:opacity-40" onClick={() => actualizarPago(p, { estado: 'pendiente', fecha_pago: null })}>
                        <RotateCcw size={15} /> Deshacer
                      </button>
                    )}
                    {puedeGestionar && (
                      <button type="button" aria-label="Eliminar cuota" className="px-3 h-10 text-[#8a2b20] hover:bg-[#f6e7e4] disabled:opacity-40" onClick={() => borrarPago(p)}>
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
          {pagos.length === 0 && (
            <tr>
              <td colSpan={5} className="text-piedra py-8">
                Sin cuotas cargadas.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );

  // Sin seguimiento de cobranza: el plan es una condición contractual (anticipo y cuotas pactadas).
  const anticipos = pagos.filter((p) => p.estado === 'pagado');
  const cuotasPactadas = pagos.filter((p) => p.estado === 'pendiente');
  const tablaPlan = (
    <div className="overflow-x-auto">
      <table className="tabla tabla-media min-w-[720px]">
        <thead>
          <tr>
            <th>Concepto</th>
            <th>Fecha</th>
            <th className="num">Monto</th>
            <th>Nota</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {[...anticipos, ...cuotasPactadas].map((p) => {
            const esAnticipo = p.estado === 'pagado';
            const n = cuotasPactadas.indexOf(p) + 1;
            const campoFecha = esAnticipo ? 'fecha_pago' : 'vencimiento';
            const valorFecha = (esAnticipo ? p.fecha_pago : p.vencimiento) ?? '';
            return (
              <tr key={p.id}>
                <td>
                  <span className="font-heading font-bold text-[15px]">{esAnticipo ? 'Anticipo' : `Cuota ${n}`}</span>
                  {esAnticipo && <span className="block text-xs text-piedra">Abonado al contratar</span>}
                </td>
                <td className="!py-2.5">
                  <input
                    type="date"
                    aria-label="Fecha"
                    className={`${claseInput} h-10 w-[170px]`}
                    defaultValue={valorFecha}
                    onBlur={(e) => e.target.value !== valorFecha && actualizarPago(p, { [campoFecha]: e.target.value || null } as Partial<Pago>)}
                  />
                </td>
                <td className="num !py-2.5">
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    aria-label="Monto"
                    className={`${claseInput} h-10 w-32 text-right`}
                    defaultValue={p.monto}
                    onBlur={(e) => Number(e.target.value) > 0 && Number(e.target.value) !== p.monto && actualizarPago(p, { monto: Number(e.target.value) })}
                  />
                </td>
                <td className="!py-2.5">
                  <input
                    aria-label="Nota"
                    className={`${claseInput} h-10 min-w-[200px]`}
                    defaultValue={p.nota ?? ''}
                    placeholder="Agregar nota"
                    onBlur={(e) => e.target.value !== (p.nota ?? '') && actualizarPago(p, { nota: e.target.value.trim() || null })}
                  />
                </td>
                <td className="!py-2.5 text-right">
                  {puedeGestionar && (
                    <button type="button" aria-label="Eliminar" className="px-3 h-10 text-[#8a2b20] hover:bg-[#f6e7e4] disabled:opacity-40" onClick={() => borrarPago(p)}>
                      <Trash2 size={15} />
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
          {pagos.length === 0 && (
            <tr>
              <td colSpan={5} className="text-piedra py-8">
                Sin plan cargado.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );

  const enlaceOscuro = (url: string | null, texto: string) =>
    url ? (
      <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 font-medium underline underline-offset-4 hover:no-underline">
        {texto} <ExternalLink size={14} aria-hidden="true" />
      </a>
    ) : (
      <span className="text-calido text-sm">Sin cargar</span>
    );

  const etiquetaOscura = (t: string) => <span className="block text-[11px] font-medium uppercase tracking-[0.16em] text-calido mb-2">{t}</span>;

  return (
    <>
      <Encabezado
        eyebrow={
          <>
            <Enlace a="/portal/crm" className="inline-flex items-center gap-1.5 hover:text-bosque">
              <ArrowLeft size={13} aria-hidden="true" /> {orgNombre || 'CRM'}
            </Enlace>
            <span className="mx-2">·</span>
            <span className="tabular-nums">{cliente.codigo}</span>
          </>
        }
        titulo={cliente.nombre}
        bajada={[cliente.servicio && `Programa ${cliente.servicio}`, cliente.email, cliente.responsable && `Responsable ${cliente.responsable}`].filter(Boolean).join(' · ')}
        acciones={
          <>
            {casosAbiertos > 0 && <Etiqueta tono="alerta">{casosAbiertos === 1 ? 'Caso abierto' : `${casosAbiertos} casos abiertos`}</Etiqueta>}
            <Etiqueta tono={TONO_FIRMA[cliente.estado_firma]}>{`Firma ${cliente.estado_firma.toLowerCase()}`}</Etiqueta>
          </>
        }
      />

      <div className="wrap py-10 desk:py-14 flex flex-col gap-14">
        {mensaje && <Aviso tipo={mensaje.tipo}>{mensaje.texto}</Aviso>}
        {cliente.revisar_pagos && (
          <Aviso tipo="error">
            <strong className="font-medium">Plan de pagos a revisar.</strong> Se migró desde la planilla y no se pudo interpretar del todo. Texto original «{cliente.plan_pagos_original}».
          </Aviso>
        )}

        {/* Plan de pagos */}
        <section>
          <TituloSeccion eyebrow={cobranza ? 'Cobranza' : 'Condiciones contractuales'} titulo={cobranza ? 'Plan de pagos' : 'Plan de pagos pactado'} />
          {!cobranza && <p className="text-sm text-piedra -mt-3 mb-6 max-w-[64ch]">Estas condiciones se usan para el contrato. El seguimiento de los cobros lo lleva la empresa en su propio sistema.</p>}
          <Cifras
            items={[
              { titulo: 'Acordado', valor: <Monto n={cliente.monto_total} moneda={moneda} /> },
              { titulo: cobranza ? 'Cobrado' : 'Anticipo', valor: <Monto n={cobrado} moneda={moneda} /> },
              { titulo: cobranza ? 'Pendiente' : 'Saldo en cuotas', valor: <Monto n={pendiente} moneda={moneda} />, nota: cobranza ? undefined : `${cuotasPactadas.length} ${cuotasPactadas.length === 1 ? 'cuota' : 'cuotas'}` },
              { titulo: 'Diferencia', valor: diferencia === 0 ? 'Cierra' : <Monto n={Math.abs(diferencia)} moneda={moneda} />, alerta: diferencia !== 0, nota: diferencia === 0 ? undefined : diferencia > 0 ? 'Falta asignar en cuotas' : 'Las cuotas superan el total' },
            ]}
          />
          <fieldset disabled={soloLectura} className="mt-8 min-w-0">
            {cobranza ? tablaPagos : tablaPlan}
            {nueva ? (
              <form onSubmit={agregarPago} className="mt-6 grid gap-4 tab:grid-cols-[160px_180px_1fr_auto_auto] items-end bg-marfil-oscuro p-5">
                <Campo etiqueta={`Monto (${moneda})`}>
                  <input required type="number" step="0.01" min="0.01" className={claseInput} value={nueva.monto} onChange={(e) => setNueva({ ...nueva, monto: e.target.value })} />
                </Campo>
                <Campo etiqueta="Vencimiento">
                  <input type="date" className={claseInput} value={nueva.vencimiento} onChange={(e) => setNueva({ ...nueva, vencimiento: e.target.value })} />
                </Campo>
                <Campo etiqueta="Nota">
                  <input className={claseInput} value={nueva.nota} onChange={(e) => setNueva({ ...nueva, nota: e.target.value })} />
                </Campo>
                <Button type="submit">Agregar</Button>
                <Button type="button" variant="ghost" onClick={() => setNueva(null)}>
                  Cancelar
                </Button>
              </form>
            ) : (
              !soloLectura && (
                <Button variant="ghost" size="sm" className="mt-6" onClick={() => setNueva({ monto: diferencia > 0 ? String(diferencia) : '', vencimiento: '', nota: '' })}>
                  <Plus size={16} /> Agregar cuota
                </Button>
              )
            )}
          </fieldset>
        </section>

        {verCasos && <CasosCliente clienteId={id} moneda={moneda} soloLectura={soloLectura} alContar={setCasosAbiertos} />}

        <div className="grid gap-12 desk:grid-cols-[7fr_5fr] desk:gap-14 items-start">
          {/* Datos */}
          <form onSubmit={guardarDatos} className="min-w-0">
            <TituloSeccion eyebrow="Ficha" titulo="Datos del cliente" />
            <fieldset disabled={soloLectura} className="flex flex-col gap-6 min-w-0">
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
                <Campo etiqueta="Domicilio">
                  <input className={claseInput} value={borrador.domicilio ?? ''} maxLength={300} onChange={(e) => set('domicilio', e.target.value)} />
                </Campo>
                <Campo etiqueta="Servicio">
                  <select className={claseInput} value={borrador.servicio ?? ''} onChange={(e) => set('servicio', e.target.value)}>
                    <option value="">Sin definir</option>
                    {servicios.map((sv) => (
                      <option key={sv.id} value={sv.clave}>
                        {sv.clave}
                        {sv.nombre ? ` · ${sv.nombre}` : ''}
                      </option>
                    ))}
                    {borrador.servicio && !servicios.some((sv) => sv.clave === borrador.servicio) && <option value={borrador.servicio}>{borrador.servicio}</option>}
                  </select>
                </Campo>
                <Campo etiqueta={`Monto total (${moneda})`}>
                  <input type="number" step="0.01" className={claseInput} value={borrador.monto_total ?? ''} onChange={(e) => set('monto_total', e.target.value === '' ? null : (e.target.value as unknown as number))} />
                </Campo>
                <Campo etiqueta="Modalidad">
                  <select className={claseInput} value={borrador.modalidad} onChange={(e) => set('modalidad', e.target.value as ClienteCrm['modalidad'])}>
                    <option value="Cuotas">Cuotas</option>
                    <option value="PIF">PIF (pago total)</option>
                  </select>
                </Campo>
                <Campo etiqueta="Onboarding">
                  <input type="datetime-local" className={claseInput} value={aLocal(borrador.fecha_onboarding)} onChange={(e) => set('fecha_onboarding', e.target.value ? new Date(e.target.value).toISOString() : null)} />
                </Campo>
                <Campo etiqueta="Responsable (CSM o AM)">
                  <input className={claseInput} value={borrador.responsable ?? ''} onChange={(e) => set('responsable', e.target.value)} />
                </Campo>
              </div>
              <Campo etiqueta="Notas" ayuda="Cualquier información que pueda ser relevante.">
                <textarea rows={4} className={`${claseInput} h-auto py-3`} value={borrador.notas ?? ''} onChange={(e) => set('notas', e.target.value)} />
              </Campo>
              <Campo etiqueta="Condiciones acordadas" ayuda="Descuentos, pagos especiales o lo que se haya pactado fuera del plan. Se usa al armar el contrato. Si las cambiás, volvé a armarlo.">
                <textarea rows={3} className={`${claseInput} h-auto py-3`} value={borrador.condiciones ?? ''} onChange={(e) => set('condiciones', e.target.value)} />
              </Campo>

              {esAdmin && (
                <div className="grid gap-5 tab:grid-cols-2 pt-6" style={{ borderTop: '1px solid rgba(27,31,27,0.15)' }}>
                  <p className="tab:col-span-2 eyebrow text-piedra">Solo FIRMA</p>
                  <Campo etiqueta="Estado de la firma">
                    <select className={claseInput} value={borrador.estado_firma} onChange={(e) => set('estado_firma', e.target.value as EstadoFirma)}>
                      <option>Pendiente</option>
                      <option>Firmado</option>
                      <option>Baja</option>
                    </select>
                  </Campo>
                  <Campo etiqueta="Link contrato de servicio">
                    <input className={claseInput} value={borrador.link_contrato_servicio ?? ''} onChange={(e) => set('link_contrato_servicio', e.target.value)} />
                  </Campo>
                  {contrato && (
                    <>
                      <Campo etiqueta="Link contrato del cliente">
                        <input className={claseInput} value={contrato.link_contrato_cliente ?? ''} onChange={(e) => setContrato({ ...contrato, link_contrato_cliente: e.target.value })} />
                      </Campo>
                      <Campo etiqueta="Link documento generado">
                        <input className={claseInput} value={contrato.link_documento ?? ''} onChange={(e) => setContrato({ ...contrato, link_documento: e.target.value })} />
                      </Campo>
                    </>
                  )}
                  <label className="tab:col-span-2 flex items-center gap-2.5 text-sm">
                    <input type="checkbox" className="w-4 h-4 accent-[#173A2F]" checked={borrador.revisar_pagos} onChange={(e) => set('revisar_pagos', e.target.checked)} />
                    Marcar el plan de pagos para revisar
                  </label>
                </div>
              )}

              {!soloLectura && (
                <div>
                  <Button type="submit" size="lg" disabled={guardando}>
                    {guardando ? 'Guardando…' : 'Guardar cambios'}
                  </Button>
                </div>
              )}
            </fieldset>
          </form>

          {/* Columna lateral */}
          <aside className="flex flex-col gap-10 min-w-0 desk:sticky desk:top-32">
            <div className="panel-carbon relative overflow-hidden p-7 flex flex-col gap-6">
              <div className="flex items-center gap-3">
                <span className="w-10 h-10 bg-marfil text-tinta flex items-center justify-center">
                  <Lock size={18} aria-hidden="true" />
                </span>
                <div>
                  <h3 className="font-heading font-bold text-[20px] leading-tight">Contratos y firma</h3>
                  <p className="text-xs text-calido">Con el modelo del servicio y firma electrónica</p>
                </div>
              </div>
              <div>
                {etiquetaOscura('Estado de la firma')}
                <span className="font-heading font-black text-[28px] leading-none">{cliente.estado_firma}</span>
              </div>
              {cliente.estado_firma !== 'Baja' && (
                <ContratoFirma
                  clienteId={id}
                  soloLectura={soloLectura}
                  recienCreado={new URLSearchParams(window.location.search).has('armando')}
                  etiqueta={etiquetaOscura}
                  alCambiar={() => void cargar()}
                />
              )}
              <div>
                {etiquetaOscura('Contrato de servicio')}
                {enlaceOscuro(cliente.link_contrato_servicio, 'Ver contrato de servicio')}
                <p className="text-xs text-calido mt-1.5">Se completa solo cuando firman todos.</p>
              </div>
              {puedeGestionar && contrato && (
                <>
                  <div>
                    {etiquetaOscura('Contrato del cliente')}
                    {enlaceOscuro(contrato.link_contrato_cliente, 'Ver contrato firmado')}
                    <p className="text-xs text-calido mt-1.5">Reservado. Solo lo ven FIRMA y el titular.</p>
                  </div>
                  <div>
                    {etiquetaOscura('Documento generado')}
                    {enlaceOscuro(contrato.link_documento, 'Ver documento')}
                  </div>
                </>
              )}
            </div>

            {puedeGestionar && historial.length > 0 && (
              <section>
                <TituloSeccion eyebrow="Trazabilidad" titulo="Historial" />
                <ol className="flex flex-col">
                  {historial.map((h) => (
                    <li key={h.id} className="py-3.5 text-sm" style={{ borderTop: '1px solid rgba(27,31,27,0.12)' }}>
                      <div className="flex justify-between gap-3">
                        <span className="font-medium">{tituloCambio(h)}</span>
                        <span className="text-piedra text-xs whitespace-nowrap">{new Date(h.creado_en).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}</span>
                      </div>
                      {h.operacion === 'update' &&
                        (Object.entries(h.cambios) as [string, { antes: unknown; despues: unknown }][])
                          .filter(([k]) => !OCULTOS.has(k))
                          .map(([k, v]) => (
                            <span key={k} className="block text-xs text-piedra mt-1">
                              {ROTULOS[k] ?? k} · {valorLegible(v.antes, k)} → {valorLegible(v.despues, k)}
                            </span>
                          ))}
                    </li>
                  ))}
                </ol>
              </section>
            )}
          </aside>
        </div>
      </div>
    </>
  );
};

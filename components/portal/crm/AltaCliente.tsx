import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from '../../Button';
import { supabase } from '../supabase';
import { navegar } from '../navegacion';
import { Aviso, Campo, claseInput } from '../ui';
import { dinero, hoyISO, type Servicio } from './tipos';

function sumarMeses(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const base = new Date(Date.UTC(y, m - 1 + n, 1));
  const ultimo = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 0)).getUTCDate();
  base.setUTCDate(Math.min(d, ultimo));
  return base.toISOString().slice(0, 10);
}

export const AltaCliente: React.FC<{ orgId: string; esAdmin: boolean }> = ({ orgId, esAdmin }) => {
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [f, setF] = useState({
    nombre: '', dni: '', email: '', telefono: '', servicio: '', monto_total: '', modalidad: 'Cuotas' as 'Cuotas' | 'PIF',
    fecha_onboarding: '', responsable: '', notas: '', pagado: '', cuotas: '2', primera: hoyISO(),
  });
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    supabase
      ?.from('crm_servicios')
      .select('*')
      .eq('organizacion_id', orgId)
      .eq('activo', true)
      .order('clave')
      .then(({ data }) => setServicios((data as Servicio[]) ?? []));
  }, [orgId]);

  const total = Number(f.monto_total.replace(',', '.')) || 0;
  const pagado = Number(f.pagado.replace(',', '.')) || 0;
  const plan = useMemo(() => {
    const saldo = Math.round((total - pagado) * 100) / 100;
    if (saldo <= 0) return [];
    if (f.modalidad === 'PIF') return [{ monto: saldo, vencimiento: f.primera }];
    const n = Math.max(1, Math.min(24, parseInt(f.cuotas, 10) || 1));
    const base = Math.floor((saldo / n) * 100) / 100;
    const resto = Math.round((saldo - base * n) * 100) / 100;
    return Array.from({ length: n }, (_, i) => ({ monto: i === n - 1 ? Math.round((base + resto) * 100) / 100 : base, vencimiento: sumarMeses(f.primera, i) }));
  }, [total, pagado, f.modalidad, f.cuotas, f.primera]);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    if (!total) return setError('Cargá el monto total acordado.');
    if (pagado > total) return setError('El pago inicial no puede superar el total.');
    setGuardando(true);
    setError(null);
    const { data, error: e1 } = await supabase
      .from('crm_clientes')
      .insert({
        organizacion_id: orgId,
        nombre: f.nombre.trim(),
        dni: f.dni.trim() || null,
        email: f.email.trim().toLowerCase() || null,
        telefono: f.telefono.trim() || null,
        servicio: f.servicio || null,
        monto_total: total,
        modalidad: f.modalidad,
        fecha_onboarding: f.fecha_onboarding ? new Date(f.fecha_onboarding).toISOString() : null,
        responsable: f.responsable.trim() || null,
        notas: f.notas.trim() || null,
      })
      .select('id')
      .single();
    if (e1 || !data) {
      setGuardando(false);
      return setError(e1?.message ?? 'No se pudo crear.');
    }
    const filas = [
      ...(pagado > 0 ? [{ cliente_id: data.id, organizacion_id: orgId, monto: pagado, estado: 'pagado', fecha_pago: hoyISO(), nota: 'Pago inicial' }] : []),
      ...plan.map((p) => ({ cliente_id: data.id, organizacion_id: orgId, monto: p.monto, vencimiento: p.vencimiento, estado: 'pendiente' })),
    ];
    if (filas.length) {
      const { error: e2 } = await supabase.from('crm_pagos').insert(filas);
      if (e2) setError(`El cliente se creó pero no se pudieron cargar las cuotas. ${e2.message}`);
    }
    setGuardando(false);
    navegar(`/portal/crm/${data.id}`);
  }

  const set = (k: keyof typeof f, v: string) => setF({ ...f, [k]: v });

  return (
    <form onSubmit={guardar} className="space-y-8 max-w-[760px]">
      <button type="button" onClick={() => navegar('/portal/crm')} className="inline-flex items-center gap-2 text-sm hover:text-bosque">
        <ArrowLeft size={16} /> Volver al listado
      </button>
      <h2 className="h3">Nuevo cliente</h2>
      {error && <Aviso tipo="error">{error}</Aviso>}
      {!esAdmin && <Aviso tipo="info">El cliente queda con la firma pendiente. FIRMA genera el contrato y actualiza el estado.</Aviso>}

      <div className="grid gap-5 tab:grid-cols-2">
        <Campo etiqueta="Nombre completo">
          <input required className={claseInput} value={f.nombre} onChange={(e) => set('nombre', e.target.value)} />
        </Campo>
        <Campo etiqueta="DNI">
          <input className={claseInput} value={f.dni} onChange={(e) => set('dni', e.target.value)} />
        </Campo>
        <Campo etiqueta="Mail">
          <input type="email" required className={claseInput} value={f.email} onChange={(e) => set('email', e.target.value)} />
        </Campo>
        <Campo etiqueta="Teléfono">
          <input className={claseInput} value={f.telefono} onChange={(e) => set('telefono', e.target.value)} />
        </Campo>
        <Campo etiqueta="Servicio">
          <select
            required
            className={claseInput}
            value={f.servicio}
            onChange={(e) => {
              const s = servicios.find((x) => x.clave === e.target.value);
              setF({ ...f, servicio: e.target.value, monto_total: s?.precio ? String(s.precio) : f.monto_total });
            }}
          >
            <option value="">Elegí</option>
            {servicios.map((s) => (
              <option key={s.id} value={s.clave}>
                {s.clave}
                {s.nombre ? ` · ${s.nombre}` : ''}
              </option>
            ))}
          </select>
        </Campo>
        <Campo etiqueta="Monto total acordado (USD)">
          <input required type="number" step="0.01" min="1" className={claseInput} value={f.monto_total} onChange={(e) => set('monto_total', e.target.value)} />
        </Campo>
        <Campo etiqueta="Onboarding">
          <input type="datetime-local" className={claseInput} value={f.fecha_onboarding} onChange={(e) => set('fecha_onboarding', e.target.value)} />
        </Campo>
        <Campo etiqueta="Responsable (CSM o AM)">
          <input className={claseInput} value={f.responsable} onChange={(e) => set('responsable', e.target.value)} />
        </Campo>
      </div>

      <fieldset className="border border-[rgba(27,31,27,0.15)] bg-white p-5 space-y-5">
        <legend className="px-2 font-medium">Plan de pagos</legend>
        <div className="grid gap-5 tab:grid-cols-4">
          <Campo etiqueta="Modalidad">
            <select className={claseInput} value={f.modalidad} onChange={(e) => set('modalidad', e.target.value)}>
              <option value="Cuotas">Cuotas</option>
              <option value="PIF">PIF (pago total)</option>
            </select>
          </Campo>
          <Campo etiqueta="Ya pagó">
            <input type="number" step="0.01" min="0" className={claseInput} value={f.pagado} onChange={(e) => set('pagado', e.target.value)} />
          </Campo>
          {f.modalidad === 'Cuotas' && (
            <Campo etiqueta="Cuotas del saldo">
              <input type="number" min="1" max="24" className={claseInput} value={f.cuotas} onChange={(e) => set('cuotas', e.target.value)} />
            </Campo>
          )}
          <Campo etiqueta={f.modalidad === 'PIF' ? 'Vence el saldo' : 'Primera cuota'}>
            <input type="date" className={claseInput} value={f.primera} onChange={(e) => set('primera', e.target.value)} />
          </Campo>
        </div>
        {plan.length > 0 && (
          <ul className="text-sm space-y-1">
            {plan.map((p, i) => (
              <li key={i} className="tabular-nums">
                {p.vencimiento.split('-').reverse().join('/')} · {dinero(p.monto)}
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-piedra">Después podés ajustar montos y fechas de cada cuota desde la ficha.</p>
      </fieldset>

      <Campo etiqueta="Notas">
        <textarea rows={3} className={`${claseInput} h-auto py-2`} value={f.notas} onChange={(e) => set('notas', e.target.value)} />
      </Campo>

      <Button type="submit" disabled={guardando}>
        {guardando ? 'Guardando…' : 'Crear cliente'}
      </Button>
    </form>
  );
};

import React, { useEffect, useState } from 'react';
import { ArrowLeft, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { Button } from '../../Button';
import { supabase } from '../supabase';
import { navegar } from '../navegacion';
import { Aviso, Campo, Encabezado, Enlace, TituloSeccion, claseInput } from '../ui';
import { useVistaPrevia } from '../vistaPrevia';
import { generarBorrador } from './borrador';
import { dinero, hoyISO, type Servicio } from './tipos';

const FECHA_VALIDA = /^\d{4}-\d{2}-\d{2}$/;

function sumarMeses(iso: string, n: number): string {
  if (!FECHA_VALIDA.test(iso)) return '';
  const [y, m, d] = iso.split('-').map(Number);
  const base = new Date(Date.UTC(y, m - 1 + n, 1));
  const ultimo = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 0)).getUTCDate();
  base.setUTCDate(Math.min(d, ultimo));
  return base.toISOString().slice(0, 10);
}

/** Los montos se comparan en centavos para que la suma cierre exacta. */
function aCentavos(v: string): number {
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

function aTexto(centavos: number): string {
  return (centavos / 100).toFixed(2).replace(/\.00$/, '');
}

interface Cuota {
  monto: string;
  vencimiento: string;
}

/** Reparte el saldo en partes iguales. La diferencia de redondeo va en la última cuota. */
function repartir(saldo: number, cantidad: number, primera: string): Cuota[] {
  if (saldo <= 0 || cantidad < 1) return [];
  const base = Math.floor(saldo / cantidad);
  const resto = saldo - base * cantidad;
  return Array.from({ length: cantidad }, (_, i) => ({ monto: aTexto(i === cantidad - 1 ? base + resto : base), vencimiento: sumarMeses(primera, i) }));
}

export const AltaCliente: React.FC<{ orgId: string; esAdmin: boolean; orgNombre: string; cobranza: boolean; zapsign?: boolean }> = ({ orgId, esAdmin, orgNombre }) => {
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [f, setF] = useState({
    nombre: '', dni: '', email: '', telefono: '', domicilio: '', servicio: '', monto_total: '', modalidad: 'Cuotas' as 'Cuotas' | 'PIF',
    fecha_onboarding: '', responsable: '', notas: '', condiciones: '', anticipo: '', cantidad: '2', primera: hoyISO(),
  });
  const [cuotas, setCuotas] = useState<Cuota[]>([]);
  const [manual, setManual] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [etapa, setEtapa] = useState<'' | 'guardando'>('');
  const soloLectura = Boolean(useVistaPrevia());

  useEffect(() => {
    supabase
      ?.from('crm_servicios')
      .select('*')
      .eq('organizacion_id', orgId)
      .eq('activo', true)
      .order('clave')
      .then(({ data }) => setServicios((data as Servicio[]) ?? []));
  }, [orgId]);

  const total = aCentavos(f.monto_total);
  const anticipo = aCentavos(f.anticipo);
  const cantidad = f.modalidad === 'PIF' ? 1 : Math.max(1, Math.min(36, parseInt(f.cantidad, 10) || 1));

  // Mientras no se toquen las cuotas a mano, el plan se reparte solo.
  useEffect(() => {
    if (manual) return;
    setCuotas(repartir(total - anticipo, cantidad, f.primera));
  }, [manual, total, anticipo, cantidad, f.primera]);

  // Validación. Anticipo más la suma de las cuotas tiene que dar el monto acordado.
  const montos = cuotas.map((c) => aCentavos(c.monto));
  const sumaCuotas = montos.reduce((a, b) => a + b, 0);
  const suma = anticipo + sumaCuotas;
  const diferencia = total - suma;
  let problema: string | null = null;
  if (total <= 0) problema = 'Cargá el monto total acordado para armar el plan.';
  else if (anticipo > total) problema = 'El anticipo supera el monto total acordado.';
  else if (montos.some((m) => m <= 0)) problema = 'Cada cuota necesita un monto mayor a cero.';
  else if (cuotas.some((c) => !FECHA_VALIDA.test(c.vencimiento))) problema = 'Cada cuota necesita su fecha de vencimiento.';
  else if (diferencia !== 0)
    problema = `Anticipo más cuotas suman ${dinero(suma / 100)} y el monto acordado es ${dinero(total / 100)}. ${diferencia > 0 ? 'Faltan' : 'Sobran'} ${dinero(Math.abs(diferencia) / 100)}.`;
  const valido = problema === null;
  const tonoResumen = valido ? 'ok' : total <= 0 ? 'info' : 'error';

  function editarCuota(i: number, cambios: Partial<Cuota>) {
    setManual(true);
    setCuotas(cuotas.map((c, j) => (j === i ? { ...c, ...cambios } : c)));
  }

  function quitarCuota(i: number) {
    setManual(true);
    setCuotas(cuotas.filter((_, j) => j !== i));
  }

  function agregarCuota() {
    setManual(true);
    const ultima = cuotas[cuotas.length - 1]?.vencimiento;
    setCuotas([...cuotas, { monto: diferencia > 0 ? aTexto(diferencia) : '', vencimiento: ultima ? sumarMeses(ultima, 1) : f.primera }]);
  }

  function cambiarPrimera(v: string) {
    setF({ ...f, primera: v });
    // Con cuotas editadas a mano se corren las fechas y se respetan los montos.
    if (manual && FECHA_VALIDA.test(v)) setCuotas(cuotas.map((c, i) => ({ ...c, vencimiento: sumarMeses(v, i) })));
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    if (!valido) return setError(problema);
    setEtapa('guardando');
    setError(null);
    const { data, error: e1 } = await supabase
      .from('crm_clientes')
      .insert({
        organizacion_id: orgId,
        nombre: f.nombre.trim(),
        dni: f.dni.trim() || null,
        email: f.email.trim().toLowerCase() || null,
        telefono: f.telefono.trim() || null,
        domicilio: f.domicilio.trim() || null,
        servicio: f.servicio || null,
        monto_total: total / 100,
        modalidad: f.modalidad,
        fecha_onboarding: f.fecha_onboarding ? new Date(f.fecha_onboarding).toISOString() : null,
        responsable: f.responsable.trim() || null,
        notas: f.notas.trim() || null,
        condiciones: f.condiciones.trim() || null,
      })
      .select('id')
      .single();
    if (e1 || !data) {
      setEtapa('');
      return setError(e1?.message ?? 'No se pudo crear.');
    }
    const filas = [
      ...(anticipo > 0 ? [{ cliente_id: data.id, organizacion_id: orgId, monto: anticipo / 100, estado: 'pagado', fecha_pago: hoyISO(), nota: 'Anticipo' }] : []),
      ...cuotas.map((c) => ({ cliente_id: data.id, organizacion_id: orgId, monto: aCentavos(c.monto) / 100, vencimiento: c.vencimiento, estado: 'pendiente' })),
    ];
    let planOk = true;
    if (filas.length) {
      const { error: e2 } = await supabase.from('crm_pagos').insert(filas);
      planOk = !e2;
    }
    // El borrador se arma con el plan completo y tarda uno o dos minutos, así que no se espera:
    // la ficha muestra el estado y permite reintentar. El envío a firmar lo hace FIRMA a mano.
    if (planOk) void generarBorrador(data.id);
    setEtapa('');
    navegar(`/portal/crm/${data.id}${planOk ? '?armando=1' : ''}`);
  }

  const set = (k: keyof typeof f, v: string) => setF({ ...f, [k]: v });

  if (soloLectura)
    return (
      <div className="wrap py-14">
        <Aviso tipo="info">En la vista previa no se pueden crear clientes.</Aviso>
      </div>
    );

  const estiloResumen = {
    ok: 'border-bosque bg-[#E4E9E3] text-bosque',
    error: 'border-[#8a2b20] bg-[#f6e7e4] text-[#5c1d15]',
    info: 'border-tinta bg-marfil-oscuro text-tinta',
  }[tonoResumen];

  return (
    <>
    <Encabezado
      eyebrow={
        <Enlace a="/portal/crm" className="inline-flex items-center gap-1.5 hover:text-bosque">
          <ArrowLeft size={13} aria-hidden="true" /> {orgNombre || 'CRM'}
        </Enlace>
      }
      titulo={
        <>
          Nuevo <span className="text-bosque">cliente</span>
        </>
      }
      bajada="Cargá los datos y el plan de pagos. Al crear el cliente se arma el borrador del contrato y queda en Drive para que FIRMA lo revise."
    />
    <form onSubmit={guardar} className="wrap py-10 desk:py-14 flex flex-col gap-10 max-w-[860px] desk:ml-0">
      <TituloSeccion eyebrow="Paso 1" titulo="Datos del cliente" />
      {error && <Aviso tipo="error">{error}</Aviso>}
      {!esAdmin && (
        <Aviso tipo="info">
          El cliente queda con la firma pendiente. El contrato se arma solo, FIRMA lo revisa, lo envía a firmar y actualiza el estado.
        </Aviso>
      )}

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
        <div className="tab:col-span-2">
          <Campo etiqueta="Domicilio" ayuda="Calle, número, localidad, provincia y país. Va en el contrato.">
            <input className={claseInput} value={f.domicilio} maxLength={300} onChange={(e) => set('domicilio', e.target.value)} />
          </Campo>
        </div>
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
        <Campo etiqueta="Monto total acordado (USD)" ayuda="Arranca con el ticket del servicio, si tiene. Cambialo si hubo descuento.">
          <input required type="number" step="0.01" min="1" className={claseInput} value={f.monto_total} onChange={(e) => set('monto_total', e.target.value)} />
        </Campo>
        <Campo etiqueta="Onboarding">
          <input type="datetime-local" className={claseInput} value={f.fecha_onboarding} onChange={(e) => set('fecha_onboarding', e.target.value)} />
        </Campo>
        <Campo etiqueta="Responsable (CSM o AM)">
          <input className={claseInput} value={f.responsable} onChange={(e) => set('responsable', e.target.value)} />
        </Campo>
      </div>

      <fieldset className="flex flex-col gap-6 pt-8 min-w-0" style={{ borderTop: '1px solid rgba(27,31,27,0.15)' }}>
        <TituloSeccion eyebrow="Paso 2" titulo="Plan de pagos" />
        <div className="grid gap-5 tab:grid-cols-2 desk:grid-cols-4">
          <Campo etiqueta="Modalidad">
            <select
              className={claseInput}
              value={f.modalidad}
              onChange={(e) => {
                set('modalidad', e.target.value);
                setManual(false);
              }}
            >
              <option value="Cuotas">Cuotas</option>
              <option value="PIF">PIF (pago total)</option>
            </select>
          </Campo>
          <Campo etiqueta="Anticipo (USD) *" ayuda="* Todo lo que se pague antes del día del onboarding.">
            <input
              type="number"
              step="0.01"
              min="0"
              className={claseInput}
              title="Todo lo que se pague antes del día del onboarding."
              value={f.anticipo}
              onChange={(e) => set('anticipo', e.target.value)}
            />
          </Campo>
          {f.modalidad === 'Cuotas' && (
            <Campo etiqueta="Cantidad de cuotas">
              <input
                type="number"
                min="1"
                max="36"
                className={claseInput}
                value={f.cantidad}
                onChange={(e) => {
                  set('cantidad', e.target.value);
                  setManual(false);
                }}
              />
            </Campo>
          )}
          <Campo etiqueta={f.modalidad === 'PIF' ? 'Vence el saldo' : 'Primera cuota'}>
            <input type="date" className={claseInput} value={f.primera} onChange={(e) => cambiarPrimera(e.target.value)} />
          </Campo>
        </div>

        <div className="flex flex-col gap-3">
          {cuotas.length > 0 && (
            <div className="grid grid-cols-[36px_minmax(0,1fr)_minmax(0,1fr)_44px] gap-3 text-[11px] font-medium uppercase tracking-[0.16em] text-piedra">
              <span>#</span>
              <span>Monto (USD)</span>
              <span>Vencimiento</span>
              <span />
            </div>
          )}
          {cuotas.map((c, i) => (
            <div key={i} className="grid grid-cols-[36px_minmax(0,1fr)_minmax(0,1fr)_44px] gap-3 items-center">
              <span className="font-heading font-black text-[20px] text-bosque tabular-nums">{i + 1}</span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                aria-label={`Monto de la cuota ${i + 1}`}
                className={claseInput}
                value={c.monto}
                onChange={(e) => editarCuota(i, { monto: e.target.value })}
              />
              <input
                type="date"
                aria-label={`Vencimiento de la cuota ${i + 1}`}
                className={claseInput}
                value={c.vencimiento}
                onChange={(e) => editarCuota(i, { vencimiento: e.target.value })}
              />
              <button
                type="button"
                aria-label={`Quitar la cuota ${i + 1}`}
                title="Quitar cuota"
                onClick={() => quitarCuota(i)}
                className="h-12 w-11 inline-flex items-center justify-center text-piedra hover:text-[#8a2b20] transition-colors duration-150"
              >
                <Trash2 size={16} aria-hidden="true" />
              </button>
            </div>
          ))}
          <div className="flex flex-wrap gap-3">
            <Button type="button" variant="ghost" size="sm" onClick={agregarCuota}>
              <Plus size={16} /> Agregar cuota
            </Button>
            {manual && (
              <Button type="button" variant="ghost" size="sm" onClick={() => setManual(false)}>
                <RotateCcw size={16} /> Repartir el saldo en partes iguales
              </Button>
            )}
          </div>
        </div>

        <div role="status" aria-live="polite" className={`border-l-[3px] px-4 py-3 text-sm leading-[1.5] ${estiloResumen}`}>
          <div className="flex flex-wrap gap-x-6 gap-y-1 tabular-nums">
            <span>Anticipo {dinero(anticipo / 100)}</span>
            <span>
              Cuotas {dinero(sumaCuotas / 100)} en {cuotas.length} {cuotas.length === 1 ? 'pago' : 'pagos'}
            </span>
            <span>
              Total {dinero(suma / 100)} de {dinero(total / 100)}
            </span>
          </div>
          <p className="mt-1 font-medium">{problema ?? 'El plan cierra exacto con el monto acordado.'}</p>
        </div>
        <p className="text-xs text-piedra">Después podés ajustar montos y fechas de cada cuota desde la ficha.</p>
      </fieldset>

      <Campo
        etiqueta="Condiciones acordadas (opcional)"
        ayuda="Escribilo como lo pactaste: descuentos, pagos especiales, bonificaciones o cualquier cosa que no entre en el plan. Claude lo interpreta al armar el contrato."
      >
        <textarea
          rows={3}
          className={`${claseInput} h-auto py-2`}
          placeholder="Ej. 10% off por pago en 48 h, la segunda cuota la paga cuando cobre la comisión de octubre"
          value={f.condiciones}
          onChange={(e) => set('condiciones', e.target.value)}
        />
      </Campo>

      <Campo etiqueta="Notas">
        <textarea rows={3} className={`${claseInput} h-auto py-2`} value={f.notas} onChange={(e) => set('notas', e.target.value)} />
      </Campo>

      <div className="flex flex-col gap-3 items-start">
        <Button type="submit" size="lg" disabled={!valido || etapa !== ''} className="disabled:opacity-45 disabled:cursor-not-allowed">
          {etapa === 'guardando' ? 'Guardando…' : 'Crear cliente'}
        </Button>
        {!valido && <p className="text-xs text-piedra">Se habilita cuando anticipo más cuotas suman exacto el monto acordado.</p>}
      </div>
    </form>
    </>
  );
};

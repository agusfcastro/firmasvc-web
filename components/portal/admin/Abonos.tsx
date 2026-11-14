import React, { useEffect, useState } from 'react';
import { Plus, RefreshCw } from 'lucide-react';
import { Button } from '../../Button';
import { supabase } from '../supabase';
import { Aviso, Campo, Cifras, Etiqueta, Monto, claseInput } from '../ui';
import type { Organizacion } from '../tipos';
import {
  ESTADO_ABONO,
  ESTADO_PAGO,
  FUNDADOR_CUPO,
  FUNDADOR_HASTA,
  MEDIO_MANUAL,
  OFERTAS,
  PAISES_DLOCALGO,
  PROCESADOR,
  consultarDisponibilidad,
  consultarMep,
  cuotaPorAutorizar,
  diagnosticarDlocal,
  enPagoUnico,
  esPagoManual,
  fechaCorta,
  fechaDia,
  fechaLarga,
  hora,
  llamarPagos,
  monedaReferencia,
  montoPagado,
  montoTexto,
  pagosAprobados,
  periodoTexto,
  pesosAlMep,
  resumenEsquema,
  sincronizarAbono,
  type Abono,
  type Diagnostico,
  type Disponibilidad,
  type Modalidad,
  type MonedaAbono,
  type PagoAbono,
  type PeriodoAbono,
  type PlanServicio,
  vigenciaVencida,
} from '../abonos';

/**
 * Abonos mensuales con tarjeta, cobrados con dLocal Go. FIRMA arma cada
 * abono como borrador (empresa, concepto, monto, moneda, país y mail del
 * pagador) y lo puede editar hasta que el titular lo activa. Un abono activo
 * no cambia de monto. Para cambiarlo se da de baja y se arma otro. Estado y
 * pagos llegan de dLocal Go y no se editan a mano.
 * Con la oferta de noviembre de 2026 el abono lleva un esquema: tres cuotas
 * y después la cuota posterior, o pago completo y después la cuota posterior
 * congelada. En ese caso el monto sí cambia, solo, cuando termina la etapa
 * inicial. Se puede cobrar en dólares o en pesos al dólar MEP.
 */

interface Borrador {
  id?: string;
  organizacion_id: string;
  concepto: string;
  monto: string;
  moneda: MonedaAbono;
  periodo: PeriodoAbono;
  email_pagador: string;
  /** AAAA-MM-DD, o vacío si el abono no tiene fecha de fin. */
  vigente_hasta: string;
  /** La que tenía al abrir el borrador, para no mandar la columna si no cambió. */
  vigenteAntes?: string;
  /** Opción de OFERTAS, o vacío para un monto especial sin esquema. */
  oferta: string;
  plan_servicio: PlanServicio | '';
  modalidad: Modalidad | '';
  /** Montos del esquema, en dólares. */
  inicial: string;
  posterior: string;
  cuotas: string;
  meses: string;
  congela: string;
  fundador: boolean;
  /** Con esquema: en dólares o en pesos al dólar MEP. */
  cobro: 'USD' | 'MEP';
  /** Ya tenía esquema: si pasa a monto especial se limpian sus columnas. */
  teniaEsquema?: boolean;
}

type Mep = { valor: number; fuente: string; fecha: string };

/** Llena el borrador con una opción de la oferta. */
function conOferta(b: Borrador, id: string): Borrador {
  const o = OFERTAS.find((x) => x.id === id);
  if (!o) return { ...b, oferta: '', plan_servicio: '', modalidad: '', fundador: false };
  return {
    ...b,
    oferta: o.id,
    concepto: o.concepto,
    plan_servicio: o.plan,
    modalidad: o.modalidad,
    inicial: String(o.inicial),
    posterior: String(o.posterior),
    cuotas: String(o.cuotas ?? 3),
    meses: String(o.meses ?? 4),
    congela: o.congela ? String(o.congela) : '',
    fundador: Boolean(o.fundador),
    periodo: 1,
  };
}

/** Número de un campo, con coma o punto. */
const numero = (v: string): number => Number(String(v).replace(',', '.'));

interface PerfilCorto {
  id: string;
  email: string;
  rol: string;
  organizacion_id: string | null;
  activo: boolean;
}

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const SIN_MONTO = 'Un abono activo no cambia de monto. Para cambiarlo, dalo de baja y armá uno nuevo.';

function errorAmable(mensaje: string): string {
  if (/abonos_ars_argentina/.test(mensaje)) return 'En pesos solo se le puede cobrar a un pagador de Argentina.';
  if (/pais/.test(mensaje) && /check/.test(mensaje)) return 'Ese país no está habilitado para cobrar con dLocal Go.';
  if (/moneda/.test(mensaje) && /check/.test(mensaje)) return 'La moneda tiene que ser ARS o USD.';
  if (/email_pagador/.test(mensaje)) return 'El mail del pagador no tiene un formato válido.';
  if (/concepto/.test(mensaje)) return 'El concepto tiene que tener entre 3 y 120 caracteres.';
  if (/row-level security|permission denied/i.test(mensaje)) return 'Solo se pueden editar abonos por activar.';
  if (/precio fundador|5 empresas/i.test(mensaje)) return mensaje;
  if (/abonos_fundador/.test(mensaje)) return 'El precio fundador es solo con pago completo.';
  if (/abonos_al_mep/.test(mensaje)) return 'En pesos al MEP falta la cotización del dólar. Probá de nuevo.';
  if (/abonos_modalidad/.test(mensaje)) return 'Revisá los montos, las cuotas y los meses del esquema.';
  if (/column .* does not exist|schema cache/i.test(mensaje)) return `${mensaje}. Revisá que la migración 0061_abonos_oferta.sql esté corrida en Supabase.`;
  return mensaje;
}

const Dato: React.FC<{ titulo: string; children: React.ReactNode; mono?: boolean }> = ({ titulo, children, mono }) => (
  <div>
    <dt className="text-[12.5px] font-medium text-piedra mb-1">{titulo}</dt>
    <dd className={mono ? 'font-mono text-[12px] break-all' : 'break-words'}>{children}</dd>
  </div>
);

/** Hoy en Buenos Aires, como AAAA-MM-DD, para el campo de fecha. */
const hoy = (): string => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date());

/** Medio que se propone según la moneda del pago. */
const medioPorMoneda = (moneda: string): string => (moneda === 'ARS' ? 'transferencia_ars' : 'transferencia_usd');

const Detalle: React.FC<{
  abono: Abono;
  pagos: PagoAbono[];
  mails: Record<string, string>;
  alEditar: () => void;
  alCambiar: (mensaje: string) => void;
  alError: (mensaje: string) => void;
}> = ({ abono, pagos, mails, alEditar, alCambiar, alError }) => {
  const [confirmandoBaja, setConfirmandoBaja] = useState(false);
  const [ocupado, setOcupado] = useState<string>('');
  const [manual, setManual] = useState<{ fecha: string; monto: string; moneda: MonedaAbono; medio: string; nota: string } | null>(null);
  const [vigencia, setVigencia] = useState<string | null>(null);
  const editable = abono.estado === 'borrador';
  const gestionable = abono.estado !== 'borrador' && abono.estado !== 'cancelado';
  const aprobados = pagosAprobados(abono, pagos);
  // En cuotas, con las cuotas iniciales pagas el plan ya tendría que estar en el monto posterior.
  const cuotaTrabada = abono.modalidad === 'cuotas' && abono.etapa === 'inicial' && Boolean(abono.plan_id) && aprobados >= (abono.cuotas_iniciales ?? 1);
  const etapaTexto =
    abono.modalidad === 'cuotas'
      ? abono.etapa === 'inicial'
        ? `Etapa inicial, ${aprobados} de ${abono.cuotas_iniciales} cuotas pagas`
        : 'Rige la cuota posterior'
      : abono.modalidad === 'pago_completo'
        ? abono.etapa === 'inicial'
          ? 'Esperando el pago completo'
          : cuotaPorAutorizar(abono)
            ? `Pago completo acreditado, cubre hasta el ${fechaLarga(abono.proximo_cobro)}. Falta que el titular autorice el débito de la cuota`
            : 'Rige la cuota posterior'
        : '';

  async function actualizar() {
    setOcupado('estado');
    const r = await sincronizarAbono(abono.id);
    setOcupado('');
    if (!r.ok) return alError(r.error ?? 'No se pudo actualizar el estado.');
    const nuevos = r.datos?.nuevos ?? 0;
    const estado = r.datos?.estado && ESTADO_ABONO[r.datos.estado] ? ESTADO_ABONO[r.datos.estado].titulo : null;
    const partes = [estado ? `Ahora figura como ${estado}` : '', nuevos ? `${nuevos} ${nuevos === 1 ? 'cobro nuevo' : 'cobros nuevos'}` : ''].filter(Boolean);
    alCambiar(`Estado actualizado con dLocal Go.${partes.length ? ` ${partes.join(', con ')}.` : ''}`);
  }

  function abrirManual() {
    setManual({ fecha: hoy(), monto: String(Number(abono.monto)), moneda: abono.moneda, medio: medioPorMoneda(abono.moneda), nota: '' });
  }

  async function registrarPago(e: React.FormEvent) {
    e.preventDefault();
    if (!manual) return;
    setOcupado('manual');
    const r = await llamarPagos('gestionar', { abono_id: abono.id, accion: 'pago_manual', ...manual, monto: Number(manual.monto.replace(',', '.')) });
    setOcupado('');
    if (!r.ok) return alError(r.error ?? 'No se pudo registrar el pago.');
    setManual(null);
    alCambiar(abono.plan_id ? 'Pago registrado en el historial.' : 'Pago registrado. El abono quedó al día.');
  }

  async function borrarPago(p: PagoAbono) {
    if (!window.confirm(`¿Borrar el pago manual del ${fechaCorta(p.fecha)} por ${montoPagado(p, abono)}?`)) return;
    setOcupado(`borrar-${p.id}`);
    const r = await llamarPagos('gestionar', { abono_id: abono.id, accion: 'borrar_pago_manual', pago_id: p.id });
    setOcupado('');
    if (!r.ok) return alError(r.error ?? 'No se pudo borrar el pago.');
    alCambiar('Pago manual borrado.');
  }

  async function guardarVigencia(e: React.FormEvent) {
    e.preventDefault();
    if (vigencia === null) return;
    setOcupado('vigencia');
    const r = await llamarPagos('gestionar', { abono_id: abono.id, accion: 'vigencia', vigente_hasta: vigencia || null });
    setOcupado('');
    if (!r.ok) return alError(r.error ?? 'No se pudo guardar la vigencia.');
    setVigencia(null);
    alCambiar(vigencia ? `Vigencia guardada: hasta el ${fechaDia(vigencia, true)}.` : 'Vigencia quitada. El abono queda sin fecha de fin.');
  }

  async function darDeBaja() {
    setOcupado('baja');
    const r = await llamarPagos<{ sin_cambios?: boolean }>('gestionar', { abono_id: abono.id, accion: 'baja' });
    setOcupado('');
    setConfirmandoBaja(false);
    if (!r.ok) return alError(r.error ?? 'No se pudo dar de baja.');
    alCambiar(r.datos?.sin_cambios ? 'El abono ya estaba dado de baja.' : 'Abono dado de baja. dLocal Go no hace más débitos.');
  }

  /** Para los abonos de prueba ya dados de baja. Borra también su historial de pagos. */
  async function borrarDeBaja() {
    const n = pagos.length;
    const detalle = n ? ` y ${n === 1 ? 'su pago' : `sus ${n} pagos`} del historial` : '';
    if (!window.confirm(`¿Borrar ${abono.concepto}${detalle}? Es para abonos de prueba y no se puede deshacer.`)) return;
    setOcupado('borrar');
    const r = await llamarPagos('gestionar', { abono_id: abono.id, accion: 'borrar' });
    setOcupado('');
    if (!r.ok) return alError(r.error ?? 'No se pudo borrar el abono.');
    alCambiar('Abono borrado.');
  }

  async function borrar() {
    if (!supabase || !window.confirm(`¿Borrar el borrador ${abono.concepto}? No se puede deshacer.`)) return;
    setOcupado('borrar');
    const { error } = await supabase.from('abonos').delete().eq('id', abono.id);
    setOcupado('');
    if (error) return alError(errorAmable(error.message));
    alCambiar('Borrador eliminado.');
  }

  return (
    <div className="grid gap-8 desk:grid-cols-[minmax(0,1fr)_320px] bg-marfil-oscuro p-6 desk:p-8">
      <div className="flex flex-col gap-6 min-w-0">
        <dl className="grid gap-x-8 gap-y-4 tab:grid-cols-2 text-sm">
          <Dato titulo="Procesador">{PROCESADOR}</Dato>
          <Dato titulo="Periodicidad">{enPagoUnico(abono) ? 'Pago completo, por única vez' : abono.periodo_meses === 3 ? 'Cada 3 meses, por adelantado' : 'Mensual'}</Dato>
          {abono.modalidad && (
            <>
              <Dato titulo="Esquema">
                {resumenEsquema(abono)}
                {abono.precio_fundador ? '. Precio fundador' : ''}
              </Dato>
              <Dato titulo="Etapa">{etapaTexto}</Dato>
            </>
          )}
          {abono.congelado_hasta && <Dato titulo="Cuota congelada hasta">{fechaDia(abono.congelado_hasta, true)}</Dato>}
          {abono.al_mep && (
            <Dato titulo="Pesos al dólar MEP">
              {montoTexto(Number(abono.monto_usd), 'USD')} son {montoTexto(abono.monto, 'ARS')} con el MEP a {montoTexto(Number(abono.cotizacion_mep), 'ARS')}
              {abono.cotizado_en ? `, del ${fechaCorta(abono.cotizado_en)}` : ''}. Se actualiza antes de cada cobro.
            </Dato>
          )}
          <Dato titulo="Mail del pagador">{abono.email_pagador}</Dato>
          <Dato titulo="Aceptación del débito">
            {abono.aceptado_en
              ? `${fechaLarga(abono.aceptado_en)}, ${hora(abono.aceptado_en)}${abono.aceptado_por && mails[abono.aceptado_por] ? `, por ${mails[abono.aceptado_por]}` : ''}`
              : 'Sin aceptar todavía'}
          </Dato>
          <Dato titulo="Plan en dLocal Go" mono>
            {abono.plan_id ?? '·'}
          </Dato>
          <Dato titulo="Suscripción vigente" mono>
            {abono.suscripcion_id ?? '·'}
          </Dato>
          {abono.cancelado_en && <Dato titulo="Dado de baja">{fechaLarga(abono.cancelado_en)}</Dato>}
          <Dato titulo="Vigente hasta">
            {vigencia === null ? (
              <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className={vigenciaVencida(abono) ? 'text-peligro' : undefined}>
                  {abono.vigente_hasta ? `${fechaDia(abono.vigente_hasta, true)}${vigenciaVencida(abono) ? ', vencida' : ''}` : 'Sin fecha de fin'}
                </span>
                {!editable && (
                  <button type="button" className="text-xs underline underline-offset-4 text-piedra hover:text-tinta" onClick={() => setVigencia(abono.vigente_hasta ?? '')}>
                    Cambiar
                  </button>
                )}
              </span>
            ) : (
              <form onSubmit={guardarVigencia} className="flex flex-wrap items-center gap-2">
                <input type="date" aria-label="Vigente hasta" className={`${claseInput} max-w-[180px]`} value={vigencia} onChange={(e) => setVigencia(e.target.value)} />
                <Button type="submit" size="sm" disabled={ocupado !== ''}>
                  {ocupado === 'vigencia' ? 'Guardando…' : 'Guardar'}
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setVigencia(null)}>
                  Cancelar
                </Button>
              </form>
            )}
          </Dato>
        </dl>

        <div className="flex flex-col gap-3">
          <h3 className="eyebrow text-piedra">Historial de pagos</h3>
          {pagos.length === 0 ? (
            <p className="text-sm text-piedra">Todavía no hay pagos registrados.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="tabla tabla-media min-w-[600px]">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th className="num">Monto</th>
                    <th className="num">Recibido</th>
                    <th>Estado</th>
                    <th>Cobro</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {pagos.map((p) => (
                    <tr key={p.id}>
                      <td className="whitespace-nowrap">{fechaCorta(p.fecha)}</td>
                      <td className="num whitespace-nowrap">{montoPagado(p, abono)}</td>
                      <td className="num whitespace-nowrap">
                        {p.monto_recibido !== null && p.monto_recibido !== '' ? montoTexto(p.monto_recibido, p.detalle?.moneda_saldo || p.moneda) : <span className="text-piedra">·</span>}
                      </td>
                      <td>
                        <Etiqueta tono={ESTADO_PAGO[p.estado].tono}>{ESTADO_PAGO[p.estado].titulo}</Etiqueta>
                      </td>
                      {esPagoManual(p) ? (
                        <td className="text-xs text-piedra">
                          {MEDIO_MANUAL[String(p.detalle?.medio)] ?? 'Pago manual'}
                          {p.detalle?.nota ? <span className="block mt-0.5 italic">{String(p.detalle.nota)}</span> : null}
                        </td>
                      ) : (
                        <td className="text-xs font-mono text-piedra">{p.cobro_id}</td>
                      )}
                      <td className="text-right">
                        {esPagoManual(p) && (
                          <button type="button" className="text-xs underline underline-offset-4 text-piedra hover:text-tinta disabled:opacity-50" onClick={() => borrarPago(p)} disabled={ocupado !== ''}>
                            {ocupado === `borrar-${p.id}` ? 'Borrando…' : 'Borrar'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-5">
        {editable && (
          <>
            <p className="text-sm text-piedra">
              Por activar. El titular lo ve en Pagos con sus condiciones y lo activa al aceptar el débito. Hasta entonces lo podés editar. Si paga por transferencia o cripto,
              registrá el pago acá abajo y el abono queda al día sin débito.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button type="button" size="sm" onClick={alEditar}>
                Editar
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={borrar} disabled={ocupado !== ''}>
                {ocupado === 'borrar' ? 'Borrando…' : 'Borrar'}
              </Button>
            </div>
          </>
        )}
        {!editable && abono.plan_id && (
          <div className="flex flex-col gap-2">
            <Button type="button" size="sm" variant="ghost" onClick={actualizar} disabled={ocupado !== ''} className="self-start">
              <RefreshCw size={14} aria-hidden="true" className={ocupado === 'estado' ? 'animate-spin' : ''} />
              {ocupado === 'estado' ? 'Actualizando…' : 'Actualizar estado'}
            </Button>
            <p className="text-xs text-piedra">Trae de dLocal Go el estado, el próximo cobro y los cobros.</p>
          </div>
        )}
        {abono.estado !== 'cancelado' && (
          <div className="flex flex-col gap-3 pt-2 border-t border-tinta/12">
            {manual ? (
              <form onSubmit={registrarPago} className="flex flex-col gap-4">
                <p className="text-sm font-medium">Registrar pago manual</p>
                <div className="grid gap-3 grid-cols-2">
                  <Campo etiqueta="Fecha">
                    <input required type="date" max={hoy()} className={claseInput} value={manual.fecha} onChange={(e) => setManual({ ...manual, fecha: e.target.value })} />
                  </Campo>
                  <Campo etiqueta="Moneda">
                    <select className={claseInput} value={manual.moneda} onChange={(e) => setManual({ ...manual, moneda: e.target.value as MonedaAbono, medio: medioPorMoneda(e.target.value) })}>
                      <option value="ARS">ARS</option>
                      <option value="USD">USD</option>
                    </select>
                  </Campo>
                </div>
                <Campo etiqueta="Monto recibido">
                  <input required type="number" inputMode="decimal" step="0.01" min="0.01" className={claseInput} value={manual.monto} onChange={(e) => setManual({ ...manual, monto: e.target.value })} />
                </Campo>
                <Campo etiqueta="Medio">
                  <select className={claseInput} value={manual.medio} onChange={(e) => setManual({ ...manual, medio: e.target.value })}>
                    {Object.entries(MEDIO_MANUAL).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </Campo>
                <Campo etiqueta="Nota" ayuda="Opcional. Por ejemplo, el número de operación. La ve el cliente en su historial.">
                  <input maxLength={300} className={claseInput} value={manual.nota} onChange={(e) => setManual({ ...manual, nota: e.target.value })} />
                </Campo>
                <p className="text-xs text-piedra">
                  {abono.plan_id
                    ? 'Queda aprobado en el historial. El débito de dLocal Go sigue como está.'
                    : enPagoUnico(abono)
                      ? `Queda aprobado como pago completo y el abono pasa a estar al día por ${abono.meses_cubiertos} meses. Después el titular autoriza el débito de la cuota.`
                      : `Queda aprobado en el historial y el abono pasa a estar al día por ${abono.periodo_meses === 3 ? 'tres meses' : 'un mes'} más.`}
                </p>
                <div className="flex flex-wrap gap-3">
                  <Button type="submit" size="sm" disabled={ocupado !== ''}>
                    {ocupado === 'manual' ? 'Registrando…' : 'Registrar pago'}
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setManual(null)} disabled={ocupado !== ''}>
                    Cancelar
                  </Button>
                </div>
              </form>
            ) : (
              <>
                <Button type="button" size="sm" variant="ghost" onClick={abrirManual} disabled={ocupado !== ''} className="self-start">
                  Registrar pago manual
                </Button>
                <p className="text-xs text-piedra">Para transferencias y cripto. El pago queda aprobado en el historial del cliente.</p>
              </>
            )}
          </div>
        )}
        {cuotaTrabada && (
          <Aviso tipo="error">
            Las {abono.cuotas_iniciales} cuotas iniciales están pagas pero el plan de dLocal Go sigue en el monto inicial. Tocá Actualizar estado para reintentar y, si no baja, revisá el
            registro de accesos.
          </Aviso>
        )}
        {gestionable && (
          <p className="text-sm text-piedra">
            {abono.modalidad ? 'El monto cambia solo cuando termina la etapa inicial. Para cualquier otro cambio, dalo de baja y armá uno nuevo.' : SIN_MONTO}
          </p>
        )}
        {gestionable && (
          <div className="flex flex-col gap-3 pt-2 border-t border-tinta/12">
            {confirmandoBaja ? (
              <>
                <p className="text-sm">¿Dar de baja {abono.concepto}? dLocal Go deja de debitar desde ahora y se desactiva el plan del abono.</p>
                <div className="flex flex-wrap gap-3">
                  <Button type="button" size="sm" variant="dark" onClick={darDeBaja} disabled={ocupado !== ''}>
                    {ocupado === 'baja' ? 'Dando de baja…' : 'Sí, dar de baja'}
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setConfirmandoBaja(false)} disabled={ocupado !== ''}>
                    Volver
                  </Button>
                </div>
              </>
            ) : (
              <Button type="button" size="sm" variant="ghost" onClick={() => setConfirmandoBaja(true)} disabled={ocupado !== ''} className="self-start">
                Dar de baja
              </Button>
            )}
          </div>
        )}
        {abono.estado === 'cancelado' && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-piedra">Dado de baja. Para retomarlo, armá un abono nuevo.</p>
            <button
              type="button"
              className="self-start text-sm font-medium underline underline-offset-4 text-peligro disabled:opacity-50"
              onClick={borrarDeBaja}
              disabled={ocupado !== ''}
            >
              {ocupado === 'borrar' ? 'Borrando…' : 'Borrar abono de prueba'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export const Abonos: React.FC = () => {
  const [orgs, setOrgs] = useState<Organizacion[]>([]);
  const [perfiles, setPerfiles] = useState<PerfilCorto[]>([]);
  const [abonos, setAbonos] = useState<Abono[] | null>(null);
  const [pagos, setPagos] = useState<PagoAbono[]>([]);
  const [disp, setDisp] = useState<Disponibilidad | null>(null);
  const [diagnostico, setDiagnostico] = useState<Diagnostico | null>(null);
  const [probando, setProbando] = useState(false);
  const [borrador, setBorrador] = useState<Borrador | null>(null);
  const [abierto, setAbierto] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [mep, setMep] = useState<Mep | null>(null);

  const empresa = (id: string) => orgs.find((o) => o.id === id)?.nombre ?? 'Empresa';
  const titularDe = (orgId: string) => perfiles.find((p) => p.organizacion_id === orgId && p.rol === 'titular' && p.activo)?.email ?? '';
  /** País de la empresa si dLocal Go lo habilita, si no Argentina. Solo define la moneda que se propone. */
  const paisDe = (orgId: string) => {
    const p = orgs.find((o) => o.id === orgId)?.pais ?? '';
    return PAISES_DLOCALGO[p] ? p : 'AR';
  };
  const mails = Object.fromEntries(perfiles.map((p) => [p.id, p.email]));

  async function cargar() {
    if (!supabase) return;
    const [{ data: o }, { data: a, error: e }, { data: p }, { data: pf }] = await Promise.all([
      supabase.from('organizaciones').select('*').order('nombre'),
      supabase.from('abonos').select('*').order('creado_en', { ascending: false }),
      supabase.from('abono_pagos').select('*').order('fecha', { ascending: false }).limit(1000),
      supabase.from('perfiles').select('id, email, rol, organizacion_id, activo'),
    ]);
    if (e) setError(`${e.message}. Revisá que la migración 0009_abonos.sql esté corrida en Supabase.`);
    setOrgs((o as Organizacion[]) ?? []);
    setAbonos((a as Abono[]) ?? []);
    setPagos((p as PagoAbono[]) ?? []);
    setPerfiles((pf as PerfilCorto[]) ?? []);
  }

  useEffect(() => {
    void cargar();
    void consultarDisponibilidad().then(setDisp);
  }, []);

  // En pesos al MEP, la cotización del día para mostrar y guardar los pesos.
  const cobroMep = borrador?.oferta && borrador.cobro === 'MEP';
  useEffect(() => {
    if (cobroMep && !mep) void consultarMep().then(setMep);
  }, [cobroMep, mep]);

  function nuevo() {
    const orgId = orgs.find((o) => o.activa)?.id ?? orgs[0]?.id ?? '';
    setOk(null);
    setError(null);
    const base: Borrador = {
      organizacion_id: orgId,
      concepto: '',
      monto: '',
      moneda: paisDe(orgId) === 'AR' ? 'ARS' : 'USD',
      periodo: 1,
      email_pagador: titularDe(orgId),
      vigente_hasta: '',
      oferta: '',
      plan_servicio: '',
      modalidad: '',
      inicial: '',
      posterior: '',
      cuotas: '3',
      meses: '4',
      congela: '',
      fundador: false,
      cobro: paisDe(orgId) === 'AR' ? 'MEP' : 'USD',
    };
    setBorrador(conOferta(base, 'eminent-cuotas'));
  }

  function editar(a: Abono) {
    setOk(null);
    setError(null);
    const oferta = a.modalidad
      ? (OFERTAS.find((o) => o.plan === a.plan_servicio && o.modalidad === a.modalidad && Boolean(o.fundador) === Boolean(a.precio_fundador))?.id ?? '')
      : '';
    setBorrador({
      id: a.id,
      organizacion_id: a.organizacion_id,
      concepto: a.concepto,
      monto: String(Number(a.monto)),
      moneda: a.moneda,
      periodo: a.periodo_meses === 3 ? 3 : 1,
      email_pagador: a.email_pagador,
      vigente_hasta: a.vigente_hasta ?? '',
      vigenteAntes: a.vigente_hasta ?? '',
      oferta,
      plan_servicio: a.plan_servicio ?? '',
      modalidad: a.modalidad ?? '',
      inicial: a.monto_inicial ? String(Number(a.monto_inicial)) : '',
      posterior: a.monto_posterior ? String(Number(a.monto_posterior)) : '',
      cuotas: String(a.cuotas_iniciales ?? 3),
      meses: String(a.meses_cubiertos ?? 4),
      congela: a.congela_meses ? String(a.congela_meses) : '',
      fundador: Boolean(a.precio_fundador),
      cobro: a.al_mep ? 'MEP' : 'USD',
      teniaEsquema: Boolean(a.modalidad),
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function cambiarEmpresa(orgId: string) {
    if (!borrador) return;
    // El mail se propone con el de la empresa nueva si era el de la anterior o estaba vacío.
    const mailSugerido = !borrador.email_pagador || borrador.email_pagador === titularDe(borrador.organizacion_id);
    setBorrador({
      ...borrador,
      organizacion_id: orgId,
      email_pagador: mailSugerido ? titularDe(orgId) : borrador.email_pagador,
    });
  }

  const cambiarMoneda = (moneda: MonedaAbono) => borrador && setBorrador({ ...borrador, moneda });
  function elegirOferta(id: string) {
    if (!borrador) return;
    setBorrador(conOferta(borrador, id));
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase || !borrador) return;
    const concepto = borrador.concepto.trim();
    const email = borrador.email_pagador.trim().toLowerCase();
    if (!borrador.organizacion_id) return setError('Elegí la empresa.');
    if (concepto.length < 3 || concepto.length > 120) return setError('El concepto tiene que tener entre 3 y 120 caracteres.');
    if (!EMAIL.test(email)) return setError('El mail del pagador no tiene un formato válido.');
    // Solo si cambió: así el formulario sigue andando aunque la migración 0021 no esté corrida.
    const vigencia = borrador.vigente_hasta !== (borrador.vigenteAntes ?? '') ? { vigente_hasta: borrador.vigente_hasta || null } : {};
    let datos: Record<string, unknown>;
    if (borrador.oferta) {
      const inicial = Math.round(numero(borrador.inicial) * 100) / 100;
      const posterior = Math.round(numero(borrador.posterior) * 100) / 100;
      const cuotas = Math.round(numero(borrador.cuotas));
      const meses = Math.round(numero(borrador.meses));
      const congela = borrador.congela ? Math.round(numero(borrador.congela)) : null;
      const completo = borrador.modalidad === 'pago_completo';
      if (!(inicial > 0) || !(posterior > 0)) return setError('Los montos del esquema tienen que ser mayores a cero.');
      if (!completo && !(cuotas >= 1 && cuotas <= 12)) return setError('Las cuotas iniciales van de 1 a 12.');
      if (completo && !(meses >= 1 && meses <= 12)) return setError('Los meses que cubre el pago completo van de 1 a 12.');
      if (congela !== null && !(congela >= 1 && congela <= 36)) return setError('Los meses de cuota congelada van de 1 a 36.');
      const alMep = borrador.cobro === 'MEP';
      const cotizacion = alMep ? (mep ?? (await consultarMep())) : null;
      if (alMep && !cotizacion) return setError('No se pudo traer la cotización del dólar MEP. Probá de nuevo en unos minutos.');
      datos = {
        organizacion_id: borrador.organizacion_id,
        concepto,
        // En pesos el plan es de Argentina. En dólares va sin país y el checkout de dLocal Go se lo pregunta al cliente.
        monto: alMep && cotizacion ? pesosAlMep(inicial, cotizacion.valor) : inicial,
        moneda: alMep ? 'ARS' : 'USD',
        pais: alMep ? 'AR' : null,
        periodo_meses: 1,
        email_pagador: email,
        plan_servicio: borrador.plan_servicio || null,
        modalidad: borrador.modalidad,
        etapa: 'inicial',
        cuotas_iniciales: completo ? null : cuotas,
        meses_cubiertos: completo ? meses : null,
        congela_meses: completo ? congela : null,
        monto_inicial: inicial,
        monto_posterior: posterior,
        precio_fundador: completo && borrador.fundador,
        al_mep: alMep,
        monto_usd: alMep ? inicial : null,
        cotizacion_mep: cotizacion?.valor ?? null,
        cotizado_en: cotizacion ? new Date().toISOString() : null,
        ...vigencia,
      };
    } else {
      const monto = numero(borrador.monto);
      if (!Number.isFinite(monto) || monto <= 0) return setError('El monto tiene que ser mayor a cero.');
      datos = {
        organizacion_id: borrador.organizacion_id,
        concepto,
        monto: Math.round(monto * 100) / 100,
        moneda: borrador.moneda,
        // En pesos el plan es de Argentina. En dólares va sin país y el checkout de dLocal Go se lo pregunta al cliente.
        pais: borrador.moneda === 'ARS' ? 'AR' : null,
        periodo_meses: borrador.periodo,
        email_pagador: email,
        // Si tenía esquema se limpia. Si no, no se mandan las columnas, así anda aunque la migración 0061 no esté corrida.
        ...(borrador.teniaEsquema
          ? {
              plan_servicio: null,
              modalidad: null,
              etapa: null,
              cuotas_iniciales: null,
              meses_cubiertos: null,
              congela_meses: null,
              monto_inicial: null,
              monto_posterior: null,
              precio_fundador: false,
              al_mep: false,
              monto_usd: null,
              cotizacion_mep: null,
              cotizado_en: null,
            }
          : {}),
        ...vigencia,
      };
    }
    setGuardando(true);
    setError(null);
    const { error: err } = borrador.id ? await supabase.from('abonos').update(datos).eq('id', borrador.id) : await supabase.from('abonos').insert(datos);
    setGuardando(false);
    if (err) return setError(errorAmable(err.message));
    setOk(borrador.id ? 'Abono actualizado.' : 'Abono creado. El titular ya lo ve en Pagos para aceptarlo y activarlo.');
    setBorrador(null);
    void cargar();
  }

  const lista = abonos ?? [];
  const vivos = lista.filter((a) => a.estado === 'activo' || a.estado === 'con_error' || a.estado === 'pausado');
  // Los trimestrales cuentan un tercio por mes.
  const porMes = (moneda: MonedaAbono) =>
    vivos.filter((a) => a.moneda === moneda && a.estado !== 'pausado').reduce((s, a) => s + Number(a.monto) / (a.periodo_meses === 3 ? 3 : 1), 0);
  const conProblemas = lista.filter((a) => a.estado === 'con_error').length;
  const ultimoPago = (id: string) => pagos.find((p) => p.abono_id === id) ?? null;
  // Precio fundador: empresas que ya lo tienen, sin contar las que se dieron de baja sin pagar.
  const fundadoras = new Set(
    lista
      .filter((a) => a.precio_fundador && (a.estado !== 'cancelado' || pagos.some((p) => p.abono_id === a.id && p.estado === 'aprobado')))
      .map((a) => a.organizacion_id),
  );
  const lugaresFundador = (orgId: string) => FUNDADOR_CUPO - [...fundadoras].filter((o) => o !== orgId).length;
  const fundadorVigente = hoy() <= FUNDADOR_HASTA;
  /** Lo que muestra la tabla debajo del monto, según el esquema. */
  const etapaCorta = (a: Abono): string => {
    const posterior = montoTexto(Number(a.monto_posterior), monedaReferencia(a));
    if (a.modalidad === 'cuotas') {
      const n = a.cuotas_iniciales ?? 0;
      return a.etapa === 'inicial' ? `Cuota ${Math.min(pagosAprobados(a, pagos) + 1, n)} de ${n}, después ${posterior}` : 'Cuota posterior';
    }
    if (a.modalidad === 'pago_completo') return a.etapa === 'inicial' ? `Después ${posterior} por mes` : cuotaPorAutorizar(a) ? 'Falta autorizar la cuota' : 'Cuota posterior';
    return '';
  };
  const entorno = disp?.entorno === 'produccion' ? 'producción' : 'sandbox';

  async function probarConexion() {
    setProbando(true);
    setDiagnostico(null);
    const r = await diagnosticarDlocal();
    setProbando(false);
    if (!r.ok || !r.datos) return setError(r.error ?? 'No se pudo probar la conexión.');
    setDiagnostico(r.datos);
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div className="flex flex-col gap-3">
          <span className="text-[12.5px] font-medium text-piedra">Procesador</span>
          <div className="flex flex-wrap gap-2">
            <Etiqueta tono={disp === null ? 'piedra' : disp.dlocalgo ? 'bosque' : 'alerta'}>
              {PROCESADOR} · {disp === null ? 'sin verificar' : disp.dlocalgo ? `disponible · ${entorno}` : 'no disponible'}
            </Etiqueta>
            <button type="button" onClick={probarConexion} disabled={probando} className="text-xs underline underline-offset-4 text-piedra hover:text-tinta disabled:opacity-50">
              {probando ? 'Probando…' : 'Probar conexión con dLocal Go'}
            </button>
          </div>
        </div>
        {!borrador && (
          <Button type="button" onClick={nuevo} disabled={orgs.length === 0}>
            <Plus size={16} /> Nuevo abono
          </Button>
        )}
      </div>

      {disp && !disp.dlocalgo && (
        <Aviso tipo="info">
          dLocal Go no está configurado. Los abonos se pueden armar igual, pero el titular no puede activarlos hasta cargar las variables en Vercel. La guía está en PORTAL.md, sección
          Pagos con tarjeta.
        </Aviso>
      )}
      {disp && disp.dlocalgo && disp.entorno === 'sandbox' && (
        <Aviso tipo="info">
          dLocal Go está en modo de prueba (sandbox) y los pagos no son reales. Para cobrar de verdad cargá en Vercel las credenciales productivas y DLOCALGO_ENTORNO con el valor
          produccion.
        </Aviso>
      )}
      {diagnostico && (
        <div className="bg-white border border-tinta/15 p-5 flex flex-col gap-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-medium">
              Prueba de conexión · {diagnostico.entorno === 'produccion' ? 'producción' : 'sandbox'} · <span className="font-mono text-xs text-piedra">{diagnostico.api}</span>
            </p>
            <button type="button" className="text-xs underline underline-offset-4 text-piedra" onClick={() => setDiagnostico(null)}>
              Cerrar
            </button>
          </div>
          <ol className="flex flex-col gap-2">
            {diagnostico.pasos.map((p) => (
              <li key={p.paso} className="flex flex-col gap-1">
                <span className="flex flex-wrap items-center gap-2">
                  <Etiqueta tono={p.ok ? 'bosque' : 'alerta'}>{p.ok ? 'Bien' : `Falló · ${p.status || 'sin respuesta'}`}</Etiqueta>
                  {p.paso}
                </span>
                {!p.ok && <span className="font-mono text-xs text-piedra break-all">{p.respuesta}</span>}
              </li>
            ))}
          </ol>
          <p className="text-xs text-piedra">Los planes de prueba se desactivan solos. El resultado queda en el registro de accesos.</p>
        </div>
      )}
      {error && <Aviso tipo="error">{error}</Aviso>}
      {ok && <Aviso tipo="ok">{ok}</Aviso>}

      {borrador && (
        <form onSubmit={guardar} className="bg-marfil-oscuro p-6 desk:p-8 space-y-5 max-w-[720px]">
          <h2 className="h3">{borrador.id ? 'Editar abono' : 'Nuevo abono'}</h2>
          <Campo etiqueta="Empresa">
            <select className={claseInput} value={borrador.organizacion_id} onChange={(e) => cambiarEmpresa(e.target.value)}>
              {orgs.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.nombre}
                  {o.activa ? '' : ' (inactiva)'}
                </option>
              ))}
            </select>
          </Campo>
          <Campo
            etiqueta="Oferta"
            ayuda="Completa el concepto y los montos con los de /planes. Si el cliente paga otro monto, cambialo abajo. El plan de la empresa se elige en Clientes."
          >
            <select className={claseInput} value={borrador.oferta} onChange={(e) => elegirOferta(e.target.value)}>
              {OFERTAS.map((o) => {
                const sinLugar = Boolean(o.fundador) && !(borrador.id && borrador.fundador) && (!fundadorVigente || lugaresFundador(borrador.organizacion_id) <= 0);
                return (
                  <option key={o.id} value={o.id} disabled={sinLugar}>
                    {o.titulo}
                    {sinLugar ? ' (sin lugares)' : ''}
                  </option>
                );
              })}
              <option value="">Monto especial, sin esquema</option>
            </select>
          </Campo>
          <Campo etiqueta="Concepto" ayuda="Lo ve el cliente en el portal y en la página de pago. Por ejemplo, Abono mensual de asesoría legal.">
            <input required maxLength={120} className={claseInput} value={borrador.concepto} onChange={(e) => setBorrador({ ...borrador, concepto: e.target.value })} />
          </Campo>
          {borrador.oferta ? (
            <>
              <div className="grid gap-5 tab:grid-cols-2">
                <Campo
                  etiqueta={borrador.modalidad === 'pago_completo' ? 'Pago completo, en USD' : 'Cuota inicial, USD por mes'}
                  ayuda={borrador.modalidad === 'pago_completo' ? 'Un solo pago con tarjeta en dLocal Go.' : 'Se debita cada mes durante las cuotas iniciales.'}
                >
                  <input required type="number" inputMode="decimal" step="0.01" min="0.01" className={claseInput} value={borrador.inicial} onChange={(e) => setBorrador({ ...borrador, inicial: e.target.value })} />
                </Campo>
                {borrador.modalidad === 'pago_completo' ? (
                  <Campo etiqueta="Meses que cubre" ayuda="Los tres meses pagos más el cuarto sin cargo.">
                    <input required type="number" min="1" max="12" step="1" className={claseInput} value={borrador.meses} onChange={(e) => setBorrador({ ...borrador, meses: e.target.value })} />
                  </Campo>
                ) : (
                  <Campo etiqueta="Cuotas iniciales" ayuda="Al aprobarse la última, el plan pasa solo a la cuota posterior.">
                    <input required type="number" min="1" max="12" step="1" className={claseInput} value={borrador.cuotas} onChange={(e) => setBorrador({ ...borrador, cuotas: e.target.value })} />
                  </Campo>
                )}
                <Campo etiqueta="Cuota posterior, USD por mes" ayuda="La que rige después de la etapa inicial.">
                  <input required type="number" inputMode="decimal" step="0.01" min="0.01" className={claseInput} value={borrador.posterior} onChange={(e) => setBorrador({ ...borrador, posterior: e.target.value })} />
                </Campo>
                {borrador.modalidad === 'pago_completo' && (
                  <Campo etiqueta="Cuota congelada, meses" ayuda="Opcional. Cuántos meses la cuota posterior no cambia.">
                    <input type="number" min="1" max="36" step="1" className={claseInput} value={borrador.congela} onChange={(e) => setBorrador({ ...borrador, congela: e.target.value })} />
                  </Campo>
                )}
                <Campo
                  etiqueta="Cobro"
                  ayuda={
                    borrador.cobro === 'MEP'
                      ? 'En pesos, con el dólar MEP. El portal actualiza el monto antes de cada cobro.'
                      : 'En dólares. dLocal Go le cobra al cliente en su moneda local al momento de cada pago.'
                  }
                >
                  <select className={claseInput} value={borrador.cobro} onChange={(e) => setBorrador({ ...borrador, cobro: e.target.value === 'MEP' ? 'MEP' : 'USD' })}>
                    <option value="USD">USD, dólares</option>
                    <option value="MEP">ARS, pesos al dólar MEP</option>
                  </select>
                </Campo>
              </div>
              <p className="text-sm text-piedra">
                {borrador.modalidad === 'pago_completo'
                  ? `Pago completo de USD ${borrador.inicial || '·'} que cubre ${borrador.meses || '·'} meses. Después USD ${borrador.posterior || '·'} por mes${borrador.congela ? `, congelados ${borrador.congela} meses` : ''}. El titular autoriza ese débito una semana antes de que venza lo pagado.`
                  : `${borrador.cuotas || '·'} cuotas de USD ${borrador.inicial || '·'} por mes y después USD ${borrador.posterior || '·'} por mes, sin que el titular vuelva a suscribirse.`}
                {borrador.cobro === 'MEP' &&
                  (mep
                    ? ` Hoy, con el MEP a ${montoTexto(mep.valor, 'ARS')}, ${borrador.modalidad === 'pago_completo' ? 'el pago completo es de' : 'la cuota inicial es de'} ${montoTexto(pesosAlMep(numero(borrador.inicial) || 0, mep.valor), 'ARS')}.`
                    : ' Trayendo la cotización del dólar MEP.')}
              </p>
              {borrador.fundador && (
                <p className="text-sm text-piedra">
                  Precio fundador. Quedan {Math.max(0, lugaresFundador(borrador.organizacion_id))} de {FUNDADOR_CUPO} lugares, hasta el {fechaDia(FUNDADOR_HASTA, true)}.
                </p>
              )}
            </>
          ) : (
          <div className="grid gap-5 tab:grid-cols-3">
            <Campo etiqueta={borrador.periodo === 3 ? 'Monto cada 3 meses' : 'Monto mensual'} ayuda={SIN_MONTO}>
              <input
                required
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0.01"
                className={claseInput}
                value={borrador.monto}
                onChange={(e) => setBorrador({ ...borrador, monto: e.target.value })}
              />
            </Campo>
            <Campo etiqueta="Moneda" ayuda="En dólares, dLocal Go le cobra al cliente en su moneda local al momento de cada pago.">
              <select className={claseInput} value={borrador.moneda} onChange={(e) => cambiarMoneda(e.target.value as MonedaAbono)}>
                <option value="ARS">ARS, pesos argentinos</option>
                <option value="USD">USD, dólares</option>
              </select>
            </Campo>
            <Campo etiqueta="Periodicidad" ayuda="Cada 3 meses es un solo débito por el trimestre, por adelantado.">
              <select className={claseInput} value={borrador.periodo} onChange={(e) => setBorrador({ ...borrador, periodo: Number(e.target.value) === 3 ? 3 : 1 })}>
                <option value={1}>Mensual</option>
                <option value={3}>Cada 3 meses</option>
              </select>
            </Campo>
          </div>
          )}
          <Campo etiqueta="Mail del pagador" ayuda="Va precargado en la página de pago de dLocal Go. Se propone el del titular.">
            <input required type="email" className={claseInput} value={borrador.email_pagador} onChange={(e) => setBorrador({ ...borrador, email_pagador: e.target.value })} />
          </Campo>
          <Campo etiqueta="Vigente hasta" ayuda="Opcional. La fecha pactada de fin del abono. Es informativa: no frena los débitos ni lo da de baja.">
            <input type="date" className={claseInput} value={borrador.vigente_hasta} onChange={(e) => setBorrador({ ...borrador, vigente_hasta: e.target.value })} />
          </Campo>
          {disp && !disp.dlocalgo && <Aviso tipo="info">dLocal Go no está disponible todavía. Podés guardar el borrador y el titular lo activa cuando esté configurado.</Aviso>}
          <div className="flex flex-wrap gap-3">
            <Button type="submit" disabled={guardando}>
              {guardando ? 'Guardando…' : borrador.id ? 'Guardar cambios' : 'Crear abono'}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setBorrador(null)}>
              Cancelar
            </Button>
          </div>
        </form>
      )}

      <Cifras
        cargando={abonos === null}
        items={[
          { titulo: 'Abonos vigentes', valor: vivos.length },
          { titulo: 'Por mes en pesos', valor: <Monto n={porMes('ARS')} moneda="ARS" /> },
          { titulo: 'Por mes en dólares', valor: <Monto n={porMes('USD')} moneda="USD" /> },
          { titulo: 'Con problemas de cobro', valor: conProblemas, alerta: conProblemas > 0 },
        ]}
      />

      <div className="overflow-x-auto">
        <table className="tabla min-w-[900px]">
          <thead>
            <tr>
              <th>Empresa y concepto</th>
              <th className="num">Monto</th>
              <th>Estado</th>
              <th>Último pago</th>
              <th>Próximo cobro</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {abonos !== null && lista.length === 0 && (
              <tr>
                <td colSpan={6} className="text-piedra">
                  Todavía no hay abonos. Armá el primero con Nuevo abono.
                </td>
              </tr>
            )}
            {lista.map((a) => {
              const ultimo = ultimoPago(a.id);
              const estado = ESTADO_ABONO[a.estado];
              const abiertoAca = abierto === a.id;
              return (
                <React.Fragment key={a.id}>
                  <tr className="fila-link" onClick={() => setAbierto(abiertoAca ? null : a.id)}>
                    <td>
                      <div className="font-medium">{empresa(a.organizacion_id)}</div>
                      <div className="text-xs text-piedra mt-1">{a.concepto}</div>
                      {a.vigente_hasta && (
                        <div className={`text-xs mt-1 ${vigenciaVencida(a) ? 'text-peligro' : 'text-piedra'}`}>
                          {vigenciaVencida(a) ? 'Vigencia vencida el' : 'Vigente hasta el'} {fechaDia(a.vigente_hasta)}
                        </div>
                      )}
                    </td>
                    <td className="num">
                      {a.al_mep ? montoTexto(Number(a.monto_usd), 'USD') : montoTexto(a.monto, a.moneda)}
                      <div className="text-xs text-piedra mt-1">
                        {enPagoUnico(a) ? 'pago completo' : periodoTexto(a.periodo_meses)}
                        {a.al_mep ? `, ${montoTexto(a.monto, 'ARS')} al MEP` : ''}
                      </div>
                      {a.modalidad && <div className="text-xs text-piedra mt-1">{etapaCorta(a)}</div>}
                    </td>
                    <td>
                      <Etiqueta tono={estado.tono}>{estado.titulo}</Etiqueta>
                    </td>
                    <td className="whitespace-nowrap">
                      {ultimo ? (
                        <>
                          {fechaCorta(ultimo.fecha)}
                          <div className="text-xs text-piedra mt-1">{ESTADO_PAGO[ultimo.estado].titulo}</div>
                        </>
                      ) : (
                        <span className="text-piedra">·</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap">{a.proximo_cobro ? fechaCorta(a.proximo_cobro) : <span className="text-piedra">·</span>}</td>
                    <td className="text-right">
                      <button
                        type="button"
                        className="text-sm font-medium text-bosque underline underline-offset-4"
                        aria-expanded={abiertoAca}
                        onClick={(e) => {
                          e.stopPropagation();
                          setAbierto(abiertoAca ? null : a.id);
                        }}
                      >
                        {abiertoAca ? 'Cerrar' : 'Ver'}
                      </button>
                    </td>
                  </tr>
                  {abiertoAca && (
                    <tr>
                      <td colSpan={6}>
                        <Detalle
                          abono={a}
                          pagos={pagos.filter((p) => p.abono_id === a.id)}
                          mails={mails}
                          alEditar={() => editar(a)}
                          alCambiar={(m) => {
                            setError(null);
                            setOk(m);
                            void cargar();
                          }}
                          alError={(m) => {
                            setOk(null);
                            setError(m);
                          }}
                        />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-piedra max-w-[80ch]">
        Estado, próximo cobro y pagos llegan de dLocal Go, con sus avisos o con Actualizar estado, y no se editan a mano. La tarjeta la carga siempre el cliente en la página segura de
        dLocal Go.
      </p>
    </div>
  );
};

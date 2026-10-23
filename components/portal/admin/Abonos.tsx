import React, { useEffect, useState } from 'react';
import { Plus, RefreshCw } from 'lucide-react';
import { Button } from '../../Button';
import { supabase } from '../supabase';
import { Aviso, Campo, Cifras, Etiqueta, Monto, claseInput } from '../ui';
import type { Organizacion } from '../tipos';
import {
  ESTADO_ABONO,
  ESTADO_PAGO,
  MEDIO_MANUAL,
  PAISES_DLOCALGO,
  PLANES_ABONO,
  PROCESADOR,
  consultarDisponibilidad,
  diagnosticarDlocal,
  esPagoManual,
  fechaCorta,
  fechaDia,
  fechaLarga,
  hora,
  llamarPagos,
  montoPagado,
  montoTexto,
  periodoTexto,
  sincronizarAbono,
  type Abono,
  type Diagnostico,
  type Disponibilidad,
  type MonedaAbono,
  type PagoAbono,
  type PeriodoAbono,
  vigenciaVencida,
} from '../abonos';

/**
 * Abonos mensuales con tarjeta, cobrados con dLocal Go. FIRMA arma cada
 * abono como borrador (empresa, concepto, monto, moneda, país y mail del
 * pagador) y lo puede editar hasta que el titular lo activa. Un abono activo
 * no cambia de monto. Para cambiarlo se da de baja y se arma otro. Estado y
 * pagos llegan de dLocal Go y no se editan a mano.
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
}

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
  return mensaje;
}

const Dato: React.FC<{ titulo: string; children: React.ReactNode; mono?: boolean }> = ({ titulo, children, mono }) => (
  <div>
    <dt className="text-[11px] font-medium uppercase tracking-[0.16em] text-piedra mb-1">{titulo}</dt>
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
          <Dato titulo="Periodicidad">{abono.periodo_meses === 3 ? 'Cada 3 meses, por adelantado' : 'Mensual'}</Dato>
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
                <span className={vigenciaVencida(abono) ? 'text-[#8a2b20]' : undefined}>
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
          <div className="flex flex-col gap-3 pt-2" style={{ borderTop: '1px solid rgba(27,31,27,0.12)' }}>
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
        {gestionable && <p className="text-sm text-piedra">{SIN_MONTO}</p>}
        {gestionable && (
          <div className="flex flex-col gap-3 pt-2" style={{ borderTop: '1px solid rgba(27,31,27,0.12)' }}>
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
        {abono.estado === 'cancelado' && <p className="text-sm text-piedra">Dado de baja. Para retomarlo, armá un abono nuevo.</p>}
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

  function nuevo() {
    const orgId = orgs.find((o) => o.activa)?.id ?? orgs[0]?.id ?? '';
    setOk(null);
    setError(null);
    setBorrador({ organizacion_id: orgId, concepto: '', monto: '', moneda: paisDe(orgId) === 'AR' ? 'ARS' : 'USD', periodo: 1, email_pagador: titularDe(orgId), vigente_hasta: '' });
  }

  function editar(a: Abono) {
    setOk(null);
    setError(null);
    setBorrador({ id: a.id, organizacion_id: a.organizacion_id, concepto: a.concepto, monto: String(Number(a.monto)), moneda: a.moneda, periodo: a.periodo_meses === 3 ? 3 : 1, email_pagador: a.email_pagador, vigente_hasta: a.vigente_hasta ?? '', vigenteAntes: a.vigente_hasta ?? '' });
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
  /** Plan de /planes que coincide con el borrador, o vacío si es un abono a medida. */
  const planElegido = (b: Borrador) =>
    PLANES_ABONO.find((p) => p.concepto === b.concepto && Number(b.monto) === p.monto && p.moneda === b.moneda && p.periodo === b.periodo)?.id ?? '';
  function elegirPlan(id: string) {
    if (!borrador) return;
    const p = PLANES_ABONO.find((x) => x.id === id);
    if (p) setBorrador({ ...borrador, concepto: p.concepto, monto: String(p.monto), moneda: p.moneda, periodo: p.periodo });
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase || !borrador) return;
    const monto = Number(borrador.monto.replace(',', '.'));
    const concepto = borrador.concepto.trim();
    const email = borrador.email_pagador.trim().toLowerCase();
    if (!borrador.organizacion_id) return setError('Elegí la empresa.');
    if (concepto.length < 3 || concepto.length > 120) return setError('El concepto tiene que tener entre 3 y 120 caracteres.');
    if (!Number.isFinite(monto) || monto <= 0) return setError('El monto tiene que ser mayor a cero.');
    if (!EMAIL.test(email)) return setError('El mail del pagador no tiene un formato válido.');
    setGuardando(true);
    setError(null);
    // En pesos el plan es de Argentina. En dólares va sin país y el checkout de dLocal Go se lo pregunta al cliente.
    const pais = borrador.moneda === 'ARS' ? 'AR' : null;
    const datos = {
      organizacion_id: borrador.organizacion_id,
      concepto,
      monto: Math.round(monto * 100) / 100,
      moneda: borrador.moneda,
      pais,
      periodo_meses: borrador.periodo,
      email_pagador: email,
      // Solo si cambió: así el formulario sigue andando aunque la migración 0021 no esté corrida.
      ...(borrador.vigente_hasta !== (borrador.vigenteAntes ?? '') ? { vigente_hasta: borrador.vigente_hasta || null } : {}),
    };
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
          <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-piedra">Procesador</span>
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
        <div className="bg-white border border-[rgba(27,31,27,0.15)] p-5 flex flex-col gap-3 text-sm">
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
          <Campo etiqueta="Plan" ayuda="Completa concepto, monto, moneda y periodicidad con los de /planes. Después los podés ajustar.">
            <select className={claseInput} value={planElegido(borrador)} onChange={(e) => elegirPlan(e.target.value)}>
              <option value="">A medida</option>
              {PLANES_ABONO.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.titulo}
                </option>
              ))}
            </select>
          </Campo>
          <Campo etiqueta="Concepto" ayuda="Lo ve el cliente en el portal y en la página de pago. Por ejemplo, Abono mensual de asesoría legal.">
            <input required maxLength={120} className={claseInput} value={borrador.concepto} onChange={(e) => setBorrador({ ...borrador, concepto: e.target.value })} />
          </Campo>
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
                        <div className={`text-xs mt-1 ${vigenciaVencida(a) ? 'text-[#8a2b20]' : 'text-piedra'}`}>
                          {vigenciaVencida(a) ? 'Vigencia vencida el' : 'Vigente hasta el'} {fechaDia(a.vigente_hasta)}
                        </div>
                      )}
                    </td>
                    <td className="num">
                      {montoTexto(a.monto, a.moneda)}
                      <div className="text-xs text-piedra mt-1">{periodoTexto(a.periodo_meses)}</div>
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

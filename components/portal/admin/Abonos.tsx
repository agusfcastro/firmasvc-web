import React, { useEffect, useState } from 'react';
import { Plus, RefreshCw } from 'lucide-react';
import { Button } from '../../Button';
import { supabase } from '../supabase';
import { Aviso, Campo, Cifras, Etiqueta, Monto, claseInput } from '../ui';
import type { Organizacion } from '../tipos';
import {
  ESTADO_ABONO,
  ESTADO_PAGO,
  PAISES_DLOCALGO,
  PROCESADOR,
  consultarDisponibilidad,
  fechaCorta,
  fechaLarga,
  hora,
  llamarPagos,
  montoPagado,
  montoTexto,
  nombrePais,
  sincronizarAbono,
  type Abono,
  type Disponibilidad,
  type MonedaAbono,
  type PagoAbono,
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
  pais: string;
  email_pagador: string;
}

interface PerfilCorto {
  id: string;
  email: string;
  rol: string;
  organizacion_id: string | null;
  activo: boolean;
}

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const PAISES = Object.keys(PAISES_DLOCALGO).sort((a, b) => nombrePais(a).localeCompare(nombrePais(b), 'es'));
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

const Detalle: React.FC<{
  abono: Abono;
  pagos: PagoAbono[];
  mails: Record<string, string>;
  alEditar: () => void;
  alCambiar: (mensaje: string) => void;
  alError: (mensaje: string) => void;
}> = ({ abono, pagos, mails, alEditar, alCambiar, alError }) => {
  const [confirmandoBaja, setConfirmandoBaja] = useState(false);
  const [ocupado, setOcupado] = useState<'' | 'estado' | 'baja' | 'borrar'>('');
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
          <Dato titulo="País del pagador">{nombrePais(abono.pais)}</Dato>
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
                      <td className="text-xs font-mono text-piedra">{p.cobro_id}</td>
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
            <p className="text-sm text-piedra">Por activar. El titular lo ve en Pagos con sus condiciones y lo activa al aceptar el débito. Hasta entonces lo podés editar.</p>
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
  const [borrador, setBorrador] = useState<Borrador | null>(null);
  const [abierto, setAbierto] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const empresa = (id: string) => orgs.find((o) => o.id === id)?.nombre ?? 'Empresa';
  const titularDe = (orgId: string) => perfiles.find((p) => p.organizacion_id === orgId && p.rol === 'titular' && p.activo)?.email ?? '';
  /** País de la empresa si dLocal Go lo habilita. Si no, Argentina. */
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
    const pais = paisDe(orgId);
    setOk(null);
    setError(null);
    setBorrador({ organizacion_id: orgId, concepto: '', monto: '', moneda: pais === 'AR' ? 'ARS' : 'USD', pais, email_pagador: titularDe(orgId) });
  }

  function editar(a: Abono) {
    setOk(null);
    setError(null);
    setBorrador({ id: a.id, organizacion_id: a.organizacion_id, concepto: a.concepto, monto: String(Number(a.monto)), moneda: a.moneda, pais: a.pais, email_pagador: a.email_pagador });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function cambiarEmpresa(orgId: string) {
    if (!borrador) return;
    // Mail y país se proponen con los de la empresa nueva si eran los de la anterior o estaban vacíos.
    const mailSugerido = !borrador.email_pagador || borrador.email_pagador === titularDe(borrador.organizacion_id);
    const pais = borrador.pais === paisDe(borrador.organizacion_id) ? paisDe(orgId) : borrador.pais;
    setBorrador({
      ...borrador,
      organizacion_id: orgId,
      email_pagador: mailSugerido ? titularDe(orgId) : borrador.email_pagador,
      pais,
      moneda: pais !== 'AR' ? 'USD' : borrador.moneda,
    });
  }

  // En pesos solo paga alguien de Argentina. Fuera de Argentina el abono va en dólares.
  const cambiarPais = (pais: string) => borrador && setBorrador({ ...borrador, pais, moneda: pais !== 'AR' ? 'USD' : borrador.moneda });
  const cambiarMoneda = (moneda: MonedaAbono) => borrador && setBorrador({ ...borrador, moneda, pais: moneda === 'ARS' ? 'AR' : borrador.pais });

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase || !borrador) return;
    const monto = Number(borrador.monto.replace(',', '.'));
    const concepto = borrador.concepto.trim();
    const email = borrador.email_pagador.trim().toLowerCase();
    if (!borrador.organizacion_id) return setError('Elegí la empresa.');
    if (concepto.length < 3 || concepto.length > 120) return setError('El concepto tiene que tener entre 3 y 120 caracteres.');
    if (!Number.isFinite(monto) || monto <= 0) return setError('El monto tiene que ser mayor a cero.');
    if (!PAISES_DLOCALGO[borrador.pais]) return setError('Elegí el país del pagador.');
    if (borrador.moneda === 'ARS' && borrador.pais !== 'AR') return setError('En pesos solo se le puede cobrar a un pagador de Argentina.');
    if (!EMAIL.test(email)) return setError('El mail del pagador no tiene un formato válido.');
    setGuardando(true);
    setError(null);
    const datos = { organizacion_id: borrador.organizacion_id, concepto, monto: Math.round(monto * 100) / 100, moneda: borrador.moneda, pais: borrador.pais, email_pagador: email };
    const { error: err } = borrador.id ? await supabase.from('abonos').update(datos).eq('id', borrador.id) : await supabase.from('abonos').insert(datos);
    setGuardando(false);
    if (err) return setError(errorAmable(err.message));
    setOk(borrador.id ? 'Abono actualizado.' : 'Abono creado. El titular ya lo ve en Pagos para aceptarlo y activarlo.');
    setBorrador(null);
    void cargar();
  }

  const lista = abonos ?? [];
  const vivos = lista.filter((a) => a.estado === 'activo' || a.estado === 'con_error' || a.estado === 'pausado');
  const porMes = (moneda: MonedaAbono) => vivos.filter((a) => a.moneda === moneda && a.estado !== 'pausado').reduce((s, a) => s + Number(a.monto), 0);
  const conProblemas = lista.filter((a) => a.estado === 'con_error').length;
  const ultimoPago = (id: string) => pagos.find((p) => p.abono_id === id) ?? null;
  const entorno = disp?.entorno === 'produccion' ? 'producción' : 'sandbox';

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div className="flex flex-col gap-3">
          <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-piedra">Procesador</span>
          <div className="flex flex-wrap gap-2">
            <Etiqueta tono={disp === null ? 'piedra' : disp.dlocalgo ? 'bosque' : 'alerta'}>
              {PROCESADOR} · {disp === null ? 'sin verificar' : disp.dlocalgo ? `disponible · ${entorno}` : 'no disponible'}
            </Etiqueta>
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
          <Campo etiqueta="Concepto" ayuda="Lo ve el cliente en el portal y en la página de pago. Por ejemplo, Abono mensual de asesoría legal.">
            <input required maxLength={120} className={claseInput} value={borrador.concepto} onChange={(e) => setBorrador({ ...borrador, concepto: e.target.value })} />
          </Campo>
          <div className="grid gap-5 tab:grid-cols-2">
            <Campo etiqueta="Monto mensual" ayuda={SIN_MONTO}>
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
            <Campo etiqueta="Moneda" ayuda="En pesos, solo para pagadores de Argentina.">
              <select className={claseInput} value={borrador.moneda} onChange={(e) => cambiarMoneda(e.target.value as MonedaAbono)}>
                <option value="ARS">ARS, pesos argentinos</option>
                <option value="USD">USD, dólares</option>
              </select>
            </Campo>
          </div>
          <Campo etiqueta="País del pagador" ayuda="El cliente paga siempre en la moneda de su país. Si el abono es en dólares, dLocal Go lo convierte al momento de cada pago.">
            <select className={claseInput} value={borrador.pais} onChange={(e) => cambiarPais(e.target.value)}>
              {PAISES.map((p) => (
                <option key={p} value={p}>
                  {nombrePais(p)}, paga en {PAISES_DLOCALGO[p].moneda}
                </option>
              ))}
            </select>
          </Campo>
          <Campo etiqueta="Mail del pagador" ayuda="Va precargado en la página de pago de dLocal Go. Se propone el del titular.">
            <input required type="email" className={claseInput} value={borrador.email_pagador} onChange={(e) => setBorrador({ ...borrador, email_pagador: e.target.value })} />
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
                    </td>
                    <td className="num">
                      {montoTexto(a.monto, a.moneda)}
                      <div className="text-xs text-piedra mt-1">{nombrePais(a.pais)}</div>
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

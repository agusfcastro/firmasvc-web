import React, { useCallback, useEffect, useState } from 'react';
import { ArrowUpRight, Check, Copy, CreditCard, LockKeyhole, RefreshCw } from 'lucide-react';
import { supabase } from './supabase';
import { Aviso, Encabezado, Enlace, Etiqueta, Marco, TituloSeccion } from './ui';
import { WHATSAPP_COMPROBANTES, mediosDisponibles, type DatoPago, type MedioAlternativo } from './mediosAlternativos';
import { useVistaPrevia } from './vistaPrevia';
import type { Organizacion, Perfil } from './tipos';
import {
  ESTADO_ABONO,
  ESTADO_PAGO,
  MEDIO_MANUAL,
  PROCESADOR,
  abonoManual,
  activable,
  cambiandoMedio,
  consultarDisponibilidad,
  esPagoManual,
  fechaCorta,
  fechaLarga,
  hora,
  llamarPagos,
  montoPagado,
  montoTexto,
  periodoTexto,
  sincronizarAbono,
  type Abono,
  type Disponibilidad,
  type PagoAbono,
} from './abonos';

/**
 * Pagos del cliente en /portal/pagos. Solo titulares y FIRMA.
 * Cada abono muestra sus condiciones, la moneda en la que paga el titular y,
 * antes de ir a dLocal Go, una casilla obligatoria de aceptación del débito
 * mensual. Después muestra estado, próximo cobro e historial, el botón para
 * actualizar el estado, el cambio de medio de pago y la baja, los dos con
 * confirmación. La tarjeta se carga siempre en la página de dLocal Go.
 */

const claseAccion =
  'inline-flex items-center justify-center gap-2 h-12 px-5 bg-marfil text-tinta text-sm font-medium whitespace-nowrap transition-colors duration-150 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed';
const claseSecundaria =
  'self-start inline-flex items-center gap-2 text-sm font-medium text-marfil underline underline-offset-4 decoration-[rgba(245,243,236,0.4)] transition-colors duration-150 hover:decoration-marfil disabled:opacity-50 disabled:cursor-not-allowed';

const MAX_INTENTOS = 12;

interface Vuelta {
  abono: string | null;
  volver: boolean;
  error: boolean;
  cancelado: boolean;
}

function leerVuelta(): Vuelta {
  const q = new URLSearchParams(window.location.search);
  return { abono: q.get('abono'), volver: q.get('volver') === 'dlocalgo', error: q.get('error') === '1', cancelado: q.get('cancelado') === '1' };
}

const futuro = (iso: string | null): boolean => Boolean(iso) && Date.parse(iso as string) > Date.now();

const Dato: React.FC<{ titulo: string; children: React.ReactNode; ancho?: boolean }> = ({ titulo, children, ancho }) => (
  <div className={`flex flex-col gap-1.5 ${ancho ? 'tab:col-span-2' : ''}`}>
    <dt className="text-[11px] font-medium uppercase tracking-[0.16em] text-piedra">{titulo}</dt>
    <dd className="text-[15px] leading-[1.55]">{children}</dd>
  </div>
);

const Historial: React.FC<{ abono: Abono; pagos: PagoAbono[] }> = ({ abono, pagos }) => (
  <div className="flex flex-col gap-3">
    <h3 className="eyebrow text-piedra">Historial de pagos</h3>
    {pagos.length === 0 ? (
      <p className="text-sm text-piedra">Todavía no hay pagos registrados.</p>
    ) : (
      <div className="overflow-x-auto">
        <table className="tabla tabla-media min-w-[360px]">
          <thead>
            <tr>
              <th>Fecha</th>
              <th className="num">Monto</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {pagos.map((p) => (
              <tr key={p.id}>
                <td className="whitespace-nowrap">{fechaCorta(p.fecha)}</td>
                <td className="num whitespace-nowrap">{montoPagado(p, abono)}</td>
                <td>
                  <Etiqueta tono={ESTADO_PAGO[p.estado].tono}>{ESTADO_PAGO[p.estado].titulo}</Etiqueta>
                  {esPagoManual(p) && <span className="block mt-1 text-[12px] text-piedra">{MEDIO_MANUAL[String(p.detalle?.medio)] ?? 'Pago manual'}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </div>
);

const TarjetaAbono: React.FC<{
  abono: Abono;
  pagos: PagoAbono[];
  disponible: boolean | null;
  empresa?: string;
  soloLectura: string | null;
  alCambiar: () => void;
}> = ({ abono, pagos, disponible, empresa, soloLectura, alCambiar }) => {
  const [acepto, setAcepto] = useState(false);
  const [ocupado, setOcupado] = useState<'' | 'pagar' | 'baja' | 'tarjeta' | 'estado'>('');
  const [confirmando, setConfirmando] = useState<'' | 'baja' | 'tarjeta'>('');
  const [error, setError] = useState<string | null>(null);
  const [nota, setNota] = useState<string | null>(null);
  const monto = montoTexto(abono.monto, abono.moneda);
  const trimestral = abono.periodo_meses === 3;
  const manual = abonoManual(abono);
  const debito = trimestral ? 'Débito trimestral' : 'Débito mensual';
  const puedePagar = activable(abono);
  const cambio = cambiandoMedio(abono, pagos);
  const estado = cambio
    ? { titulo: 'Falta el medio de pago', tono: 'alerta' as const }
    : manual && !futuro(abono.proximo_cobro)
      ? { titulo: 'Pago vencido', tono: 'alerta' as const }
      : ESTADO_ABONO[abono.estado];

  async function irA(ruta: 'activar' | 'gestionar', cuerpo: Record<string, unknown>, que: 'pagar' | 'tarjeta') {
    setOcupado(que);
    setError(null);
    setNota(null);
    const r = await llamarPagos<{ url?: string }>(ruta, cuerpo);
    if (!r.ok || !r.datos?.url) {
      setOcupado('');
      setConfirmando('');
      setError(r.error ?? 'No se pudo abrir la página de dLocal Go.');
      // El servidor ya trajo el estado real de dLocal Go. Se recarga para mostrarlo.
      if (r.datos?.actualizar) alCambiar();
      return;
    }
    window.location.assign(r.datos.url);
  }

  async function darDeBaja() {
    setOcupado('baja');
    setError(null);
    const r = await llamarPagos('gestionar', { abono_id: abono.id, accion: 'baja' });
    setOcupado('');
    if (!r.ok) return setError(r.error ?? 'No se pudo dar de baja.');
    setConfirmando('');
    alCambiar();
  }

  async function actualizar() {
    setOcupado('estado');
    setError(null);
    const r = await sincronizarAbono(abono.id);
    setOcupado('');
    if (!r.ok) return setError(r.error ?? 'No se pudo actualizar el estado.');
    setNota('Estado actualizado con dLocal Go.');
    alCambiar();
  }

  const botonActualizar =
    !soloLectura && abono.plan_id ? (
      <button type="button" className={claseSecundaria} onClick={actualizar} disabled={ocupado !== ''}>
        <RefreshCw size={14} aria-hidden="true" className={ocupado === 'estado' ? 'animate-spin' : ''} />
        {ocupado === 'estado' ? 'Actualizando' : 'Actualizar estado'}
      </button>
    ) : null;

  const confirmacion = (texto: React.ReactNode, si: string, enCurso: string, alConfirmar: () => void, clave: 'baja' | 'tarjeta') => (
    <div className="border-l-[3px] border-calido pl-4 flex flex-col gap-3">
      <p className="text-[15px] leading-[1.55]">{texto}</p>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <button type="button" className={claseAccion} onClick={alConfirmar} disabled={ocupado !== ''}>
          {ocupado === clave ? enCurso : si}
        </button>
        <button type="button" className={claseSecundaria} onClick={() => setConfirmando('')} disabled={ocupado !== ''}>
          Volver
        </button>
      </div>
    </div>
  );

  const botonBaja =
    !soloLectura && abono.estado !== 'cancelado' && abono.estado !== 'borrador' ? (
      confirmando === 'baja' ? (
        confirmacion(
          <>¿Confirmás la baja de {abono.concepto}? dLocal Go deja de debitar desde ahora y no se hacen más cobros.</>,
          'Sí, dar de baja',
          'Dando de baja',
          darDeBaja,
          'baja',
        )
      ) : confirmando === '' ? (
        <button type="button" className={claseSecundaria} onClick={() => setConfirmando('baja')} disabled={ocupado !== ''}>
          Dar de baja
        </button>
      ) : null
    ) : null;

  const botonMedio =
    !soloLectura && (abono.estado === 'activo' || abono.estado === 'con_error') ? (
      confirmando === 'tarjeta' ? (
        confirmacion(
          <>
            ¿Cambiás el medio de pago de {abono.concepto}? dLocal Go no permite cambiarlo sobre la suscripción actual. Por eso la damos de baja y te llevamos a dLocal Go para
            que te suscribas de nuevo con el medio nuevo. Hasta que completes ese paso no se hacen débitos.
            {abono.estado === 'activo' && futuro(abono.proximo_cobro)
              ? ` Lo que ya pagaste se respeta y el primer débito con el medio nuevo es el ${fechaLarga(abono.proximo_cobro)}.`
              : abono.estado === 'con_error'
                ? ' El débito pendiente se cobra al suscribirte con el medio nuevo.'
                : ''}
          </>,
          'Sí, cambiar medio de pago',
          'Abriendo dLocal Go',
          () => irA('gestionar', { abono_id: abono.id, accion: 'tarjeta' }, 'tarjeta'),
          'tarjeta',
        )
      ) : confirmando === '' ? (
        <button type="button" className={claseAccion} onClick={() => setConfirmando('tarjeta')} disabled={ocupado !== ''}>
          <CreditCard size={16} aria-hidden="true" />
          Cambiar medio de pago
        </button>
      ) : null
    ) : null;

  let panel: React.ReactNode;
  if (puedePagar) {
    const sinProcesador = disponible === false;
    panel = (
      <>
        <p className="eyebrow text-[11px] text-calido">Autorización de débito</p>
        {cambio ? (
          <p className="text-[15px] leading-[1.55]">
            Diste de baja la suscripción anterior para cambiar el medio de pago. Seguí en dLocal Go y suscribite con el medio nuevo. Hasta que lo hagas no se hacen débitos.
            {futuro(abono.proximo_cobro) ? ` Como ya está pago hasta el ${fechaLarga(abono.proximo_cobro)}, el primer débito con el medio nuevo es ese día.` : ''}
          </p>
        ) : abono.estado === 'pendiente' ? (
          <p className="text-[15px] leading-[1.55]">Estamos esperando la confirmación de dLocal Go. Si no terminaste el pago, podés retomarlo.</p>
        ) : null}
        {abono.estado === 'con_error' && (
          <p className="text-[15px] leading-[1.55]">El débito no se pudo completar y la suscripción quedó sin efecto. Podés volver a suscribirte con la misma tarjeta u otra.</p>
        )}
        <label className={`flex items-start gap-3 text-[15px] leading-[1.6] ${soloLectura || sinProcesador ? 'opacity-70' : 'cursor-pointer'}`}>
          <input
            type="checkbox"
            className="mt-1 w-4 h-4 shrink-0 accent-[#F5F3EC]"
            checked={acepto}
            disabled={Boolean(soloLectura) || sinProcesador}
            onChange={(e) => setAcepto(e.target.checked)}
          />
          <span>
            Autorizo a FIRMA a debitar <strong className="font-semibold">
              {monto} {periodoTexto(abono.periodo_meses)}
            </strong>
            {abono.moneda === 'USD' ? ', convertidos a tu moneda local al momento de cada pago,' : ''} de la tarjeta que cargue en dLocal Go, en concepto de {abono.concepto}, hasta que dé
            de baja el abono desde este portal.
          </span>
        </label>
        {sinProcesador ? (
          <p className="text-[13px] leading-[1.55] text-calido">
            El pago con tarjeta no está disponible por ahora. {mediosDisponibles().length > 0 ? 'Podés pagar con los otros medios de más abajo.' : 'Escribinos y lo resolvemos.'}
          </p>
        ) : null}
        <button type="button" className={claseAccion} onClick={() => irA('activar', { abono_id: abono.id, acepto: true, monto: Number(abono.monto) }, 'pagar')} disabled={!acepto || Boolean(soloLectura) || sinProcesador || ocupado !== ''}>
          {ocupado === 'pagar' ? 'Abriendo la página de pago' : `Continuar a ${PROCESADOR}`}
          <ArrowUpRight size={16} aria-hidden="true" />
        </button>
        <p className="flex items-start gap-2 text-[13px] leading-[1.55] text-calido">
          <LockKeyhole size={14} className="mt-[3px] shrink-0" aria-hidden="true" />
          <span>Vas a cargar la tarjeta en la página segura de dLocal Go. FIRMA no ve ni guarda los datos de tu tarjeta.</span>
        </p>
        {abono.estado !== 'borrador' && botonActualizar}
        {abono.estado === 'pendiente' && botonBaja}
      </>
    );
  } else if (abono.estado === 'cancelado') {
    panel = (
      <>
        <p className="eyebrow text-[11px] text-calido">{debito}</p>
        <p className="h3 font-heading">Abono de baja</p>
        <p className="text-[15px] leading-[1.55] text-calido">
          {abono.cancelado_en ? `Se dio de baja el ${fechaLarga(abono.cancelado_en)}. ` : ''}No se hacen más débitos.
        </p>
        {!soloLectura && (
          <Enlace a="/portal/agenda" className={claseSecundaria}>
            Si querés retomarlo, agendá una reunión
          </Enlace>
        )}
      </>
    );
  } else if (manual) {
    const alDia = futuro(abono.proximo_cobro);
    panel = (
      <>
        <p className="eyebrow text-[11px] text-calido">Pago por transferencia o cripto</p>
        <p className="h3 font-heading">{alDia ? 'Abono al día' : 'Pago vencido'}</p>
        <p className="text-[15px] leading-[1.55] text-calido">
          {alDia
            ? `Está pago hasta el ${fechaLarga(abono.proximo_cobro)}. FIRMA registra cada pago que recibe.`
            : `El período venció${abono.proximo_cobro ? ` el ${fechaLarga(abono.proximo_cobro)}` : ''}. Podés pagar con los medios de más abajo y mandarnos el comprobante.`}
        </p>
        {botonBaja}
      </>
    );
  } else {
    const titulo = abono.estado === 'pausado' ? 'Débito en pausa' : abono.estado === 'con_error' ? 'No pudimos cobrar' : 'Débito activo';
    const texto =
      abono.estado === 'pausado'
        ? 'Mientras siga en pausa no se hacen cobros.'
        : abono.estado === 'con_error'
          ? 'El último débito fue rechazado. Si querés pagar con otro medio, usá Cambiar medio de pago.'
          : abono.proximo_cobro
            ? `Próximo cobro el ${fechaLarga(abono.proximo_cobro)}.`
            : 'El próximo cobro se informa apenas lo confirme dLocal Go.';
    panel = (
      <>
        <p className="eyebrow text-[11px] text-calido">{debito}</p>
        <p className="h3 font-heading">{titulo}</p>
        <p className="text-[15px] leading-[1.55] text-calido">{texto}</p>
        {botonMedio}
        {confirmando === '' && botonActualizar}
        {botonBaja}
      </>
    );
  }

  return (
    <article className="grid desk:grid-cols-[minmax(0,1fr)_380px] border border-[rgba(27,31,27,0.15)]" aria-label={abono.concepto}>
      <div className="bg-white p-6 desk:p-8 flex flex-col gap-7 min-w-0">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            {empresa && <span className="eyebrow text-[11px] text-piedra">{empresa}</span>}
            <Etiqueta tono={estado.tono}>{estado.titulo}</Etiqueta>
          </div>
          <h2 className="h3">{abono.concepto}</h2>
        </div>
        <dl className="grid gap-x-10 gap-y-5 tab:grid-cols-2">
          <Dato titulo={trimestral ? 'Monto trimestral' : 'Monto mensual'}>
            <span className="font-heading font-black text-[22px] text-bosque tabular-nums">{monto}</span>
          </Dato>
          <Dato titulo="Periodicidad">{trimestral ? 'Un débito cada 3 meses, por adelantado' : 'Mensual, un débito por mes'}</Dato>
          <Dato titulo="Medio de pago">{manual ? 'Transferencia o cripto, registrado por FIRMA' : `Tarjeta, a través de ${PROCESADOR}`}</Dato>
          <Dato titulo={puedePagar ? 'Primer débito' : manual ? 'Pago hasta' : 'Próximo cobro'}>
            {puedePagar
              ? cambio && futuro(abono.proximo_cobro)
                ? fechaLarga(abono.proximo_cobro)
                : 'Al confirmar el pago'
              : abono.proximo_cobro
                ? fechaLarga(abono.proximo_cobro)
                : 'Sin cobros programados'}
          </Dato>
          <Dato titulo="Cómo darte de baja" ancho>
            {manual
              ? 'Cuando quieras, desde esta página con Dar de baja.'
              : 'Cuando quieras, desde esta página con Dar de baja. dLocal Go deja de debitar desde ese momento.'}
          </Dato>
        </dl>
        {abono.aceptado_en && (
          <p className="text-[13px] text-piedra">
            Débito aceptado el {fechaLarga(abono.aceptado_en)} a las {hora(abono.aceptado_en)}.
          </p>
        )}
        {abono.estado !== 'borrador' || pagos.length > 0 ? <Historial abono={abono} pagos={pagos} /> : null}
      </div>
      <aside className="panel-carbon p-6 desk:p-8 flex flex-col gap-5">
        {panel}
        {nota && !error && (
          <p role="status" className="text-[13px] leading-[1.5] text-calido">
            {nota}
          </p>
        )}
        {error && (
          <p role="alert" className="border-l-[3px] border-[#e3a59b] pl-3 text-sm leading-[1.5] text-[#f6e7e4]">
            {error}
          </p>
        )}
        {soloLectura && <p className="mt-auto pt-2 text-[12px] leading-[1.5] text-calido">{soloLectura}</p>}
      </aside>
    </article>
  );
};

const Copiar: React.FC<{ texto: string; etiqueta: string }> = ({ texto, etiqueta }) => {
  const [hecho, setHecho] = useState(false);
  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      setHecho(true);
      window.setTimeout(() => setHecho(false), 1800);
    } catch {
      // Sin permiso de portapapeles el dato igual se puede seleccionar a mano.
    }
  }
  return (
    <button
      type="button"
      onClick={copiar}
      aria-label={hecho ? `${etiqueta} copiado` : `Copiar ${etiqueta}`}
      className="shrink-0 inline-flex items-center gap-1.5 h-8 px-2.5 text-[13px] font-medium text-bosque border border-[rgba(23,58,47,0.3)] transition-colors duration-150 hover:bg-[#E4E9E3]"
    >
      {hecho ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
      {hecho ? 'Copiado' : 'Copiar'}
    </button>
  );
};

const FilaDato: React.FC<{ dato: DatoPago }> = ({ dato }) => (
  <div className="flex flex-col gap-1">
    <dt className="text-[11px] font-medium uppercase tracking-[0.16em] text-piedra">{dato.etiqueta}</dt>
    <dd className="flex items-center justify-between gap-3">
      <span className="text-[15px] leading-[1.45] [overflow-wrap:anywhere] select-all">{dato.valor}</span>
      {dato.copiable && <Copiar texto={dato.valor} etiqueta={dato.etiqueta} />}
    </dd>
  </div>
);

const TarjetaMedio: React.FC<{ medio: MedioAlternativo }> = ({ medio }) => (
  <article className="bg-white border border-[rgba(27,31,27,0.15)] p-6 flex flex-col gap-5 min-w-0" aria-label={medio.titulo}>
    <div className="flex flex-col gap-1.5">
      <p className="eyebrow text-[11px] text-piedra">{medio.moneda}</p>
      <h3 className="font-heading font-bold text-[19px] leading-[1.25]">{medio.titulo}</h3>
    </div>
    <dl className="flex flex-col gap-4">
      {medio.datos.map((d) => (
        <FilaDato key={d.etiqueta} dato={d} />
      ))}
    </dl>
    {medio.aviso && <p className="mt-auto border-l-[3px] border-calido pl-3 text-[13px] leading-[1.5] text-piedra">{medio.aviso}</p>}
  </article>
);

/** Transferencia y cripto. El pago no se registra solo: el cliente manda el comprobante. */
const OtrosMedios: React.FC<{ empresa?: string }> = ({ empresa }) => {
  const medios = mediosDisponibles();
  if (medios.length === 0) return null;
  const mensaje = `Hola, les envío el comprobante de pago${empresa ? ` de ${empresa}` : ''}.`;
  return (
    <section className="flex flex-col pt-4" aria-labelledby="otros-medios">
      <TituloSeccion
        eyebrow="Otros medios de pago"
        titulo={<span id="otros-medios">Transferencia y cripto</span>}
        acciones={
          <a
            href={`https://wa.me/${WHATSAPP_COMPROBANTES}?text=${encodeURIComponent(mensaje)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 h-12 px-5 bg-bosque text-marfil text-sm font-medium transition-colors duration-150 hover:bg-bosque-dark"
          >
            Enviar comprobante
            <ArrowUpRight size={16} aria-hidden="true" />
          </a>
        }
      />
      <p className="text-[15px] leading-[1.6] text-piedra max-w-[680px] mb-6">
        Si preferís no pagar con tarjeta, podés transferir o enviar cripto. Mandanos el comprobante por WhatsApp y lo acreditamos a mano. Estos pagos no
        activan el débito automático.
      </p>
      <div className="grid gap-4 tab:grid-cols-2 desk:grid-cols-3">
        {medios.map((m) => (
          <TarjetaMedio key={m.id} medio={m} />
        ))}
      </div>
    </section>
  );
};

export const Pagos: React.FC<{ perfil: Perfil; organizacion: Organizacion | null }> = ({ perfil, organizacion }) => {
  const vista = useVistaPrevia();
  // En Ver como el perfil llega con el rol del cliente. Esto es el admin mirando todas las empresas.
  const esAdmin = perfil.rol === 'admin';
  const orgId = esAdmin ? null : (organizacion?.id ?? null);
  const [abonos, setAbonos] = useState<Abono[] | null>(null);
  const [pagos, setPagos] = useState<PagoAbono[]>([]);
  const [empresas, setEmpresas] = useState<Record<string, string>>({});
  const [disp, setDisp] = useState<Disponibilidad | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [vuelta] = useState(leerVuelta);
  const [intentos, setIntentos] = useState(0);

  const cargar = useCallback(async () => {
    if (!supabase) return;
    let qa = supabase.from('abonos').select('*').order('creado_en', { ascending: false });
    let qp = supabase.from('abono_pagos').select('*').order('fecha', { ascending: false }).limit(500);
    if (orgId) {
      qa = qa.eq('organizacion_id', orgId);
      qp = qp.eq('organizacion_id', orgId);
    }
    const [{ data: a, error: e }, { data: p }] = await Promise.all([qa, qp]);
    if (e) setError(esAdmin ? `${e.message}. Revisá que la migración 0009_abonos.sql esté corrida en Supabase.` : 'No pudimos cargar tus abonos. Probá recargar la página.');
    setAbonos((a as Abono[]) ?? []);
    setPagos((p as PagoAbono[]) ?? []);
  }, [orgId, esAdmin]);

  useEffect(() => {
    // Al volver de dLocal Go primero se trae el estado real del abono y después se muestra.
    const delRetorno = vuelta.volver && vuelta.abono && !vista ? sincronizarAbono(vuelta.abono) : Promise.resolve(null);
    void delRetorno.then(() => cargar());
    void consultarDisponibilidad().then(setDisp);
    if (esAdmin && supabase) {
      void supabase
        .from('organizaciones')
        .select('id, nombre')
        .then(({ data }) => setEmpresas(Object.fromEntries(((data as { id: string; nombre: string }[]) ?? []).map((o) => [o.id, o.nombre]))));
    }
  }, [cargar, esAdmin, vuelta, vista]);

  // Mientras se confirma el pago la página se actualiza sola. Cada tres vueltas vuelve a consultar a dLocal Go.
  const delRetorno = (abonos ?? []).filter((a) => !vuelta.abono || a.id === vuelta.abono);
  const esperando = vuelta.volver && !vuelta.error && delRetorno.some((a) => a.estado === 'pendiente' || a.estado === 'borrador');
  const confirmado = vuelta.volver && delRetorno.length > 0 && delRetorno.every((a) => a.estado === 'activo');
  useEffect(() => {
    if (!esperando || intentos >= MAX_INTENTOS) return;
    const t = window.setTimeout(async () => {
      if (intentos % 3 === 2 && vuelta.abono) await sincronizarAbono(vuelta.abono);
      await cargar();
      setIntentos((n) => n + 1);
    }, 5000);
    return () => window.clearTimeout(t);
  }, [esperando, intentos, cargar, vuelta.abono]);

  const soloLectura = vista
    ? 'Vista previa de solo lectura. La aceptación, los pagos y las bajas los hace el titular desde su portal.'
    : esAdmin
      ? 'Vista de FIRMA. La aceptación y el pago los hace el titular. Las bajas y la actualización del estado se hacen desde Administración.'
      : null;

  return (
    <Marco perfil={perfil}>
      <Encabezado
        eyebrow={esAdmin ? 'Pagos · Todas las empresas' : 'Pagos'}
        titulo={
          esAdmin ? (
            <>
              Abonos de <span className="text-bosque">tus clientes</span>
            </>
          ) : (
            <>
              Tu abono con <span className="text-bosque">FIRMA</span>
            </>
          )
        }
        bajada={
          esAdmin
            ? 'Así ve cada titular sus abonos. Las altas y las bajas se gestionan desde Administración.'
            : 'Débito automático con tarjeta a través de dLocal Go. Pagás en tu moneda local y FIRMA nunca ve los datos de tu tarjeta.'
        }
        acciones={
          esAdmin ? (
            <Enlace a="/portal/admin/abonos" className="inline-flex items-center h-[52px] px-6 text-[15px] font-medium bg-bosque text-marfil transition-colors duration-150 hover:bg-bosque-dark">
              Administrar abonos
            </Enlace>
          ) : undefined
        }
      />

      <div className="wrap py-10 desk:py-14 flex flex-col gap-8">
        {vuelta.volver && vuelta.error && <Aviso tipo="error">dLocal Go no pudo completar el pago. Podés intentarlo de nuevo con la misma tarjeta u otra.</Aviso>}
        {vuelta.volver && !vuelta.error && confirmado && <Aviso tipo="ok">Listo. El débito automático quedó activo.</Aviso>}
        {vuelta.volver && !vuelta.error && !confirmado && (abonos === null || (esperando && intentos < MAX_INTENTOS)) && (
          <Aviso tipo="ok">Estamos confirmando tu pago con dLocal Go. Puede tardar unos minutos y esta página se actualiza sola.</Aviso>
        )}
        {vuelta.volver && !vuelta.error && !confirmado && abonos !== null && (!esperando || intentos >= MAX_INTENTOS) && (
          <Aviso tipo="info">dLocal Go todavía no confirmó el pago. Si ya pagaste, en un rato lo vas a ver acá. También podés tocar Actualizar estado.</Aviso>
        )}
        {vuelta.cancelado && <Aviso tipo="info">No se completó el pago. Podés retomarlo cuando quieras.</Aviso>}
        {error && <Aviso tipo="error">{error}</Aviso>}

        {abonos === null ? (
          <p className="eyebrow text-piedra">Cargando</p>
        ) : abonos.length === 0 ? (
          <div className="flex flex-col gap-4 p-8 desk:p-10 max-w-[680px] bg-marfil-oscuro">
            <p className="h3">{esAdmin ? 'Todavía no hay abonos' : 'Todavía no tenés abonos'}</p>
            <p className="text-[15px] leading-[1.6] text-piedra">
              {esAdmin
                ? 'Armalos desde Administración, en la pestaña Abonos. El titular los ve acá para aceptarlos y activarlos.'
                : 'Cuando FIRMA prepare tu abono, lo vas a ver acá con sus condiciones para aceptarlo y activarlo.'}
            </p>
            <Enlace a={esAdmin ? '/portal/admin/abonos' : '/portal/agenda'} className="self-start text-sm font-medium text-bosque underline underline-offset-4">
              {esAdmin ? 'Armar un abono' : 'Agendar una reunión'}
            </Enlace>
          </div>
        ) : (
          abonos.map((a) => (
            <TarjetaAbono
              key={`${a.id}-${a.estado}-${a.actualizado_en}`}
              abono={a}
              pagos={pagos.filter((p) => p.abono_id === a.id)}
              disponible={disp ? disp.dlocalgo : null}
              empresa={esAdmin ? empresas[a.organizacion_id] : undefined}
              soloLectura={soloLectura}
              alCambiar={cargar}
            />
          ))
        )}

        <OtrosMedios empresa={esAdmin ? undefined : organizacion?.nombre} />
      </div>
    </Marco>
  );
};

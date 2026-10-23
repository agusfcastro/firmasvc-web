import React, { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import { ArrowDown, ArrowUpRight, Eye, RefreshCw, RotateCcw, Send, X } from 'lucide-react';
import { supabase } from '../supabase';
import { Enlace, Etiqueta } from '../ui';
import { BotonCopiar } from './firma';
import { ESTADO_FIRMANTE, ESTADO_SOBRE, fechaHora } from '../../firma/comun';
import { COLUMNAS_FIRMANTE, descargarSobre, llamarSobres, type Firmante, type Sobre } from '../firmas/api';

const Visor = lazy(() => import('../../firma/Visor').then((m) => ({ default: m.Visor })));

/**
 * Contrato del cliente con la firma electrónica propia, en el panel oscuro de
 * la ficha. El servidor completa las variables del modelo del servicio, deja
 * una vista previa en PDF y desde acá se manda a firmar. Firman a la vez el
 * cliente y la empresa. Al completarse, el cliente pasa solo a Firmado.
 */

type EstadoContrato = 'generando' | 'listo' | 'faltan_datos' | 'error' | 'sin_modelo';

interface Contrato {
  cliente_id: string;
  estado: EstadoContrato;
  pdf_paginas: number | null;
  avisos: string[];
  error: string | null;
  sobre_id: string | null;
  generado_en: string;
}

/** Fecha para cerrar una oración: «a. m.» ya trae su punto. */
const fecha = (iso: string | null) => fechaHora(iso).replace(/\.$/, '');

// Si quedó "generando" más de 3 minutos, la función se cortó y se puede reintentar.
const COLGADO_MS = 3 * 60 * 1000;

/** Arma el contrato con el modelo del servicio. Lo usan el alta y la ficha. */
export async function generarContratoFirma(clienteId: string): Promise<{ ok: boolean; error?: string }> {
  const r = await llamarSobres({ accion: 'crm_vista', cliente_id: clienteId });
  return r.ok ? { ok: true } : { ok: false, error: r.error };
}

const claseBoton =
  'inline-flex items-center justify-center gap-2 h-11 px-5 bg-marfil text-tinta text-sm font-medium transition-colors duration-150 hover:bg-white disabled:opacity-60';
const claseSecundario = 'inline-flex items-center gap-1.5 text-sm font-medium text-marfil underline underline-offset-4 decoration-[rgba(245,243,236,0.4)] hover:decoration-marfil disabled:opacity-60';

export const ContratoFirma: React.FC<{
  clienteId: string;
  soloLectura: boolean;
  recienCreado?: boolean;
  etiqueta: (t: string) => React.ReactNode;
  alCambiar?: () => void;
}> = ({ clienteId, soloLectura, recienCreado = false, etiqueta, alCambiar }) => {
  const [c, setC] = useState<Contrato | null | undefined>(undefined);
  const [sobre, setSobre] = useState<Sobre | null>(null);
  const [firmantes, setFirmantes] = useState<Firmante[]>([]);
  const [enlaces, setEnlaces] = useState<Record<string, string>>({});
  const [desde] = useState(() => Date.now());
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [falla, setFalla] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [vista, setVista] = useState<string | null>(null);
  const [otros, setOtros] = useState<Sobre[]>([]);

  const cargar = useCallback(async () => {
    if (!supabase) return;
    const [{ data }, { data: vinculados }] = await Promise.all([
      supabase.from('crm_contratos_firma').select('cliente_id, estado, pdf_paginas, avisos, error, sobre_id, generado_en').eq('cliente_id', clienteId).maybeSingle(),
      // Envíos atados a este cliente desde Firma electrónica › Nuevo envío.
      supabase.from('firma_sobres').select('*').eq('crm_cliente_id', clienteId).order('creado_en', { ascending: false }).limit(10),
    ]);
    const fila = (data as Contrato) ?? null;
    setC(fila);
    setOtros(((vinculados ?? []) as Sobre[]).filter((x) => x.id !== fila?.sobre_id));
    if (!fila?.sobre_id) {
      setSobre(null);
      setFirmantes([]);
      return;
    }
    const [{ data: s }, { data: f }] = await Promise.all([
      supabase.from('firma_sobres').select('*').eq('id', fila.sobre_id).maybeSingle(),
      supabase.from('firma_firmantes').select(COLUMNAS_FIRMANTE).eq('sobre_id', fila.sobre_id).order('orden').order('nombre'),
    ]);
    setSobre((s as Sobre) ?? null);
    setFirmantes((f ?? []) as unknown as Firmante[]);
    if (s?.estado === 'en_curso' && !soloLectura) {
      const r = await llamarSobres<{ enlaces: { firmante_id: string; url: string }[] }>({ accion: 'enlaces', sobre_id: fila.sobre_id });
      if (r.ok) setEnlaces(Object.fromEntries(r.datos.enlaces.map((x) => [x.firmante_id, x.url])));
    }
  }, [clienteId, soloLectura]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const generando =
    ocupado === 'generar' ||
    (c?.estado === 'generando' && Date.now() - new Date(c.generado_en).getTime() < COLGADO_MS) ||
    (c === null && recienCreado && Date.now() - desde < COLGADO_MS);
  const enCurso = sobre?.estado === 'en_curso';

  // Mientras se arma el contrato o está en firma, se vuelve a mirar solo.
  useEffect(() => {
    if (!generando && !enCurso) return;
    const t = window.setInterval(() => void cargar(), generando ? 4000 : 30000);
    return () => window.clearInterval(t);
  }, [generando, enCurso, cargar]);

  // Cuando se completa la firma, la ficha se recarga para mostrar el estado Firmado.
  const completado = sobre?.estado === 'completado';
  useEffect(() => {
    if (completado) alCambiar?.();
  }, [completado]); // eslint-disable-line react-hooks/exhaustive-deps

  async function generar() {
    setOcupado('generar');
    setFalla(null);
    setOk(null);
    const r = await generarContratoFirma(clienteId);
    setOcupado(null);
    if (!r.ok) setFalla(r.error ?? 'No se pudo armar el contrato.');
    await cargar();
  }

  async function enviar() {
    setOcupado('enviar');
    setFalla(null);
    setOk(null);
    const r = await llamarSobres<{ id: string; avisos: string[] }>({ accion: 'crm_enviar', cliente_id: clienteId });
    setOcupado(null);
    setConfirmando(false);
    if (!r.ok) return setFalla(r.error ?? 'No se pudo mandar a firmar.');
    setOk(r.datos.avisos?.length ? r.datos.avisos.join(' ') : 'Listo. Les llegó el mail al cliente y a quien firma por la empresa.');
    await cargar();
  }

  async function verPdf() {
    setOcupado('ver');
    setFalla(null);
    const r = await llamarSobres<{ url: string }>({ accion: 'crm_pdf', cliente_id: clienteId });
    setOcupado(null);
    if (!r.ok) return setFalla(r.error ?? 'No se pudo abrir el PDF.');
    setVista(r.datos.url);
  }

  async function recordar(f: Firmante) {
    setOcupado(f.id);
    setFalla(null);
    setOk(null);
    const r = await llamarSobres({ accion: 'recordar', firmante_id: f.id });
    setOcupado(null);
    if (!r.ok) return setFalla(r.error ?? 'No se pudo reenviar.');
    setOk(`Le reenviamos el mail a ${f.nombre}.`);
    await cargar();
  }

  async function bajarFirmado() {
    if (!sobre) return;
    setOcupado('bajar');
    const fallo = await descargarSobre(sobre.id, 'final');
    setOcupado(null);
    if (fallo) setFalla(fallo);
  }

  if (c === undefined) return null;

  // Se puede generar de nuevo mientras no haya un envío en curso ni firmado.
  const puedeGenerar = !soloLectura && !enCurso && !completado && !generando;
  const avisos = Array.isArray(c?.avisos) ? c!.avisos : [];
  const cerrado = sobre && !enCurso && !completado ? sobre : null;

  let texto: string;
  if (generando) texto = 'Armando el contrato con el modelo del servicio. Tarda unos segundos.';
  else if (completado) texto = `Firmado por todos el ${fecha(sobre!.completado_en)}.`;
  else if (enCurso) texto = `En firma. Vence el ${fecha(sobre!.vence_en)}.`;
  else if (cerrado) texto = `El envío anterior quedó ${ESTADO_SOBRE[cerrado.estado].texto.toLowerCase()}. ${cerrado.motivo_cierre ?? ''} Podés generarlo y mandarlo de nuevo.`;
  else if (!c) texto = 'Todavía no se generó.';
  else if (c.estado === 'sin_modelo') texto = 'El servicio no tiene contrato modelo. El titular lo elige en CRM › Servicios.';
  else if (c.estado === 'error') texto = `No se pudo armar el contrato. ${c.error ?? ''}`;
  else if (c.estado === 'faltan_datos') texto = 'Faltan datos en la ficha. Completalos y volvé a generarlo antes de mandarlo a firmar.';
  else if (c.estado === 'generando') texto = 'El armado anterior se cortó. Volvé a generarlo.';
  else texto = `Listo para revisar${c.pdf_paginas ? `, ${c.pdf_paginas} ${c.pdf_paginas === 1 ? 'hoja' : 'hojas'}` : ''}. Cuando esté bien, mandalo a firmar.`;

  return (
    <div className="flex flex-col gap-4">
      <div>
        {etiqueta('Contrato')}
        <p className={`text-sm ${cerrado && !generando ? 'text-[#f0b4a8]' : 'text-calido'}`}>{texto}</p>
      </div>

      {!generando && avisos.length > 0 && !enCurso && !completado && (
        <ul className="flex flex-col gap-1.5 text-xs text-[#f0d2a8] list-disc pl-4">
          {avisos.map((a, i) => (
            <li key={i}>{a}</li>
          ))}
        </ul>
      )}

      {/* Firmantes y seguimiento */}
      {sobre && (enCurso || completado) && (
        <ul className="flex flex-col">
          {firmantes.map((f) => {
            const e = ESTADO_FIRMANTE[f.estado];
            const pendiente = enCurso && f.estado !== 'firmado' && f.estado !== 'rechazado';
            return (
              <li key={f.id} className="py-3 flex flex-wrap items-center justify-between gap-3" style={{ borderTop: '1px solid rgba(245,243,236,0.12)' }}>
                <span className="flex flex-col min-w-0">
                  <span className="text-sm font-medium truncate">{f.nombre}</span>
                  <span className="text-xs text-calido truncate">{f.firmado_en ? `Firmó el ${fechaHora(f.firmado_en)}` : f.email}</span>
                </span>
                <span className="flex items-center gap-2">
                  <Etiqueta tono={e.tono}>{e.texto}</Etiqueta>
                  {pendiente && !soloLectura && enlaces[f.id] && <BotonCopiar texto={enlaces[f.id]} descripcion={`Copiar el enlace de ${f.nombre}`} />}
                  {pendiente && !soloLectura && (
                    <button
                      type="button"
                      title="Reenviar el mail"
                      aria-label={`Reenviar el mail a ${f.nombre}`}
                      disabled={ocupado === f.id}
                      onClick={() => void recordar(f)}
                      className="inline-flex items-center justify-center w-9 h-9 border border-[rgba(245,243,236,0.3)] text-marfil hover:border-marfil disabled:opacity-50"
                    >
                      <RefreshCw size={15} aria-hidden="true" className={ocupado === f.id ? 'animate-spin' : ''} />
                    </button>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {falla && <p className="text-sm text-[#f0b4a8]">{falla}</p>}
      {ok && <p className="text-sm text-[#b9d4c4]">{ok}</p>}

      {/* Confirmación antes de mandar */}
      {confirmando && (
        <div className="bg-[rgba(245,243,236,0.08)] p-4 flex flex-col gap-3">
          <p className="text-sm">Le llega un mail al cliente y a quien firma por la empresa, y firman a la vez. ¿Lo mandamos?</p>
          <div className="flex flex-wrap gap-3">
            <button type="button" className={claseBoton} disabled={ocupado === 'enviar'} onClick={() => void enviar()}>
              <Send size={15} aria-hidden="true" /> {ocupado === 'enviar' ? 'Enviando…' : 'Sí, mandar a firmar'}
            </button>
            <button type="button" className={claseSecundario} onClick={() => setConfirmando(false)}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {!confirmando && (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          {completado ? (
            <button type="button" className={claseBoton} disabled={ocupado === 'bajar'} onClick={() => void bajarFirmado()}>
              <ArrowDown size={15} aria-hidden="true" /> {ocupado === 'bajar' ? 'Preparando…' : 'Descargar firmado'}
            </button>
          ) : (
            !soloLectura &&
            !enCurso &&
            !generando &&
            c?.estado === 'listo' &&
            !cerrado && (
              <button type="button" className={claseBoton} onClick={() => setConfirmando(true)}>
                <Send size={15} aria-hidden="true" /> Mandar a firmar
              </button>
            )
          )}
          {!generando && (c?.estado === 'listo' || c?.estado === 'faltan_datos' || sobre) && (
            <button type="button" className={claseSecundario} disabled={ocupado === 'ver'} onClick={() => void verPdf()}>
              <Eye size={15} aria-hidden="true" /> {ocupado === 'ver' ? 'Abriendo…' : completado ? 'Ver firmado' : 'Ver contrato'}
            </button>
          )}
          {puedeGenerar && (
            <button type="button" className={c && c.estado !== 'sin_modelo' && c.estado !== 'error' && !cerrado ? claseSecundario : claseBoton} onClick={() => void generar()}>
              <RotateCcw size={15} aria-hidden="true" /> {c ? 'Generar de nuevo' : 'Generar contrato'}
            </button>
          )}
          {sobre && (
            <Enlace a={`/portal/firmas/${sobre.id}`} className={claseSecundario}>
              <ArrowUpRight size={15} aria-hidden="true" /> Seguimiento
            </Enlace>
          )}
        </div>
      )}

      {otros.length > 0 && (
        <div>
          {etiqueta('Otros documentos vinculados')}
          <ul className="flex flex-col">
            {otros.map((o) => {
              const e = ESTADO_SOBRE[o.estado];
              const fallido = o.estado === 'rechazado' || o.estado === 'vencido' || o.estado === 'anulado';
              const cuando =
                o.estado === 'completado' ? `Firmado el ${fecha(o.completado_en)}` : o.estado === 'en_curso' ? `Vence el ${fecha(o.vence_en)}` : `${e.texto} el ${fecha(o.cerrado_en)}`;
              return (
                <li key={o.id} className="py-3 flex flex-col gap-1.5" style={{ borderTop: '1px solid rgba(245,243,236,0.12)' }}>
                  <span className="flex flex-wrap items-center justify-between gap-3">
                    <Enlace a={`/portal/firmas/${o.id}`} className="text-sm font-medium underline underline-offset-4 decoration-[rgba(245,243,236,0.4)] hover:decoration-marfil min-w-0 truncate">
                      {o.titulo}
                    </Enlace>
                    <Etiqueta tono={e.tono}>{e.texto}</Etiqueta>
                  </span>
                  <span className={`text-xs ${fallido ? 'text-[#f0b4a8]' : 'text-calido'}`}>
                    {cuando}.{fallido && o.motivo_cierre ? ` ${o.motivo_cierre}` : ''}
                    {fallido ? ' Hay que volver a mandarlo.' : ''}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {vista && (
        <div className="fixed inset-0 z-50 flex tab:items-center tab:justify-center bg-[rgba(27,31,27,0.6)] tab:p-6" role="dialog" aria-modal="true" aria-label="Contrato" onMouseDown={(e) => e.target === e.currentTarget && setVista(null)}>
          <div className="relative w-full tab:max-w-[900px] h-full tab:h-[92vh] overflow-y-auto bg-marfil text-tinta flex flex-col">
            <div className="sticky top-0 z-20 bg-marfil flex items-center justify-between gap-4 px-5 py-3" style={{ borderBottom: '1px solid rgba(27,31,27,0.12)' }}>
              <span className="eyebrow text-[11px] text-piedra">{completado ? 'Contrato firmado' : 'Vista previa del contrato'}</span>
              <button type="button" onClick={() => setVista(null)} aria-label="Cerrar" className="w-9 h-9 inline-flex items-center justify-center hover:bg-marfil-oscuro">
                <X size={18} aria-hidden="true" />
              </button>
            </div>
            <Suspense fallback={<p className="eyebrow text-piedra p-8">Cargando</p>}>
              <Visor url={vista} titulo="Contrato" />
            </Suspense>
          </div>
        </div>
      )}
    </div>
  );
};

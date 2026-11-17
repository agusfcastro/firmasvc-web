import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from '../../Button';
import { supabase } from '../supabase';
import { Aviso, Cargando, Cifras, Etiqueta, TituloSeccion, claseInput } from '../ui';
import { useVistaPrevia } from '../vistaPrevia';
import { mensajeAmable } from '../errores';
import {
  BANDA,
  CONFIANZA,
  CONTEO,
  ETAPA,
  LINEA_BASE,
  REGLAS,
  SUJETO,
  TONO_BANDA,
  cuenta,
  type AnalisisCompleto,
  type CodigoCatalogo,
} from './analisis';

/**
 * Informe del análisis de una llamada de venta (migración 0067).
 *   FIRMA     lo ve siempre. En revisión, descarta o restaura códigos con
 *             motivo (la base recalcula el puntaje), aprueba o descarta el
 *             análisis entero, y puede pedir uno nuevo o analizarla como venta.
 *   Negocio   titular y CSM ven el estado y, aprobado, el informe sin las
 *             correcciones de FIRMA ni lo descartado.
 * En «Ver como», FIRMA ve lo que vería el negocio.
 * Abrir el informe queda en la bitácora (lo anota analisis_leer).
 */

const fechaHora = (iso: string) =>
  new Date(iso).toLocaleString('es-AR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const LIMITES =
  'Este análisis describe conductas verbales observadas en una llamada y no evalúa la personalidad ni la honestidad de nadie. Los pesos del libro de códigos son a priori y todavía no están calibrados con desenlaces reales. Es un insumo para una decisión humana y no la reemplaza.';

const ESPERA: Record<string, string> = {
  pendiente: 'La llamada se está analizando. Suele tardar unos minutos.',
  en_revision: 'FIRMA está revisando este análisis. Lo vas a ver acá apenas lo apruebe.',
  no_aplica: 'La llamada no es de venta, así que por ahora no tiene análisis de riesgo.',
  limite: 'Este mes ya se usaron los análisis de llamadas que incluye el plan.',
  error: 'No pudimos analizar esta llamada. Podés volver a pedirlo.',
  reemplazado: 'Este análisis fue reemplazado por uno más nuevo.',
};

export const AnalisisLlamada: React.FC<{
  analisisId: string;
  esStaff: boolean;
  puedePedir: boolean;
  alVolver: (mensaje?: string) => void;
  alCambiar: () => void;
}> = ({ analisisId, esStaff, puedePedir, alVolver, alCambiar }) => {
  const vistaPrevia = Boolean(useVistaPrevia());
  const comoFirma = esStaff && !vistaPrevia;
  const [datos, setDatos] = useState<AnalisisCompleto | null>(null);
  const [catalogo, setCatalogo] = useState<Map<string, CodigoCatalogo>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [descartando, setDescartando] = useState<{ codigo: string; motivo: string } | null>(null);
  const [motivoAnalisis, setMotivoAnalisis] = useState<string | null>(null);

  async function cargar() {
    if (!supabase) return;
    const { data, error: e } = await supabase.rpc('analisis_leer', { p_analisis: analisisId });
    if (e) return setError(mensajeAmable(e, 'No pudimos abrir el análisis.'));
    const a = data as AnalisisCompleto;
    setDatos(a);
    if (a.version) {
      const { data: c } = await supabase.from('analisis_codigos').select('codigo, tipo, nombre, peso, respaldo').eq('version', a.version);
      setCatalogo(new Map(((c as CodigoCatalogo[] | null) ?? []).map((x) => [x.codigo, x])));
    }
  }

  useEffect(() => {
    setDatos(null);
    setDescartando(null);
    setMotivoAnalisis(null);
    void cargar();
  }, [analisisId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function correr(accion: () => PromiseLike<{ error: { message: string } | null }>, mensaje: string, volver = false) {
    setOcupado(true);
    setError(null);
    setOk(null);
    const { error: e } = await accion();
    setOcupado(false);
    if (e) {
      setError(mensajeAmable(e));
      return;
    }
    alCambiar();
    if (volver) return alVolver(mensaje);
    setOk(mensaje);
    setDescartando(null);
    setMotivoAnalisis(null);
    await cargar();
  }

  const codigos = datos?.codigos ?? [];
  const descartados = useMemo(() => new Set(codigos.filter((c) => c.descartado).map((c) => c.codigo)), [codigos]);
  const nombre = (codigo: string) => catalogo.get(codigo)?.nombre ?? codigo;
  // El negocio no ve lo que FIRMA descartó.
  const mostrar = <T extends { codigo: string }>(items: T[] | undefined) => (items ?? []).filter((x) => comoFirma || !descartados.has(x.codigo));

  const volver = (
    <button type="button" onClick={() => alVolver()} className="inline-flex items-center gap-1.5 text-sm hover:text-bosque self-start">
      <ArrowLeft size={14} aria-hidden="true" /> Volver a las llamadas
    </button>
  );

  if (!datos) {
    return (
      <section className="flex flex-col gap-6">
        {volver}
        {error ? <Aviso tipo="error">{error}</Aviso> : <Cargando />}
      </section>
    );
  }

  const titulo = datos.titulo || 'Llamada sin título';
  const sinInforme = ['pendiente', 'limite', 'error', 'reemplazado'].includes(datos.estado);
  const visible = datos.visible && (comoFirma ? !sinInforme : datos.estado === 'aprobado');

  if (!visible) {
    const puedeVolverAPedir = (puedePedir || comoFirma) && !vistaPrevia && (datos.estado === 'error' || datos.estado === 'limite');
    return (
      <section className="flex flex-col gap-6">
        {volver}
        <TituloSeccion eyebrow="Análisis de la llamada" titulo={titulo} />
        {error && <Aviso tipo="error">{error}</Aviso>}
        {datos.estado === 'descartado' ? (
          <Aviso tipo="info">FIRMA descartó este análisis{datos.motivo ? `. Motivo, ${datos.motivo}` : ''}.</Aviso>
        ) : (
          <Aviso tipo="info">{ESPERA[datos.estado] ?? 'El análisis todavía no está disponible.'}</Aviso>
        )}
        {comoFirma && datos.error && <p className="text-sm text-piedra">Detalle del error, {datos.error}</p>}
        {puedeVolverAPedir && (
          <div>
            <Button
              size="sm"
              disabled={ocupado}
              onClick={() => void correr(() => supabase!.rpc('analisis_solicitar', { p_interaccion: datos.interaccion_id }), 'Pedimos el análisis de nuevo.', true)}
            >
              Volver a pedir el análisis
            </Button>
          </div>
        )}
      </section>
    );
  }

  const d = datos.detalle ?? {};
  const enRevision = datos.estado === 'en_revision';
  const editable = comoFirma && enRevision && !ocupado;
  const indicadores = mostrar(d.indicadores);
  const protectores = mostrar(d.protectores);
  const vendedor = mostrar(d.conducta_vendedor);
  const banda = datos.banda_final;

  const botonCodigo = (codigo: string) =>
    !editable ? null : descartados.has(codigo) ? (
      <button
        type="button"
        className="text-[13px] underline underline-offset-4 hover:text-bosque"
        onClick={() => void correr(() => supabase!.rpc('analisis_corregir', { p_analisis: datos.id, p_codigo: codigo, p_descartar: false }), `${codigo} restaurado.`)}
      >
        Restaurar
      </button>
    ) : (
      <button type="button" className="text-[13px] underline underline-offset-4 hover:text-peligro" onClick={() => setDescartando({ codigo, motivo: '' })}>
        Descartar
      </button>
    );

  const celdaCodigo = (codigo: string) => (
    <td className="whitespace-nowrap">
      <span className={descartados.has(codigo) ? 'line-through text-piedra' : 'font-semibold'}>{codigo}</span>
      <span className="block text-[12.5px] text-piedra max-w-[200px] whitespace-normal">{nombre(codigo)}</span>
    </td>
  );

  return (
    <section className="flex flex-col gap-8">
      {volver}
      <TituloSeccion
        eyebrow={`Análisis de la llamada · ${datos.ocurrida_en ? fechaHora(datos.ocurrida_en) : ''}`}
        titulo={titulo}
        acciones={
          <div className="flex flex-wrap gap-2 items-center">
            {banda && <Etiqueta tono={TONO_BANDA[banda]}>Riesgo {BANDA[banda].toLowerCase()}</Etiqueta>}
            {comoFirma && <Etiqueta tono={enRevision ? 'alerta' : 'piedra'}>{enRevision ? 'En revisión' : datos.estado === 'aprobado' ? 'Aprobado' : datos.estado}</Etiqueta>}
          </div>
        }
      />
      {error && <Aviso tipo="error">{error}</Aviso>}
      {ok && <Aviso tipo="ok">{ok}</Aviso>}

      {comoFirma && enRevision && (
        <Aviso tipo="info">
          Revisión de FIRMA. Descartá lo que no corresponda, con el motivo, y aprobá. Hasta que lo apruebes, el negocio ve «En revisión de FIRMA».
          {d.verificacion?.citas_rechazadas ? ` El sistema ya dejó afuera ${d.verificacion.citas_rechazadas} cita${d.verificacion.citas_rechazadas === 1 ? '' : 's'} que no aparecían textuales.` : ''}
        </Aviso>
      )}
      {datos.alerta_vulnerabilidad && (
        <Aviso tipo="error">
          Alerta de posible vulnerabilidad. El prospecto declaró una tensión financiera fuerte. Antes de seguir, que una persona revise el caso, sin presionar y dando tiempo para decidir.
        </Aviso>
      )}
      {datos.detalle_vencido && <Aviso tipo="info">El detalle con las citas ya venció junto con la llamada. Quedan los códigos y el puntaje.</Aviso>}

      {/* Resultado */}
      <div className="flex flex-col gap-4">
        <Cifras
          items={[
            { titulo: 'Banda final', valor: banda ? BANDA[banda] : 'Sin banda' },
            { titulo: 'Riesgo', valor: datos.puntaje_riesgo ?? 0 },
            { titulo: 'Protector', valor: datos.puntaje_protector ?? 0 },
            { titulo: 'Neto', valor: datos.puntaje_neto ?? 0 },
          ]}
        />
        <div className="text-sm text-piedra flex flex-col gap-1">
          <p className="tabular-nums">
            Riesgo {cuenta(codigos, 'riesgo')}. Protector {cuenta(codigos, 'protector')}. Neto {datos.puntaje_neto ?? 0}
            {datos.banda_puntaje ? `, banda por puntaje ${BANDA[datos.banda_puntaje].toLowerCase()}` : ''}.
          </p>
          {(datos.reglas ?? []).map((r) => (
            <p key={r}>
              <span className="font-semibold text-tinta">{r}</span> {REGLAS[r] ?? ''}
            </p>
          ))}
          <p>
            Confianza {CONFIANZA[datos.confianza ?? ''] ?? 'sin dato'}
            {d.confianza_motivo ? `. ${d.confianza_motivo}` : ''}
            {datos.palabras_prospecto != null ? ` El prospecto dijo unas ${datos.palabras_prospecto} palabras.` : ''}
          </p>
          {d.lectura && <p className="text-tinta text-[15px] leading-relaxed mt-2 max-w-[75ch]">{d.lectura}</p>}
        </div>
      </div>

      {comoFirma && enRevision && (
        <div className="flex flex-wrap gap-3 items-start">
          <Button size="sm" disabled={ocupado} onClick={() => void correr(() => supabase!.rpc('analisis_aprobar', { p_analisis: datos.id }), 'Análisis aprobado. Ya lo ve el negocio.')}>
            Aprobar
          </Button>
          <Button size="sm" variant="ghost" disabled={ocupado} onClick={() => setMotivoAnalisis('')}>
            Descartar el análisis
          </Button>
        </div>
      )}

      {descartando && (
        <form
          className="flex flex-col gap-3 border border-borde-suave rounded-control p-4 bg-papel max-w-[640px]"
          onSubmit={(e) => {
            e.preventDefault();
            void correr(
              () => supabase!.rpc('analisis_corregir', { p_analisis: datos.id, p_codigo: descartando.codigo, p_descartar: true, p_motivo: descartando.motivo }),
              `${descartando.codigo} descartado. El puntaje se recalculó.`,
            );
          }}
        >
          <label className="text-sm font-medium">
            Por qué descartás {descartando.codigo} ({nombre(descartando.codigo)})
            <input
              autoFocus
              className={`${claseInput} mt-1.5`}
              value={descartando.motivo}
              maxLength={300}
              onChange={(e) => setDescartando({ ...descartando, motivo: e.target.value })}
              placeholder="Por ejemplo, preguntó por la garantía para informarse"
            />
          </label>
          <div className="flex gap-2">
            <Button size="sm" type="submit" disabled={ocupado || descartando.motivo.trim().length < 3}>
              Descartar
            </Button>
            <Button size="sm" variant="ghost" type="button" onClick={() => setDescartando(null)}>
              Cancelar
            </Button>
          </div>
        </form>
      )}

      {motivoAnalisis !== null && (
        <form
          className="flex flex-col gap-3 border border-borde-suave rounded-control p-4 bg-papel max-w-[640px]"
          onSubmit={(e) => {
            e.preventDefault();
            void correr(() => supabase!.rpc('analisis_descartar', { p_analisis: datos.id, p_motivo: motivoAnalisis }), 'Análisis descartado.', true);
          }}
        >
          <label className="text-sm font-medium">
            Por qué descartás el análisis (lo ve el negocio)
            <input
              autoFocus
              className={`${claseInput} mt-1.5`}
              value={motivoAnalisis}
              maxLength={300}
              onChange={(e) => setMotivoAnalisis(e.target.value)}
              placeholder="Por ejemplo, la transcripción está cortada"
            />
          </label>
          <div className="flex gap-2">
            <Button size="sm" type="submit" disabled={ocupado || motivoAnalisis.trim().length < 3}>
              Descartar el análisis
            </Button>
            <Button size="sm" variant="ghost" type="button" onClick={() => setMotivoAnalisis(null)}>
              Cancelar
            </Button>
          </div>
        </form>
      )}

      {/* Indicadores */}
      <div className="flex flex-col gap-3">
        <TituloSeccion eyebrow="Lo que dijo el prospecto" titulo="Indicadores de riesgo" />
        <div className="overflow-x-auto">
          <table className="tabla min-w-[860px]">
            <thead>
              <tr>
                <th>Código</th>
                <th>Int.</th>
                <th>Puntos</th>
                <th>Cita literal</th>
                <th>Minuto</th>
                <th>Por qué cumple</th>
                {comoFirma && enRevision && <th />}
              </tr>
            </thead>
            <tbody>
              {indicadores.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-6 text-piedra">
                    No se codificaron indicadores de riesgo.
                  </td>
                </tr>
              )}
              {indicadores.map((x, i) => {
                const c = codigos.find((k) => k.codigo === x.codigo);
                return (
                  <tr key={`${x.codigo}-${i}`}>
                    {celdaCodigo(x.codigo)}
                    <td className="tabular-nums">{x.intensidad}</td>
                    <td className="tabular-nums">{c && !c.descartado ? `${c.peso}×${c.intensidad} = ${c.puntos}` : '0'}</td>
                    <td className="italic max-w-[280px]">«{x.cita}»</td>
                    <td className="tabular-nums whitespace-nowrap">{x.minuto || '—'}</td>
                    <td className="max-w-[320px]">
                      {x.justificacion}
                      {x.inducido && <span className="block text-[12.5px] text-peligro mt-1">Inducido por el vendedor</span>}
                      {x.corregido && <span className="block text-[12.5px] text-piedra mt-1">El vendedor lo corrigió</span>}
                    </td>
                    {comoFirma && enRevision && <td>{botonCodigo(x.codigo)}</td>}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Protectores */}
      <div className="flex flex-col gap-3">
        <TituloSeccion eyebrow="Lo que baja el riesgo" titulo="Factores protectores" />
        {protectores.length === 0 ? (
          <p className="text-sm text-piedra">No se codificaron factores protectores.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="tabla min-w-[760px]">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Int.</th>
                  <th>Cita literal</th>
                  <th>Minuto</th>
                  <th>Por qué cumple</th>
                  {comoFirma && enRevision && <th />}
                </tr>
              </thead>
              <tbody>
                {protectores.map((x, i) => (
                  <tr key={`${x.codigo}-${i}`}>
                    {celdaCodigo(x.codigo)}
                    <td className="tabular-nums">{x.intensidad}</td>
                    <td className="italic max-w-[280px]">«{x.cita}»</td>
                    <td className="tabular-nums whitespace-nowrap">{x.minuto || '—'}</td>
                    <td className="max-w-[320px]">{x.justificacion}</td>
                    {comoFirma && enRevision && <td>{botonCodigo(x.codigo)}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Compromiso y agencia */}
      {(d.conteo_compromiso || d.sujeto_resultado) && (
        <div className="flex flex-col gap-3">
          <TituloSeccion eyebrow="Cómo habla de lo que va a hacer" titulo="Compromiso y agencia" />
          <div className="overflow-x-auto">
            <table className="tabla min-w-[560px]">
              <thead>
                <tr>
                  {CONTEO.map(([, t]) => (
                    <th key={t}>{t}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  {CONTEO.map(([k]) => (
                    <td key={k} className="tabular-nums">
                      {d.conteo_compromiso?.[k] ?? 0}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-sm text-piedra">
            Quién logra el resultado en sus frases.{' '}
            {SUJETO.map(([k, t]) => `${t} ${d.sujeto_resultado?.[k] ?? 0}`).join(' · ')}
          </p>
        </div>
      )}

      {/* Vendedor */}
      {vendedor.length > 0 && (
        <div className="flex flex-col gap-3">
          <TituloSeccion eyebrow="No suma al puntaje" titulo="Conducta del vendedor" />
          <div className="overflow-x-auto">
            <table className="tabla min-w-[700px]">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Cita literal</th>
                  <th>Minuto</th>
                  <th>Comentario</th>
                  {comoFirma && enRevision && <th />}
                </tr>
              </thead>
              <tbody>
                {vendedor.map((x, i) => (
                  <tr key={`${x.codigo}-${i}`}>
                    {celdaCodigo(x.codigo)}
                    <td className="italic max-w-[300px]">«{x.cita}»</td>
                    <td className="tabular-nums whitespace-nowrap">{x.minuto || '—'}</td>
                    <td className="max-w-[320px]">{x.comentario}</td>
                    {comoFirma && enRevision && <td>{botonCodigo(x.codigo)}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pautas, temas y línea de base */}
      <div className="grid gap-8 desk:grid-cols-2">
        <div className="flex flex-col gap-3">
          <TituloSeccion eyebrow="Qué hacer" titulo="Pautas de gestión" />
          {(d.pautas ?? []).length ? (
            <ul className="list-disc pl-5 text-[15px] flex flex-col gap-1.5">
              {(d.pautas ?? []).map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-piedra">Sin pautas.</p>
          )}
        </div>
        <div className="flex flex-col gap-3">
          <TituloSeccion eyebrow="Para la próxima" titulo="Temas no explorados" />
          {(d.temas_no_explorados ?? []).length ? (
            <ul className="list-disc pl-5 text-[15px] flex flex-col gap-1.5">
              {(d.temas_no_explorados ?? []).map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-piedra">Ninguno.</p>
          )}
        </div>
      </div>

      {d.linea_base && (
        <div className="flex flex-col gap-3">
          <TituloSeccion eyebrow="Para el seguimiento" titulo="Línea de base" />
          <table className="tabla max-w-[760px]">
            <tbody>
              {LINEA_BASE.map(([k, t]) => (
                <tr key={k}>
                  <th className="text-left font-medium w-[260px]">{t}</th>
                  <td>{d.linea_base?.[k] || <span className="text-piedra">No se habló</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Descartes */}
      {(d.descartes ?? []).length > 0 && (
        <details className="border border-borde-suave rounded-control p-4 bg-papel">
          <summary className="cursor-pointer text-sm font-medium">Descartes ({d.descartes!.length})</summary>
          <ul className="mt-3 flex flex-col gap-2 text-sm">
            {d.descartes!.map((x, i) => (
              <li key={i}>
                <span className="font-semibold">{x.codigo_evaluado}</span> «{x.fragmento}». {x.motivo}
                {comoFirma && x.origen === 'verificacion' && <span className="text-piedra"> (verificación automática)</span>}
              </li>
            ))}
          </ul>
        </details>
      )}

      {/* Correcciones de FIRMA */}
      {comoFirma && (datos.correcciones ?? []).length > 0 && (
        <details className="border border-borde-suave rounded-control p-4 bg-papel" open>
          <summary className="cursor-pointer text-sm font-medium">Correcciones de FIRMA ({datos.correcciones!.length})</summary>
          <ul className="mt-3 flex flex-col gap-2 text-sm">
            {datos.correcciones!.map((c, i) => (
              <li key={i}>
                <span className="tabular-nums text-piedra">{fechaHora(c.en)}</span> · {c.accion === 'descartado' ? 'Descartó' : 'Restauró'}{' '}
                <span className="font-semibold">{c.codigo}</span>
                {c.motivo ? `. ${c.motivo}` : ''}
              </li>
            ))}
          </ul>
        </details>
      )}

      {comoFirma && (
        <div className="flex flex-col gap-3 border-t border-borde-suave pt-6">
          <p className="text-[12.5px] text-piedra">
            Libro de códigos {datos.version} · {datos.etapa ? `Etapa ${ETAPA[datos.etapa] ?? datos.etapa}` : ''}
            {d.etapa_motivo ? `. ${d.etapa_motivo}` : ''}
            {datos.modelo ? ` · ${datos.modelo}` : ''}
            {datos.analizado_en ? ` · Analizado el ${fechaHora(datos.analizado_en)}` : ''}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="ghost"
              disabled={ocupado}
              onClick={() =>
                void correr(() => supabase!.rpc('analisis_solicitar', { p_interaccion: datos.interaccion_id, p_forzar_venta: false }), 'Pedimos un análisis nuevo.', true)
              }
            >
              Volver a analizar
            </Button>
            {datos.etapa !== 'venta' && (
              <Button
                size="sm"
                variant="ghost"
                disabled={ocupado}
                onClick={() =>
                  void correr(() => supabase!.rpc('analisis_solicitar', { p_interaccion: datos.interaccion_id, p_forzar_venta: true }), 'Pedimos analizarla como venta.', true)
                }
              >
                Analizar como venta
              </Button>
            )}
          </div>
        </div>
      )}

      <p className="text-[12.5px] text-piedra max-w-[80ch]">
        {datos.estado === 'aprobado' && datos.revisado_en ? `Revisado y aprobado por FIRMA el ${fechaHora(datos.revisado_en)}. ` : ''}
        {LIMITES}
      </p>
    </section>
  );
};

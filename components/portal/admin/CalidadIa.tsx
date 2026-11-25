import React, { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, Download } from 'lucide-react';
import { Button } from '../../Button';
import { supabase } from '../supabase';
import { Aviso, Campo, Enlace, Etiqueta, Pestanas, claseInput } from '../ui';
import { fechaCorta } from '../tipos';
import { mensajeAmable } from '../errores';
import {
  AGENTES,
  CAMINOS,
  ETAPAS,
  archivoParaEvaluador,
  esperadoDesde,
  nombreAgente,
  problemaDeEntrada,
  type CasoIa,
  type FormularioEsperado,
} from './casosIa';

/**
 * Administración › Calidad de la IA (migraciones 0074 y 0075). Las corridas
 * de cada agente, la revisión de FIRMA, la tasa de aprobación sin cambios
 * por versión del prompt y los casos de prueba que usa el evaluador.
 */

type Revision = 'pendiente' | 'aprobada' | 'corregida' | 'rechazada' | 'sin_revision';

interface Corrida {
  id: number;
  agente: string;
  version_prompt: string;
  modelo: string;
  organizacion_id: string | null;
  referencia_tabla: 'tina_conversaciones' | 'interaccion_analisis' | 'asunto_archivos' | null;
  referencia_id: string | null;
  tokens_entrada: number;
  tokens_salida: number;
  costo_usd: number;
  duracion_ms: number | null;
  error: string | null;
  revision: Revision;
  nota: string | null;
  revisado_en: string | null;
  creado_en: string;
}

interface Resumen {
  agente: string;
  version_prompt: string;
  corridas: number;
  revisadas: number;
  aprobadas: number;
  costo_usd: number;
  ultima: string;
}

interface Mensaje {
  id: number;
  autor: 'usuario' | 'tina';
  contenido: string;
  herramientas: { nombre: string }[] | null;
  creado_en: string;
}

interface Preparado {
  agente: string;
  nota: string | null;
  entrada: Record<string, unknown>;
  salida: unknown;
  aviso?: string;
}

const REVISION: Record<Revision, { texto: string; tono: 'bosque' | 'piedra' | 'alerta' | 'tinta' }> = {
  pendiente: { texto: 'Para revisar', tono: 'piedra' },
  aprobada: { texto: 'Aprobada', tono: 'bosque' },
  corregida: { texto: 'Corregida', tono: 'tinta' },
  rechazada: { texto: 'Rechazada', tono: 'alerta' },
  sin_revision: { texto: 'Se revisa aparte', tono: 'piedra' },
};

const COLUMNAS = 'id, agente, version_prompt, modelo, organizacion_id, referencia_tabla, referencia_id, tokens_entrada, tokens_salida, costo_usd, duracion_ms, error, revision, nota, revisado_en, creado_en';

const usd = (n: number) => `USD ${Number(n || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;
const tasa = (r: Resumen) => (r.revisadas ? Math.round((100 * r.aprobadas) / r.revisadas) : null);

async function prepararCaso(corridaId: number): Promise<Preparado | { error: string }> {
  if (!supabase) return { error: 'Portal sin configurar.' };
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { error: 'Tu sesión venció. Volvé a ingresar.' };
  try {
    const r = await fetch('/api/admin/ia', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ accion: 'preparar_caso', corrida_id: corridaId }),
    });
    const j = (await r.json().catch(() => ({}))) as Preparado & { error?: string };
    return r.ok ? j : { error: j.error || `Error ${r.status}` };
  } catch {
    return { error: 'No hay conexión con el servidor.' };
  }
}

function descargar(nombre: string, texto: string) {
  const url = URL.createObjectURL(new Blob([texto], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  a.click();
  URL.revokeObjectURL(url);
}

export const CalidadIa: React.FC = () => {
  const [pestana, setPestana] = useState<'revisar' | 'todas' | 'casos'>('revisar');
  const [agente, setAgente] = useState('todos');
  const [resumen, setResumen] = useState<Resumen[]>([]);
  const [corridas, setCorridas] = useState<Corrida[]>([]);
  const [casos, setCasos] = useState<CasoIa[]>([]);
  const [empresas, setEmpresas] = useState<Record<string, string>>({});
  const [abierta, setAbierta] = useState<Corrida | null>(null);
  const [pendientes, setPendientes] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  async function cargar() {
    if (!supabase) return;
    let q = supabase.from('ia_corridas').select(COLUMNAS).order('creado_en', { ascending: false }).limit(150);
    if (pestana === 'revisar') q = q.eq('revision', 'pendiente');
    if (agente !== 'todos') q = q.eq('agente', agente);
    const [r, c, k, o, p] = await Promise.all([
      supabase.rpc('ia_resumen'),
      q,
      supabase.from('ia_casos').select('id, agente, etiqueta, origen, corrida_id, entrada, esperado, activo, creado_en').order('creado_en', { ascending: false }),
      supabase.from('organizaciones').select('id, nombre'),
      supabase.from('ia_corridas').select('id', { count: 'exact', head: true }).eq('revision', 'pendiente'),
    ]);
    if (r.error || c.error || k.error) setError(mensajeAmable(r.error ?? c.error ?? k.error, 'No pudimos cargar las corridas de la IA.'));
    setResumen((r.data as Resumen[]) ?? []);
    setCorridas((c.data as Corrida[]) ?? []);
    setCasos((k.data as CasoIa[]) ?? []);
    setEmpresas(Object.fromEntries(((o.data as { id: string; nombre: string }[]) ?? []).map((x) => [x.id, x.nombre])));
    setPendientes(p.count ?? 0);
  }

  useEffect(() => {
    void cargar();
  }, [pestana, agente]); // eslint-disable-line react-hooks/exhaustive-deps

  const porAgente = useMemo(() => {
    const m = new Map<string, Resumen[]>();
    for (const r of resumen) m.set(r.agente, [...(m.get(r.agente) ?? []), r]);
    return [...m.entries()];
  }, [resumen]);

  if (abierta)
    return (
      <DetalleCorrida
        corrida={abierta}
        empresa={abierta.organizacion_id ? empresas[abierta.organizacion_id] ?? 'Empresa' : 'Sin empresa'}
        alVolver={(m) => {
          setAbierta(null);
          setOk(m ?? null);
          void cargar();
        }}
      />
    );

  return (
    <div className="space-y-8">
      {error && <Aviso tipo="error">{error}</Aviso>}
      {ok && <Aviso tipo="ok">{ok}</Aviso>}

      <section className="space-y-3">
        <h2 className="h3">Aprobadas sin cambios</h2>
        <div className="overflow-x-auto">
          <table className="tabla min-w-[720px]">
            <thead>
              <tr>
                <th>Agente</th>
                <th>Versión</th>
                <th>Corridas</th>
                <th>Revisadas</th>
                <th>Sin cambios</th>
                <th>Costo</th>
                <th>Última</th>
              </tr>
            </thead>
            <tbody>
              {porAgente.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-piedra">
                    Todavía no hay corridas.
                  </td>
                </tr>
              )}
              {porAgente.flatMap(([a, versiones]) =>
                versiones.map((v, i) => {
                  const t = tasa(v);
                  return (
                    <tr key={`${a}-${v.version_prompt}`}>
                      <td className="font-semibold">{i === 0 ? nombreAgente(a) : ''}</td>
                      <td>
                        <code className="text-xs">{v.version_prompt}</code>
                        {i === 0 && <span className="ml-2 text-xs text-piedra">vigente</span>}
                      </td>
                      <td className="tabular-nums">{v.corridas}</td>
                      <td className="tabular-nums">{v.revisadas}</td>
                      <td className="tabular-nums">
                        {t === null ? '·' : `${t} %`}
                        {t !== null && v.revisadas >= 20 && t >= 90 && (
                          <span className="ml-2">
                            <Etiqueta tono="bosque">Lista</Etiqueta>
                          </span>
                        )}
                      </td>
                      <td className="tabular-nums whitespace-nowrap">{usd(v.costo_usd)}</td>
                      <td className="whitespace-nowrap">{fechaCorta(v.ultima)}</td>
                    </tr>
                  );
                }),
              )}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-piedra">Un agente queda listo con 18 de 20 aprobadas sin cambios. Lo legal, los reembolsos, los conflictos y la difamación se revisan siempre.</p>
      </section>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <Pestanas
          items={[
            { clave: 'revisar', titulo: 'Para revisar', cuenta: pendientes },
            { clave: 'todas', titulo: 'Todas' },
            { clave: 'casos', titulo: 'Casos de prueba', cuenta: casos.filter((c) => c.activo).length },
          ]}
          activa={pestana}
          alCambiar={(c) => setPestana(c as typeof pestana)}
        />
        <select className={`${claseInput} w-auto`} value={agente} onChange={(e) => setAgente(e.target.value)} aria-label="Agente">
          <option value="todos">Todos los agentes</option>
          {Object.entries(AGENTES).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>

      {pestana === 'casos' ? (
        <Casos casos={agente === 'todos' ? casos : casos.filter((c) => c.agente === agente)} todos={casos} alCambiar={() => void cargar()} alError={setError} />
      ) : (
        <div className="overflow-x-auto">
          <table className="tabla min-w-[820px]">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Agente</th>
                <th>Empresa</th>
                <th>Versión</th>
                <th>Costo</th>
                <th>Estado</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {corridas.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-piedra">
                    {pestana === 'revisar' ? 'No hay nada para revisar.' : 'No hay corridas.'}
                  </td>
                </tr>
              )}
              {corridas.map((c) => (
                <tr key={c.id}>
                  <td className="whitespace-nowrap">{fechaCorta(c.creado_en)}</td>
                  <td>{nombreAgente(c.agente)}</td>
                  <td>{c.organizacion_id ? empresas[c.organizacion_id] ?? '·' : '·'}</td>
                  <td>
                    <code className="text-xs">{c.version_prompt}</code>
                  </td>
                  <td className="tabular-nums whitespace-nowrap">{usd(c.costo_usd)}</td>
                  <td>{c.error ? <Etiqueta tono="alerta">Con error</Etiqueta> : <Etiqueta tono={REVISION[c.revision].tono}>{REVISION[c.revision].texto}</Etiqueta>}</td>
                  <td className="text-right">
                    <button type="button" className="underline underline-offset-4 hover:text-bosque" onClick={() => setAbierta(c)}>
                      {c.revision === 'pendiente' ? 'Revisar' : 'Ver'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

/** Dónde está guardado lo que hizo el agente. */
function enlaceOriginal(c: Corrida): { a: string; texto: string } | null {
  if (!c.referencia_id) return null;
  if (c.referencia_tabla === 'interaccion_analisis' && c.organizacion_id)
    return { a: `/portal/crm/llamadas?org=${c.organizacion_id}&analisis=${c.referencia_id}`, texto: 'Abrir el análisis' };
  return null;
}

const DetalleCorrida: React.FC<{ corrida: Corrida; empresa: string; alVolver: (mensaje?: string) => void }> = ({ corrida, empresa, alVolver }) => {
  const [mensajes, setMensajes] = useState<Mensaje[] | null>(null);
  const [archivo, setArchivo] = useState<{ asunto_id: string; nombre: string } | null>(null);
  const [revisando, setRevisando] = useState<'corregida' | 'rechazada' | null>(null);
  const [nota, setNota] = useState('');
  const [caso, setCaso] = useState<Preparado | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase || !corrida.referencia_id) return;
    if (corrida.referencia_tabla === 'tina_conversaciones') {
      // La respuesta de la corrida es la última de Tina hasta ese momento.
      const hasta = new Date(Date.parse(corrida.creado_en) + 5000).toISOString();
      void supabase
        .from('tina_mensajes')
        .select('id, autor, contenido, herramientas, creado_en')
        .eq('conversacion_id', corrida.referencia_id)
        .lte('creado_en', hasta)
        .order('id', { ascending: false })
        .limit(20)
        .then(({ data }) => setMensajes(((data as Mensaje[]) ?? []).reverse()));
    }
    if (corrida.referencia_tabla === 'asunto_archivos') {
      void supabase
        .from('asunto_archivos')
        .select('asunto_id, nombre')
        .eq('id', corrida.referencia_id)
        .maybeSingle()
        .then(({ data }) => setArchivo((data as { asunto_id: string; nombre: string } | null) ?? null));
    }
  }, [corrida]);

  const ultimaDeTina = mensajes ? [...mensajes].reverse().find((m) => m.autor === 'tina')?.id : undefined;
  const enlace =
    enlaceOriginal(corrida) ??
    (archivo ? { a: `/portal/asuntos/${archivo.asunto_id}?pestana=documentos&documento=${corrida.referencia_id}`, texto: `Abrir ${archivo.nombre}` } : null);

  async function revisar(revision: 'aprobada' | 'corregida' | 'rechazada') {
    if (!supabase) return;
    if (revision !== 'aprobada' && nota.trim().length < 3) return setError(revision === 'corregida' ? 'Escribí qué tenía que hacer.' : 'Escribí por qué la rechazás.');
    setOcupado(true);
    setError(null);
    const { error: e } = await supabase.rpc('ia_corrida_revisar', { p_corrida: corrida.id, p_revision: revision, p_nota: revision === 'aprobada' ? null : nota });
    setOcupado(false);
    if (e) return setError(mensajeAmable(e));
    alVolver(revision === 'aprobada' ? 'Aprobada.' : revision === 'corregida' ? 'Corregida. Desde Ver podés crear el caso de prueba.' : 'Rechazada.');
  }

  async function armarCaso() {
    setOcupado(true);
    setError(null);
    const r = await prepararCaso(corrida.id);
    setOcupado(false);
    if ('error' in r && !('entrada' in r)) return setError(r.error);
    setCaso(r as Preparado);
  }

  if (caso) return <NuevoCaso corrida={corrida} preparado={caso} alVolver={alVolver} alCancelar={() => setCaso(null)} />;

  return (
    <div className="space-y-6 max-w-[880px]">
      <button type="button" className="text-sm underline underline-offset-4 hover:text-bosque" onClick={() => alVolver()}>
        Volver a las corridas
      </button>
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="h3">{nombreAgente(corrida.agente)}</h2>
        <Etiqueta tono={REVISION[corrida.revision].tono}>{REVISION[corrida.revision].texto}</Etiqueta>
      </div>
      <dl className="grid grid-cols-2 tab:grid-cols-4 gap-4 text-sm">
        {[
          ['Empresa', empresa],
          ['Fecha', fechaCorta(corrida.creado_en)],
          ['Versión', corrida.version_prompt],
          ['Modelo', corrida.modelo || '·'],
          ['Tokens', `${corrida.tokens_entrada.toLocaleString('es-AR')} + ${corrida.tokens_salida.toLocaleString('es-AR')}`],
          ['Costo', usd(corrida.costo_usd)],
          ['Duración', corrida.duracion_ms ? `${(corrida.duracion_ms / 1000).toFixed(1)} s` : '·'],
        ].map(([k, v]) => (
          <div key={k}>
            <dt className="text-piedra text-xs">{k}</dt>
            <dd className="font-medium break-all">{v}</dd>
          </div>
        ))}
      </dl>
      {corrida.error && <Aviso tipo="error">{corrida.error}</Aviso>}
      {corrida.nota && (
        <Aviso>
          <span className="font-semibold">Nota de FIRMA.</span> {corrida.nota}
        </Aviso>
      )}
      {error && <Aviso tipo="error">{error}</Aviso>}

      {enlace && (
        <Enlace a={enlace.a} className="inline-flex items-center gap-1.5 font-medium underline underline-offset-4 hover:text-bosque">
          {enlace.texto} <ArrowUpRight size={16} />
        </Enlace>
      )}

      {mensajes && (
        <section className="space-y-3">
          <h3 className="font-semibold">Conversación</h3>
          {mensajes.length === 0 && <p className="text-sm text-piedra">La conversación ya no está.</p>}
          <ol className="space-y-3">
            {mensajes.map((m) => (
              <li
                key={m.id}
                className={`rounded-control border px-4 py-3 text-[14.5px] leading-[1.55] whitespace-pre-wrap ${m.id === ultimaDeTina ? 'border-tinta bg-papel' : 'border-borde-suave'} ${m.autor === 'usuario' ? 'ml-8' : 'mr-8'}`}
              >
                <div className="text-xs text-piedra mb-1">
                  {m.autor === 'usuario' ? 'Persona' : 'Tina'} · {fechaCorta(m.creado_en)}
                  {m.id === ultimaDeTina && ' · esta corrida'}
                </div>
                {m.contenido || <span className="text-piedra">Sin texto</span>}
                {m.herramientas?.length ? <div className="text-xs text-piedra mt-2">Usó {m.herramientas.map((h) => h.nombre).join(', ')}</div> : null}
              </li>
            ))}
          </ol>
        </section>
      )}

      {(corrida.revision === 'pendiente' || corrida.revision === 'sin_revision') && (
        <section className="space-y-4 border-t border-separador pt-6">
          {revisando ? (
            <>
              <Campo etiqueta={revisando === 'corregida' ? 'Qué tenía que hacer' : 'Por qué la rechazás'}>
                <textarea rows={4} className={`${claseInput} h-auto py-3`} value={nota} onChange={(e) => setNota(e.target.value)} autoFocus />
              </Campo>
              <div className="flex flex-wrap gap-3">
                <Button disabled={ocupado} onClick={() => void revisar(revisando)}>
                  {revisando === 'corregida' ? 'Guardar corrección' : 'Rechazar'}
                </Button>
                <Button variant="ghost" onClick={() => setRevisando(null)}>
                  Cancelar
                </Button>
              </div>
            </>
          ) : (
            <div className="flex flex-wrap gap-3">
              <Button disabled={ocupado} onClick={() => void revisar('aprobada')}>
                Aprobar sin cambios
              </Button>
              <Button variant="ghost" disabled={ocupado} onClick={() => setRevisando('corregida')}>
                Corregir
              </Button>
              <Button variant="ghost" disabled={ocupado} onClick={() => setRevisando('rechazada')}>
                Rechazar
              </Button>
            </div>
          )}
        </section>
      )}

      {corrida.revision === 'corregida' && (
        <section className="border-t border-separador pt-6">
          <Button disabled={ocupado} onClick={() => void armarCaso()}>
            {ocupado ? 'Armando…' : 'Crear caso de prueba'}
          </Button>
        </section>
      )}
    </div>
  );
};

const VACIO: FormularioEsperado = { camino: '', herramientas: '', sin_herramientas: '', etapa: '', codigos: '', sin_codigos: '', incluye: '', excluye: '', criterios: '' };

const NuevoCaso: React.FC<{ corrida: Corrida; preparado: Preparado; alVolver: (m?: string) => void; alCancelar: () => void }> = ({ corrida, preparado, alVolver, alCancelar }) => {
  const nota = (corrida.nota ?? preparado.nota ?? '').trim();
  const [etiqueta, setEtiqueta] = useState(nota.split('\n')[0].slice(0, 120));
  const [entrada, setEntrada] = useState(JSON.stringify(preparado.entrada, null, 2));
  const [f, setF] = useState<FormularioEsperado>({ ...VACIO, criterios: nota });
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const esTina = corrida.agente === 'tina';
  const esAnalisis = corrida.agente.startsWith('analisis_');
  const campo = (k: keyof FormularioEsperado) => ({ value: f[k], onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value }) });

  async function guardar() {
    if (!supabase) return;
    setError(null);
    let valor: unknown;
    try {
      valor = JSON.parse(entrada);
    } catch {
      return setError('La entrada no es un JSON válido.');
    }
    const problema = problemaDeEntrada(corrida.agente, valor);
    if (problema) return setError(problema);
    const esperado = esperadoDesde(f);
    if (!Object.keys(esperado).length) return setError('Sumá al menos un criterio o un chequeo.');
    if (!etiqueta.trim()) return setError('Ponele un nombre al caso.');
    setOcupado(true);
    const { data: u } = await supabase.auth.getUser();
    const { error: e } = await supabase.from('ia_casos').insert({
      agente: corrida.agente,
      etiqueta: etiqueta.trim(),
      origen: 'correccion',
      corrida_id: corrida.id,
      entrada: valor,
      esperado,
      creado_por: u.user?.id ?? null,
    });
    setOcupado(false);
    if (e) return setError(mensajeAmable(e));
    alVolver('Caso de prueba creado. Bajalo desde Casos de prueba para el evaluador.');
  }

  return (
    <div className="space-y-6 max-w-[880px]">
      <h2 className="h3">Caso de prueba · {nombreAgente(corrida.agente)}</h2>
      {preparado.aviso && <Aviso>{preparado.aviso}</Aviso>}
      {error && <Aviso tipo="error">{error}</Aviso>}
      <Campo etiqueta="Nombre">
        <input className={claseInput} value={etiqueta} onChange={(e) => setEtiqueta(e.target.value)} maxLength={120} />
      </Campo>
      <Campo etiqueta="Entrada" ayuda="Ya va anonimizada. Revisá que no quede ningún dato real.">
        <textarea rows={14} spellCheck={false} className={`${claseInput} h-auto py-3 font-mono text-[12.5px]`} value={entrada} onChange={(e) => setEntrada(e.target.value)} />
      </Campo>
      <details className="text-sm">
        <summary className="cursor-pointer font-medium">Lo que respondió</summary>
        <pre className="mt-2 p-3 bg-papel border border-borde-suave rounded-control overflow-x-auto text-[12px] whitespace-pre-wrap">{JSON.stringify(preparado.salida, null, 2)}</pre>
      </details>
      <Campo etiqueta="Criterios" ayuda="Uno por renglón. Con (2) al final pesa doble.">
        <textarea rows={4} className={`${claseInput} h-auto py-3`} {...campo('criterios')} />
      </Campo>
      {esTina && (
        <div className="grid gap-5 tab:grid-cols-3">
          <Campo etiqueta="Camino">
            <select className={claseInput} {...campo('camino')}>
              <option value="">Cualquiera</option>
              {CAMINOS.map((c) => (
                <option key={c} value={c}>
                  {c === 'derivacion' ? 'Derivación' : c === 'recurso' ? 'Recurso' : 'Accionable'}
                </option>
              ))}
            </select>
          </Campo>
          <Campo etiqueta="Tiene que usar">
            <input className={claseInput} placeholder="crear_ticket" {...campo('herramientas')} />
          </Campo>
          <Campo etiqueta="No puede usar">
            <input className={claseInput} placeholder="crear_ficha_cierre" {...campo('sin_herramientas')} />
          </Campo>
        </div>
      )}
      {esAnalisis && (
        <div className="grid gap-5 tab:grid-cols-3">
          <Campo etiqueta="Etapa">
            <select className={claseInput} {...campo('etapa')}>
              <option value="">Cualquiera</option>
              {ETAPAS.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </select>
          </Campo>
          <Campo etiqueta="Códigos que tienen que salir">
            <input className={claseInput} placeholder="A1, B1" {...campo('codigos')} />
          </Campo>
          <Campo etiqueta="Códigos que no">
            <input className={claseInput} placeholder="C1" {...campo('sin_codigos')} />
          </Campo>
        </div>
      )}
      {!esAnalisis && (
        <div className="grid gap-5 tab:grid-cols-2">
          <Campo etiqueta="Tiene que decir" ayuda="Uno por renglón.">
            <textarea rows={2} className={`${claseInput} h-auto py-3`} {...campo('incluye')} />
          </Campo>
          <Campo etiqueta="No puede decir" ayuda="Uno por renglón.">
            <textarea rows={2} className={`${claseInput} h-auto py-3`} {...campo('excluye')} />
          </Campo>
        </div>
      )}
      <div className="flex flex-wrap gap-3">
        <Button disabled={ocupado} onClick={() => void guardar()}>
          {ocupado ? 'Guardando…' : 'Guardar caso'}
        </Button>
        <Button variant="ghost" onClick={alCancelar}>
          Cancelar
        </Button>
      </div>
    </div>
  );
};

const Casos: React.FC<{ casos: CasoIa[]; todos: CasoIa[]; alCambiar: () => void; alError: (m: string | null) => void }> = ({ casos, todos, alCambiar, alError }) => {
  const agentes = [...new Set(todos.filter((c) => c.activo).map((c) => c.agente))];

  async function alternar(c: CasoIa) {
    if (!supabase) return;
    const { error: e } = await supabase.from('ia_casos').update({ activo: !c.activo }).eq('id', c.id);
    if (e) alError(mensajeAmable(e));
    alCambiar();
  }

  return (
    <div className="space-y-4">
      {agentes.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          {agentes.map((a) => (
            <Button key={a} variant="ghost" size="sm" onClick={() => descargar(`${a}.json`, archivoParaEvaluador(a, todos))}>
              <Download size={15} /> {nombreAgente(a)}
            </Button>
          ))}
          <span className="text-xs text-piedra">Va a scripts/ia/casos/ para que lo use el evaluador.</span>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="tabla min-w-[720px]">
          <thead>
            <tr>
              <th>Caso</th>
              <th>Agente</th>
              <th>Origen</th>
              <th>Creado</th>
              <th>Estado</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {casos.length === 0 && (
              <tr>
                <td colSpan={6} className="text-piedra">
                  Todavía no hay casos. Salen de las corridas corregidas.
                </td>
              </tr>
            )}
            {casos.map((c) => (
              <tr key={c.id}>
                <td>
                  <div className="font-medium">{c.etiqueta}</div>
                  {c.esperado?.rubrica?.length ? <div className="text-xs text-piedra">{c.esperado.rubrica.length} criterios</div> : null}
                </td>
                <td>{nombreAgente(c.agente)}</td>
                <td>{c.origen === 'correccion' ? 'Corrección' : c.origen === 'manipulacion' ? 'Manipulación' : 'Manual'}</td>
                <td className="whitespace-nowrap">{fechaCorta(c.creado_en)}</td>
                <td>{c.activo ? <Etiqueta tono="bosque">Activo</Etiqueta> : <Etiqueta>Pausado</Etiqueta>}</td>
                <td className="text-right">
                  <button type="button" className="underline underline-offset-4 hover:text-bosque" onClick={() => void alternar(c)}>
                    {c.activo ? 'Pausar' : 'Activar'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

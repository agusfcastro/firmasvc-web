// Herramientas interactivas del motor. Todas trabajan en el navegador,
// no guardan datos y se reinician con un botón.

import { useId, useMemo, useState, type ReactNode } from 'react';
import s from '../../sop-llamadas-venta/sop.module.css';
import m from './motor.module.css';
import { formatearMonto, monedaDe } from './ficha';
import { BotonCopiar, Tx, usePlano } from './piezas';
import type {
  BarraCalculo,
  CriterioRubrica,
  EntradaCalculo,
  Ficha,
  FormatoCalculo,
  Nivel,
  NivelEvaluacion,
  OpcionCampo,
  OpcionPlazo,
  PreguntaSemaforo,
  ResultadoSemaforo,
  SalidaCalculo,
} from './tipos';

// Utilidades

/** Interpreta números escritos a mano. Acepta 3000, 3.000, 3000,5 y 12.5. */
export function leerNumero(texto: string): number | null {
  const limpio = texto.replace(/\s/g, '').replace(/[^\d.,-]/g, '');
  if (!limpio || limpio === '-' || limpio === ',' || limpio === '.') return null;
  let normal = limpio;
  if (limpio.includes(',')) {
    normal = limpio.replace(/\./g, '').replace(',', '.');
  } else if (/^-?\d{1,3}(\.\d{3})+$/.test(limpio)) {
    normal = limpio.replace(/\./g, '');
  }
  const n = Number(normal);
  return Number.isFinite(n) ? n : null;
}

function formatear(n: number | null, formato: FormatoCalculo, f: Ficha): string {
  if (n === null || !Number.isFinite(n)) return 'Sin datos';
  const decimales = (x: number, max = 1) => x.toLocaleString('es-AR', { maximumFractionDigits: max });
  switch (formato) {
    case 'pct':
      return `${decimales(n)}%`;
    case 'monto':
      return formatearMonto(monedaDe(f), n) ?? 'Sin datos';
    case 'dias':
      return `${decimales(n, 0)} ${Math.round(n) === 1 ? 'día' : 'días'}`;
    case 'veces':
      return `${decimales(n)} veces`;
    case 'puntos':
      return `${decimales(n, 0)} puntos`;
    default:
      return decimales(n);
  }
}

function unidadVisible(u: EntradaCalculo['unidad'], f: Ficha): string | null {
  if (!u) return null;
  if (u === 'moneda') return monedaDe(f);
  return u;
}

function Encabezado({ titulo, intro, onReiniciar, extra }: { titulo: string; intro?: string; onReiniciar?: () => void; extra?: ReactNode }) {
  return (
    <>
      <div className={m.herramientaCabecera}>
        <h3 className={m.herramientaTitulo}>{titulo}</h3>
        <div className={`${s.repasoAcciones} ${s.noImprimir}`}>
          {extra}
          {onReiniciar && (
            <button type="button" className={s.boton} onClick={onReiniciar}>
              Reiniciar
            </button>
          )}
        </div>
      </div>
      {intro && (
        <p className={m.herramientaIntro}>
          <Tx t={intro} />
        </p>
      )}
    </>
  );
}

function Segmentado({ nombre, valor, opciones, onChange }: { nombre: string; valor: string; opciones: OpcionCampo[]; onChange: (v: string) => void }) {
  const grupo = useId();
  const plano = usePlano();
  return (
    <div className={s.segmentado} role="radiogroup" aria-label={nombre}>
      {opciones.map((o) => (
        <label key={o.valor} className={s.segmento} data-activo={valor === o.valor}>
          <input type="radio" name={grupo} value={o.valor} checked={valor === o.valor} onChange={() => onChange(o.valor)} />
          <span>{plano(o.rotulo)}</span>
        </label>
      ))}
    </div>
  );
}

function CajaResultado({ nivel, titulo, children }: { nivel: Nivel | 'pendiente'; titulo: string; children?: ReactNode }) {
  return (
    <div className={m.resultado} data-nivel={nivel} aria-live="polite">
      <p className={m.resultadoTitulo}>
        <Tx t={titulo} />
      </p>
      {children}
    </div>
  );
}

// Semáforo de decisión

export function Semaforo({ titulo, preguntas, evaluar, ficha }: { titulo: string; preguntas: PreguntaSemaforo[]; evaluar: (r: Record<string, string>, f: Ficha) => ResultadoSemaforo | null; ficha: Ficha }) {
  const [respuestas, setRespuestas] = useState<Record<string, string>>({});
  const resultado = useMemo(() => evaluar(respuestas, ficha), [evaluar, respuestas, ficha]);
  const plano = usePlano();
  const copiar = () => (resultado ? [plano(resultado.titulo), ...resultado.pasos.map((p, i) => `${i + 1}. ${plano(p)}`)].join('\n') : '');
  return (
    <div className={m.herramienta}>
      <Encabezado
        titulo={titulo}
        onReiniciar={() => setRespuestas({})}
        extra={resultado ? <BotonCopiar texto={copiar} etiqueta="Copiar resultado" variante="texto" /> : undefined}
      />
      <div className={m.preguntas}>
        {preguntas.map((p) => (
          <div key={p.id} className={m.pregunta}>
            <p className={m.preguntaTexto}>
              <Tx t={p.texto} />
            </p>
            {p.ayuda && (
              <p className={m.preguntaAyuda}>
                <Tx t={p.ayuda} />
              </p>
            )}
            <Segmentado nombre={plano(p.texto)} valor={respuestas[p.id] ?? ''} opciones={p.opciones} onChange={(v) => setRespuestas((r) => ({ ...r, [p.id]: v }))} />
          </div>
        ))}
      </div>
      {resultado ? (
        <CajaResultado nivel={resultado.nivel} titulo={resultado.titulo}>
          {resultado.pasos.length > 0 && (
            <ol className={m.resultadoPasos}>
              {resultado.pasos.map((p) => (
                <li key={p}>
                  <Tx t={p} />
                </li>
              ))}
            </ol>
          )}
        </CajaResultado>
      ) : (
        <CajaResultado nivel="pendiente" titulo="Respondé todas las preguntas para ver la vía que corresponde." />
      )}
    </div>
  );
}

// Calculadora genérica

export function Calculadora({
  titulo,
  intro,
  entradas,
  salidas,
  barra,
  conclusion,
  nota,
  ficha,
}: {
  titulo: string;
  intro?: string;
  entradas: EntradaCalculo[];
  salidas: SalidaCalculo[];
  barra?: (v: Record<string, number | null>, r: Record<string, number | null>, f: Ficha) => BarraCalculo | null;
  conclusion?: (v: Record<string, number | null>, r: Record<string, number | null>, f: Ficha) => { nivel: Nivel; texto: string } | null;
  nota?: string;
  ficha: Ficha;
}) {
  const iniciales = () => Object.fromEntries(entradas.map((e) => [e.id, e.inicial ?? '']));
  const [textos, setTextos] = useState<Record<string, string>>(iniciales);
  const base = useId();
  const valores = useMemo(() => Object.fromEntries(entradas.map((e) => [e.id, leerNumero(textos[e.id] ?? '')])) as Record<string, number | null>, [entradas, textos]);
  const resultados = useMemo(() => {
    const r: Record<string, number | null> = {};
    salidas.forEach((sa) => {
      try {
        const n = sa.calcular(valores, ficha);
        r[sa.id] = n === null || !Number.isFinite(n) ? null : n;
      } catch {
        r[sa.id] = null;
      }
    });
    return r;
  }, [salidas, valores, ficha]);
  const datosBarra = barra ? barra(valores, resultados, ficha) : null;
  const cierre = conclusion ? conclusion(valores, resultados, ficha) : null;
  const plano = usePlano();
  const copiar = () =>
    [
      titulo,
      ...entradas.map((e) => `${e.rotulo} ${textos[e.id] || 'sin dato'}${unidadVisible(e.unidad, ficha) ? ` ${unidadVisible(e.unidad, ficha)}` : ''}`),
      '',
      ...salidas.map((sa) => `${sa.rotulo} ${formatear(resultados[sa.id], sa.formato, ficha)}`),
      ...(cierre ? ['', plano(cierre.texto)] : []),
    ].join('\n');

  return (
    <div className={m.herramienta}>
      <Encabezado titulo={titulo} intro={intro} onReiniciar={() => setTextos(iniciales())} extra={<BotonCopiar texto={copiar} etiqueta="Copiar cálculo" variante="texto" />} />
      <div className={m.entradas}>
        {entradas.map((e) => {
          const unidad = unidadVisible(e.unidad, ficha);
          return (
            <label key={e.id} className={m.entrada} htmlFor={`${base}-${e.id}`}>
              <span className={m.entradaRotulo}>{e.rotulo}</span>
              <span className={m.entradaCaja}>
                <input
                  id={`${base}-${e.id}`}
                  type="text"
                  inputMode="decimal"
                  value={textos[e.id] ?? ''}
                  onChange={(ev) => setTextos((t) => ({ ...t, [e.id]: ev.target.value }))}
                  placeholder="0"
                />
                {unidad && <span className={m.entradaUnidad}>{unidad}</span>}
              </span>
              {e.ayuda && <span className={m.entradaAyuda}>{e.ayuda}</span>}
            </label>
          );
        })}
      </div>
      <div className={m.salidas} aria-live="polite">
        {salidas.map((sa) => {
          const n = resultados[sa.id];
          const ok = sa.meta && n !== null ? (sa.meta.sentido === 'max' ? n <= sa.meta.valor : n >= sa.meta.valor) : null;
          return (
            <div key={sa.id} className={m.salida} data-destacada={sa.destacada ? 'true' : 'false'}>
              <span className={m.salidaRotulo}>{sa.rotulo}</span>
              <span className={m.salidaValor}>{formatear(n, sa.formato, ficha)}</span>
              {sa.meta && (
                <span className={m.salidaMeta} data-ok={ok === null ? undefined : String(ok)}>
                  Meta orientativa {sa.meta.sentido === 'max' ? 'hasta' : 'desde'} {formatear(sa.meta.valor, sa.formato, ficha)}
                </span>
              )}
              {sa.ayuda && <span className={m.salidaAyuda}>{sa.ayuda}</span>}
            </div>
          );
        })}
      </div>
      {datosBarra && <Barra datos={datosBarra} ficha={ficha} />}
      {cierre && (
        <div className={m.resultado} data-nivel={cierre.nivel} aria-live="polite">
          <p className={m.resultadoTexto}>
            <Tx t={cierre.texto} />
          </p>
        </div>
      )}
      {nota && (
        <p className={m.herramientaNota}>
          <Tx t={nota} />
        </p>
      )}
    </div>
  );
}

function Barra({ datos, ficha }: { datos: BarraCalculo; ficha: Ficha }) {
  const rango = datos.max - datos.min || 1;
  const pos = (v: number) => `${Math.min(100, Math.max(0, ((v - datos.min) / rango) * 100))}%`;
  const moneda = (v: number) => formatearMonto(monedaDe(ficha), v) ?? String(v);
  return (
    <div className={m.barra}>
      <div className={m.barraPista} aria-hidden="true">
        {datos.zona && <span className={m.barraZona} style={{ left: pos(datos.zona[0]), width: `calc(${pos(datos.zona[1])} - ${pos(datos.zona[0])})` }} />}
        {datos.marcas.map((mk, i) => (
          <span key={mk.rotulo} className={m.barraMarca} style={{ left: pos(mk.valor) }}>
            {i + 1}
          </span>
        ))}
      </div>
      <ul className={m.barraLeyenda}>
        {datos.marcas.map((mk, i) => (
          <li key={mk.rotulo}>
            <span className={m.barraLeyendaNumero}>{i + 1}</span>
            <span>
              {mk.rotulo} {moneda(mk.valor)}
            </span>
          </li>
        ))}
        {datos.zona && (
          <li>
            <span className={m.barraLeyendaZona} />
            <span>
              {datos.zonaRotulo ?? 'Zona de posible acuerdo'} entre {moneda(datos.zona[0])} y {moneda(datos.zona[1])}
            </span>
          </li>
        )}
      </ul>
    </div>
  );
}

// Rúbrica de puntajes de 1 a 4 con pesos

export function Rubrica({ titulo, intro, criterios, niveles }: { titulo: string; intro?: string; criterios: CriterioRubrica[]; niveles: NivelEvaluacion[] }) {
  const [puntajes, setPuntajes] = useState<Record<string, number>>({});
  const base = useId();
  const evaluados = criterios.filter((c) => puntajes[c.id]);
  const pesoTotal = evaluados.reduce((a, c) => a + c.peso, 0);
  const promedio = pesoTotal ? evaluados.reduce((a, c) => a + c.peso * puntajes[c.id], 0) / pesoTotal : null;
  const completo = evaluados.length === criterios.length;
  const nivel = completo && promedio !== null ? [...niveles].sort((a, b) => b.desde - a.desde).find((n) => promedio >= n.desde) ?? null : null;
  const copiar = () =>
    [
      titulo,
      ...criterios.map((c) => `${c.nombre} ${puntajes[c.id] ? `${puntajes[c.id]} de 4` : 'sin puntaje'}`),
      promedio !== null ? `Puntaje ponderado ${promedio.toLocaleString('es-AR', { maximumFractionDigits: 2 })} de 4` : '',
      nivel ? `${nivel.titulo}. ${nivel.texto}` : '',
    ]
      .filter(Boolean)
      .join('\n');

  return (
    <div className={m.herramienta}>
      <Encabezado titulo={titulo} intro={intro} onReiniciar={() => setPuntajes({})} extra={<BotonCopiar texto={copiar} etiqueta="Copiar evaluación" variante="texto" />} />
      <div className={m.rubrica} role="table" aria-label={titulo}>
        <div className={`${m.rubricaFila} ${m.rubricaCabecera}`} role="row">
          <span role="columnheader">Criterio</span>
          <span role="columnheader">1 · Insuficiente</span>
          <span role="columnheader">2 · Parcial</span>
          <span role="columnheader">3 · Sólido</span>
          <span role="columnheader">4 · Sobresaliente</span>
        </div>
        {criterios.map((c) => (
          <div key={c.id} className={m.rubricaFila} role="radiogroup" aria-label={c.nombre}>
            <div className={m.rubricaCriterio}>
              <span className={m.rubricaNombre}>{c.nombre}</span>
              <span className={m.rubricaPeso}>Peso {c.peso}</span>
            </div>
            {c.anclas.map((ancla, i) => (
              <label key={i} className={m.rubricaOpcion} data-activo={puntajes[c.id] === i + 1}>
                <input type="radio" name={`${base}-${c.id}`} checked={puntajes[c.id] === i + 1} onChange={() => setPuntajes((p) => ({ ...p, [c.id]: i + 1 }))} />
                <span className={m.rubricaPuntaje}>{i + 1}</span>
                <span>{ancla}</span>
              </label>
            ))}
          </div>
        ))}
      </div>
      {nivel && promedio !== null ? (
        <CajaResultado nivel={nivel.nivel} titulo={`${nivel.titulo} · ${promedio.toLocaleString('es-AR', { maximumFractionDigits: 2 })} de 4`}>
          <p className={m.resultadoTexto}>
            <Tx t={nivel.texto} />
          </p>
        </CajaResultado>
      ) : (
        <CajaResultado
          nivel="pendiente"
          titulo={`Faltan ${criterios.length - evaluados.length} de ${criterios.length} criterios por puntuar.${promedio !== null ? ` Parcial ${promedio.toLocaleString('es-AR', { maximumFractionDigits: 2 })} de 4.` : ''}`}
        />
      )}
    </div>
  );
}

// Evaluación por señales con peso

export function Evaluacion({ titulo, intro, items, niveles }: { titulo: string; intro?: string; items: { id: string; texto: string; peso: number }[]; niveles: NivelEvaluacion[] }) {
  const [marcados, setMarcados] = useState<Record<string, boolean>>({});
  // Hasta que no se marque nada, el resultado queda pendiente. Cero señales marcadas a propósito sí es un resultado.
  const [tocado, setTocado] = useState(false);
  const total = items.reduce((a, it) => a + (marcados[it.id] ? it.peso : 0), 0);
  const nivel = [...niveles].sort((a, b) => b.desde - a.desde).find((n) => total >= n.desde) ?? null;
  const plano = usePlano();
  const copiar = () =>
    [titulo, ...items.filter((it) => marcados[it.id]).map((it) => `Sí · ${plano(it.texto)}`), `Puntaje ${total}`, nivel ? `${nivel.titulo}. ${plano(nivel.texto)}` : ''].filter(Boolean).join('\n');
  return (
    <div className={m.herramienta}>
      <Encabezado
        titulo={titulo}
        intro={intro}
        onReiniciar={() => {
          setMarcados({});
          setTocado(false);
        }}
        extra={<BotonCopiar texto={copiar} etiqueta="Copiar evaluación" variante="texto" />}
      />
      <ul className={s.controlLista}>
        {items.map((it) => (
          <li key={it.id}>
            <label className={s.controlItem}>
              <input
                type="checkbox"
                checked={!!marcados[it.id]}
                onChange={(e) => {
                  setTocado(true);
                  setMarcados((mm) => ({ ...mm, [it.id]: e.target.checked }));
                }}
              />
              <span className={s.repasoCaja} aria-hidden="true" />
              <span>
                <Tx t={it.texto} />
              </span>
            </label>
          </li>
        ))}
      </ul>
      {tocado && nivel ? (
        <CajaResultado nivel={nivel.nivel} titulo={`${nivel.titulo} · ${total} ${total === 1 ? 'punto' : 'puntos'}`}>
          <p className={m.resultadoTexto}>
            <Tx t={nivel.texto} />
          </p>
        </CajaResultado>
      ) : (
        <CajaResultado nivel="pendiente" titulo="Marcá las señales que se cumplen para ver el resultado." />
      )}
    </div>
  );
}

// Lista de control con ítems críticos y estándar

export function Checklist({ titulo, items, textoConforme, textoNoConforme }: { titulo: string; items: { id: string; texto: string; critico: boolean }[]; textoConforme?: string; textoNoConforme?: string }) {
  const [marcados, setMarcados] = useState<Record<string, boolean>>({});
  const criticos = items.filter((it) => it.critico);
  const estandar = items.filter((it) => !it.critico);
  const algunoMarcado = Object.values(marcados).some(Boolean);
  const criticosOk = criticos.every((it) => marcados[it.id]);
  const estandarOk = estandar.filter((it) => marcados[it.id]).length;
  const pct = estandar.length ? Math.round((estandarOk / estandar.length) * 100) : 100;
  const estado = !algunoMarcado ? 'vacio' : criticosOk ? 'conforme' : 'no';

  const lista = (grupo: typeof items) => (
    <ul className={s.controlLista}>
      {grupo.map((it) => (
        <li key={it.id}>
          <label className={s.controlItem}>
            <input type="checkbox" checked={!!marcados[it.id]} onChange={(e) => setMarcados((mm) => ({ ...mm, [it.id]: e.target.checked }))} />
            <span className={s.repasoCaja} aria-hidden="true" />
            <span>
              <Tx t={it.texto} />
            </span>
          </label>
        </li>
      ))}
    </ul>
  );

  return (
    <div className={`${s.tarjeta} ${s.control}`}>
      <div className={s.controlCabecera}>
        <h3 className={s.h3}>{titulo}</h3>
        <div className={s.controlResultado} data-estado={estado} aria-live="polite">
          {estado === 'vacio' && 'Marcá lo que está cumplido'}
          {estado === 'conforme' && `${textoConforme ?? 'Conforme'} · estándar ${estandarOk} de ${estandar.length} (${pct}%)`}
          {estado === 'no' && (textoNoConforme ?? 'No conforme · falta al menos un ítem crítico')}
        </div>
      </div>
      <div className={criticos.length && estandar.length ? s.dosColumnas : undefined}>
        {criticos.length > 0 && (
          <div>
            <p className={s.controlGrupo}>Críticos</p>
            {lista(criticos)}
          </div>
        )}
        {estandar.length > 0 && (
          <div>
            <p className={s.controlGrupo}>Estándar</p>
            {lista(estandar)}
          </div>
        )}
      </div>
      <div className={s.noImprimir}>
        <button type="button" className={s.boton} onClick={() => setMarcados({})}>
          Reiniciar
        </button>
      </div>
    </div>
  );
}

// Calculadora de plazos

const FORMATO_FECHA: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };

function hoyISO(): string {
  const d = new Date();
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mes}-${dia}`;
}

export function calcularVencimiento(inicio: Date, op: OpcionPlazo): Date {
  const d = new Date(inicio.getTime());
  if (op.unidad === 'horas') {
    d.setHours(d.getHours() + op.cantidad);
    return d;
  }
  if (op.unidad === 'corridos') {
    d.setDate(d.getDate() + op.cantidad);
    return d;
  }
  if (op.unidad === 'meses') {
    const dia = d.getDate();
    d.setDate(1);
    d.setMonth(d.getMonth() + op.cantidad);
    const ultimo = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(dia, ultimo));
    return d;
  }
  let restantes = op.cantidad;
  while (restantes > 0) {
    d.setDate(d.getDate() + 1);
    const dia = d.getDay();
    if (dia !== 0 && dia !== 6) restantes -= 1;
  }
  return d;
}

export function Plazos({ titulo, intro, opciones }: { titulo: string; intro?: string; opciones: OpcionPlazo[] }) {
  const [fecha, setFecha] = useState(hoyISO);
  const [elegida, setElegida] = useState(opciones[0]?.id ?? '');
  const base = useId();
  const op = opciones.find((o) => o.id === elegida) ?? opciones[0];
  const inicio = fecha ? new Date(`${fecha}T12:00:00`) : null;
  const vence = inicio && op && !Number.isNaN(inicio.getTime()) ? calcularVencimiento(inicio, op) : null;
  const texto = vence
    ? op.unidad === 'horas'
      ? op.cantidad % 24 === 0
        ? `Vence el ${vence.toLocaleDateString('es-AR', FORMATO_FECHA)}, a la misma hora en que se recibió.`
        : `Vence ${op.cantidad} horas después de la recepción. Contá desde la hora exacta en que llegó.`
      : `Vence el ${vence.toLocaleDateString('es-AR', FORMATO_FECHA)}.`
    : 'Elegí una fecha válida.';
  return (
    <div className={m.herramienta}>
      <Encabezado titulo={titulo} intro={intro} />
      <div className={m.plazos}>
        <label className={m.entrada} htmlFor={`${base}-fecha`}>
          <span className={m.entradaRotulo}>Fecha de inicio del plazo</span>
          <span className={m.entradaCaja}>
            <input id={`${base}-fecha`} type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </span>
        </label>
        <label className={m.entrada} htmlFor={`${base}-tipo`}>
          <span className={m.entradaRotulo}>Qué plazo</span>
          <span className={m.entradaCaja}>
            <select id={`${base}-tipo`} value={elegida} onChange={(e) => setElegida(e.target.value)}>
              {opciones.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.rotulo}
                </option>
              ))}
            </select>
          </span>
        </label>
      </div>
      <CajaResultado nivel="info" titulo={texto}>
        {op?.nota && (
          <p className={m.resultadoTexto}>
            <Tx t={op.nota} />
          </p>
        )}
      </CajaResultado>
      <p className={m.herramientaNota}>Los días hábiles se cuentan de lunes a viernes y no descuentan feriados. Revisá el calendario del lugar antes de fijar una fecha.</p>
    </div>
  );
}

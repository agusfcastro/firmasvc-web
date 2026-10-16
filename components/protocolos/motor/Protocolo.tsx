/**
 * Motor de protocolos FIRMA. Recibe la definición de un protocolo y arma la página
 * completa, con ficha configurable, índice, herramientas, impresión y tarjeta de bolsillo.
 * Usa los estilos del protocolo de llamadas, así que se ajusta con las mismas variables --sop-*.
 */
import { useCallback, useEffect, useId, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react';
import s from '../../sop-llamadas-venta/sop.module.css';
import m from './motor.module.css';
import { enlaceConfigurado, guardarLocal, leerFichaInicial, limpiarHash } from './ficha';
import { Calculadora, Checklist, Evaluacion, Plazos, Rubrica, Semaforo } from './herramientas';
import { Acordeon, BotonCopiar, IconoAlerta, IconoEnlace, IconoImprimir, TextoCtx, Tx, usePlano, type ContextoTexto } from './piezas';
import type { Bloque, BloqueGuion, CampoFicha, DefFicha, DefProtocolo, Ficha, Guion, ItemBolsillo, Seccion as DefSeccion } from './tipos';

export interface ProtocoloProps {
  def: DefProtocolo;
  theme?: 'light' | 'dark' | 'auto';
  marca?: string;
  fichaInicial?: Partial<Ficha>;
  ocultarFicha?: boolean;
  className?: string;
  style?: CSSProperties;
}

export default function Protocolo({ def, theme = 'light', marca = 'FIRMA', fichaInicial, ocultarFicha = false, className, style }: ProtocoloProps) {
  const [ficha, setFicha] = useState<Ficha>(() => leerFichaInicial(def.ficha, def.claveLocal, fichaInicial));
  const [guardado, setGuardado] = useState<boolean | null>(null);
  const raizRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setGuardado(guardarLocal(def.claveLocal, ficha));
  }, [def.claveLocal, ficha]);

  useEffect(() => {
    limpiarHash();
  }, []);

  const ctx: ContextoTexto = useMemo(
    () => ({ valores: def.ficha.valores(ficha), macros: def.ficha.macros ? def.ficha.macros(ficha) : {}, rotulos: def.ficha.rotulos }),
    [def, ficha],
  );
  const todas = useMemo(() => def.secciones(ficha), [def, ficha]);
  const secciones = useMemo(() => (ocultarFicha ? todas.filter((x) => !x.bloques.some((b) => b.tipo === 'ficha')) : todas), [todas, ocultarFicha]);
  const prefijo = useId().replace(/[^a-zA-Z0-9]/g, '');
  const idDe = (id: string) => `pr-${prefijo}-${id}`;
  const activa = useSeccionActiva(secciones.map((x) => idDe(x.id)));
  const seccionFicha = secciones.find((x) => x.bloques.some((b) => b.tipo === 'ficha'));
  const hayTarjeta = secciones.some((x) => x.tarjeta);

  const irA = (id: string) => (e: MouseEvent) => {
    e.preventDefault();
    document.getElementById(idDe(id))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const actualizar = useCallback((clave: string, valor: string | boolean) => setFicha((f) => ({ ...f, [clave]: valor })), []);
  const tituloImpresion = `${def.meta.titulo} · ${marca}`;

  return (
    <TextoCtx.Provider value={ctx}>
      <div ref={raizRef} className={`${s.raiz} ${className ?? ''}`} style={style} data-theme={theme} lang="es">
        <header className={s.hero}>
          <div className={s.heroInterior}>
            <p className={s.kicker}>
              {def.meta.kicker} {marca}
            </p>
            <h1 className={s.titulo}>{def.meta.titulo}</h1>
            <p className={s.bajada}>{def.meta.bajada}</p>
            <p className={s.meta}>
              {def.meta.version}
              {ctx.valores.empresa ? (
                <>
                  {' · '}Configurado para <Tx t="{empresa}" />
                </>
              ) : null}
            </p>
            <div className={`${s.acciones} ${s.noImprimir}`}>
              {seccionFicha && (
                <a href={`#${idDe(seccionFicha.id)}`} onClick={irA(seccionFicha.id)} className={`${s.boton} ${s.botonPrimario}`}>
                  Configurar la ficha
                </a>
              )}
              <button type="button" className={s.boton} onClick={() => imprimirEnVentana(raizRef.current, 'todo', tituloImpresion)}>
                <IconoImprimir />
                <span>Imprimir o guardar en PDF</span>
              </button>
              {hayTarjeta && (
                <button type="button" className={s.boton} onClick={() => imprimirEnVentana(raizRef.current, 'tarjeta', `Tarjeta de bolsillo · ${marca}`)}>
                  <IconoImprimir />
                  <span>Tarjeta de bolsillo</span>
                </button>
              )}
            </div>
            <div className={s.ideas}>
              {def.ideas.map((idea) => (
                <div key={idea.titulo} className={s.idea}>
                  <p className={s.ideaTitulo}>{idea.titulo}</p>
                  <p className={s.ideaTexto}>{idea.texto}</p>
                </div>
              ))}
            </div>
          </div>
        </header>

        <div className={s.cuerpo}>
          <nav className={`${s.indice} ${s.noImprimir}`} aria-label="Índice del protocolo">
            <p className={s.indiceTitulo}>Contenido</p>
            <ol className={s.indiceLista}>
              {secciones.map((x, i) => (
                <li key={x.id}>
                  <a href={`#${idDe(x.id)}`} onClick={irA(x.id)} aria-current={activa === idDe(x.id) ? 'true' : undefined}>
                    <span className={s.indiceNumero}>{String(i + 1).padStart(2, '0')}</span>
                    {x.corto}
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          <main className={s.contenido}>
            {secciones.map((sec, i) => (
              <Seccion key={sec.id} id={idDe(sec.id)} sec={sec} numero={String(i + 1).padStart(2, '0')}>
                {sec.bloques.map((b, j) => (
                  <div key={`${sec.id}-${j}`} className={m.bloque} data-bloque={b.tipo}>
                    <RenderBloque
                      b={b}
                      ficha={ficha}
                      defFicha={def.ficha}
                      actualizar={actualizar}
                      guardado={guardado}
                      onEjemplo={() => setFicha({ ...def.ficha.ejemplo })}
                      onLimpiar={() => setFicha({ ...def.ficha.vacia, ...(fichaInicial ?? {}) } as Ficha)}
                    />
                  </div>
                ))}
                {sec.tarjeta && (
                  <div className={`${s.acciones} ${s.noImprimir}`}>
                    <button type="button" className={s.boton} onClick={() => imprimirEnVentana(raizRef.current, 'tarjeta', `Tarjeta de bolsillo · ${marca}`)}>
                      <IconoImprimir />
                      <span>Imprimir tarjeta</span>
                    </button>
                  </div>
                )}
              </Seccion>
            ))}

            <footer className={s.pie}>
              <p>{def.pie.replace('FIRMA', marca)}</p>
              <p className={s.pieMeta}>{def.meta.version}</p>
            </footer>
          </main>
        </div>
      </div>
    </TextoCtx.Provider>
  );
}

// Secciones

function Seccion({ id, sec, numero, children }: { id: string; sec: DefSeccion; numero: string; children: ReactNode }) {
  return (
    <section id={id} className={`${s.seccion} ${sec.tarjeta ? s.seccionTarjeta : ''}`} data-seccion={sec.id} aria-labelledby={`${id}-t`}>
      <p className={s.seccionNumero}>{numero}</p>
      <h2 id={`${id}-t`} className={s.seccionTitulo}>
        {sec.titulo}
      </h2>
      {sec.intro && (
        <p className={s.seccionIntro}>
          <Tx t={sec.intro} />
        </p>
      )}
      {children}
    </section>
  );
}

function useSeccionActiva(ids: string[]) {
  const [activa, setActiva] = useState(ids[0]);
  const clave = ids.join('|');
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const lista = clave.split('|');
    let cuadro = 0;
    const medir = () => {
      cuadro = 0;
      const umbral = window.innerHeight * 0.3;
      let actual = lista[0];
      for (const id of lista) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= umbral) actual = id;
      }
      setActiva(actual);
    };
    const alDesplazar = () => {
      if (!cuadro) cuadro = window.requestAnimationFrame(medir);
    };
    medir();
    window.addEventListener('scroll', alDesplazar, { passive: true });
    window.addEventListener('resize', alDesplazar);
    return () => {
      window.removeEventListener('scroll', alDesplazar);
      window.removeEventListener('resize', alDesplazar);
      if (cuadro) window.cancelAnimationFrame(cuadro);
    };
  }, [clave]);
  return activa;
}

// Bloques

function RenderBloque({
  b,
  ficha,
  defFicha,
  actualizar,
  guardado,
  onEjemplo,
  onLimpiar,
}: {
  b: Bloque;
  ficha: Ficha;
  defFicha: DefFicha;
  actualizar: (clave: string, valor: string | boolean) => void;
  guardado: boolean | null;
  onEjemplo: () => void;
  onLimpiar: () => void;
}) {
  const plano = usePlano();
  switch (b.tipo) {
    case 'parrafo':
      return (
        <p className={s.parrafo}>
          <Tx t={b.texto} />
        </p>
      );
    case 'aclaracion':
      return (
        <p className={s.aclaracion}>
          <Tx t={b.texto} />
        </p>
      );
    case 'subtitulo':
      return <h3 className={s.h3Separado}>{b.texto}</h3>;
    case 'leyenda':
      return (
        <div className={s.leyenda}>
          <span>
            <span className={s.var}>Dato de la ficha</span>
          </span>
          <span>
            <span className={`${s.var} ${s.varVacia}`}>Falta completar</span>
          </span>
          <span>
            <span className={s.vivo}>{b.vivo ?? 'Se completa en el momento'}</span>
          </span>
        </div>
      );
    case 'ficha':
      return <FichaForm def={defFicha} ficha={ficha} actualizar={actualizar} guardado={guardado} onEjemplo={onEjemplo} onLimpiar={onLimpiar} />;
    case 'roles':
      return (
        <div className={s.grillaRoles}>
          {b.items.map((r) => (
            <div key={r.rol} className={s.rol}>
              <p className={s.rolNombre}>{r.rol}</p>
              <p className={s.rolFoco}>
                <Tx t={r.foco} />
              </p>
            </div>
          ))}
        </div>
      );
    case 'reglas':
      return (
        <ol className={s.reglas}>
          {b.items.map((r, i) => (
            <li key={r.titulo} className={s.regla}>
              <span className={s.reglaNumero}>{i + 1}</span>
              <div>
                <p className={s.reglaTitulo}>
                  <Tx t={r.titulo} />
                </p>
                <p className={s.reglaTexto}>
                  <Tx t={r.texto} />
                </p>
              </div>
            </li>
          ))}
        </ol>
      );
    case 'tips':
      return (
        <div className={s.grillaTips}>
          {b.items.map((t) => (
            <div key={t.titulo} className={s.tip}>
              <p className={s.tipTitulo}>
                <Tx t={t.titulo} />
              </p>
              <p className={s.tipTexto}>
                <Tx t={t.texto} />
              </p>
            </div>
          ))}
        </div>
      );
    case 'tarjetas':
      return (
        <div className={b.items.length > 1 ? s.dosColumnas : undefined}>
          {b.items.map((t) => (
            <div key={t.titulo} className={s.tarjeta}>
              <h3 className={s.h3}>
                <Tx t={t.titulo} />
              </h3>
              {t.texto && (
                <p className={s.parrafo}>
                  <Tx t={t.texto} />
                </p>
              )}
              {t.lista &&
                (t.numerada ? (
                  <ol className={s.listaNumerada}>
                    {t.lista.map((x) => (
                      <li key={x}>
                        <Tx t={x} />
                      </li>
                    ))}
                  </ol>
                ) : (
                  <ul className={t.check ? s.listaCheck : s.listaPuntos}>
                    {t.lista.map((x) => (
                      <li key={x}>
                        <Tx t={x} />
                      </li>
                    ))}
                  </ul>
                ))}
              {t.leads && (
                <ul className={s.listaLead}>
                  {t.leads.map((x) => (
                    <li key={x.lead}>
                      <strong>{x.lead}</strong> <Tx t={x.texto} />
                    </li>
                  ))}
                </ul>
              )}
              {t.cita && (
                <div className={s.decir}>
                  <span className={s.decirEtiqueta}>Ejemplo</span>
                  <p className={s.decirTexto}>
                    <Tx t={t.cita} />
                  </p>
                  <BotonCopiar texto={() => plano(t.cita as string)} etiqueta="Copiar ejemplo" />
                </div>
              )}
            </div>
          ))}
        </div>
      );
    case 'etapas':
      return (
        <ol className={s.momentos}>
          {b.items.map((e, i) => (
            <li key={e.titulo} className={s.momento}>
              <div className={s.momentoCabecera}>
                <span className={s.momentoNumero}>{i + 1}</span>
                <div>
                  <p className={s.momentoTitulo}>
                    <Tx t={e.titulo} />
                  </p>
                  <p className={s.momentoCuando}>
                    <Tx t={e.cuando} />
                  </p>
                </div>
              </div>
              <dl className={s.momentoDatos}>
                {e.datos.map((d) => (
                  <div key={d.rotulo} className={d.estilo === 'frase' ? s.momentoFrase : d.estilo === 'error' ? s.momentoError : undefined}>
                    <dt>{d.rotulo}</dt>
                    <dd>
                      <Tx t={d.texto} />
                    </dd>
                  </div>
                ))}
              </dl>
            </li>
          ))}
        </ol>
      );
    case 'guiones':
      return <Guiones aria={b.aria} guiones={b.items} />;
    case 'acordeones':
      return (
        <div className={s.pila}>
          {b.items.map((a) => (
            <Acordeon
              key={a.titulo}
              titulo={<Tx t={a.titulo} />}
              subtitulo={a.subtitulo ? <Tx t={a.subtitulo} /> : undefined}
              abiertoInicial={a.abierto}
              destacado={a.destacado}
              insignia={a.insignia ? <span className={s.insignia}>{a.insignia}</span> : undefined}
            >
              <div className={s.pilaBloques}>
                {a.bloques.map((x, i) => (
                  <BloqueGuionVista key={i} b={x} />
                ))}
              </div>
            </Acordeon>
          ))}
        </div>
      );
    case 'tabla':
      return (
        <div className={`${s.tabla} ${m.tablaN}`} role="table" aria-label={b.aria} style={{ '--cols': b.columnas.map((c) => c.ancho ?? '1fr').join(' ') } as CSSProperties}>
          <div className={`${s.tablaFila} ${s.tablaCabecera}`} role="row">
            {b.columnas.map((c) => (
              <span key={c.rotulo} role="columnheader">
                {c.rotulo}
              </span>
            ))}
          </div>
          {b.filas.map((fila, i) => (
            <div key={`${i}-${fila[0]}`} className={s.tablaFila} role="row">
              {fila.map((celda, j) => {
                const col = b.columnas[j];
                return <Celda key={j} texto={celda} rotulo={col?.rotulo ?? ''} estilo={col?.estilo} />;
              })}
            </div>
          ))}
        </div>
      );
    case 'checklist':
      return <Checklist titulo={b.titulo} items={b.items} textoConforme={b.textoConforme} textoNoConforme={b.textoNoConforme} />;
    case 'kpis':
      return (
        <div className={m.kpis}>
          {b.items.map((k) => (
            <div key={k.nombre} className={m.kpi}>
              <p className={m.kpiNombre}>{k.nombre}</p>
              <p className={m.kpiFormula}>
                <Tx t={k.formula} />
              </p>
              <p className={m.kpiLectura}>
                <Tx t={k.lectura} />
              </p>
              {(k.meta || k.frecuencia || k.fuente) && (
                <div className={m.kpiDatos}>
                  {k.meta && (
                    <span className={m.kpiDato}>
                      Meta <strong>
                        <Tx t={k.meta} />
                      </strong>
                    </span>
                  )}
                  {k.frecuencia && (
                    <span className={m.kpiDato}>
                      Frecuencia <strong>
                        <Tx t={k.frecuencia} />
                      </strong>
                    </span>
                  )}
                  {k.fuente && (
                    <span className={m.kpiDato}>
                      Fuente <strong>
                        <Tx t={k.fuente} />
                      </strong>
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      );
    case 'juridico':
      return (
        <div className={s.pila}>
          {b.items.map((bj) => (
            <Acordeon key={bj.id} titulo={bj.titulo} subtitulo={bj.bajada} abiertoInicial={bj.abierto}>
              <ul className={s.listaJuridica}>
                {bj.items.map((it) => (
                  <li key={it.lead}>
                    {it.nivel && (
                      <span className={s.nivel} data-nivel={it.nivel}>
                        {it.nivel}
                      </span>
                    )}
                    <strong>{it.lead}</strong> <Tx t={it.texto} />
                  </li>
                ))}
              </ul>
            </Acordeon>
          ))}
        </div>
      );
    case 'correo': {
      const copiar = () => [`Asunto «${plano(b.asunto)}»`, '', ...b.cuerpo.map(plano)].join('\n\n');
      return (
        <div className={`${s.tarjeta} ${s.correo}`}>
          <div className={s.correoCabecera}>
            <h3 className={s.h3}>{b.titulo}</h3>
            <BotonCopiar texto={copiar} etiqueta="Copiar correo" variante="texto" />
          </div>
          <p className={s.correoAsunto}>
            <span className={s.correoRotulo}>Asunto</span> <Tx t={b.asunto} />
          </p>
          <div className={s.correoCuerpo}>
            {b.cuerpo.map((linea, i) => (
              <p key={i}>
                <Tx t={linea} />
              </p>
            ))}
          </div>
          {b.nota && (
            <p className={s.aclaracion}>
              <Tx t={b.nota} />
            </p>
          )}
        </div>
      );
    }
    case 'bolsillo':
      return (
        <div className={s.bolsillo}>
          {b.filas.map((fila, i) =>
            Array.isArray(fila) ? (
              <div key={i} className={s.bolsilloFila}>
                {fila.map((it) => (
                  <BloqueBolsillo key={it.rotulo} it={it} />
                ))}
              </div>
            ) : (
              <BloqueBolsillo key={i} it={fila} />
            ),
          )}
        </div>
      );
    case 'semaforo':
      return <Semaforo titulo={b.titulo} preguntas={b.preguntas} evaluar={b.evaluar} ficha={ficha} />;
    case 'calculadora':
      return (
        <Calculadora
          // Si la ficha cambia los valores iniciales (por ejemplo un porcentaje), la calculadora se reinicia con ellos.
          key={`${b.id}-${b.entradas.map((e) => e.inicial ?? '').join('|')}`}
          titulo={b.titulo}
          intro={b.intro}
          entradas={b.entradas}
          salidas={b.salidas}
          barra={b.barra}
          conclusion={b.conclusion}
          nota={b.nota}
          ficha={ficha}
        />
      );
    case 'rubrica':
      return <Rubrica titulo={b.titulo} intro={b.intro} criterios={b.criterios} niveles={b.niveles} />;
    case 'evaluacion':
      return <Evaluacion titulo={b.titulo} intro={b.intro} items={b.items} niveles={b.niveles} />;
    case 'plazos':
      return <Plazos titulo={b.titulo} intro={b.intro} opciones={b.opciones} />;
    case 'componente': {
      const C = b.componente;
      return <C ficha={ficha} />;
    }
    default:
      return null;
  }
}

function Celda({ texto, rotulo, estilo }: { texto: string; rotulo: string; estilo?: string }) {
  if (estilo === 'senal') {
    return (
      <span role="cell" data-rotulo={rotulo} className={s.celdaSenal}>
        <IconoAlerta />
        <span>
          <Tx t={texto} />
        </span>
      </span>
    );
  }
  if (estilo === 'pastilla') {
    return (
      <span role="cell" data-rotulo={rotulo}>
        <span className={s.pastilla}>
          <Tx t={texto} />
        </span>
      </span>
    );
  }
  const clase = estilo === 'no' ? s.celdaNo : estilo === 'si' ? s.celdaSi : estilo === 'porque' ? s.celdaPorque : estilo === 'fuerte' ? m.celdaFuerte : undefined;
  return (
    <span role="cell" data-rotulo={rotulo} className={clase}>
      <Tx t={texto} />
    </span>
  );
}

function BloqueBolsillo({ it }: { it: ItemBolsillo }) {
  return (
    <div className={`${s.bolsilloBloque} ${it.tono === 'nunca' ? s.bolsilloNunca : ''}`}>
      <p className={s.bolsilloRotulo}>
        <Tx t={it.rotulo} />
      </p>
      {it.texto && (
        <p className={it.tono === 'cita' ? s.bolsilloCita : undefined}>
          <Tx t={it.texto} />
        </p>
      )}
      {it.lista &&
        (it.numerada ? (
          <ol>
            {it.lista.map((x) => (
              <li key={x}>
                <Tx t={x} />
              </li>
            ))}
          </ol>
        ) : (
          <ul>
            {it.lista.map((x) => (
              <li key={x}>
                <Tx t={x} />
              </li>
            ))}
          </ul>
        ))}
    </div>
  );
}

function BloqueGuionVista({ b }: { b: BloqueGuion }) {
  const plano = usePlano();
  switch (b.tipo) {
    case 'decir':
      return (
        <div className={s.decir}>
          <span className={s.decirEtiqueta}>
            {b.etiqueta}
            {b.condicion && <span className={s.condicion}>{b.condicion}</span>}
          </span>
          <p className={s.decirTexto}>
            <Tx t={b.texto} />
          </p>
          <BotonCopiar texto={() => plano(b.texto)} etiqueta="Copiar texto" />
        </div>
      );
    case 'nota':
      return (
        <div className={s.nota}>
          <span className={s.notaEtiqueta}>{b.etiqueta}</span>
          <p>
            <Tx t={b.texto} />
          </p>
        </div>
      );
    case 'porque':
      return (
        <div className={s.porque}>
          <span className={s.porqueEtiqueta}>Por qué</span>
          <p>
            <Tx t={b.texto} />
          </p>
        </div>
      );
    case 'nunca':
      return (
        <div className={s.nunca}>
          <span className={s.nuncaEtiqueta}>Nunca</span>
          <ul>
            {b.textos.map((t) => (
              <li key={t}>
                <Tx t={t} />
              </li>
            ))}
          </ul>
        </div>
      );
    default:
      return null;
  }
}

function Guiones({ aria, guiones }: { aria: string; guiones: Guion[] }) {
  const [activo, setActivo] = useState(guiones[0]?.id ?? '');
  const base = useId().replace(/[^a-zA-Z0-9]/g, '');
  const botones = useRef<(HTMLButtonElement | null)[]>([]);
  const actual = guiones.some((g) => g.id === activo) ? activo : (guiones[0]?.id ?? '');

  const alTeclado = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = guiones.findIndex((g) => g.id === actual);
    let destino = -1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') destino = (i + 1) % guiones.length;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') destino = (i - 1 + guiones.length) % guiones.length;
    if (e.key === 'Home') destino = 0;
    if (e.key === 'End') destino = guiones.length - 1;
    if (destino >= 0) {
      e.preventDefault();
      setActivo(guiones[destino].id);
      botones.current[destino]?.focus();
    }
  };

  return (
    <div className={s.pestanas}>
      <div className={`${s.pestanasLista} ${s.noImprimir}`} role="tablist" aria-label={aria} aria-orientation="vertical" onKeyDown={alTeclado}>
        {guiones.map((g, i) => (
          <button
            key={g.id}
            ref={(el) => {
              botones.current[i] = el;
            }}
            type="button"
            role="tab"
            id={`${base}-tab-${g.id}`}
            aria-selected={actual === g.id}
            aria-controls={`${base}-panel-${g.id}`}
            tabIndex={actual === g.id ? 0 : -1}
            className={s.pestana}
            onClick={() => setActivo(g.id)}
          >
            {g.titulo}
          </button>
        ))}
      </div>
      <div className={s.pestanasPaneles}>
        {guiones.map((g) => (
          <div
            key={g.id}
            role="tabpanel"
            id={`${base}-panel-${g.id}`}
            aria-labelledby={`${base}-tab-${g.id}`}
            hidden={actual !== g.id}
            className={s.pestanaPanel}
            tabIndex={0}
          >
            <h3 className={s.guionTitulo}>{g.titulo}</h3>
            <p className={s.guionBajada}>
              <Tx t={g.bajada} />
            </p>
            <div className={s.pilaBloques}>
              {g.bloques.map((x, i) => (
                <BloqueGuionVista key={`${g.id}-${i}`} b={x} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Ficha

function Campo({ etiqueta, ayuda, children, ancho = false }: { etiqueta: string; ayuda?: string; children: ReactNode; ancho?: boolean }) {
  return (
    <label className={`${s.campo} ${ancho ? s.campoAncho : ''}`}>
      <span className={s.campoEtiqueta}>{etiqueta}</span>
      {children}
      {ayuda && <span className={s.campoAyuda}>{ayuda}</span>}
    </label>
  );
}

function Opciones({ nombre, valor, opciones, onChange }: { nombre: string; valor: string; opciones: { valor: string; rotulo: string }[]; onChange: (v: string) => void }) {
  const grupo = useId();
  return (
    <div className={s.segmentado} role="radiogroup" aria-label={nombre}>
      {opciones.map((o) => (
        <label key={o.valor} className={s.segmento} data-activo={valor === o.valor}>
          <input type="radio" name={grupo} value={o.valor} checked={valor === o.valor} onChange={() => onChange(o.valor)} />
          <span>{o.rotulo}</span>
        </label>
      ))}
    </div>
  );
}

function Interruptor({ etiqueta, valor, onChange }: { etiqueta: string; valor: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className={s.interruptor}>
      <input type="checkbox" checked={valor} onChange={(e) => onChange(e.target.checked)} />
      <span className={s.interruptorPista} aria-hidden="true" />
      <span>{etiqueta}</span>
    </label>
  );
}

function FichaForm({
  def,
  ficha,
  actualizar,
  guardado,
  onEjemplo,
  onLimpiar,
}: {
  def: DefFicha;
  ficha: Ficha;
  actualizar: (clave: string, valor: string | boolean) => void;
  guardado: boolean | null;
  onEjemplo: () => void;
  onLimpiar: () => void;
}) {
  const avisos = useMemo(() => (def.avisos ? def.avisos(ficha) : []), [def, ficha]);
  const [enlace, setEnlace] = useState<'listo' | 'ok' | 'error'>('listo');
  const plano = usePlano();

  const copiarEnlace = async () => {
    try {
      await navigator.clipboard.writeText(enlaceConfigurado(ficha));
      setEnlace('ok');
    } catch {
      setEnlace('error');
    }
    window.setTimeout(() => setEnlace('listo'), 1800);
  };

  const campo = (c: CampoFicha) => {
    if (c.cuando && !c.cuando(ficha)) return null;
    if (c.tipo === 'texto') {
      return (
        <Campo key={c.clave} etiqueta={c.etiqueta} ayuda={c.ayuda} ancho={c.ancho}>
          <input
            className={s.input}
            type="text"
            inputMode={c.numerico ? 'numeric' : undefined}
            value={typeof ficha[c.clave] === 'string' ? (ficha[c.clave] as string) : ''}
            placeholder={c.ejemplo}
            onChange={(e) => actualizar(c.clave, e.target.value)}
          />
        </Campo>
      );
    }
    if (c.tipo === 'opciones') {
      return (
        <Campo key={c.clave} etiqueta={c.etiqueta} ayuda={c.ayuda} ancho={c.ancho}>
          <Opciones nombre={c.etiqueta} valor={typeof ficha[c.clave] === 'string' ? (ficha[c.clave] as string) : ''} opciones={c.opciones} onChange={(v) => actualizar(c.clave, v)} />
        </Campo>
      );
    }
    return (
      <div key={c.clave} className={s.campoAncho}>
        <Interruptor etiqueta={c.etiqueta} valor={ficha[c.clave] === true} onChange={(v) => actualizar(c.clave, v)} />
        {c.ayuda && <span className={s.campoAyuda}>{c.ayuda}</span>}
      </div>
    );
  };

  return (
    <div className={s.ficha}>
      <div className={`${s.fichaAcciones} ${s.noImprimir}`}>
        <button type="button" className={s.boton} onClick={onEjemplo}>
          Cargar ejemplo
        </button>
        <button type="button" className={s.boton} onClick={onLimpiar}>
          Limpiar ficha
        </button>
        <button type="button" className={`${s.boton} ${s.botonPrimario}`} onClick={copiarEnlace}>
          <IconoEnlace />
          <span>{enlace === 'ok' ? 'Enlace copiado' : enlace === 'error' ? 'No se pudo copiar' : 'Copiar enlace configurado'}</span>
        </button>
        <span className={s.estadoGuardado} aria-live="polite">
          {guardado === false ? 'Este navegador no permite guardar. Usá el enlace configurado.' : 'Se guarda sola en este navegador.'}
        </span>
      </div>

      {avisos.length > 0 && (
        <ul className={`${s.avisos} ${s.noImprimir}`} aria-live="polite">
          {avisos.map((a) => (
            <li key={a.texto} className={s.aviso} data-nivel={a.nivel}>
              <IconoAlerta />
              <span>
                <Tx t={a.texto} />
              </span>
            </li>
          ))}
        </ul>
      )}

      <form className={`${s.fichaFormulario} ${s.noImprimir}`} onSubmit={(e) => e.preventDefault()}>
        {def.grupos.map((g) => {
          const visibles = g.campos.filter((c) => !c.cuando || c.cuando(ficha));
          if (!visibles.length) return null;
          return (
            <fieldset key={g.titulo} className={s.grupo}>
              <legend>{g.titulo}</legend>
              <div className={s.grillaCampos}>{g.campos.map(campo)}</div>
            </fieldset>
          );
        })}
      </form>

      <dl className={s.resumenImpresion}>
        {def.resumen.map((r) => (
          <div key={r.rotulo}>
            <dt>{r.rotulo}</dt>
            <dd>{plano(r.texto)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

// Impresión en una ventana aparte, para no arrastrar el resto del sitio.

function escapar(t: string) {
  return t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);
}

function imprimirEnVentana(raiz: HTMLElement | null, modo: 'todo' | 'tarjeta', titulo: string) {
  if (!raiz) return;
  const ventana = window.open('', '_blank');
  if (!ventana) {
    window.print();
    return;
  }
  const estilos = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
    .map((n) => n.outerHTML)
    .join('\n');
  const clon = raiz.cloneNode(true) as HTMLElement;
  clon.setAttribute('data-print', modo);
  clon.setAttribute('data-theme', 'light');
  // Los paneles cerrados se abren en la copia. Algunos resets globales (Tailwind v4)
  // ocultan [hidden] con !important y le ganarían a cualquier regla de impresión.
  clon.querySelectorAll('[hidden]').forEach((el) => el.removeAttribute('hidden'));
  // Los valores escritos en campos no viajan con el clon. Se copian a mano.
  const originales = raiz.querySelectorAll('input, select');
  const copias = clon.querySelectorAll('input, select');
  originales.forEach((el, i) => {
    const copia = copias[i];
    if (!copia) return;
    if (el instanceof HTMLInputElement && copia instanceof HTMLInputElement) {
      if (el.type === 'checkbox' || el.type === 'radio') {
        if (el.checked) copia.setAttribute('checked', '');
        else copia.removeAttribute('checked');
      } else copia.setAttribute('value', el.value);
    } else if (el instanceof HTMLSelectElement && copia instanceof HTMLSelectElement) {
      Array.from(copia.options).forEach((o, j) => {
        if (j === el.selectedIndex) o.setAttribute('selected', '');
        else o.removeAttribute('selected');
      });
    }
  });
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapar(
    titulo,
  )}</title><base href="${escapar(document.baseURI)}">${estilos}<style>html,body{margin:0;background:#fff}</style></head><body>${clon.outerHTML}</body></html>`;
  ventana.document.open();
  ventana.document.write(html);
  ventana.document.close();
  let lanzado = false;
  const lanzar = () => {
    if (lanzado) return;
    lanzado = true;
    ventana.focus();
    ventana.print();
  };
  ventana.addEventListener('load', () => window.setTimeout(lanzar, 350));
  window.setTimeout(lanzar, 1500);
}


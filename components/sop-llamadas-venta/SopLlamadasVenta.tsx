/**
 * Protocolo de comunicación legal en llamadas de venta. Plantilla FIRMA.
 *
 * Uso con React Router
 *   import SopLlamadasVenta from './sop-llamadas-venta';
 *   <Route path="/protocolo-llamadas" element={<SopLlamadasVenta />} />
 *
 * Versión fija para un cliente, sin ficha visible
 *   <SopLlamadasVenta ocultarFicha configInicial={{ empresa: 'Cliente LLC', perfil: 'B2B', variante: 'A', ventana: '72 horas' }} />
 *
 * Ajustes visuales con variables CSS, por la prop style (viajan también a la impresión),
 * en un contenedor padre o en :root
 *   colores      --sop-bg, --sop-surface, --sop-ink, --sop-muted, --sop-line, --sop-accent
 *   tipografía   --sop-font-body, --sop-font-display, --sop-display-weight, --sop-display-weight-sm
 *   formas       --sop-radius, --sop-radius-md, --sop-radius-sm, --sop-radius-xs, --sop-radius-pill
 *   navegación   --sop-sticky-top, --sop-scroll-margin, --sop-scroll-margin-mobile
 *
 * En Next.js (App Router) agregar 'use client' en la primera línea de este archivo y de piezas.tsx.
 */
import { useCallback, useEffect, useId, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react';
import s from './sop.module.css';
import {
  CONFIG_EJEMPLO,
  CONFIG_VACIA,
  avisosDeFicha,
  enlaceConfigurado,
  guardarLocal,
  leerConfigInicial,
  macrosDeFicha,
  valoresDeFicha,
  varianteEfectiva,
  type ConfigSop,
  type Nicho,
  type Variante,
} from './config';
import {
  ALERTAS,
  CAMPOS_CRM,
  COMO_DECIRLO,
  CONSECUENCIAS,
  CONSERVACION,
  CONTROL,
  FRASES,
  IDEAS,
  JURIDICO,
  META,
  MOMENTOS,
  MUESTRA,
  NICHOS,
  NOTA_CONTROL,
  PIE,
  REGLAS_ORO,
  REGLAS_SETTER,
  REPASO_APERTURA,
  REPASO_CIERRE,
  ROLES,
  construirCorreo,
  construirGuiones,
  construirObjeciones,
  construirRepaso,
  type Bloque,
  type Guion,
  type ItemRepaso,
} from './contenido';
import { Acordeon, BotonCopiar, IconoAlerta, IconoEnlace, IconoImprimir, TextoCtx, Tx, textoPlano, usePlano, type ContextoTexto } from './piezas';

export interface SopLlamadasVentaProps {
  /** Tema visual. Por defecto claro, para integrarse en sitios de fondo claro. */
  theme?: 'light' | 'dark' | 'auto';
  /** Marca que firma el protocolo. */
  marca?: string;
  /** Ficha precargada para un cliente. */
  configInicial?: Partial<ConfigSop>;
  /** Oculta la ficha, útil cuando la página ya está configurada para un cliente puntual. */
  ocultarFicha?: boolean;
  className?: string;
  /** Estilos en línea para la raíz. Ideal para las variables --sop-* de marca. */
  style?: CSSProperties;
}

interface DefSeccion {
  id: string;
  titulo: string;
  corto: string;
}

const SECCIONES: DefSeccion[] = [
  { id: 'uso', titulo: 'Cómo usar este protocolo', corto: 'Cómo usarlo' },
  { id: 'ficha', titulo: 'Ficha del cliente', corto: 'Ficha del cliente' },
  { id: 'reglas', titulo: 'Cinco reglas de oro', corto: 'Reglas de oro' },
  { id: 'mapa', titulo: 'La llamada en siete momentos', corto: 'Siete momentos' },
  { id: 'guiones', titulo: 'Guiones por tema', corto: 'Guiones' },
  { id: 'repaso', titulo: 'Repaso de cierre', corto: 'Repaso de cierre' },
  { id: 'objeciones', titulo: 'Objeciones con contenido legal', corto: 'Objeciones' },
  { id: 'frases', titulo: 'Frases prohibidas y su reemplazo', corto: 'Frases prohibidas' },
  { id: 'alertas', titulo: 'Alertas y escalamiento', corto: 'Alertas' },
  { id: 'despues', titulo: 'Después de la llamada', corto: 'Después de la llamada' },
  { id: 'calidad', titulo: 'Control de calidad', corto: 'Control de calidad' },
  { id: 'juridico', titulo: 'Anexo jurídico', corto: 'Anexo jurídico' },
  { id: 'tarjeta', titulo: 'Tarjeta de bolsillo', corto: 'Tarjeta de bolsillo' },
];

const VARIANTES: { v: Variante; titulo: string; texto: string }[] = [
  {
    v: 'A',
    titulo: 'A · Ventana contractual',
    texto: 'Para compradores B2B. El contrato da un plazo corto para arrepentirse, por ejemplo 72 horas, y después el compromiso es por el total.',
  },
  {
    v: 'B',
    titulo: 'B · Ventana legal del consumidor',
    texto: 'Obligatoria si quien compra es consumidor. 10 días corridos en Argentina y 14 días naturales en España. Hay que informarla para que venza.',
  },
  {
    v: 'C',
    titulo: 'C · Sin devoluciones',
    texto: 'Solo con caracterización B2B sólida en el contrato. Es la variante de mayor exposición.',
  },
];

const NICHO_OPCIONES: { valor: Nicho; rotulo: string }[] = [
  { valor: 'ninguno', rotulo: 'General' },
  { valor: 'salud', rotulo: 'Salud y bienestar' },
  { valor: 'finanzas', rotulo: 'Finanzas' },
  { valor: 'inmobiliario', rotulo: 'Inmobiliario' },
];

export default function SopLlamadasVenta({ theme = 'light', marca = 'FIRMA', configInicial, ocultarFicha = false, className, style }: SopLlamadasVentaProps) {
  const [config, setConfig] = useState<ConfigSop>(() => leerConfigInicial(configInicial));
  const [guardado, setGuardado] = useState<boolean | null>(null);
  const raizRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setGuardado(guardarLocal(config));
  }, [config]);

  // Si la ficha llegó por enlace, se limpia el hash para que las ediciones posteriores no se pierdan al recargar.
  useEffect(() => {
    try {
      if (window.location.hash.startsWith('#ficha=')) {
        const { pathname, search } = window.location;
        window.history.replaceState(window.history.state, '', `${pathname}${search}`);
      }
    } catch {
      // Sin acceso al historial, no pasa nada.
    }
  }, []);

  const ctx: ContextoTexto = useMemo(() => ({ valores: valoresDeFicha(config), macros: macrosDeFicha(config) }), [config]);
  const plano = useCallback((t: string) => textoPlano(t, ctx), [ctx]);
  const variante = varianteEfectiva(config);
  const guiones = useMemo(() => construirGuiones(config), [config]);
  const repaso = useMemo(() => construirRepaso(config), [config]);
  const objeciones = useMemo(() => construirObjeciones(config), [config]);
  const correo = useMemo(() => construirCorreo(config), [config]);

  const secciones = useMemo(() => (ocultarFicha ? SECCIONES.filter((x) => x.id !== 'ficha') : SECCIONES), [ocultarFicha]);
  const prefijo = useId().replace(/[^a-zA-Z0-9]/g, '');
  const idDe = (id: string) => `sop-${prefijo}-${id}`;
  const activa = useSeccionActiva(secciones.map((x) => idDe(x.id)));

  const actualizar = <K extends keyof ConfigSop>(clave: K, valor: ConfigSop[K]) => setConfig((c) => ({ ...c, [clave]: valor }));

  const irA = (id: string) => (e: MouseEvent) => {
    e.preventDefault();
    document.getElementById(idDe(id))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const numeroDe = (id: string) => String(secciones.findIndex((x) => x.id === id) + 1).padStart(2, '0');
  const def = (id: string) => secciones.find((x) => x.id === id) as DefSeccion;
  const tituloImpresion = `${META.titulo} · ${marca}`;

  const correoPlano = () => [`Asunto «${plano(correo.asunto)}»`, '', ...correo.cuerpo.map(plano)].join('\n\n');
  const repasoPlano = () => [plano(REPASO_APERTURA), ...repaso.map((r) => plano(r.texto)), plano(REPASO_CIERRE)].join('\n');

  return (
    <TextoCtx.Provider value={ctx}>
      <div ref={raizRef} className={`${s.raiz} ${className ?? ''}`} style={style} data-theme={theme} lang="es">
        <header className={s.hero}>
          <div className={s.heroInterior}>
            <p className={s.kicker}>
              {META.kicker} {marca}
            </p>
            <h1 className={s.titulo}>{META.titulo}</h1>
            <p className={s.bajada}>{META.bajada}</p>
            <p className={s.meta}>
              {META.version}
              {ctx.valores.empresa ? (
                <>
                  {' · '}Configurado para <Tx t="{empresa}" />
                </>
              ) : null}
            </p>
            <div className={`${s.acciones} ${s.noImprimir}`}>
              {!ocultarFicha && (
                <a href={`#${idDe('ficha')}`} onClick={irA('ficha')} className={`${s.boton} ${s.botonPrimario}`}>
                  Configurar la ficha
                </a>
              )}
              <button type="button" className={s.boton} onClick={() => imprimirEnVentana(raizRef.current, 'todo', tituloImpresion)}>
                <IconoImprimir />
                <span>Imprimir o guardar en PDF</span>
              </button>
              <button type="button" className={s.boton} onClick={() => imprimirEnVentana(raizRef.current, 'tarjeta', `Tarjeta de bolsillo · ${marca}`)}>
                <IconoImprimir />
                <span>Tarjeta de bolsillo</span>
              </button>
            </div>
            <div className={s.ideas}>
              {IDEAS.map((idea) => (
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
            {/* 01 Cómo usar */}
            <Seccion id={idDe('uso')} clave="uso" numero={numeroDe('uso')} titulo={def('uso').titulo}>
              <p className={s.parrafo}>
                Este documento es el procedimiento y guion comercial al que remiten los contratos de closers y setters. Aplicarlo forma parte del servicio
                contratado. Los datos de cada cliente se completan una sola vez en la ficha y se actualizan solos en todos los guiones.
              </p>
              <div className={s.leyenda}>
                <span>
                  <span className={s.var}>Dato de la ficha</span>
                </span>
                <span>
                  <span className={`${s.var} ${s.varVacia}`}>Falta completar</span>
                </span>
                <span>
                  <span className={s.vivo}>Se completa en la llamada</span>
                </span>
              </div>
              <div className={s.grillaRoles}>
                {ROLES.map((r) => (
                  <div key={r.rol} className={s.rol}>
                    <p className={s.rolNombre}>{r.rol}</p>
                    <p className={s.rolFoco}>{r.foco}</p>
                  </div>
                ))}
              </div>
              <div className={`${s.tarjeta} ${s.tarjetaSetter}`}>
                <h3 className={s.h3}>Reglas para setters</h3>
                <ol className={s.listaNumerada}>
                  {REGLAS_SETTER.map((r) => (
                    <li key={r}>
                      <Tx t={r} />
                    </li>
                  ))}
                </ol>
              </div>
              <p className={s.aclaracion}>Si algo de un guion no coincide con el contrato del cliente, prevalece el contrato y hay que avisar para ajustar la ficha.</p>
            </Seccion>

            {/* 02 Ficha */}
            {!ocultarFicha && (
              <Seccion
                id={idDe('ficha')}
                clave="ficha"
                numero={numeroDe('ficha')}
                titulo={def('ficha').titulo}
                intro="Se completa una sola vez por cliente. Los guiones de todo el protocolo se actualizan solos, y el enlace configurado permite compartir esta misma versión con el equipo comercial."
              >
                <FichaCliente
                  config={config}
                  actualizar={actualizar}
                  variante={variante}
                  guardado={guardado}
                  onEjemplo={() => setConfig({ ...CONFIG_EJEMPLO })}
                  onLimpiar={() => setConfig({ ...CONFIG_VACIA, ...(configInicial ?? {}) })}
                />
              </Seccion>
            )}

            {/* 03 Reglas de oro */}
            <Seccion
              id={idDe('reglas')}
              clave="reglas"
              numero={numeroDe('reglas')}
              titulo={def('reglas').titulo}
              intro="La versión de un minuto. Si el equipo recuerda solo esto, ya evita la mayoría de los problemas."
            >
              <ol className={s.reglas}>
                {REGLAS_ORO.map((r, i) => (
                  <li key={r.titulo} className={s.regla}>
                    <span className={s.reglaNumero}>{i + 1}</span>
                    <div>
                      <p className={s.reglaTitulo}>{r.titulo}</p>
                      <p className={s.reglaTexto}>{r.texto}</p>
                    </div>
                  </li>
                ))}
              </ol>
              <h3 className={s.h3Separado}>Cómo decirlo sin enfriar la venta</h3>
              <div className={s.grillaTips}>
                {COMO_DECIRLO.map((t) => (
                  <div key={t.titulo} className={s.tip}>
                    <p className={s.tipTitulo}>{t.titulo}</p>
                    <p className={s.tipTexto}>{t.texto}</p>
                  </div>
                ))}
              </div>
            </Seccion>

            {/* 04 Mapa */}
            <Seccion
              id={idDe('mapa')}
              clave="mapa"
              numero={numeroDe('mapa')}
              titulo={def('mapa').titulo}
              intro="Cada momento comercial tiene un objetivo legal. Ninguno agrega más de un par de minutos a la llamada."
            >
              <ol className={s.momentos}>
                {MOMENTOS.map((m, i) => (
                  <li key={m.titulo} className={s.momento}>
                    <div className={s.momentoCabecera}>
                      <span className={s.momentoNumero}>{i + 1}</span>
                      <div>
                        <p className={s.momentoTitulo}>{m.titulo}</p>
                        <p className={s.momentoCuando}>{m.cuando}</p>
                      </div>
                    </div>
                    <dl className={s.momentoDatos}>
                      <div>
                        <dt>Objetivo legal</dt>
                        <dd>
                          <Tx t={m.objetivo} />
                        </dd>
                      </div>
                      <div>
                        <dt>Qué tiene que pasar</dt>
                        <dd>
                          <Tx t={m.que} />
                        </dd>
                      </div>
                      <div className={s.momentoFrase}>
                        <dt>Frase ancla</dt>
                        <dd>
                          <Tx t={m.frase} />
                        </dd>
                      </div>
                      <div className={s.momentoError}>
                        <dt>Error típico</dt>
                        <dd>
                          <Tx t={m.error} />
                        </dd>
                      </div>
                    </dl>
                  </li>
                ))}
              </ol>
            </Seccion>

            {/* 05 Guiones */}
            <Seccion
              id={idDe('guiones')}
              clave="guiones"
              numero={numeroDe('guiones')}
              titulo={def('guiones').titulo}
              intro="Cada guion tiene una versión corta para el flujo normal y respuestas para cuando el prospecto pregunta más. Se pueden adaptar al estilo de cada closer siempre que no cambie el contenido."
            >
              <Guiones guiones={guiones} />
            </Seccion>

            {/* 06 Repaso */}
            <Seccion
              id={idDe('repaso')}
              clave="repaso"
              numero={numeroDe('repaso')}
              titulo={def('repaso').titulo}
              intro="Va después del sí comercial y antes de enviar el link de pago. Dura entre 60 y 90 segundos y en cada punto el closer espera un sí claro. Si aparece una duda, se resuelve antes de cobrar. Es la pieza de prueba más valiosa de toda la llamada."
            >
              <Repaso items={repaso} copiarTodo={repasoPlano} />
            </Seccion>

            {/* 07 Objeciones */}
            <Seccion
              id={idDe('objeciones')}
              clave="objeciones"
              numero={numeroDe('objeciones')}
              titulo={def('objeciones').titulo}
              intro="Las objeciones comerciales se trabajan con el guion de ventas de cada empresa. Estas son las que tocan temas legales y tienen una sola respuesta correcta."
            >
              <div className={s.pila}>
                {objeciones.map((o) => (
                  <Acordeon key={o.pregunta} titulo={<Tx t={o.pregunta} />}>
                    <div className={s.decir}>
                      <span className={s.decirEtiqueta}>Respuesta modelo</span>
                      <p className={s.decirTexto}>
                        <Tx t={o.respuesta} />
                      </p>
                      <BotonCopiar texto={() => plano(o.respuesta)} etiqueta="Copiar respuesta" />
                    </div>
                    {o.nota && (
                      <div className={s.porque}>
                        <span className={s.porqueEtiqueta}>Ojo</span>
                        <p>
                          <Tx t={o.nota} />
                        </p>
                      </div>
                    )}
                  </Acordeon>
                ))}
              </div>
            </Seccion>

            {/* 08 Frases */}
            <Seccion
              id={idDe('frases')}
              clave="frases"
              numero={numeroDe('frases')}
              titulo={def('frases').titulo}
              intro="No se trata de hablar como abogado. Se trata de no regalar promesas que después alguien tiene que pagar."
            >
              <div className={s.tabla} role="table" aria-label="Frases prohibidas y su reemplazo">
                <div className={`${s.tablaFila} ${s.tablaCabecera}`} role="row">
                  <span role="columnheader">No digas</span>
                  <span role="columnheader">Decí</span>
                  <span role="columnheader">Por qué</span>
                </div>
                {FRASES.map((f) => (
                  <div key={f.no} className={s.tablaFila} role="row">
                    <span role="cell" data-rotulo="No digas" className={s.celdaNo}>
                      <Tx t={f.no} />
                    </span>
                    <span role="cell" data-rotulo="Decí" className={s.celdaSi}>
                      <Tx t={f.si} />
                    </span>
                    <span role="cell" data-rotulo="Por qué" className={s.celdaPorque}>
                      <Tx t={f.porque} />
                    </span>
                  </div>
                ))}
              </div>
            </Seccion>

            {/* 09 Alertas */}
            <Seccion
              id={idDe('alertas')}
              clave="alertas"
              numero={numeroDe('alertas')}
              titulo={def('alertas').titulo}
              intro="Ante estas señales el closer no improvisa. Aplica la acción indicada y avisa a quien corresponde antes de cobrar."
            >
              <div className={`${s.tabla} ${s.tablaAlertas}`} role="table" aria-label="Alertas y escalamiento">
                <div className={`${s.tablaFila} ${s.tablaCabecera}`} role="row">
                  <span role="columnheader">Señal</span>
                  <span role="columnheader">Qué hacer</span>
                  <span role="columnheader">Escalar a</span>
                </div>
                {ALERTAS.map((a) => (
                  <div key={a.senal} className={s.tablaFila} role="row">
                    <span role="cell" data-rotulo="Señal" className={s.celdaSenal}>
                      <IconoAlerta />
                      <span>
                        <Tx t={a.senal} />
                      </span>
                    </span>
                    <span role="cell" data-rotulo="Qué hacer">
                      <Tx t={a.accion} />
                    </span>
                    <span role="cell" data-rotulo="Escalar a">
                      <span className={s.pastilla}>{a.escalar}</span>
                    </span>
                  </div>
                ))}
              </div>
              <h3 className={s.h3Separado}>Reglas por nicho</h3>
              <div className={s.pila}>
                {(Object.keys(NICHOS) as (keyof typeof NICHOS)[]).map((k) => (
                  <Acordeon
                    key={k}
                    titulo={NICHOS[k].titulo}
                    abiertoInicial={config.nicho === k}
                    destacado={config.nicho === k}
                    insignia={config.nicho === k ? <span className={s.insignia}>Nicho de este cliente</span> : undefined}
                  >
                    <ul className={s.listaPuntos}>
                      {NICHOS[k].reglas.map((r) => (
                        <li key={r}>{r}</li>
                      ))}
                    </ul>
                  </Acordeon>
                ))}
              </div>
            </Seccion>

            {/* 10 Después de la llamada */}
            <Seccion
              id={idDe('despues')}
              clave="despues"
              numero={numeroDe('despues')}
              titulo={def('despues').titulo}
              intro="Lo que no queda por escrito dentro de las 24 horas, en la práctica, no existe para la defensa de la empresa."
            >
              <div className={s.dosColumnas}>
                <div className={s.tarjeta}>
                  <h3 className={s.h3}>Campos mínimos en el CRM</h3>
                  <ul className={s.listaCheck}>
                    {CAMPOS_CRM.map((c) => (
                      <li key={c}>
                        <Tx t={c} />
                      </li>
                    ))}
                  </ul>
                </div>
                <div className={s.tarjeta}>
                  <h3 className={s.h3}>Conservación del registro</h3>
                  <ul className={s.listaLead}>
                    {CONSERVACION.map((c) => (
                      <li key={c.lead}>
                        <strong>{c.lead}</strong> {c.texto}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              <div className={`${s.tarjeta} ${s.correo}`}>
                <div className={s.correoCabecera}>
                  <h3 className={s.h3}>Correo de confirmación</h3>
                  <BotonCopiar texto={correoPlano} etiqueta="Copiar correo" variante="texto" />
                </div>
                <p className={s.correoAsunto}>
                  <span className={s.correoRotulo}>Asunto</span> <Tx t={correo.asunto} />
                </p>
                <div className={s.correoCuerpo}>
                  {correo.cuerpo.map((linea, i) => (
                    <p key={i}>
                      <Tx t={linea} />
                    </p>
                  ))}
                </div>
                <p className={s.aclaracion}>El correo resume, no agrega. Si el closer quiere sumar algo que no está en el contrato, primero lo aprueba el líder comercial.</p>
              </div>
            </Seccion>

            {/* 11 Control de calidad */}
            <Seccion
              id={idDe('calidad')}
              clave="calidad"
              numero={numeroDe('calidad')}
              titulo={def('calidad').titulo}
              intro="El control se hace sobre el registro de la llamada y mide el servicio contratado. Los ítems críticos no admiten excepciones."
            >
              <div className={s.dosColumnas}>
                <div className={s.tarjeta}>
                  <h3 className={s.h3}>Muestra mínima</h3>
                  <ul className={s.listaPuntos}>
                    {MUESTRA.map((m) => (
                      <li key={m}>{m}</li>
                    ))}
                  </ul>
                </div>
                <div className={s.tarjeta}>
                  <h3 className={s.h3}>Consecuencias</h3>
                  <ol className={s.listaLeadNumerada}>
                    {CONSECUENCIAS.map((c) => (
                      <li key={c.lead}>
                        <strong>{c.lead}</strong> {c.texto}
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
              <Scorecard usaReserva={config.usaReserva} />
              <p className={s.aclaracion}>{NOTA_CONTROL}</p>
            </Seccion>

            {/* 12 Anexo jurídico */}
            <Seccion
              id={idDe('juridico')}
              clave="juridico"
              numero={numeroDe('juridico')}
              titulo={def('juridico').titulo}
              intro="Para la dirección de la empresa y el equipo legal. El equipo comercial no necesita leerlo, pero cada regla del protocolo se apoya en lo que sigue. Normativa revisada a octubre de 2026."
            >
              <div className={s.pila}>
                {JURIDICO.map((b) => (
                  <Acordeon key={b.id} titulo={b.titulo} subtitulo={b.bajada} abiertoInicial={b.id === 'ajustes'}>
                    <ul className={s.listaJuridica}>
                      {b.items.map((it) => (
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
            </Seccion>

            {/* 13 Tarjeta de bolsillo */}
            <Seccion
              id={idDe('tarjeta')}
              clave="tarjeta"
              numero={numeroDe('tarjeta')}
              titulo={def('tarjeta').titulo}
              intro="Una página para tener abierta durante la llamada. El botón la imprime sola."
              claseExtra={s.seccionTarjeta}
            >
              <TarjetaBolsillo repaso={repaso} usaCuotas={config.usaCuotas} usaReserva={config.usaReserva} />
              <div className={`${s.acciones} ${s.noImprimir}`}>
                <button type="button" className={s.boton} onClick={() => imprimirEnVentana(raizRef.current, 'tarjeta', `Tarjeta de bolsillo · ${marca}`)}>
                  <IconoImprimir />
                  <span>Imprimir tarjeta</span>
                </button>
              </div>
            </Seccion>

            <footer className={s.pie}>
              <p>{PIE.replace('FIRMA', marca)}</p>
              <p className={s.pieMeta}>{META.version}</p>
            </footer>
          </main>
        </div>
      </div>
    </TextoCtx.Provider>
  );
}

// Secciones y piezas internas

function Seccion({
  id,
  clave,
  numero,
  titulo,
  intro,
  claseExtra,
  children,
}: {
  id: string;
  clave: string;
  numero: string;
  titulo: string;
  intro?: string;
  claseExtra?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className={`${s.seccion} ${claseExtra ?? ''}`} data-seccion={clave} aria-labelledby={`${id}-t`}>
      <p className={s.seccionNumero}>{numero}</p>
      <h2 id={`${id}-t`} className={s.seccionTitulo}>
        {titulo}
      </h2>
      {intro && <p className={s.seccionIntro}>{intro}</p>}
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

function Campo({ etiqueta, ayuda, children, ancho = false }: { etiqueta: string; ayuda?: string; children: ReactNode; ancho?: boolean }) {
  return (
    <label className={`${s.campo} ${ancho ? s.campoAncho : ''}`}>
      <span className={s.campoEtiqueta}>{etiqueta}</span>
      {children}
      {ayuda && <span className={s.campoAyuda}>{ayuda}</span>}
    </label>
  );
}

function Opciones<T extends string>({
  nombre,
  valor,
  opciones,
  onChange,
}: {
  nombre: string;
  valor: T;
  opciones: { valor: T; rotulo: string }[];
  onChange: (v: T) => void;
}) {
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

function FichaCliente({
  config,
  actualizar,
  variante,
  guardado,
  onEjemplo,
  onLimpiar,
}: {
  config: ConfigSop;
  actualizar: <K extends keyof ConfigSop>(clave: K, valor: ConfigSop[K]) => void;
  variante: Variante;
  guardado: boolean | null;
  onEjemplo: () => void;
  onLimpiar: () => void;
}) {
  const avisos = useMemo(() => avisosDeFicha(config), [config]);
  const [enlace, setEnlace] = useState<'listo' | 'ok' | 'error'>('listo');
  const grupoVariante = useId();
  const plano = usePlano();

  const copiarEnlace = async () => {
    try {
      await navigator.clipboard.writeText(enlaceConfigurado(config));
      setEnlace('ok');
    } catch {
      setEnlace('error');
    }
    window.setTimeout(() => setEnlace('listo'), 1800);
  };

  const texto = (clave: keyof ConfigSop, etiqueta: string, ayuda?: string, placeholder?: string, opciones?: { ancho?: boolean; numerico?: boolean }) => (
    <Campo etiqueta={etiqueta} ayuda={ayuda} ancho={opciones?.ancho}>
      <input
        className={s.input}
        type="text"
        inputMode={opciones?.numerico ? 'numeric' : undefined}
        value={config[clave] as string}
        placeholder={placeholder}
        onChange={(e) => actualizar(clave, e.target.value as never)}
      />
    </Campo>
  );

  const deshabilitada = (v: Variante) => (config.perfil === 'B2C' ? v !== 'B' : v === 'B');

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
              <span>{a.texto}</span>
            </li>
          ))}
        </ul>
      )}

      <form className={`${s.fichaFormulario} ${s.noImprimir}`} onSubmit={(e) => e.preventDefault()}>
        <fieldset className={s.grupo}>
          <legend>Empresa y programa</legend>
          <div className={s.grillaCampos}>
            {texto('empresa', 'Empresa', 'Razón social que firma el contrato.', 'Por ejemplo, Impulso Consultores LLC')}
            {texto('programa', 'Programa', undefined, 'Por ejemplo, Programa Impulso')}
            {texto('duracion', 'Duración', undefined, 'Por ejemplo, 3 meses')}
            {texto('inicio', 'Inicio o próxima cohorte', 'Se lee después de «arranca».', 'Por ejemplo, el lunes 2 de noviembre')}
            {texto('cupos', 'Cupos reales', 'Solo si existe un límite real.', 'Por ejemplo, 20 lugares por cohorte', { ancho: true })}
          </div>
        </fieldset>

        <fieldset className={s.grupo}>
          <legend>Comprador y devoluciones</legend>
          <div className={s.grillaCampos}>
            <Campo etiqueta="Perfil del comprador" ayuda="Si compra para uso personal, es consumidor.">
              <Opciones
                nombre="Perfil del comprador"
                valor={config.perfil}
                opciones={[
                  { valor: 'B2B', rotulo: 'Profesional o empresa' },
                  { valor: 'B2C', rotulo: 'Consumidor' },
                ]}
                onChange={(v) => actualizar('perfil', v)}
              />
            </Campo>
            <Campo etiqueta="Mercado principal" ayuda="Define la ventana legal del consumidor.">
              <Opciones
                nombre="Mercado principal"
                valor={config.mercado}
                opciones={[
                  { valor: 'AR', rotulo: 'Argentina' },
                  { valor: 'ES', rotulo: 'España' },
                  { valor: 'OTRO', rotulo: 'Otro' },
                ]}
                onChange={(v) => actualizar('mercado', v)}
              />
            </Campo>
          </div>
          <div className={s.variantes} role="radiogroup" aria-label="Variante de devoluciones">
            {VARIANTES.map((op) => {
              const off = deshabilitada(op.v);
              return (
                <label key={op.v} className={s.varianteOpcion} data-activo={variante === op.v} data-deshabilitada={off}>
                  <input
                    type="radio"
                    name={grupoVariante}
                    value={op.v}
                    checked={variante === op.v}
                    disabled={off}
                    onChange={() => actualizar('variante', op.v)}
                  />
                  <span className={s.varianteTitulo}>{op.titulo}</span>
                  <span className={s.varianteTexto}>{op.texto}</span>
                </label>
              );
            })}
          </div>
          {variante === 'A' && (
            <div className={s.grillaCampos}>{texto('ventana', 'Ventana contractual', 'Plazo para arrepentirse que da el contrato.', 'Por ejemplo, 72 horas')}</div>
          )}
        </fieldset>

        <fieldset className={s.grupo}>
          <legend>Precio y pagos</legend>
          <div className={s.grillaCampos}>
            <Campo etiqueta="Moneda">
              <Opciones
                nombre="Moneda"
                valor={config.moneda}
                opciones={[
                  { valor: 'USD', rotulo: 'USD' },
                  { valor: 'ARS', rotulo: 'ARS' },
                  { valor: 'EUR', rotulo: 'EUR' },
                ]}
                onChange={(v) => actualizar('moneda', v)}
              />
            </Campo>
            {texto('precio', 'Precio total', 'Solo números.', 'Por ejemplo, 3000', { numerico: true })}
          </div>
          <div className={s.grillaCampos}>
            <div className={s.campoAncho}>
              <Interruptor etiqueta="Ofrece pago en cuotas" valor={config.usaCuotas} onChange={(v) => actualizar('usaCuotas', v)} />
            </div>
            {config.usaCuotas && (
              <>
                {texto('cuotasN', 'Cantidad de cuotas', undefined, 'Por ejemplo, 3', { numerico: true })}
                {texto('cuotaMonto', 'Monto por cuota', 'Solo números.', 'Por ejemplo, 1000', { numerico: true })}
              </>
            )}
          </div>
          <div className={s.grillaCampos}>
            <div className={s.campoAncho}>
              <Interruptor etiqueta="Usa reserva de cupo" valor={config.usaReserva} onChange={(v) => actualizar('usaReserva', v)} />
            </div>
            {config.usaReserva && (
              <>
                {texto('reservaMonto', 'Monto de la reserva', 'Se descuenta del precio total.', 'Por ejemplo, 300', { numerico: true })}
                {texto('saldoDias', 'Días para completar el pago', undefined, 'Por ejemplo, 7', { numerico: true })}
              </>
            )}
          </div>
        </fieldset>

        <fieldset className={s.grupo}>
          <legend>Herramientas y canales</legend>
          <div className={s.grillaCampos}>
            {texto('pasarela', 'Plataforma de cobro', undefined, 'Por ejemplo, Stripe')}
            {texto('firma', 'Plataforma de firma', undefined, 'Por ejemplo, ZapSign')}
            {texto('herramienta', 'Registro de llamadas', undefined, 'Por ejemplo, Fathom')}
            {texto('canal', 'Canal oficial de legales', 'Donde se derivan reclamos y pedidos formales.', 'Por ejemplo, legales@empresa.com')}
          </div>
        </fieldset>

        <fieldset className={s.grupo}>
          <legend>Nicho</legend>
          <Opciones nombre="Nicho" valor={config.nicho} opciones={NICHO_OPCIONES} onChange={(v) => actualizar('nicho', v)} />
        </fieldset>
      </form>

      <dl className={s.resumenImpresion}>
        <div>
          <dt>Empresa</dt>
          <dd>{plano('{empresa}')}</dd>
        </div>
        <div>
          <dt>Programa</dt>
          <dd>{plano('{programa}, {duracion}')}</dd>
        </div>
        <div>
          <dt>Precio</dt>
          <dd>{plano('{precio}, {opcionesPago}')}</dd>
        </div>
        <div>
          <dt>Devoluciones</dt>
          <dd>
            Variante {variante}. {plano('{politicaCorta}')}
          </dd>
        </div>
        {config.usaReserva && (
          <div>
            <dt>Reserva</dt>
            <dd>{plano('{reserva}, saldo en {saldoPlazo}')}</dd>
          </div>
        )}
        <div>
          <dt>Herramientas</dt>
          <dd>{plano('{pasarela}, {firma}, {herramienta}')}</dd>
        </div>
      </dl>
    </div>
  );
}

function BloqueGuion({ b }: { b: Bloque }) {
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
          <BotonCopiar texto={() => plano(b.texto)} etiqueta="Copiar guion" />
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

function Guiones({ guiones }: { guiones: Guion[] }) {
  const [activo, setActivo] = useState(guiones[0]?.id ?? '');
  const base = useId().replace(/[^a-zA-Z0-9]/g, '');
  const botones = useRef<(HTMLButtonElement | null)[]>([]);

  const alTeclado = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = guiones.findIndex((g) => g.id === activo);
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
      <div className={`${s.pestanasLista} ${s.noImprimir}`} role="tablist" aria-label="Guiones por tema" aria-orientation="vertical" onKeyDown={alTeclado}>
        {guiones.map((g, i) => (
          <button
            key={g.id}
            ref={(el) => {
              botones.current[i] = el;
            }}
            type="button"
            role="tab"
            id={`${base}-tab-${g.id}`}
            aria-selected={activo === g.id}
            aria-controls={`${base}-panel-${g.id}`}
            tabIndex={activo === g.id ? 0 : -1}
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
            hidden={activo !== g.id}
            className={s.pestanaPanel}
            tabIndex={0}
          >
            <h3 className={s.guionTitulo}>{g.titulo}</h3>
            <p className={s.guionBajada}>{g.bajada}</p>
            <div className={s.pilaBloques}>
              {g.bloques.map((b, i) => (
                <BloqueGuion key={`${g.id}-${i}`} b={b} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Repaso({ items, copiarTodo }: { items: ItemRepaso[]; copiarTodo: () => string }) {
  const [marcados, setMarcados] = useState<Record<string, boolean>>({});
  const hechos = items.filter((it) => marcados[it.id]).length;
  const completo = hechos === items.length;
  return (
    <div className={`${s.tarjeta} ${s.repaso}`}>
      <div className={s.repasoCabecera}>
        <p className={s.repasoProgreso} data-completo={completo} aria-live="polite">
          {completo ? 'Repaso completo. Ahora sí, link de pago.' : `${hechos} de ${items.length} confirmados`}
        </p>
        <div className={`${s.repasoAcciones} ${s.noImprimir}`}>
          <BotonCopiar texto={copiarTodo} etiqueta="Copiar repaso" variante="texto" />
          <button type="button" className={s.boton} onClick={() => setMarcados({})}>
            Reiniciar
          </button>
        </div>
      </div>
      <p className={s.repasoLinea}>
        <span className={s.repasoRotulo}>Abrir</span>
        <Tx t={REPASO_APERTURA} />
      </p>
      <ol className={s.repasoLista}>
        {items.map((it) => (
          <li key={it.id} className={s.repasoItem} data-marcado={!!marcados[it.id]}>
            <label>
              <input type="checkbox" checked={!!marcados[it.id]} onChange={(e) => setMarcados((m) => ({ ...m, [it.id]: e.target.checked }))} />
              <span className={s.repasoCaja} aria-hidden="true" />
              <span className={s.repasoContenido}>
                <span className={s.repasoTitulo}>{it.titulo}</span>
                <span className={s.repasoTexto}>
                  <Tx t={it.texto} />
                </span>
              </span>
            </label>
          </li>
        ))}
      </ol>
      <p className={s.repasoLinea}>
        <span className={s.repasoRotulo}>Cerrar</span>
        <Tx t={REPASO_CIERRE} />
      </p>
      <p className={s.aclaracion}>Si el prospecto no aceptó el registro, este repaso se hace por escrito y se espera su respuesta antes de enviar el link.</p>
    </div>
  );
}

function Scorecard({ usaReserva }: { usaReserva: boolean }) {
  const [marcados, setMarcados] = useState<Record<string, boolean>>({});
  const items = CONTROL.filter((it) => !(it.opcional && !usaReserva));
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
            <input type="checkbox" checked={!!marcados[it.id]} onChange={(e) => setMarcados((m) => ({ ...m, [it.id]: e.target.checked }))} />
            <span className={s.repasoCaja} aria-hidden="true" />
            <span>{it.texto}</span>
          </label>
        </li>
      ))}
    </ul>
  );

  return (
    <div className={`${s.tarjeta} ${s.control}`}>
      <div className={s.controlCabecera}>
        <h3 className={s.h3}>Scorecard de la llamada</h3>
        <div className={s.controlResultado} data-estado={estado} aria-live="polite">
          {estado === 'vacio' && 'Marcá lo que se cumplió en la llamada'}
          {estado === 'conforme' && `Conforme · estándar ${estandarOk} de ${estandar.length} (${pct}%)`}
          {estado === 'no' && 'No conforme · falta al menos un ítem crítico'}
        </div>
      </div>
      <div className={s.dosColumnas}>
        <div>
          <p className={s.controlGrupo}>Críticos</p>
          {lista(criticos)}
        </div>
        <div>
          <p className={s.controlGrupo}>Estándar</p>
          {lista(estandar)}
        </div>
      </div>
      <div className={s.noImprimir}>
        <button type="button" className={s.boton} onClick={() => setMarcados({})}>
          Reiniciar scorecard
        </button>
      </div>
    </div>
  );
}

function TarjetaBolsillo({ repaso, usaCuotas, usaReserva }: { repaso: ItemRepaso[]; usaCuotas: boolean; usaReserva: boolean }) {
  return (
    <div className={s.bolsillo}>
      <div className={s.bolsilloBloque}>
        <p className={s.bolsilloRotulo}>Al empezar</p>
        <p className={s.bolsilloCita}>«Te cuento que la llamada queda registrada así tenemos respaldo de todo lo que hablemos. ¿Estás de acuerdo?»</p>
      </div>
      <div className={`${s.bolsilloBloque} ${s.bolsilloNunca}`}>
        <p className={s.bolsilloRotulo}>Tres nunca</p>
        <ul>
          <li>Nunca prometas resultados ni ingresos.</li>
          <li>Nunca digas algo que el contrato no dice.</li>
          <li>Nunca tomes datos de tarjeta en la llamada.</li>
        </ul>
      </div>
      <div className={s.bolsilloBloque}>
        <p className={s.bolsilloRotulo}>Antes del link de pago, {repaso.length} síes</p>
        <ol>
          <li>
            Precio total <Tx t="{precio}" /> y modalidad elegida.
          </li>
          {usaCuotas && <li>Las cuotas pagan un precio total, no son una suscripción.</li>}
          <li>
            Devoluciones, <Tx t="{politicaMini}" />.
          </li>
          <li>Los resultados dependen de la implementación.</li>
          {usaReserva && (
            <li>
              Reserva de <Tx t="{reserva}" />, saldo en <Tx t="{saldoPlazo}" />.
            </li>
          )}
          <li>Contrato y términos por correo, leerlos antes de pagar.</li>
        </ol>
      </div>
      <div className={s.bolsilloFila}>
        <div className={s.bolsilloBloque}>
          <p className={s.bolsilloRotulo}>Si dudás</p>
          <p>Escalá. Una venta postergada cuesta menos que un reclamo.</p>
        </div>
        <div className={s.bolsilloBloque}>
          <p className={s.bolsilloRotulo}>Después</p>
          <p>Correo de confirmación y CRM dentro de las 24 horas.</p>
        </div>
      </div>
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

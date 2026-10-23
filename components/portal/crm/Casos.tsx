import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ExternalLink, Plus, Trash2 } from 'lucide-react';
import { Button } from '../../Button';
import { supabase } from '../supabase';
import { navegar } from '../navegacion';
import { Aviso, Campo, Cifras, Encabezado, Enlace, Etiqueta, Pestanas, TituloSeccion, claseInput, type Cifra } from '../ui';
import { useVistaPrevia } from '../vistaPrevia';
import { dinero, fecha, hoyISO } from './tipos';
import {
  AYUDA_SEMAFORO,
  CANALES_SUGERIDOS,
  CAUSAS,
  DECISIONES,
  ETAPAS,
  RESULTADOS,
  ROTULO_CAUSA,
  ROTULO_DECISION,
  ROTULO_ETAPA,
  ROTULO_RESULTADO,
  ROTULO_SEMAFORO,
  SEMAFOROS,
  TONO_ETAPA,
  borradorDe,
  borradorNuevo,
  calcularIndicadores,
  cantidad,
  datosDe,
  HISTORICO,
  diasAbierto,
  enLegales,
  mensajeError,
  normalizarCaso,
  numero,
  ordenarCasos,
  porcentaje,
  validarBorrador,
  type Alta,
  type Borrador,
  type Caso,
  type CasoAbierto,
  type Causa,
  type ClienteDelCaso,
  type Decision,
  type Etapa,
  type ResultadoContracargo,
  type Semaforo,
} from './reglasCasos';

/**
 * Casos de conflicto del CRM. Registro de reclamos y pedidos de reembolso de
 * cada cliente final, con los indicadores del tablero del protocolo de conflictos.
 *   /portal/crm/casos              tablero y registro histórico
 *   /portal/crm/casos?cliente=<id> abre un caso nuevo con ese cliente
 *   /portal/crm/casos?caso=<id>    abre ese caso para editarlo
 */

const SELECT_CASO = '*, cliente:crm_clientes(id, nombre, codigo, moneda)';

const ESTILO_SEMAFORO: Record<Semaforo, string> = {
  verde: 'text-bosque bg-[#E4E9E3]',
  ambar: 'text-[#85621a] bg-[#f6ecd2]',
  rojo: 'text-[#8a2b20] bg-[#f6e7e4]',
};

const PUNTO_SEMAFORO: Record<Semaforo, string> = {
  verde: 'bg-bosque',
  ambar: 'bg-[#85621a]',
  rojo: 'bg-[#8a2b20]',
};

const claseEtiqueta = 'block text-[11px] font-medium uppercase tracking-[0.16em] text-piedra mb-2';
const claseSelectorEncabezado = 'h-12 pl-3.5 pr-10 bg-white border border-tinta font-medium text-[15px] focus:outline-none focus:ring-1 focus:ring-bosque';
const filete = { borderTop: '1px solid rgba(27,31,27,0.15)' };

type Filtro = 'abiertos' | 'cerrados' | 'todos';

const FILTROS: { clave: Filtro; titulo: string }[] = [
  { clave: 'abiertos', titulo: 'Abiertos' },
  { clave: 'cerrados', titulo: 'Cerrados' },
  { clave: 'todos', titulo: 'Todos' },
];

const DEFINICIONES: [string, string][] = [
  ['Abiertos hoy', 'Casos en curso hoy.'],
  ['Reclamos cada 100 ventas', 'Casos abiertos sobre clientes dados de alta en el CRM, por cien. Todo el historial.'],
  ['Resueltos antes de legales', 'Cerrados sin derivación, sobre el total de cerrados.'],
  ['Tiempo medio', 'Días entre la apertura y el cierre de los casos cerrados.'],
  ['Costo de concesiones', 'Monto concedido en los casos cerrados sobre el monto de todas las altas, en la moneda de cada cliente.'],
  ['Contracargos', 'Casos con contracargo y el porcentaje ganado sobre los recibidos.'],
  ['Causas raíz', 'Casos según su causa.'],
];

/** Cuántos casos se ven por página en el registro. */
const LIMITES = [10, 20, 30];

export const EtiquetaSemaforo: React.FC<{ nivel: Semaforo }> = ({ nivel }) => (
  <span className={`inline-flex items-center gap-1.5 px-2 py-1 text-[11px] font-medium uppercase tracking-[0.12em] whitespace-nowrap ${ESTILO_SEMAFORO[nivel]}`}>
    <span aria-hidden="true" className="w-1.5 h-1.5 rounded-full bg-current" />
    {ROTULO_SEMAFORO[nivel]}
  </span>
);

/** Unidad chica al lado de una cifra grande, como la moneda del contador. */
const Unidad: React.FC<{ children: React.ReactNode; antes?: boolean }> = ({ children, antes }) => (
  <span className={`text-[0.48em] font-bold text-piedra tracking-normal ${antes ? 'mr-1.5 align-[0.3em]' : 'ml-1.5'}`}>{children}</span>
);

/* ------------------------------------------------------------------ */
/* Tabla de casos, en el registro y en la ficha del cliente             */
/* ------------------------------------------------------------------ */
export const TablaCasos: React.FC<{ casos: Caso[]; hoy: string; conCliente?: boolean; moneda?: string; vacio: string; alElegir: (c: Caso) => void }> = ({
  casos,
  hoy,
  conCliente = false,
  moneda = 'USD',
  vacio,
  alElegir,
}) => (
  <div className="overflow-x-auto">
    <table className={`tabla ${conCliente ? 'min-w-[1000px]' : 'min-w-[820px]'}`}>
      <thead>
        <tr>
          {conCliente && <th>Cliente</th>}
          <th>Apertura</th>
          <th>Etapa</th>
          <th>Semáforo</th>
          <th>Causa</th>
          <th className="num">Reclamado</th>
          <th>Decisión</th>
          <th className="num">Días abierto</th>
        </tr>
      </thead>
      <tbody>
        {casos.length === 0 && (
          <tr>
            <td colSpan={conCliente ? 8 : 7} className="text-piedra py-10">
              {vacio}
            </td>
          </tr>
        )}
        {casos.map((c) => {
          const mon = c.cliente?.moneda ?? moneda;
          const elegir = (e: React.MouseEvent) => {
            e.stopPropagation();
            alElegir(c);
          };
          return (
            <tr key={c.id} className="fila-link" onClick={() => alElegir(c)}>
              {conCliente && (
                <td className="min-w-[160px]">
                  <button type="button" onClick={elegir} className="font-heading font-bold text-[16px] leading-tight text-left hover:text-bosque">
                    {c.cliente?.nombre ?? 'Cliente'}
                  </button>
                  {c.cliente?.codigo && <div className="text-xs text-piedra mt-1 tabular-nums">{c.cliente.codigo}</div>}
                </td>
              )}
              <td className="whitespace-nowrap">
                {conCliente ? (
                  <span className="tabular-nums">{fecha(c.abierto_en)}</span>
                ) : (
                  <button type="button" onClick={elegir} className="font-medium tabular-nums hover:text-bosque">
                    {fecha(c.abierto_en)}
                  </button>
                )}
                {c.canal && <div className="text-xs text-piedra mt-1">{c.canal}</div>}
              </td>
              <td>
                <Etiqueta tono={TONO_ETAPA[c.etapa]}>{ROTULO_ETAPA[c.etapa]}</Etiqueta>
                {c.contracargo && <div className="text-xs text-piedra mt-1.5">Contracargo {ROTULO_RESULTADO[c.contracargo_resultado ?? 'pendiente'].toLowerCase()}</div>}
              </td>
              <td>
                <EtiquetaSemaforo nivel={c.semaforo} />
              </td>
              <td className="min-w-[120px]">{ROTULO_CAUSA[c.causa]}</td>
              <td className="num">{c.monto_reclamado === null ? '·' : dinero(c.monto_reclamado, mon)}</td>
              <td className="min-w-[120px]">
                {c.decision ? ROTULO_DECISION[c.decision] : <span className="text-piedra">Sin decisión</span>}
                {c.monto_concedido > 0 && <div className="text-xs text-piedra mt-1 tabular-nums">Concedido {dinero(c.monto_concedido, mon)}</div>}
              </td>
              <td className="num">{diasAbierto(c, hoy)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  </div>
);

/* ------------------------------------------------------------------ */
/* Sección de la ficha del cliente                                     */
/* ------------------------------------------------------------------ */
export const CasosCliente: React.FC<{ clienteId: string; moneda: string; soloLectura: boolean; alContar?: (abiertos: number) => void }> = ({ clienteId, moneda, soloLectura, alContar }) => {
  const [casos, setCasos] = useState<Caso[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) return;
    let vigente = true;
    supabase
      .from('crm_casos')
      .select('*')
      .eq('cliente_id', clienteId)
      .order('abierto_en', { ascending: false })
      .then(({ data, error: e }) => {
        if (!vigente) return;
        const lista = ((data as Caso[] | null) ?? []).map(normalizarCaso);
        setError(e ? mensajeError(e) : null);
        setCasos(lista);
        alContar?.(lista.filter((c) => c.etapa !== 'cerrado').length);
      });
    return () => {
      vigente = false;
    };
  }, [clienteId]); // eslint-disable-line react-hooks/exhaustive-deps

  const enCurso = (casos ?? []).filter((c) => c.etapa !== 'cerrado');

  return (
    <section>
      <TituloSeccion
        eyebrow="Conflictos"
        titulo="Casos de conflicto"
        acciones={
          soloLectura ? undefined : (
            <Button variant="ghost" size="sm" onClick={() => navegar(`/portal/crm/casos?cliente=${clienteId}`)}>
              <Plus size={16} /> Abrir un caso
            </Button>
          )
        }
      />
      <div className="flex flex-col gap-5">
        {error && <Aviso tipo="error">{error}</Aviso>}
        {enCurso.some((c) => enLegales(c.etapa)) && (
          <Aviso tipo="error">
            <strong className="font-medium">Caso en legales.</strong> Desde la derivación nadie fuera de legales responde sobre el reclamo, por ningún canal.
          </Aviso>
        )}
        {casos === null ? (
          <p className="eyebrow text-piedra">Cargando</p>
        ) : casos.length === 0 ? (
          !error && (
            <p className="text-sm text-piedra max-w-[64ch]">
              Sin casos registrados. Si el cliente plantea una disconformidad o pide un reembolso, abrí un caso para seguirlo con el protocolo de conflictos.
            </p>
          )
        ) : (
          <TablaCasos casos={casos} hoy={hoyISO()} moneda={moneda} vacio="" alElegir={(c) => navegar(`/portal/crm/casos?caso=${c.id}`)} />
        )}
      </div>
    </section>
  );
};

/* ------------------------------------------------------------------ */
/* Pantalla de casos                                                    */
/* ------------------------------------------------------------------ */
export const Casos: React.FC<{ orgId: string; orgNombre: string; puedeGestionar: boolean; selector?: React.ReactNode; cambiarOrg?: (id: string) => void }> = ({
  orgId,
  orgNombre,
  puedeGestionar,
  selector,
  cambiarOrg,
}) => {
  const hoy = hoyISO();
  const mes = HISTORICO;
  const [limite, setLimite] = useState(10);
  const [pagina, setPagina] = useState(0);
  const [casos, setCasos] = useState<Caso[]>([]);
  const [abiertos, setAbiertos] = useState<CasoAbierto[]>([]);
  const [altas, setAltas] = useState<Alta[]>([]);
  const [clientes, setClientes] = useState<ClienteDelCaso[]>([]);
  const [precargado, setPrecargado] = useState<ClienteDelCaso | null>(null);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<Filtro>('abiertos');
  const [borrador, setBorrador] = useState<Borrador | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [version, setVersion] = useState(0);
  const formulario = useRef<HTMLFormElement>(null);
  const soloLectura = Boolean(useVistaPrevia());

  // Todos los casos, los que siguen en curso y todas las altas del CRM: la vista es histórica.
  useEffect(() => {
    if (!supabase) return;
    let vigente = true;
    setCargando(true);
    void Promise.all([
      supabase.from('crm_casos').select(SELECT_CASO).eq('organizacion_id', orgId),
      supabase.from('crm_casos').select('id, etapa, semaforo').eq('organizacion_id', orgId).neq('etapa', 'cerrado'),
      supabase.from('crm_clientes').select('moneda, monto_total').eq('organizacion_id', orgId),
    ]).then(([p, a, v]) => {
      if (!vigente) return;
      const fallo = p.error ?? a.error ?? v.error;
      setErrorCarga(fallo ? mensajeError(fallo) : null);
      setCasos(((p.data as Caso[] | null) ?? []).map(normalizarCaso));
      setAbiertos((a.data as CasoAbierto[] | null) ?? []);
      setAltas(((v.data as Alta[] | null) ?? []).map((x) => ({ moneda: x.moneda, monto_total: x.monto_total === null ? null : Number(x.monto_total) })));
      setCargando(false);
    });
    return () => {
      vigente = false;
    };
  }, [orgId, version]); // eslint-disable-line react-hooks/exhaustive-deps

  // Clientes de la empresa para el formulario.
  useEffect(() => {
    if (!supabase) return;
    let vigente = true;
    supabase
      .from('crm_clientes')
      .select('id, nombre, codigo, moneda')
      .eq('organizacion_id', orgId)
      .order('nombre')
      .then(({ data }) => {
        if (vigente) setClientes((data as ClienteDelCaso[] | null) ?? []);
      });
    return () => {
      vigente = false;
    };
  }, [orgId]);

  // Enlaces desde la ficha. Un caso nuevo con el cliente precargado o un caso existente.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const casoId = q.get('caso');
    const clienteId = q.get('cliente');
    if (!supabase || (!casoId && !clienteId)) return;
    window.history.replaceState(window.history.state, '', '/portal/crm/casos');
    if (casoId) {
      supabase
        .from('crm_casos')
        .select(SELECT_CASO)
        .eq('id', casoId)
        .maybeSingle()
        .then(({ data }) => {
          if (!data) return setError('No existe ese caso o no tenés acceso.');
          const c = normalizarCaso(data as Caso);
          if (c.organizacion_id !== orgId) cambiarOrg?.(c.organizacion_id);
          if (c.cliente) setPrecargado(c.cliente);
          abrir(borradorDe(c));
        });
    } else if (clienteId) {
      supabase
        .from('crm_clientes')
        .select('id, nombre, codigo, moneda, organizacion_id')
        .eq('id', clienteId)
        .maybeSingle()
        .then(({ data }) => {
          if (!data) return setError('No existe ese cliente o no tenés acceso.');
          const cl = data as ClienteDelCaso;
          if (cl.organizacion_id && cl.organizacion_id !== orgId) cambiarOrg?.(cl.organizacion_id);
          setPrecargado(cl);
          abrir(borradorNuevo(hoyISO(), cl.id));
        });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function abrir(b: Borrador) {
    setBorrador(b);
    setError(null);
    setOk(null);
    requestAnimationFrame(() => formulario.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

  const cerrar = () => {
    setBorrador(null);
    setError(null);
  };

  const cambiar = (cambios: Partial<Borrador>) => setBorrador((b) => (b ? { ...b, ...cambios } : b));

  // Al cerrar se propone la fecha de hoy. Al reabrir se borra la fecha de cierre.
  function cambiarEtapa(etapa: Etapa) {
    setBorrador((b) => (b ? { ...b, etapa, cerrado_en: etapa === 'cerrado' ? b.cerrado_en || hoyISO() : '', derivado_legales: b.derivado_legales || enLegales(etapa) } : b));
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase || !borrador) return;
    const problema = validarBorrador(borrador, hoyISO());
    if (problema) return setError(problema);
    setGuardando(true);
    setError(null);
    setOk(null);
    const datos = datosDe(borrador);
    const { error: err } = borrador.id ? await supabase.from('crm_casos').update(datos).eq('id', borrador.id) : await supabase.from('crm_casos').insert(datos);
    setGuardando(false);
    if (err) return setError(mensajeError(err));
    setOk(borrador.id ? 'Caso actualizado.' : 'Caso registrado. Ya cuenta en los indicadores y tiene su asunto en Estado de asuntos.');
    setBorrador(null);
    setVersion((n) => n + 1);
  }

  async function borrar() {
    if (!supabase || !borrador?.id) return;
    if (!window.confirm('¿Eliminar este caso? Deja de contar en los indicadores y la baja queda en el historial del cliente.')) return;
    const { error: err } = await supabase.from('crm_casos').delete().eq('id', borrador.id);
    if (err) return setError(mensajeError(err));
    setOk('Caso eliminado.');
    setBorrador(null);
    setVersion((n) => n + 1);
  }

  // Indicadores de todo el historial.
  const ind = useMemo(() => calcularIndicadores(casos, abiertos, altas, mes), [casos, abiertos, altas, mes]);
  const unaMoneda = ind.concesiones.length === 1 ? ind.concesiones[0] : null;
  const costo: Cifra =
    ind.concesiones.length === 0
      ? { titulo: 'Costo de concesiones', valor: '·', nota: 'Sin altas cargadas' }
      : unaMoneda
        ? {
            titulo: 'Costo de concesiones',
            valor: unaMoneda.pct === null ? '·' : porcentaje(unaMoneda.pct),
            nota:
              unaMoneda.altas > 0
                ? `${dinero(unaMoneda.concedido, unaMoneda.moneda)} sobre ${dinero(unaMoneda.altas, unaMoneda.moneda)} vendidos`
                : `${dinero(unaMoneda.concedido, unaMoneda.moneda)} concedidos, sin altas cargadas`,
          }
        : {
            titulo: 'Costo de concesiones',
            valor: (
              <span className="flex flex-col gap-1.5">
                {ind.concesiones.map((x) => (
                  <span key={x.moneda}>
                    <Unidad antes>{x.moneda}</Unidad>
                    {x.pct === null ? '·' : porcentaje(x.pct)}
                  </span>
                ))}
              </span>
            ),
            nota: 'Por moneda, sin convertir',
          };

  const items: Cifra[] = [
    {
      titulo: 'Abiertos hoy',
      valor: ind.abiertosHoy,
      alerta: ind.enRojo > 0,
      nota: [ind.enRojo ? `${ind.enRojo} en rojo` : '', ind.enLegales ? `${ind.enLegales} en legales o difusión` : ''].filter(Boolean).join(', ') || (ind.abiertosHoy ? 'Ninguno en rojo' : 'Sin casos en curso'),
    },
    {
      titulo: 'Reclamos cada 100 ventas',
      valor: ind.tasaReclamos === null ? '·' : numero(ind.tasaReclamos),
      nota: ind.ventasMes
        ? `${cantidad(ind.reclamosMes, 'reclamo', 'reclamos')} sobre ${cantidad(ind.ventasMes, 'alta', 'altas')}`
        : `${cantidad(ind.reclamosMes, 'reclamo', 'reclamos')}, sin altas cargadas`,
    },
    {
      titulo: 'Resueltos antes de legales',
      valor: ind.resueltosAntes === null ? '·' : porcentaje(ind.resueltosAntes),
      nota: ind.cerradosMes ? `${ind.sinDerivacion} de ${cantidad(ind.cerradosMes, 'cerrado', 'cerrados')}` : 'Sin casos cerrados',
    },
    {
      titulo: 'Tiempo medio de resolución',
      valor:
        ind.tiempoMedio === null ? (
          '·'
        ) : (
          <>
            {numero(ind.tiempoMedio)}
            <Unidad>{numero(ind.tiempoMedio) === '1' ? 'día' : 'días'}</Unidad>
          </>
        ),
      nota: ind.cerradosMes ? `De la apertura al cierre, ${cantidad(ind.cerradosMes, 'caso', 'casos')}` : 'Sin casos cerrados',
    },
    costo,
    {
      titulo: 'Contracargos',
      valor: ind.contracargos,
      alerta: ind.contracargosPerdidos > 0,
      nota: ind.contracargos
        ? [`${porcentaje(ind.pctGanados ?? 0)} ganados`, ind.contracargosPendientes ? cantidad(ind.contracargosPendientes, 'pendiente', 'pendientes') : ''].filter(Boolean).join(', ')
        : 'Sin contracargos',
    },
  ];

  const maximo = Math.max(1, ...ind.causas.map((x) => x.cantidad));
  const ordenados = useMemo(() => ordenarCasos(casos), [casos]);
  const pasa = (c: Caso, f: Filtro) => f === 'todos' || (f === 'abiertos' ? c.etapa !== 'cerrado' : c.etapa === 'cerrado');
  const filtrados = ordenados.filter((c) => pasa(c, filtro));
  const paginas = Math.max(1, Math.ceil(filtrados.length / limite));
  const paginaActual = Math.min(pagina, paginas - 1);
  const visibles = filtrados.slice(paginaActual * limite, paginaActual * limite + limite);

  const opciones = precargado && !clientes.some((c) => c.id === precargado.id) ? [...clientes, precargado] : clientes;
  const clienteElegido = borrador ? (opciones.find((c) => c.id === borrador.cliente_id) ?? null) : null;
  const moneda = clienteElegido?.moneda ?? 'USD';

  return (
    <>
      <Encabezado
        eyebrow={
          <Enlace a="/portal/crm" className="inline-flex items-center gap-1.5 hover:text-bosque">
            <ArrowLeft size={13} aria-hidden="true" /> {orgNombre || 'CRM'}
          </Enlace>
        }
        titulo={
          <>
            Casos de <span className="text-bosque">conflicto</span>
          </>
        }
        bajada={`Indicadores del protocolo y seguimiento de los reembolsos y contracargos de ${orgNombre || 'la empresa'}. Cada caso tiene su asunto, con el chat y los documentos.`}
        acciones={
          <>
            {selector}
            {!soloLectura && (
              <Button size="lg" className="self-end" onClick={() => abrir(borradorNuevo(hoyISO()))}>
                <Plus size={18} /> Nuevo caso
              </Button>
            )}
          </>
        }
      />

      <div className="wrap py-10 desk:py-14 flex flex-col gap-14">
        {(errorCarga || ok || (!borrador && error)) && (
          <div className="flex flex-col gap-3 -mb-6">
            {errorCarga && <Aviso tipo="error">{errorCarga}</Aviso>}
            {ok && <Aviso tipo="ok">{ok}</Aviso>}
            {!borrador && error && <Aviso tipo="error">{error}</Aviso>}
          </div>
        )}

        {borrador && (
          <form ref={formulario} onSubmit={guardar} className="bg-marfil-oscuro p-6 desk:p-8 flex flex-col gap-8" style={{ scrollMarginTop: 120 }}>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="flex flex-col gap-2">
                <p className="eyebrow text-piedra">{borrador.id ? 'Editar caso' : 'Nuevo caso'}</p>
                <h2 className="h3">{clienteElegido ? clienteElegido.nombre : 'Reclamo o pedido de reembolso'}</h2>
              </div>
              <div className="flex flex-wrap gap-x-6 gap-y-2">
                {borrador.asunto_id && (
                  <Enlace a={`/portal/asuntos/${borrador.asunto_id}`} className="text-sm font-medium underline underline-offset-4 hover:text-bosque">
                    Ver el asunto, con el chat y los documentos
                  </Enlace>
                )}
                {borrador.cliente_id && (
                  <Enlace a={`/portal/crm/${borrador.cliente_id}`} className="text-sm font-medium underline underline-offset-4 hover:text-bosque">
                    Ver la ficha del cliente
                  </Enlace>
                )}
              </div>
            </div>

            <fieldset disabled={soloLectura} className="flex flex-col gap-8 min-w-0">
              <div className="grid gap-5 tab:grid-cols-2 desk:grid-cols-3">
                <Campo etiqueta="Cliente">
                  <select required className={claseInput} value={borrador.cliente_id} onChange={(e) => cambiar({ cliente_id: e.target.value })}>
                    <option value="">Elegí</option>
                    {opciones.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nombre}
                        {c.codigo ? ` · ${c.codigo}` : ''}
                      </option>
                    ))}
                  </select>
                </Campo>
                <Campo etiqueta="Apertura">
                  <input type="date" required max={hoy} className={claseInput} value={borrador.abierto_en} onChange={(e) => cambiar({ abierto_en: e.target.value })} />
                </Campo>
                <Campo etiqueta="Causa">
                  <select required className={claseInput} value={borrador.causa} onChange={(e) => cambiar({ causa: e.target.value as Causa | '' })}>
                    <option value="">Elegí</option>
                    {CAUSAS.map((k) => (
                      <option key={k} value={k}>
                        {ROTULO_CAUSA[k]}
                      </option>
                    ))}
                  </select>
                </Campo>
                <Campo etiqueta="Canal" ayuda="Por dónde llegó el reclamo.">
                  <input list="canales-caso" className={claseInput} value={borrador.canal} onChange={(e) => cambiar({ canal: e.target.value })} placeholder="WhatsApp, correo, tarjeta" />
                </Campo>
                <Campo etiqueta={`Monto reclamado (${moneda})`} ayuda="Opcional. Lo que pide el cliente.">
                  <input type="number" min="0" step="0.01" className={claseInput} value={borrador.monto_reclamado} onChange={(e) => cambiar({ monto_reclamado: e.target.value })} />
                </Campo>
                <Campo etiqueta="Responsable">
                  <input className={claseInput} value={borrador.responsable} onChange={(e) => cambiar({ responsable: e.target.value })} placeholder="Quién lleva el caso" />
                </Campo>
              </div>
              <datalist id="canales-caso">
                {CANALES_SUGERIDOS.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>

              <div className="grid gap-6 tab:grid-cols-2 pt-7" style={filete}>
                <p className="tab:col-span-2 eyebrow text-piedra -mb-1">Gestión</p>
                <Campo etiqueta="Etapa">
                  <select className={claseInput} value={borrador.etapa} onChange={(e) => cambiarEtapa(e.target.value as Etapa)}>
                    {ETAPAS.map((k) => (
                      <option key={k} value={k}>
                        {ROTULO_ETAPA[k]}
                      </option>
                    ))}
                  </select>
                </Campo>
                <div>
                  <span className={claseEtiqueta} id="caso-semaforo">
                    Semáforo de la compuerta legal
                  </span>
                  <div className="flex" role="group" aria-labelledby="caso-semaforo">
                    {SEMAFOROS.map((s) => {
                      const activo = borrador.semaforo === s;
                      return (
                        <button
                          key={s}
                          type="button"
                          aria-pressed={activo}
                          onClick={() => cambiar({ semaforo: s })}
                          className={`flex-1 h-12 px-3 -ml-px first:ml-0 inline-flex items-center justify-center gap-2 text-sm font-medium border transition-colors duration-150 ${
                            activo ? `${ESTILO_SEMAFORO[s]} border-current relative z-10` : 'bg-white text-piedra border-[rgba(27,31,27,0.22)] hover:text-tinta'
                          }`}
                        >
                          <span aria-hidden="true" className={`w-2 h-2 rounded-full ${PUNTO_SEMAFORO[s]}`} />
                          {ROTULO_SEMAFORO[s]}
                        </button>
                      );
                    })}
                  </div>
                  <span className="block text-xs text-piedra mt-1.5">{AYUDA_SEMAFORO[borrador.semaforo]}</span>
                </div>
                <label className="flex items-start gap-2.5 text-sm">
                  <input
                    type="checkbox"
                    className="w-4 h-4 mt-0.5 accent-[#173A2F]"
                    checked={borrador.derivado_legales || enLegales(borrador.etapa)}
                    disabled={enLegales(borrador.etapa)}
                    onChange={(e) => cambiar({ derivado_legales: e.target.checked })}
                  />
                  <span>
                    Derivado a legales
                    <span className="block text-xs text-piedra mt-0.5">
                      {enLegales(borrador.etapa) ? 'En legales o en difusión pública el caso ya está derivado.' : 'Queda marcado aunque después se cierre. Define los resueltos antes de legales.'}
                    </span>
                  </span>
                </label>
                <div className="flex flex-col gap-4">
                  <label className="flex items-start gap-2.5 text-sm">
                    <input type="checkbox" className="w-4 h-4 mt-0.5 accent-[#173A2F]" checked={borrador.contracargo} onChange={(e) => cambiar({ contracargo: e.target.checked })} />
                    <span>
                      Hubo contracargo
                      <span className="block text-xs text-piedra mt-0.5">Disputa del cliente ante la tarjeta o el banco.</span>
                    </span>
                  </label>
                  {borrador.contracargo && (
                    <Campo etiqueta="Resultado del contracargo">
                      <select className={claseInput} value={borrador.contracargo_resultado} onChange={(e) => cambiar({ contracargo_resultado: e.target.value as ResultadoContracargo })}>
                        {RESULTADOS.map((k) => (
                          <option key={k} value={k}>
                            {ROTULO_RESULTADO[k]}
                          </option>
                        ))}
                      </select>
                    </Campo>
                  )}
                </div>
              </div>

              <div className="grid gap-5 tab:grid-cols-3 pt-7" style={filete}>
                <p className="tab:col-span-3 eyebrow text-piedra -mb-1">Resultado</p>
                <Campo etiqueta="Decisión" ayuda="Obligatoria para cerrar el caso.">
                  <select className={claseInput} value={borrador.decision} onChange={(e) => cambiar({ decision: e.target.value as Decision | '' })}>
                    <option value="">Sin decisión</option>
                    {DECISIONES.map((k) => (
                      <option key={k} value={k}>
                        {ROTULO_DECISION[k]}
                      </option>
                    ))}
                  </select>
                </Campo>
                <Campo etiqueta={`Monto concedido (${moneda})`} ayuda="Devoluciones, descuentos o bonificaciones acordadas.">
                  <input type="number" min="0" step="0.01" placeholder="0" className={claseInput} value={borrador.monto_concedido} onChange={(e) => cambiar({ monto_concedido: e.target.value })} />
                </Campo>
                {borrador.etapa === 'cerrado' ? (
                  <Campo etiqueta="Fecha de cierre">
                    <input type="date" min={borrador.abierto_en} max={hoy} className={claseInput} value={borrador.cerrado_en} onChange={(e) => cambiar({ cerrado_en: e.target.value })} />
                  </Campo>
                ) : (
                  <p className="text-xs text-piedra self-center leading-[1.5]">Para cerrar el caso pasalo a la etapa Cerrado y completá la decisión y la fecha de cierre.</p>
                )}
              </div>

              <Campo etiqueta="Notas" ayuda="Cronología, alternativas ofrecidas y respuestas del cliente.">
                <textarea rows={4} className={`${claseInput} h-auto py-3`} value={borrador.notas} onChange={(e) => cambiar({ notas: e.target.value })} />
              </Campo>
            </fieldset>

            {error && <Aviso tipo="error">{error}</Aviso>}

            <div className="flex flex-wrap items-center gap-3">
              {soloLectura ? (
                <Button type="button" variant="ghost" onClick={cerrar}>
                  Cerrar
                </Button>
              ) : (
                <>
                  <Button type="submit" disabled={guardando}>
                    {guardando ? 'Guardando…' : borrador.id ? 'Guardar cambios' : 'Registrar caso'}
                  </Button>
                  <Button type="button" variant="ghost" onClick={cerrar}>
                    Cancelar
                  </Button>
                  {puedeGestionar && borrador.id && (
                    <button
                      type="button"
                      onClick={borrar}
                      className="ml-auto inline-flex items-center gap-2 h-[52px] px-4 text-sm font-medium text-[#8a2b20] transition-colors duration-150 hover:bg-[#f6e7e4]"
                    >
                      <Trash2 size={16} aria-hidden="true" /> Eliminar caso
                    </button>
                  )}
                </>
              )}
            </div>
          </form>
        )}

        <section>
          <TituloSeccion eyebrow="Tablero" titulo="Indicadores históricos" />
          <Cifras cargando={cargando} items={items} />
          <div className="mt-12 grid gap-12 desk:grid-cols-[7fr_5fr] desk:gap-14 items-start">
            <div className="min-w-0">
              <h3 className="eyebrow text-piedra mb-5">Causas raíz</h3>
              {cargando ? (
                <p className="eyebrow text-piedra">Cargando</p>
              ) : ind.causas.length === 0 ? (
                <p className="text-sm text-piedra">Sin reclamos registrados.</p>
              ) : (
                <ol className="flex flex-col gap-4">
                  {ind.causas.map((x) => {
                    const parte = Math.round((x.cantidad / ind.reclamosMes) * 100);
                    return (
                      <li
                        key={x.causa}
                        className="grid grid-cols-[110px_minmax(0,1fr)_auto] tab:grid-cols-[200px_minmax(0,1fr)_auto] items-center gap-4 text-sm"
                        title={`${ROTULO_CAUSA[x.causa]}, ${cantidad(x.cantidad, 'caso', 'casos')}, ${parte}% de los reclamos`}
                      >
                        <span className="font-medium leading-tight">{ROTULO_CAUSA[x.causa]}</span>
                        <span className="h-2.5 bg-marfil-oscuro" aria-hidden="true">
                          <span className="block h-2.5 bg-bosque" style={{ width: `${(x.cantidad / maximo) * 100}%` }} />
                        </span>
                        <span className="tabular-nums whitespace-nowrap text-piedra">
                          <strong className="font-medium text-tinta">{x.cantidad}</strong> · {parte}%
                        </span>
                      </li>
                    );
                  })}
                </ol>
              )}
              <p className="text-xs text-piedra mt-6">Las dos primeras causas definen dónde se trabaja.</p>
            </div>
            <aside className="panel-carbon p-7 flex flex-col gap-5">
              <h3 className="font-heading font-bold text-[20px] leading-tight">Cómo se calculan</h3>
              <ul className="flex flex-col gap-3 text-sm text-calido leading-[1.55]">
                {DEFINICIONES.map(([titulo, texto]) => (
                  <li key={titulo}>
                    <strong className="font-medium text-marfil">{titulo}.</strong> {texto}
                  </li>
                ))}
              </ul>
              <a
                href="/protocolo-conflictos"
                target="_blank"
                rel="noopener"
                className="self-start inline-flex items-center gap-2 h-11 px-5 bg-marfil text-tinta text-sm font-medium transition-colors duration-150 hover:bg-white"
              >
                Ver el protocolo de conflictos <ExternalLink size={15} aria-hidden="true" />
              </a>
            </aside>
          </div>
        </section>

        <section>
          <TituloSeccion
            eyebrow="Registro"
            titulo="Todos los casos"
            acciones={
              <label className="flex items-center gap-2 text-sm text-piedra">
                Mostrar
                <select
                  className="h-9 px-2 bg-white border border-[rgba(27,31,27,0.25)] text-sm text-tinta"
                  value={limite}
                  onChange={(e) => {
                    setLimite(Number(e.target.value));
                    setPagina(0);
                  }}
                >
                  {LIMITES.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
            }
          />
          <p className="text-sm text-piedra -mt-3 mb-6 max-w-[64ch]">Primero los abiertos, del más urgente al más viejo. Tocá un caso para ver el detalle o actualizarlo.</p>
          <Pestanas<Filtro>
            items={FILTROS.map((f) => ({ ...f, cuenta: cargando ? undefined : casos.filter((c) => pasa(c, f.clave)).length }))}
            activa={filtro}
            alCambiar={(f) => {
              setFiltro(f);
              setPagina(0);
            }}
          />
          <div className="mt-2">
            <TablaCasos casos={visibles} hoy={hoy} conCliente vacio="No hay casos para mostrar con este filtro." alElegir={(c) => abrir(borradorDe(c))} />
          </div>
          {filtrados.length > limite && (
            <div className="mt-5 flex flex-wrap items-center gap-4 text-sm">
              <span className="text-piedra">
                {paginaActual * limite + 1} a {Math.min(filtrados.length, (paginaActual + 1) * limite)} de {filtrados.length}
              </span>
              <Button type="button" size="sm" variant="ghost" disabled={paginaActual === 0} onClick={() => setPagina(paginaActual - 1)}>
                Anteriores
              </Button>
              <Button type="button" size="sm" variant="ghost" disabled={paginaActual >= paginas - 1} onClick={() => setPagina(paginaActual + 1)}>
                Siguientes
              </Button>
            </div>
          )}
        </section>
      </div>
    </>
  );
};

export default Casos;

import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { Chip } from '@heroui/react';
import { supabase } from '../supabase';
import { navegar } from '../navegacion';
import { Enlace } from '../ui';
import { dinero, type ClienteResumen } from './tipos';
import { TIPO_REUNION, type EstadoReunion, type TipoReunion } from './reuniones';
import { ROTULO_CAUSA, type Causa, type Etapa, type Semaforo } from './reglasCasos';

const DIA = 86400000;
/** Desde cuántos días antes del fin se avisa que el contrato vence. */
export const AVISO_VENCE_DIAS = 45;
/** Cuánto se marca como onboarding al principio de cada contrato. */
const ONBOARDING_DIAS = 14;
const MESES_VISIBLES = 12;

// Verde del onboarding, el de las capturas aprobadas.
const verde = '#3f7a5f';
const rayado = 'repeating-linear-gradient(135deg, var(--color-borde-suave) 0 6px, var(--color-separador) 6px 12px)';

/** Fin del contrato: la fecha de onboarding más la duración del servicio. Sin alguna de las dos, no hay fin. */
export function finDelContrato(inicio: string | null | undefined, meses: number | null | undefined): Date | null {
  if (!inicio || !meses) return null;
  const fin = new Date(inicio);
  fin.setMonth(fin.getMonth() + meses);
  return fin;
}

const corta = (d: Date) => d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }).replace('.', '');

/**
 * Orden de la línea de tiempo. Primero los contratos vigentes, por fecha de onboarding; después
 * los que ya terminaron y las bajas, del más reciente al más viejo; al final, los que no tienen
 * fecha. Así la primera página muestra lo que está en curso.
 */
export function ordenTimeline(filas: ClienteResumen[], duracion: (servicio: string | null | undefined) => number | null): ClienteResumen[] {
  const ahora = Date.now();
  const grupo = (c: ClienteResumen) => {
    if (!c.fecha_onboarding) return 2;
    const fin = finDelContrato(c.fecha_onboarding, duracion(c.servicio));
    return c.estado_firma === 'Baja' || (fin && fin.getTime() < ahora) ? 1 : 0;
  };
  const fin = (c: ClienteResumen) => finDelContrato(c.fecha_onboarding, duracion(c.servicio))?.getTime() ?? 0;
  return [...filas].sort((a, b) => {
    const ga = grupo(a);
    const gb = grupo(b);
    if (ga !== gb) return ga - gb;
    if (ga === 1) return fin(b) - fin(a);
    return (a.fecha_onboarding ?? '').localeCompare(b.fecha_onboarding ?? '');
  });
}

/* Marcas de cada cliente: reuniones, cuotas y casos de conflicto. Se piden solo para la página que se ve. */
interface MarcaReunion {
  cliente_id: string;
  inicio: string;
  tipo: TipoReunion | null;
  estado: EstadoReunion;
}
interface MarcaPago {
  cliente_id: string;
  monto: number;
  vencimiento: string | null;
  estado: 'pendiente' | 'pagado';
  fecha_pago: string | null;
}
interface MarcaCaso {
  cliente_id: string;
  abierto_en: string;
  cerrado_en: string | null;
  etapa: Etapa;
  semaforo: Semaforo;
  causa: Causa;
}
interface Marcas {
  reuniones: MarcaReunion[];
  pagos: MarcaPago[];
  casos: MarcaCaso[];
}
const SIN_MARCAS: Marcas = { reuniones: [], pagos: [], casos: [] };

function useMarcas(ids: string[], conPagos: boolean, conCasos: boolean): Marcas {
  const [m, setM] = useState<Marcas>(SIN_MARCAS);
  const clave = ids.join(',');
  useEffect(() => {
    if (!supabase || !ids.length) return setM(SIN_MARCAS);
    let vigente = true;
    // Si una tabla no existe o el rol no la ve, esa fila de marcas queda vacía y el resto sigue.
    void Promise.all([
      supabase.from('crm_reuniones').select('cliente_id, inicio, tipo, estado').in('cliente_id', ids).neq('estado', 'cancelada').order('inicio').limit(1000),
      conPagos ? supabase.from('crm_pagos').select('cliente_id, monto, vencimiento, estado, fecha_pago').in('cliente_id', ids).limit(1000) : Promise.resolve({ data: [] }),
      conCasos ? supabase.from('crm_casos').select('cliente_id, abierto_en, cerrado_en, etapa, semaforo, causa').in('cliente_id', ids).limit(1000) : Promise.resolve({ data: [] }),
    ]).then(([r, p, c]) => {
      if (!vigente) return;
      setM({
        reuniones: (r.data as MarcaReunion[] | null) ?? [],
        pagos: ((p.data as MarcaPago[] | null) ?? []).map((x) => ({ ...x, monto: Number(x.monto) })),
        casos: (c.data as MarcaCaso[] | null) ?? [],
      });
    });
    return () => {
      vigente = false;
    };
  }, [clave, conPagos, conCasos]); // eslint-disable-line react-hooks/exhaustive-deps
  return m;
}

const COLOR_CASO: Record<Semaforo, string> = { rojo: 'var(--color-peligro)', ambar: 'var(--color-aviso)', verde: 'var(--color-exito)' };
const diaHoy = () => new Date(new Date().toDateString()).getTime();
const vencida = (p: MarcaPago) => p.estado === 'pendiente' && Boolean(p.vencimiento) && Date.parse(`${p.vencimiento}T23:59:59`) < Date.now();
const fechaPago = (p: MarcaPago) => (p.estado === 'pagado' && p.fecha_pago ? p.fecha_pago : p.vencimiento);

/**
 * Vista de proyecto de los clientes: una barra por cliente desde el onboarding hasta el fin
 * del contrato, en meses. Las dos primeras semanas son el onboarding; la firma pendiente va
 * punteada, las bajas rayadas y se avisa cuando faltan 45 días o menos.
 */
export const LineaTiempo: React.FC<{
  /** Los clientes de la página, ya en orden (ordenTimeline). */
  filas: ClienteResumen[];
  cargando?: boolean;
  duracion: (servicio: string | null | undefined) => number | null;
  nombreEquipo: (id: string | null | undefined) => string | null;
  /** Muestra las cuotas: solo quien ve la cobranza. */
  conPagos?: boolean;
  /** Muestra los casos de conflicto: solo quien los ve. */
  conCasos?: boolean;
}> = ({ filas, cargando = false, duracion, nombreEquipo, conPagos = true, conCasos = true }) => {
  // Arranca cuatro meses antes del actual y muestra doce. Las flechas corren de a tres.
  const [corrimiento, setCorrimiento] = useState(0);
  const hoy = new Date();
  const desde = new Date(hoy.getFullYear(), hoy.getMonth() - 4 + corrimiento, 1);
  const hasta = new Date(desde.getFullYear(), desde.getMonth() + MESES_VISIBLES, 1);
  const meses = Array.from({ length: MESES_VISIBLES }, (_, i) => new Date(desde.getFullYear(), desde.getMonth() + i, 1));
  const pos = (d: Date) => ((d.getTime() - desde.getTime()) / (hasta.getTime() - desde.getTime())) * 100;
  const recorte = (x: number) => Math.max(0, Math.min(100, x));
  const posHoy = pos(hoy);

  const ordenadas = filas;
  const marcas = useMarcas(
    filas.map((f) => f.id),
    conPagos,
    conCasos,
  );

  // Cliente abierto: al pasar el cursor (con una pausa corta, para no abrir de paso), con el foco o con un toque.
  const [abierto, setAbierto] = useState<string | null>(null);
  const espera = useRef<number | null>(null);
  const toque = useRef(false);
  const abrirLuego = (id: string) => {
    if (espera.current) window.clearTimeout(espera.current);
    espera.current = window.setTimeout(() => setAbierto(id), 180);
  };
  const cerrar = (id: string) => {
    if (espera.current) window.clearTimeout(espera.current);
    setAbierto((x) => (x === id ? null : x));
  };
  useEffect(() => () => void (espera.current && window.clearTimeout(espera.current)), []);

  /** Marcas de un cliente sobre la franja de debajo de la barra, o en sus carriles cuando está abierto. */
  const marcasDe = (c: ClienteResumen, expandido: boolean) => {
    const reuniones = marcas.reuniones.filter((r) => r.cliente_id === c.id);
    const pagos = marcas.pagos.filter((p) => p.cliente_id === c.id && fechaPago(p));
    const casos = marcas.casos.filter((x) => x.cliente_id === c.id);
    // Cerrado: reuniones y casos en una franja, cuotas en otra, así no se tapan. Abierto: un carril para cada cosa.
    const y = expandido ? { reuniones: 54, pagos: 74, casos: 96 } : { reuniones: 44, pagos: 56, casos: 46 };
    const dentro = (x: number) => x >= 0 && x <= 100;
    const inicio = c.fecha_onboarding ? new Date(c.fecha_onboarding) : null;
    const dia = (d: Date) => (inicio ? Math.round((d.getTime() - new Date(inicio.toDateString()).getTime()) / DIA) : null);
    const cuando = (d: Date) => {
      const n = dia(d);
      return n !== null && n >= 0 && d.getTime() <= Date.now() ? `día ${n}` : corta(d);
    };
    const elementos: React.ReactNode[] = [];
    for (const x of casos) {
      const a = new Date(x.abierto_en);
      const b = x.cerrado_en ? new Date(x.cerrado_en) : hoy;
      const x0 = recorte(pos(a));
      const x1 = recorte(pos(b));
      if (pos(b) < 0 || pos(a) > 100) continue;
      elementos.push(
        <span
          key={`c-${x.abierto_en}`}
          title={`Caso ${x.cerrado_en ? 'cerrado' : 'abierto'}, ${ROTULO_CAUSA[x.causa].toLowerCase()}. Desde el ${cuando(a)}${x.cerrado_en ? ` hasta el ${corta(b)}` : ', en curso'}.`}
          className="absolute h-[5px] rounded-pastilla z-[2]"
          style={{ left: `${x0}%`, width: `max(6px, ${x1 - x0}%)`, top: y.casos, background: COLOR_CASO[x.semaforo], opacity: x.cerrado_en ? 0.45 : 1 }}
        />,
      );
    }
    for (const r of reuniones) {
      const d = new Date(r.inicio);
      const x = pos(d);
      if (!dentro(x)) continue;
      const tipo = r.tipo ? TIPO_REUNION[r.tipo] : 'Reunión';
      const relleno = r.estado === 'realizada' ? 'var(--color-tinta)' : r.estado === 'no_asistio' ? 'var(--color-aviso)' : 'var(--color-papel)';
      const borde = r.estado === 'no_asistio' ? 'var(--color-aviso)' : 'var(--color-tinta)';
      const estado = r.estado === 'realizada' ? 'hecha' : r.estado === 'no_asistio' ? 'no asistió' : r.estado === 'reprogramada' ? 'reprogramada' : 'agendada';
      elementos.push(
        <span
          key={`r-${r.inicio}`}
          title={`${tipo}, ${estado}. ${corta(d)}${cuando(d).startsWith('día') ? `, ${cuando(d)}` : ''}.`}
          className="absolute w-[9px] h-[9px] rounded-full z-[3]"
          style={{ left: `calc(${x}% - 4.5px)`, top: y.reuniones, background: relleno, border: `1.75px solid ${borde}` }}
        />,
      );
    }
    for (const p of pagos) {
      const d = new Date(`${fechaPago(p)}T12:00:00`);
      const x = pos(d);
      if (!dentro(x)) continue;
      const venc = vencida(p);
      const estado = p.estado === 'pagado' ? 'pagada' : venc ? 'vencida' : 'por vencer';
      elementos.push(
        <span
          key={`p-${p.vencimiento}-${p.fecha_pago}-${p.monto}`}
          title={`Cuota de ${dinero(p.monto, c.moneda || 'USD')}, ${estado}. ${corta(d)}.`}
          className="absolute w-[9px] h-[9px] rotate-45 z-[3]"
          style={{
            left: `calc(${x}% - 4.5px)`,
            top: y.pagos,
            background: p.estado === 'pagado' ? 'var(--color-exito)' : venc ? 'var(--color-peligro)' : 'transparent',
            border: p.estado === 'pendiente' && !venc ? '1.75px solid var(--color-piedra)' : 'none',
          }}
        />,
      );
    }
    return { elementos, reuniones, pagos, casos, cuando };
  };

  /** Lo que se ve al abrir un cliente: carriles, regla de días y la cronología en orden. */
  const detalle = (c: ClienteResumen) => {
    const { reuniones, pagos, casos, cuando } = marcasDe(c, true);
    const inicio = c.fecha_onboarding ? new Date(new Date(c.fecha_onboarding).toDateString()) : null;
    const regla = inicio
      ? [30, 60, 90, 120, 150, 180]
          .map((n) => ({ n, x: pos(new Date(inicio.getTime() + n * DIA)) }))
          .filter(({ x }) => x > 2 && x < 98 && Math.abs(x - posHoy) > 4.5)
      : [];
    const diaDeHoy = inicio ? Math.round((diaHoy() - inicio.getTime()) / DIA) : null;
    type Evento = { t: number; clave: string; texto: string; color: 'default' | 'success' | 'warning' | 'danger' };
    const eventos: Evento[] = [
      ...reuniones.map((r) => {
        const d = new Date(r.inicio);
        const tipo = r.tipo ? TIPO_REUNION[r.tipo] : 'Reunión';
        const estado = r.estado === 'realizada' ? 'hecha' : r.estado === 'no_asistio' ? 'no asistió' : r.estado === 'reprogramada' ? 'reprogramada' : 'agendada';
        return { t: d.getTime(), clave: `r${r.inicio}`, texto: `${cuando(d)} · ${tipo}, ${estado}`, color: (r.estado === 'no_asistio' ? 'warning' : 'default') as Evento['color'] };
      }),
      ...pagos.map((p) => {
        const d = new Date(`${fechaPago(p)}T12:00:00`);
        const venc = vencida(p);
        return {
          t: d.getTime(),
          clave: `p${p.vencimiento}${p.fecha_pago}${p.monto}`,
          texto: `${cuando(d)} · Cuota de ${dinero(p.monto, c.moneda || 'USD')} ${p.estado === 'pagado' ? 'pagada' : venc ? 'vencida' : 'por vencer'}`,
          color: (p.estado === 'pagado' ? 'success' : venc ? 'danger' : 'default') as Evento['color'],
        };
      }),
      ...casos.map((x) => {
        const d = new Date(x.abierto_en);
        return {
          t: d.getTime(),
          clave: `c${x.abierto_en}`,
          texto: `${cuando(d)} · Caso ${x.cerrado_en ? 'cerrado' : 'abierto'}, ${ROTULO_CAUSA[x.causa].toLowerCase()}`,
          color: (x.cerrado_en ? 'default' : x.semaforo === 'rojo' ? 'danger' : 'warning') as Evento['color'],
        };
      }),
    ].sort((a, b) => a.t - b.t);
    return {
      capas: (
      <>
        {regla.map(({ n, x }) => (
          <React.Fragment key={n}>
            <span aria-hidden="true" className="absolute border-l border-dashed border-tinta/25" style={{ left: `${x}%`, top: 46, height: 60 }} />
            <span className="absolute text-[10.5px] text-piedra" style={{ left: `calc(${x}% + 4px)`, top: 44 }}>
              día {n}
            </span>
          </React.Fragment>
        ))}
        {diaDeHoy !== null && diaDeHoy >= 0 && posHoy >= 0 && posHoy <= 100 && (
          <span className="absolute -translate-x-full pr-2 text-[10.5px] font-semibold text-peligro bg-niebla/90" style={{ left: `${posHoy}%`, top: 44 }}>
            hoy · día {diaDeHoy}
          </span>
        )}
      </>
      ),
      cronologia: (
        <div className="flex flex-wrap items-center gap-1.5">
          {eventos.length === 0 ? (
            <span className="text-[12.5px] text-piedra">Sin reuniones, cuotas ni casos cargados.</span>
          ) : (
            eventos.slice(-8).map((e) => (
              <Chip key={e.clave} size="sm" variant="soft" color={e.color} className={e.color === 'default' ? 'bg-papel border border-borde-suave' : ''}>
                {e.texto}
              </Chip>
            ))
          )}
          {eventos.length > 8 && <span className="text-[12px] text-piedra">y {eventos.length - 8} más en la ficha</span>}
        </div>
      ),
    };
  };

  /** Lo que se suma a la izquierda del cliente abierto. */
  const resumen = (c: ClienteResumen) => {
    const proxima = marcas.reuniones.find((r) => r.cliente_id === c.id && r.estado === 'agendada' && Date.parse(r.inicio) > Date.now());
    const enCurso = marcas.casos.filter((x) => x.cliente_id === c.id && !x.cerrado_en).length;
    const moneda = c.moneda || 'USD';
    return (
      <div className="mt-3 flex flex-col gap-1 text-[12.5px] leading-snug">
        {conPagos && (
          <span>
            Cobrado <strong className="font-semibold">{dinero(c.cobrado, moneda)}</strong> de {dinero(c.monto_total, moneda)}
          </span>
        )}
        {conPagos && c.cuotas_vencidas > 0 && (
          <span className="font-semibold text-peligro">{c.cuotas_vencidas === 1 ? '1 cuota vencida' : `${c.cuotas_vencidas} cuotas vencidas`}</span>
        )}
        <span>{proxima ? <>Próxima reunión <strong className="font-semibold">{corta(new Date(proxima.inicio))}</strong></> : 'Sin reunión agendada'}</span>
        {conCasos && enCurso > 0 && <span className="font-semibold text-aviso">{enCurso === 1 ? '1 caso en curso' : `${enCurso} casos en curso`}</span>}
        <Enlace a={`/portal/crm/${c.id}`} onClick={(e) => e.stopPropagation()} className="mt-1.5 inline-flex items-center gap-1 font-semibold underline underline-offset-4 hover:text-bosque">
          Abrir ficha <ArrowRight size={13} aria-hidden="true" />
        </Enlace>
      </div>
    );
  };

  const barra = (c: ClienteResumen) => {
    if (!c.fecha_onboarding) return <span className="absolute inset-y-0 left-2 flex items-center text-[12.5px] text-piedra">Sin fecha de onboarding</span>;
    const inicio = new Date(c.fecha_onboarding);
    const meses = duracion(c.servicio);
    const fin = finDelContrato(c.fecha_onboarding, meses);
    const baja = c.estado_firma === 'Baja';
    const pendiente = c.estado_firma === 'Pendiente' || c.estado_firma === 'En firma';
    const finVisual = fin ?? new Date(inicio.getTime() + 120 * DIA);
    const x0 = pos(inicio);
    const x1 = pos(finVisual);
    if (x1 < 0 || x0 > 100)
      return (
        <span className="absolute inset-y-0 left-2 flex items-center text-[12.5px] text-piedra">
          {x1 < 0 ? `Terminó el ${corta(finVisual)}` : `Empieza el ${corta(inicio)}`}
        </span>
      );
    const izq = recorte(x0);
    const ancho = recorte(x1) - izq;
    const finOnboarding = new Date(inicio.getTime() + ONBOARDING_DIAS * DIA);
    const anchoOnboarding = Math.max(0, Math.min(100, ((recorte(pos(finOnboarding)) - izq) / ancho) * 100));
    const dias = fin ? Math.round((fin.getTime() - hoy.getTime()) / DIA) : null;
    const vence = !baja && dias !== null && dias >= 0 && dias <= AVISO_VENCE_DIAS;
    const termino = !baja && dias !== null && dias < 0;
    const redondeo = `${x0 >= 0 ? 8 : 0}px ${x1 <= 100 ? 8 : 0}px ${x1 <= 100 ? 8 : 0}px ${x0 >= 0 ? 8 : 0}px`;

    let contenido: React.ReactNode;
    let estilo: React.CSSProperties;
    if (baja) {
      estilo = { background: rayado, border: '1px solid var(--color-borde)' };
      contenido = (
        <span className="flex-1 flex items-center justify-between gap-2 px-2.5 text-[12px] text-piedra">
          <span>Baja</span>
          {fin && <span>era hasta {corta(fin)}</span>}
        </span>
      );
    } else if (!fin) {
      estilo = { background: 'linear-gradient(90deg, var(--color-tinta) 0%, var(--color-tinta) 70%, transparent 100%)' };
      contenido = (
        <>
          <span className="flex items-center px-2 text-[11.5px] font-semibold text-marfil" style={{ background: verde }}>
            Onb.
          </span>
          <span className="flex items-center px-2.5 text-[12px] text-marfil whitespace-nowrap">Falta la duración del servicio</span>
        </>
      );
    } else {
      estilo = pendiente ? { border: '1.5px dashed var(--color-tinta)', background: 'var(--color-papel)' } : { background: 'var(--color-tinta)' };
      contenido = (
        <>
          <span
            className={`flex items-center pl-2 text-[11.5px] font-semibold whitespace-nowrap overflow-hidden ${pendiente ? 'text-bosque' : 'text-marfil'}`}
            style={{ width: `${anchoOnboarding}%`, background: pendiente ? 'color-mix(in srgb, var(--color-bosque) 15%, transparent)' : verde }}
          >
            {anchoOnboarding > 4 ? 'Onb.' : ''}
          </span>
          <span className={`flex-1 flex items-center justify-between gap-2 px-2.5 text-[12px] whitespace-nowrap overflow-hidden ${pendiente ? 'text-tinta' : 'text-marfil'}`}>
            <span>{pendiente ? 'Firma pendiente' : `${meses} ${meses === 1 ? 'mes' : 'meses'}`}</span>
            <span className="opacity-80">termina {corta(fin)}</span>
          </span>
        </>
      );
    }
    return (
      <>
        <span className="absolute top-3 h-7 flex overflow-hidden" style={{ left: `${izq}%`, width: `${ancho}%`, borderRadius: redondeo, ...estilo }}>
          {contenido}
        </span>
        {(vence || termino) && x1 <= 100 && (
          <span
            className={`absolute top-[15px] px-2 py-0.5 rounded-pastilla text-[11.5px] font-semibold whitespace-nowrap ${vence ? 'bg-peligro-suave text-peligro' : 'bg-niebla text-piedra'}`}
            style={x1 > 82 ? { right: `calc(${100 - x1}% + 8px)` } : { left: `calc(${x1}% + 8px)` }}
          >
            {vence ? (dias === 0 ? 'Vence hoy' : `Vence en ${dias} ${dias === 1 ? 'día' : 'días'}`) : `Terminó el ${corta(fin!)}`}
          </span>
        )}
      </>
    );
  };

  const mesAnio = (d: Date) => d.toLocaleDateString('es-AR', { month: 'short', year: 'numeric' }).replace(/\./g, '');
  const rango = `${mesAnio(meses[0])} a ${mesAnio(meses[MESES_VISIBLES - 1])}`;
  const rotuloRango = rango.charAt(0).toUpperCase() + rango.slice(1);
  const flecha = 'w-9 h-9 inline-flex items-center justify-center border border-borde-suave bg-papel rounded-[10px] hover:border-tinta';

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button type="button" aria-label="Tres meses antes" className={flecha} onClick={() => setCorrimiento((n) => n - 3)}>
            <ChevronLeft size={16} aria-hidden="true" />
          </button>
          <button type="button" aria-label="Tres meses después" className={flecha} onClick={() => setCorrimiento((n) => n + 3)}>
            <ChevronRight size={16} aria-hidden="true" />
          </button>
          <span className="text-sm font-medium ml-1">{rotuloRango}</span>
          {corrimiento !== 0 && (
            <button type="button" className="text-sm text-piedra underline underline-offset-4 hover:text-bosque ml-2" onClick={() => setCorrimiento(0)}>
              Volver a hoy
            </button>
          )}
        </div>
        <span className="text-[13px] text-piedra">Pasá el cursor por un cliente para ver sus reuniones, cuotas y casos</span>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[900px]">
          <div className="grid grid-cols-[240px_1fr] border-b border-borde-suave">
            <span className="py-2 text-[12px] font-semibold text-piedra">Cliente</span>
            <div className="grid" style={{ gridTemplateColumns: `repeat(${MESES_VISIBLES}, 1fr)` }}>
              {meses.map((d, i) => (
                <span key={i} className="py-2 pl-1.5 border-l border-separador text-[12px] font-semibold text-piedra capitalize">
                  {d.toLocaleDateString('es-AR', { month: 'short' }).replace('.', '')}
                  {i === 0 || d.getMonth() === 0 ? ` ${String(d.getFullYear()).slice(2)}` : ''}
                </span>
              ))}
            </div>
          </div>
          <div className="relative">
            <div className="absolute inset-y-0 left-[240px] right-0 grid pointer-events-none" style={{ gridTemplateColumns: `repeat(${MESES_VISIBLES}, 1fr)` }} aria-hidden="true">
              {meses.map((_, i) => (
                <span key={i} className="border-l border-separador" />
              ))}
            </div>
            {posHoy >= 0 && posHoy <= 100 && (
              <div className="absolute top-0 bottom-0 w-0.5 bg-peligro z-[1] pointer-events-none" style={{ left: `calc(240px + (100% - 240px) * ${posHoy / 100})` }} aria-hidden="true" />
            )}
            {ordenadas.length === 0 && <p className="py-10 text-piedra">{cargando ? 'Cargando los clientes…' : 'No hay clientes para mostrar con este filtro.'}</p>}
            {ordenadas.map((c) => {
              const am = nombreEquipo(c.responsable_id);
              const expandido = abierto === c.id;
              return (
                <div
                  key={c.id}
                  role="link"
                  tabIndex={0}
                  aria-expanded={expandido}
                  onPointerDown={(e) => {
                    toque.current = e.pointerType === 'touch';
                  }}
                  onMouseEnter={() => abrirLuego(c.id)}
                  onMouseLeave={() => cerrar(c.id)}
                  onFocus={() => setAbierto(c.id)}
                  onBlur={(e) => !e.currentTarget.contains(e.relatedTarget as Node | null) && cerrar(c.id)}
                  onClick={() => {
                    // En el celular el primer toque abre el cliente; el segundo, o Abrir ficha, va a la ficha.
                    if (toque.current && !expandido) return setAbierto(c.id);
                    navegar(`/portal/crm/${c.id}`);
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && navegar(`/portal/crm/${c.id}`)}
                  className={`grid grid-cols-[240px_1fr] border-b border-separador cursor-pointer transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-bosque/40 ${expandido ? 'bg-niebla/70 shadow-[inset_3px_0_0_var(--color-tinta)]' : 'hover:bg-niebla/50'}`}
                >
                  <div className={`pr-4 flex flex-col min-w-0 ${expandido ? 'pl-3.5 pt-3 pb-4 justify-start' : 'py-2.5 justify-center'}`}>
                    <span className={`font-heading font-bold text-[15px] leading-tight truncate ${c.estado_firma === 'Baja' ? 'text-piedra' : ''}`}>{c.nombre}</span>
                    <span className="text-[12px] text-piedra mt-0.5 truncate">
                      {c.servicio || 'Sin servicio'} · {am ?? 'Sin Account Manager'}
                    </span>
                    {expandido && resumen(c)}
                  </div>
                  <div className={`relative ${expandido ? '' : 'h-[68px]'}`}>
                    {barra(c)}
                    {marcasDe(c, expandido).elementos}
                    {expandido &&
                      (() => {
                        const d = detalle(c);
                        return (
                          <>
                            {d.capas}
                            {/* La cronología va debajo de los carriles y la fila crece lo que haga falta. */}
                            <div className="relative z-[2] pt-[116px] pb-4 px-1">{d.cronologia}</div>
                          </>
                        );
                      })()}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-x-5 gap-y-2 text-[12.5px] text-piedra">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-5 h-3 rounded-[4px]" style={{ background: verde }} /> Onboarding, primeras 2 semanas
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-5 h-3 rounded-[4px] bg-tinta" /> Contrato vigente
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-5 h-3 rounded-[4px] border-[1.5px] border-dashed border-tinta" /> Firma pendiente
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-5 h-3 rounded-[4px]" style={{ background: rayado }} /> Baja
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-0.5 h-3 bg-peligro" /> Hoy
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-[9px] h-[9px] rounded-full bg-tinta" /> Reunión hecha
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-[9px] h-[9px] rounded-full border-[1.75px] border-tinta" /> Reunión agendada
        </span>
        {conPagos && (
          <>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2 h-2 rotate-45 bg-exito" /> Cuota pagada
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2 h-2 rotate-45 bg-peligro" /> Cuota vencida
            </span>
          </>
        )}
        {conCasos && (
          <span className="inline-flex items-center gap-1.5">
            <span className="w-[18px] h-[5px] rounded-pastilla bg-aviso" /> Caso abierto
          </span>
        )}
        <span>Se avisa cuando faltan {AVISO_VENCE_DIAS} días o menos</span>
      </div>
    </div>
  );
};

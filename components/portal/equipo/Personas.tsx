import React, { useMemo, useState } from 'react';
import { CalendarDays, CalendarPlus, LayoutGrid } from 'lucide-react';
import { Button } from '../../Button';
import { navegar } from '../navegacion';
import { Aviso, Enlace } from '../ui';
import { avisoDeGoogle, conectarGoogle, useConexionesGoogle } from '../google';
import { rolDe, type IntegranteEquipo, type RolComercial } from '../crm/tipos';
import { FormReunion } from '../crm/ReunionUI';
import type { BaseEquipo } from './EquipoApp';
import { CalendarioEquipo } from './CalendarioEquipo';
import { ROTULO_ESTADO_ITEM, colorDe, entreManos, inicialesDe, numerosDe, tonoRendimiento, useDatosPersonas, type EstadoItem, type Item } from './personasDatos';
import { claseBotonHero } from '../../Button';

/** El estado de cada cosa que tiene alguien entre manos, como un círculo que se llena. */
export const IconoEstado: React.FC<{ estado: EstadoItem }> = ({ estado }) => {
  const t = ROTULO_ESTADO_ITEM[estado];
  if (estado === 'hecha')
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" role="img" aria-label={t}>
        <circle cx="8" cy="8" r="7.2" fill="#3f7a5f" />
        <path d="M5 8.2l2 2 4-4.2" fill="none" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  if (estado === 'pendiente')
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" role="img" aria-label={t}>
        <circle cx="8" cy="8" r="6.5" fill="none" stroke="#9a947f" strokeWidth="1.6" strokeDasharray="2.2 2.2" />
      </svg>
    );
  const { color, d } = {
    agendada: { color: '#3b6fd8', d: 'M8 1.5 A6.5 6.5 0 0 1 14.5 8 L8 8 Z' },
    curso: { color: '#b7791f', d: 'M8 1.5 A6.5 6.5 0 0 1 8 14.5 Z' },
    riesgo: { color: '#b3261e', d: 'M8 1.5 A6.5 6.5 0 1 1 1.5 8 L8 8 Z' },
  }[estado];
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" role="img" aria-label={t}>
      <circle cx="8" cy="8" r="6.5" fill="none" stroke={color} strokeWidth="1.6" />
      <path d={d} fill={color} />
    </svg>
  );
};

export const Avatar: React.FC<{ m: IntegranteEquipo; tam?: number }> = ({ m, tam = 46 }) => (
  <span
    aria-hidden="true"
    className="rounded-full grid place-items-center font-bold text-marfil shrink-0"
    style={{ width: tam, height: tam, background: colorDe(m.id).fuerte, fontSize: Math.round(tam * 0.35) }}
  >
    {inicialesDe(m.nombre)}
  </span>
);

/** Una fila de la lista numerada de lo que tiene entre manos. */
export const FilaItem: React.FC<{ item: Item; n: number }> = ({ item, n }) => {
  const contenido = (
    <>
      <span className="w-[22px] h-[22px] rounded-[6px] bg-niebla text-piedra text-[12px] font-semibold grid place-items-center shrink-0">{n}</span>
      <span className="grid place-items-center shrink-0">
        <IconoEstado estado={item.estado} />
      </span>
      <span className="min-w-0 flex-1 flex items-baseline justify-between gap-3">
        <span className="font-semibold text-[14px] truncate">{item.titulo}</span>
        <span className="text-[12.5px] text-piedra whitespace-nowrap">{item.detalle}</span>
      </span>
    </>
  );
  const clase = 'flex items-center gap-2.5 px-2 py-1.5 rounded-[10px]';
  return <li>{item.a ? <Enlace a={item.a} className={`${clase} hover:bg-niebla/60`}>{contenido}</Enlace> : <div className={clase}>{contenido}</div>}</li>;
};

type Grupo = 'todos' | 'account_manager' | 'closer' | 'setter' | 'otro';
const GRUPOS: { clave: Grupo; titulo: string; roles: RolComercial[] }[] = [
  { clave: 'todos', titulo: 'Todos', roles: [] },
  { clave: 'account_manager', titulo: 'Account Managers', roles: ['account_manager', 'csm'] },
  { clave: 'closer', titulo: 'Closers', roles: ['closer'] },
  { clave: 'setter', titulo: 'Setters', roles: ['setter'] },
  { clave: 'otro', titulo: 'Otros roles', roles: ['otro'] },
];

/**
 * Equipo como CRM: una tarjeta por persona con lo que tiene entre manos, sus
 * números según el rol y su rendimiento, y el calendario del equipo. Quien
 * lidera ve a todos; el resto, solo su tarjeta.
 */
export const Personas: React.FC<{ base: BaseEquipo }> = ({ base }) => {
  const { orgId, equipo, yo, miCuenta, lidera, soloLectura, objetivos } = base;
  const datos = useDatosPersonas(orgId, false);
  const [vista, setVista] = useState<'tarjetas' | 'calendario'>('tarjetas');
  const [grupo, setGrupo] = useState<Grupo>('todos');
  const [agendar, setAgendar] = useState<{ miembro: string | null; inicio?: string } | null>(null);
  const google = useConexionesGoogle(orgId);
  const [aviso, setAviso] = useState(() => avisoDeGoogle());
  const [conectando, setConectando] = useState(false);
  async function conectar() {
    setConectando(true);
    try {
      await conectarGoogle(orgId);
    } catch (e) {
      setConectando(false);
      setAviso({ tipo: 'error', texto: e instanceof Error ? e.message : 'No se pudo conectar con Google.' });
    }
  }

  const personas = useMemo(() => (lidera ? equipo.filter((m) => m.activo) : yo ? [yo] : []), [lidera, equipo, yo]);
  const delGrupo = (g: Grupo) => (g === 'todos' ? personas : personas.filter((m) => GRUPOS.find((x) => x.clave === g)!.roles.includes(m.rol_comercial)));
  const visibles = delGrupo(grupo);
  const clientes = datos.clientes.map((c) => ({ id: c.id, nombre: c.nombre, codigo: c.codigo, responsable_id: c.responsable_id }));

  if (!personas.length)
    return (
      <p className="text-sm text-piedra">
        {lidera ? 'Todavía no hay nadie en el equipo. Sumalo desde Clientes › Equipo.' : 'Cuando el titular te sume al equipo vas a ver acá tu tarjeta.'}
      </p>
    );

  return (
    <div className="flex flex-col gap-6">
      {aviso && <Aviso tipo={aviso.tipo}>{aviso.texto}</Aviso>}
      {miCuenta && !soloLectura && !google.activas.has(miCuenta.id) && (
        <div className="flex flex-wrap items-center justify-between gap-3 bg-papel border border-borde-suave rounded-[16px] px-4 py-3">
          <span className="text-[14px]">
            {google.conexiones.some((c) => c.miembro_id === miCuenta.id && c.estado === 'error')
              ? 'Google pidió volver a conectar tu calendario.'
              : 'Conectá tu Google Calendar para que el equipo vea tu agenda y te puedan agendar con link de Meet.'}
          </span>
          <Button size="sm" onClick={() => void conectar()} disabled={conectando}>
            <CalendarDays size={15} aria-hidden="true" /> {conectando ? 'Abriendo Google…' : 'Conectar Google Calendar'}
          </Button>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2 text-[13.5px]">
          {lidera &&
            GRUPOS.filter((g) => g.clave === 'todos' || delGrupo(g.clave).length).map((g) => (
              <button
                key={g.clave}
                type="button"
                aria-pressed={grupo === g.clave}
                onClick={() => setGrupo(g.clave)}
                className={`px-3 py-1.5 rounded-pastilla ${grupo === g.clave ? 'bg-tinta text-marfil' : 'border border-borde-suave bg-papel hover:border-tinta'}`}
              >
                {g.titulo} <span className="opacity-65">{delGrupo(g.clave).length}</span>
              </button>
            ))}
        </div>
        <div role="group" aria-label="Vista" className="inline-flex bg-niebla rounded-[12px] p-1 gap-0.5">
          {(
            [
              ['tarjetas', 'Tarjetas', LayoutGrid],
              ['calendario', 'Calendario del equipo', CalendarDays],
            ] as const
          ).map(([v, t, Icono]) => (
            <button
              key={v}
              type="button"
              aria-pressed={vista === v}
              onClick={() => setVista(v)}
              className={`inline-flex items-center gap-1.5 h-9 px-3.5 rounded-[9px] text-[14px] ${vista === v ? 'bg-papel font-semibold shadow-[0_1px_2px_rgba(0,0,0,0.08)]' : 'text-piedra hover:text-tinta'}`}
            >
              <Icono size={15} aria-hidden="true" /> {t}
            </button>
          ))}
        </div>
      </div>

      {agendar && !soloLectura && (
        <FormReunion
          orgId={orgId}
          equipo={equipo}
          clientes={clientes}
          miembroPorDefecto={agendar.miembro ?? undefined}
          inicioPorDefecto={agendar.inicio}
          conectados={google.activas}
          alGuardar={(r) => {
            datos.reemplazar(r);
            setAgendar(null);
          }}
          alCancelar={() => setAgendar(null)}
        />
      )}

      {!datos.cargado ? (
        <p className="text-piedra text-sm" role="status">
          Cargando…
        </p>
      ) : vista === 'calendario' ? (
        <CalendarioEquipo
          orgId={orgId}
          conectados={google.activas}
          personas={visibles}
          reuniones={datos.reuniones}
          clientes={datos.clientes}
          puedeAgendar={!soloLectura}
          alAgendar={(inicio, miembro) => {
            setAgendar({ miembro, inicio: inicio.toISOString() });
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        />
      ) : (
        <>
          <div className="grid gap-4 tab:grid-cols-2 desk:grid-cols-3">
            {visibles.map((m) => {
              const items = entreManos(m, datos, objetivos);
              const { cifras, rendimiento } = numerosDe(m, datos, objetivos);
              const tono = tonoRendimiento(rendimiento);
              return (
                <article key={m.id} className="bg-papel border border-borde-suave rounded-[20px] flex flex-col min-w-0">
                  <div className="flex items-center gap-3 px-[18px] py-4 border-b border-separador">
                    <Avatar m={m} />
                    <div className="min-w-0 flex-1">
                      <Enlace a={`/portal/equipo/persona/${m.id}`} className="block font-heading font-bold text-[17px] leading-tight truncate hover:text-bosque">
                        {m.nombre}
                      </Enlace>
                      <span className="flex items-center gap-1.5 text-[12.5px] text-piedra mt-0.5">
                        {rolDe(m)}
                        {google.activas.has(m.id) && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="w-2 h-2 rounded-full bg-[#3f7a5f]" aria-hidden="true" /> Calendario conectado
                          </>
                        )}
                      </span>
                    </div>
                  </div>
                  {items.length ? (
                    <ol className="px-2.5 py-2">
                      {items.slice(0, 5).map((it, i) => (
                        <FilaItem key={i} item={it} n={i + 1} />
                      ))}
                    </ol>
                  ) : (
                    <p className="px-[18px] py-4 text-[13.5px] text-piedra">Nada pendiente por ahora.</p>
                  )}
                  {items.length > 5 && (
                    <Enlace a={`/portal/equipo/persona/${m.id}`} className="px-[18px] -mt-1 mb-2 text-[13px] text-piedra underline underline-offset-4 hover:text-bosque">
                      {items.length - 5} más
                    </Enlace>
                  )}
                  <div className="mt-auto px-[18px] pt-3 pb-4 border-t border-separador flex flex-col gap-2.5">
                    <div className="grid grid-cols-3 gap-2">
                      {cifras.map(([t, v]) => (
                        <div key={t} className="min-w-0">
                          <span className="block text-[11.5px] text-piedra leading-tight">{t}</span>
                          <span className="block font-bold text-[15px] mt-0.5">{v}</span>
                        </div>
                      ))}
                    </div>
                    <div title="Promedio de la asistencia a sus reuniones y del avance de sus objetivos">
                      <div className="flex justify-between text-[12px] text-piedra">
                        <span>Rendimiento</span>
                        <span className="font-semibold" style={{ color: tono }}>
                          {rendimiento === null ? 'Sin datos todavía' : Math.round(rendimiento * 100)}
                        </span>
                      </div>
                      <div className="h-1.5 bg-niebla rounded-pastilla mt-1">
                        <div className="h-1.5 rounded-pastilla" style={{ width: `${Math.round((rendimiento ?? 0) * 100)}%`, background: tono }} />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {!soloLectura && (
                        <button
                          type="button"
                          onClick={() => {
                            setAgendar({ miembro: m.id });
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 h-9 rounded-[10px] border border-borde-suave bg-papel text-[13.5px] font-medium hover:border-tinta"
                        >
                          <CalendarPlus size={15} aria-hidden="true" /> Agendar
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => navegar(`/portal/equipo/persona/${m.id}`)}
                        className={`${claseBotonHero('primary', 'sm')} flex-1`}
                      >
                        Ver ficha
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[12.5px] text-piedra">
            {(Object.keys(ROTULO_ESTADO_ITEM) as EstadoItem[]).map((e) => (
              <span key={e} className="inline-flex items-center gap-1.5">
                <IconoEstado estado={e} /> {ROTULO_ESTADO_ITEM[e]}
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
};


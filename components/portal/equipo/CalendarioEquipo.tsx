import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Video } from 'lucide-react';
import { pedirGoogle, type EventoGoogle } from '../google';
import { navegar } from '../navegacion';
import type { IntegranteEquipo } from '../crm/tipos';
import { TIPO_REUNION, yaPaso, type Reunion } from '../crm/reunionesDatos';
import { colorDe, inicialesDe, semanaDe, type ClientePersona } from './personasDatos';

const DIA = 86400000;
const ALTO_HORA = 46;

const hora = (d: Date) => d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });

/**
 * Semana del equipo, un color por persona, con las reuniones del portal.
 * Arriba la próxima reunión. Tocando un hueco se agenda a esa hora.
 * Cuando esté la conexión con Google, acá se suman los eventos de cada calendario.
 */
export const CalendarioEquipo: React.FC<{
  orgId: string;
  /** Personas con Google Calendar conectado: de ellas se trae su agenda. */
  conectados: Set<string>;
  personas: IntegranteEquipo[];
  reuniones: Reunion[];
  clientes: ClientePersona[];
  puedeAgendar: boolean;
  alAgendar: (inicio: Date, miembroId: string | null) => void;
}> = ({ orgId, conectados, personas, reuniones, clientes, puedeAgendar, alAgendar }) => {
  const [corrimiento, setCorrimiento] = useState(0);
  const [ocultas, setOcultas] = useState<Set<string>>(new Set());
  const { desde } = semanaDe(new Date(Date.now() + corrimiento * 7 * DIA));
  const dias = Array.from({ length: 5 }, (_, i) => new Date(desde.getTime() + i * DIA));
  const finSemana = new Date(desde.getTime() + 5 * DIA);
  const visibles = personas.filter((p) => !ocultas.has(p.id));
  const ids = new Set(visibles.map((p) => p.id));

  // Agenda de Google de quienes la conectaron. Lo que ya es una reunión del portal no se repite.
  const [eventosG, setEventosG] = useState<EventoGoogle[]>([]);
  const [errorG, setErrorG] = useState<string | null>(null);
  const claveGoogle = visibles.filter((p) => conectados.has(p.id)).map((p) => p.id).join(',');
  useEffect(() => {
    if (!claveGoogle) {
      setEventosG([]);
      setErrorG(null);
      return;
    }
    let vivo = true;
    pedirGoogle<{ eventos: EventoGoogle[]; errores: { miembro_id: string; error: string }[] }>('eventos', {
      org: orgId,
      desde: desde.toISOString(),
      hasta: finSemana.toISOString(),
      miembros: claveGoogle.split(','),
    })
      .then((r) => {
        if (!vivo) return;
        setEventosG(r.eventos);
        const nombres = r.errores.map((x) => personas.find((p) => p.id === x.miembro_id)?.nombre.split(' ')[0]).filter(Boolean);
        setErrorG(nombres.length ? `No se pudo leer el Google Calendar de ${nombres.join(', ')}. Puede que tenga que volver a conectarlo.` : null);
      })
      .catch((e: unknown) => vivo && setErrorG(e instanceof Error ? e.message : 'No se pudo leer Google Calendar.'));
    return () => {
      vivo = false;
    };
  }, [orgId, desde.getTime(), claveGoogle]); // eslint-disable-line react-hooks/exhaustive-deps
  const yaEnPortal = new Set(reuniones.map((r) => r.google_evento_id).filter(Boolean));
  const deGoogle = eventosG.filter((e) => !e.todo_el_dia && e.inicio && e.fin && !yaEnPortal.has(e.id));

  const deLaSemana = useMemo(
    () => reuniones.filter((r) => r.miembro_id && ids.has(r.miembro_id) && r.estado !== 'cancelada' && Date.parse(r.inicio) >= desde.getTime() && Date.parse(r.inicio) < finSemana.getTime()),
    [reuniones, desde.getTime(), [...ids].join()], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // De 9 a 18, o más si hay reuniones antes o después.
  const horas = [...deLaSemana.map((r) => new Date(r.inicio).getHours()), ...deGoogle.map((e) => new Date(e.inicio as string).getHours())];
  const inicioDia = Math.max(6, Math.min(9, ...horas));
  const finDia = Math.min(23, Math.max(18, ...deLaSemana.map((r) => new Date(r.inicio).getHours() + Math.ceil((r.duracion_min ?? 45) / 60)), ...deGoogle.map((e) => Math.ceil(new Date(e.fin as string).getHours() + new Date(e.fin as string).getMinutes() / 60))));
  const filas = finDia - inicioDia;

  const proxima = reuniones
    .filter((r) => r.miembro_id && ids.has(r.miembro_id) && r.estado === 'agendada' && !yaPaso(r))
    .sort((a, b) => a.inicio.localeCompare(b.inicio))[0];
  const minutos = proxima ? Math.round((Date.parse(proxima.inicio) - Date.now()) / 60000) : null;
  const falta = minutos === null ? '' : minutos < 60 ? `en ${minutos} min` : minutos < 24 * 60 ? `en ${Math.round(minutos / 60)} h` : new Date(proxima!.inicio).toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric' }).replace('.', '');
  const nombre = (id: string | null) => personas.find((p) => p.id === id)?.nombre.split(' ')[0] ?? '';
  const conQuien = (r: Reunion) => (r.cliente_id && clientes.find((c) => c.id === r.cliente_id)?.nombre) || r.prospecto || r.titulo || 'Sin cliente';

  const ahora = new Date();
  const rango = `${dias[0].getDate()} al ${dias[4].toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })}`;
  const flecha = 'w-9 h-9 inline-flex items-center justify-center border border-borde-suave bg-papel rounded-[10px] hover:border-tinta';

  return (
    <div className="flex flex-col gap-4">
      {proxima && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 bg-tinta text-marfil rounded-[14px] px-4 py-2.5 text-[14px]">
          <span className={`px-2 py-0.5 rounded-pastilla text-[12px] font-bold ${minutos !== null && minutos <= 60 ? 'bg-peligro text-white' : 'bg-marfil/15'}`}>{falta}</span>
          <span>
            <strong className="font-semibold">
              {proxima.tipo ? TIPO_REUNION[proxima.tipo] : 'Reunión'} con {conQuien(proxima)}
            </strong>{' '}
            · {nombre(proxima.miembro_id)} · {hora(new Date(proxima.inicio))}
          </span>
          {proxima.enlace_reunion ? (
            <a href={proxima.enlace_reunion} target="_blank" rel="noreferrer noopener" className="ml-auto inline-flex items-center gap-1.5 h-8 px-3 rounded-[9px] bg-marfil text-tinta text-[13px] font-semibold">
              <Video size={14} aria-hidden="true" /> Unirse a la reunión
            </a>
          ) : (
            proxima.cliente_id && (
              <button type="button" className="ml-auto h-8 px-3 rounded-[9px] bg-marfil text-tinta text-[13px] font-semibold" onClick={() => navegar(`/portal/crm/${proxima.cliente_id}`)}>
                Ver el cliente
              </button>
            )
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button type="button" aria-label="Semana anterior" className={flecha} onClick={() => setCorrimiento((n) => n - 1)}>
            <ChevronLeft size={16} aria-hidden="true" />
          </button>
          <button type="button" aria-label="Semana siguiente" className={flecha} onClick={() => setCorrimiento((n) => n + 1)}>
            <ChevronRight size={16} aria-hidden="true" />
          </button>
          <span className="font-semibold text-[15px] ml-1">{rango}</span>
          {corrimiento !== 0 && (
            <button type="button" className="text-sm text-piedra underline underline-offset-4 hover:text-bosque ml-2" onClick={() => setCorrimiento(0)}>
              Esta semana
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Personas a mostrar">
          {personas.map((p) => {
            const c = colorDe(p.id);
            const activa = !ocultas.has(p.id);
            return (
              <button
                key={p.id}
                type="button"
                aria-pressed={activa}
                onClick={() =>
                  setOcultas((s) => {
                    const n = new Set(s);
                    if (n.has(p.id)) n.delete(p.id);
                    else n.add(p.id);
                    return n;
                  })
                }
                className={`inline-flex items-center gap-2 pl-1 pr-3 py-1 rounded-pastilla border bg-papel text-[13.5px] ${activa ? '' : 'opacity-50'}`}
                style={{ borderColor: activa ? c.fuerte : 'var(--color-borde-suave)' }}
              >
                <span className="w-7 h-7 rounded-full grid place-items-center text-[11px] font-bold text-marfil" style={{ background: c.fuerte }}>
                  {inicialesDe(p.nombre)}
                </span>
                {p.nombre.split(' ')[0]}
              </button>
            );
          })}
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[760px] bg-papel border border-borde-suave rounded-[18px] pt-3 pb-4 pr-3.5 pl-1.5">
          <div className="grid grid-cols-[52px_repeat(5,1fr)]">
            <span />
            {dias.map((d) => {
              const hoy = d.toDateString() === ahora.toDateString();
              return (
                <span key={d.toISOString()} className={`px-2 pb-2.5 text-[13px] capitalize ${hoy ? 'font-bold text-bosque' : 'font-semibold text-piedra'}`}>
                  {d.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric' }).replace('.', '')}
                  {hoy ? ' · hoy' : ''}
                </span>
              );
            })}
          </div>
          <div className="grid grid-cols-[52px_1fr]">
            <div>
              {Array.from({ length: filas }, (_, i) => (
                <div key={i} className="text-[11.5px] text-piedra text-right pr-2 -translate-y-[7px]" style={{ height: ALTO_HORA }}>
                  {inicioDia + i}:00
                </div>
              ))}
            </div>
            <div className="relative grid grid-cols-5">
              {Array.from({ length: filas }, (_, i) => (
                <div key={i} className="absolute left-0 right-0 border-t border-separador pointer-events-none" style={{ top: i * ALTO_HORA }} />
              ))}
              {dias.map((d) => {
                const hoy = d.toDateString() === ahora.toDateString();
                const delDia = deLaSemana.filter((r) => new Date(r.inicio).toDateString() === d.toDateString());
                return (
                  <div key={d.toISOString()} className={`relative border-l border-separador ${hoy ? 'bg-bosque/[0.035]' : ''}`} style={{ height: filas * ALTO_HORA }}>
                    {puedeAgendar &&
                      Array.from({ length: filas }, (_, i) => {
                        const inicio = new Date(d);
                        inicio.setHours(inicioDia + i, 0, 0, 0);
                        if (inicio.getTime() < Date.now()) return null;
                        return (
                          <button
                            key={i}
                            type="button"
                            aria-label={`Agendar el ${inicio.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric' })} a las ${inicioDia + i}`}
                            className="group absolute left-1 right-1 rounded-[6px] hover:border-[1.5px] hover:border-dashed hover:border-bosque hover:bg-bosque/[0.04] grid place-items-center"
                            style={{ top: i * ALTO_HORA + 1, height: ALTO_HORA - 3 }}
                            onClick={() => alAgendar(inicio, visibles.length === 1 ? visibles[0].id : null)}
                          >
                            <span className="hidden group-hover:block text-[12px] font-semibold text-bosque">+ Agendar</span>
                          </button>
                        );
                      })}
                    {delDia.map((r) => {
                      const ini = new Date(r.inicio);
                      const desdeArriba = (ini.getHours() + ini.getMinutes() / 60 - inicioDia) * ALTO_HORA;
                      const alto = Math.max(22, ((r.duracion_min ?? 45) / 60) * ALTO_HORA - 3);
                      const c = colorDe(r.miembro_id ?? '');
                      const fin = new Date(ini.getTime() + (r.duracion_min ?? 45) * 60000);
                      return (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => navegar(r.cliente_id ? `/portal/crm/${r.cliente_id}` : '/portal/crm/reuniones')}
                          className="absolute left-1 right-1 rounded-[6px] px-2 py-0.5 text-left overflow-hidden text-[12px] leading-tight z-[1]"
                          style={{ top: desdeArriba + 1, height: alto, background: c.claro, borderLeft: `3px solid ${c.fuerte}` }}
                          title={`${r.tipo ? TIPO_REUNION[r.tipo] : 'Reunión'} · ${conQuien(r)} · ${hora(ini)} a ${hora(fin)}`}
                        >
                          <span className="block font-semibold text-tinta truncate">
                            {r.tipo ? TIPO_REUNION[r.tipo] : 'Sin tipo'} · {conQuien(r)}
                          </span>
                          {alto >= 34 && (
                            <span className="block text-piedra text-[11.5px] truncate">
                              {hora(ini)} a {hora(fin)} · {nombre(r.miembro_id)}
                            </span>
                          )}
                        </button>
                      );
                    })}
                    {deGoogle
                      .filter((e) => new Date(e.inicio as string).toDateString() === d.toDateString())
                      .map((e) => {
                        const ini = new Date(e.inicio as string);
                        const fin = new Date(e.fin as string);
                        const desdeArriba = Math.max(0, (ini.getHours() + ini.getMinutes() / 60 - inicioDia) * ALTO_HORA);
                        const alto = Math.max(22, ((fin.getTime() - ini.getTime()) / 3600000) * ALTO_HORA - 3);
                        const c = colorDe(e.miembro_id);
                        const contenido = (
                          <>
                            <span className="block font-medium text-tinta truncate">{e.titulo}</span>
                            {alto >= 34 && (
                              <span className="block text-piedra text-[11.5px] truncate">
                                {hora(ini)} a {hora(fin)} · {nombre(e.miembro_id)} · Google
                              </span>
                            )}
                          </>
                        );
                        const estilo: React.CSSProperties = { top: desdeArriba + 1, height: alto, border: `1px dashed ${c.fuerte}`, borderLeftWidth: 3, borderLeftStyle: 'solid', background: e.libre ? 'transparent' : 'var(--color-papel)' };
                        const clase = 'absolute left-1 right-1 rounded-[6px] px-2 py-0.5 text-left overflow-hidden text-[12px] leading-tight z-[1]';
                        return e.enlace ? (
                          <a key={e.id} href={e.enlace} target="_blank" rel="noreferrer noopener" className={clase} style={estilo} title={`${e.titulo} · ${hora(ini)} a ${hora(fin)}`}>
                            {contenido}
                          </a>
                        ) : (
                          <div key={e.id} className={clase} style={estilo} title={`${e.titulo} · ${hora(ini)} a ${hora(fin)}`}>
                            {contenido}
                          </div>
                        );
                      })}
                    {hoy && ahora.getHours() >= inicioDia && ahora.getHours() < finDia && (
                      <div className="absolute -left-[5px] right-0 h-0.5 bg-peligro z-[2] pointer-events-none" style={{ top: (ahora.getHours() + ahora.getMinutes() / 60 - inicioDia) * ALTO_HORA }}>
                        <span className="absolute left-0 -top-1 w-2.5 h-2.5 rounded-full bg-peligro" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
      {errorG && <p className="text-[13px] text-peligro">{errorG}</p>}
      <p className="text-[12.5px] text-piedra">
        Un color por persona. Lleno, las reuniones del portal y las que llegan de Fathom. Punteado, la agenda de Google Calendar de quien lo conectó. Tocá un hueco para agendar.
      </p>
    </div>
  );
};

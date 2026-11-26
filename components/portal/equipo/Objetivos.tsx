import React, { useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '../../Button';
import { supabase } from '../supabase';
import { Aviso, Campo, Etiqueta, TituloSeccion, claseInput } from '../ui';
import { mensajeAmable } from '../errores';
import { ROLES_ELEGIBLES, ROL_COMERCIAL, rolDe, type RolComercial } from '../crm/tipos';
import type { BaseEquipo } from './EquipoApp';
import { ROTULO_MEDIDA, aNumero, esNumerico, fechaCortaDia, hoy, mesDe, numero, textoAlcance, type Alcance, type Avance, type Hito, type Medida, type Objetivo } from './tipos';

/**
 * Objetivos con su avance, que calcula la base (equipo_objetivos_avance), e
 * hitos por rol. Quien lidera el equipo pone los objetivos y ajusta los
 * hitos; el resto ve los del negocio, los de su rol y los suyos.
 */

const claseLink = 'underline underline-offset-4 hover:text-bosque';
const rotuloRol = (r: RolComercial) => ROL_COMERCIAL[r] ?? r;

interface Borrador {
  id?: string;
  titulo: string;
  alcance: Alcance;
  rol_comercial: RolComercial;
  miembro_id: string;
  medida: Medida;
  reporte_id: string;
  campo: string;
  meta: string;
  desde: string;
  hasta: string;
}

function nuevo(): Borrador {
  const { desde, hasta } = mesDe(hoy());
  return { titulo: '', alcance: 'rol', rol_comercial: 'closer', miembro_id: '', medida: 'reporte', reporte_id: '', campo: '', meta: '', desde, hasta };
}

const Barra: React.FC<{ avance: number; meta: number }> = ({ avance, meta }) => {
  const pct = meta > 0 ? Math.min(100, Math.round((avance / meta) * 100)) : 0;
  return (
    <div className="h-2 w-full bg-separador rounded-pastilla overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
      <div className={`h-full ${pct >= 100 ? 'bg-bosque' : 'bg-tinta'}`} style={{ width: `${pct}%` }} />
    </div>
  );
};

export const Objetivos: React.FC<{ base: BaseEquipo }> = ({ base }) => {
  const { orgId, equipo, yo, lidera, soloLectura, objetivos, hitos, reportes, recargar } = base;
  const [avances, setAvances] = useState<Avance[]>([]);
  const [cumplidos, setCumplidos] = useState<{ hito_id: string; miembro_id: string }[]>([]);
  const [plantillas, setPlantillas] = useState<Hito[]>([]);
  const [borrador, setBorrador] = useState<Borrador | null>(null);
  const [nuevoHito, setNuevoHito] = useState<{ rol: RolComercial; titulo: string; plazo: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const puedeEditar = lidera && !soloLectura;

  async function cargar() {
    if (!supabase) return;
    const [a, c, p] = await Promise.all([
      supabase.rpc('equipo_objetivos_avance', { org: orgId }),
      supabase.from('equipo_victorias').select('hito_id, miembro_id').eq('organizacion_id', orgId).eq('estado', 'validada').not('hito_id', 'is', null),
      supabase.from('equipo_hitos').select('*').is('organizacion_id', null).eq('activo', true).order('orden'),
    ]);
    const fallo = a.error ?? c.error;
    if (fallo) setError(mensajeAmable(fallo));
    setAvances(((a.data as Avance[]) ?? []).map((x) => ({ ...x, avance: Number(x.avance) })));
    setCumplidos((c.data as { hito_id: string; miembro_id: string }[]) ?? []);
    setPlantillas((p.data as Hito[]) ?? []);
  }

  useEffect(() => {
    void cargar();
  }, [orgId, objetivos]); // eslint-disable-line react-hooks/exhaustive-deps

  const persona = useMemo(() => new Map(equipo.map((m) => [m.id, m])), [equipo]);
  const hoyIso = hoy();
  const enCurso = objetivos.filter((o) => o.hasta >= hoyIso);
  const terminados = objetivos.filter((o) => o.hasta < hoyIso).slice(0, 12);
  const rolesEquipo = [...new Set(equipo.filter((m) => m.activo).map((m) => m.rol_comercial))];
  const rolesHitos = [...new Set([...rolesEquipo, ...hitos.map((h) => h.rol_comercial)])].sort((a, b) => rotuloRol(a).localeCompare(rotuloRol(b)));
  const reportesActivos = reportes.filter((r) => r.activo);

  function medidaDe(o: Objetivo): string {
    if (o.medida !== 'reporte') return ROTULO_MEDIDA[o.medida];
    const r = reportes.find((x) => x.id === o.reporte_id);
    return `${r?.campos.find((c) => c.clave === o.campo)?.etiqueta ?? 'Un número'} del ${r?.titulo.toLowerCase() ?? 'reporte'}`;
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase || !borrador) return;
    const meta = aNumero(borrador.meta);
    if (borrador.titulo.trim().length < 2) return setError('Poné un nombre al objetivo.');
    if (meta === null || Number.isNaN(meta) || meta <= 0) return setError('La meta tiene que ser un número mayor que cero.');
    if (borrador.alcance === 'persona' && !borrador.miembro_id) return setError('Elegí la persona.');
    if (borrador.medida === 'reporte' && (!borrador.reporte_id || !borrador.campo)) return setError('Elegí el reporte y el número que suma.');
    if (borrador.hasta < borrador.desde) return setError('La fecha de fin es anterior a la de inicio.');
    setGuardando(true);
    setError(null);
    setOk(null);
    const datos = {
      titulo: borrador.titulo.trim(),
      alcance: borrador.alcance,
      rol_comercial: borrador.alcance === 'rol' ? borrador.rol_comercial : null,
      miembro_id: borrador.alcance === 'persona' ? borrador.miembro_id : null,
      medida: borrador.medida,
      reporte_id: borrador.medida === 'reporte' ? borrador.reporte_id : null,
      campo: borrador.medida === 'reporte' ? borrador.campo : null,
      meta,
      desde: borrador.desde,
      hasta: borrador.hasta,
    };
    const { error: err } = borrador.id
      ? await supabase.from('equipo_objetivos').update(datos).eq('id', borrador.id)
      : await supabase.from('equipo_objetivos').insert({ ...datos, organizacion_id: orgId });
    setGuardando(false);
    if (err) return setError(mensajeAmable(err));
    setOk(borrador.id ? 'Objetivo actualizado.' : 'Objetivo creado. El avance se calcula solo.');
    setBorrador(null);
    await recargar();
  }

  async function archivar(o: Objetivo) {
    if (!supabase) return;
    const { error: err } = await supabase.from('equipo_objetivos').update({ activo: false }).eq('id', o.id);
    if (err) return setError(mensajeAmable(err));
    setOk(`«${o.titulo}» se archivó.`);
    await recargar();
  }

  async function usarPlantillas(rol: RolComercial) {
    if (!supabase) return;
    setError(null);
    const { data, error: err } = await supabase.rpc('equipo_cargar_plantillas', { org: orgId, rol });
    if (err) return setError(mensajeAmable(err));
    const n = (data as { hitos?: number } | null)?.hitos ?? 0;
    setOk(n ? `Se sumaron ${n} hitos de ${rotuloRol(rol).toLowerCase()}. Los podés ajustar.` : 'Ya estaban todos los hitos de FIRMA para ese rol.');
    await recargar();
  }

  async function guardarHito(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase || !nuevoHito) return;
    const plazo = nuevoHito.plazo.trim() ? Number(nuevoHito.plazo) : null;
    if (nuevoHito.titulo.trim().length < 2) return setError('Escribí el hito.');
    if (plazo !== null && (!Number.isInteger(plazo) || plazo < 1 || plazo > 365)) return setError('El plazo va en días, entre 1 y 365.');
    const orden = Math.max(0, ...hitos.filter((h) => h.rol_comercial === nuevoHito.rol).map((h) => h.orden)) + 1;
    const { error: err } = await supabase
      .from('equipo_hitos')
      .insert({ organizacion_id: orgId, rol_comercial: nuevoHito.rol, titulo: nuevoHito.titulo.trim(), plazo_dias: plazo, orden });
    if (err) return setError(mensajeAmable(err));
    setNuevoHito(null);
    await recargar();
  }

  async function alternarHito(h: Hito) {
    if (!supabase) return;
    const { error: err } = await supabase.from('equipo_hitos').update({ activo: !h.activo }).eq('id', h.id);
    if (err) return setError(mensajeAmable(err));
    await recargar();
  }

  const tarjetaObjetivo = (o: Objetivo) => {
    const filas = avances.filter((a) => a.objetivo_id === o.id);
    return (
      <li key={o.id} className="bg-papel border border-borde-suave rounded-control p-5 flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-heading font-bold text-[16.5px] leading-snug">{o.titulo}</p>
            <p className="text-[13px] text-piedra mt-0.5">
              {textoAlcance(o, equipo, rotuloRol)} · {medidaDe(o)} · del {fechaCortaDia(o.desde)} al {fechaCortaDia(o.hasta)}
            </p>
          </div>
          <span className="font-heading font-bold tabular-nums">Meta {numero(o.meta)}</span>
        </div>
        {filas.length === 0 ? (
          <p className="text-[13px] text-piedra">
            {o.alcance === 'rol' ? `No hay nadie activo con el rol ${rotuloRol(o.rol_comercial as RolComercial).toLowerCase()}.` : 'Sin avance para mostrar.'}
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {filas
              .sort((a, b) => b.avance - a.avance)
              .map((a) => (
                <li key={a.miembro_id ?? 'negocio'} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1.5 items-center">
                  <span className={`text-[14px] truncate ${a.miembro_id && a.miembro_id === yo?.id ? 'font-semibold' : ''}`}>
                    {a.miembro_id ? (persona.get(a.miembro_id)?.nombre ?? 'Sin nombre') : 'Todo el equipo'}
                  </span>
                  <span className="text-[13.5px] tabular-nums">
                    {numero(a.avance)} de {numero(o.meta)}
                    {a.avance >= o.meta && (
                      <span className="ml-2">
                        <Etiqueta tono="bosque">Cumplido</Etiqueta>
                      </span>
                    )}
                  </span>
                  <div className="col-span-2">
                    <Barra avance={a.avance} meta={o.meta} />
                  </div>
                </li>
              ))}
          </ul>
        )}
        {puedeEditar && (
          <div className="flex gap-4 text-[13px]">
            <button
              type="button"
              className={claseLink}
              onClick={() =>
                setBorrador({
                  id: o.id,
                  titulo: o.titulo,
                  alcance: o.alcance,
                  rol_comercial: o.rol_comercial ?? 'closer',
                  miembro_id: o.miembro_id ?? '',
                  medida: o.medida,
                  reporte_id: o.reporte_id ?? '',
                  campo: o.campo ?? '',
                  meta: String(o.meta),
                  desde: o.desde,
                  hasta: o.hasta,
                })
              }
            >
              Editar
            </button>
            <button type="button" className={`${claseLink} text-piedra`} onClick={() => void archivar(o)}>
              Archivar
            </button>
          </div>
        )}
      </li>
    );
  };

  const reporteElegido = reportesActivos.find((r) => r.id === borrador?.reporte_id);

  return (
    <div className="flex flex-col gap-10">
      {error && <Aviso tipo="error">{error}</Aviso>}
      {ok && <Aviso tipo="ok">{ok}</Aviso>}

      {borrador && (
        <form onSubmit={guardar} className="bg-marfil-oscuro p-6 desk:p-8 flex flex-col gap-5 max-w-[720px]">
          <h2 className="h3">{borrador.id ? 'Editar objetivo' : 'Nuevo objetivo'}</h2>
          <Campo etiqueta="Objetivo">
            <input
              required
              className={claseInput}
              maxLength={140}
              placeholder="12 cierres en diciembre"
              value={borrador.titulo}
              onChange={(e) => setBorrador({ ...borrador, titulo: e.target.value })}
            />
          </Campo>
          <div className="grid gap-5 tab:grid-cols-2">
            <Campo etiqueta="¿Para quién?">
              <select className={claseInput} value={borrador.alcance} onChange={(e) => setBorrador({ ...borrador, alcance: e.target.value as Alcance })}>
                <option value="rol">Cada persona de un rol</option>
                <option value="persona">Una persona</option>
                <option value="negocio">Todo el equipo junto</option>
              </select>
            </Campo>
            {borrador.alcance === 'rol' && (
              <Campo etiqueta="Rol">
                <select className={claseInput} value={borrador.rol_comercial} onChange={(e) => setBorrador({ ...borrador, rol_comercial: e.target.value as RolComercial })}>
                  {ROLES_ELEGIBLES.map((r) => (
                    <option key={r} value={r}>
                      {ROL_COMERCIAL[r]}
                    </option>
                  ))}
                </select>
              </Campo>
            )}
            {borrador.alcance === 'persona' && (
              <Campo etiqueta="Persona">
                <select className={claseInput} value={borrador.miembro_id} onChange={(e) => setBorrador({ ...borrador, miembro_id: e.target.value })}>
                  <option value="">Elegí una persona</option>
                  {equipo
                    .filter((m) => m.activo)
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.nombre} · {rolDe(m)}
                      </option>
                    ))}
                </select>
              </Campo>
            )}
          </div>
          <Campo
            etiqueta="¿Cómo se mide?"
            ayuda={
              borrador.medida === 'reporte'
                ? 'Suma ese número de los reportes del período.'
                : borrador.medida === 'valor'
                  ? 'Suma el valor de las victorias validadas que se cargan atadas a este objetivo.'
                  : 'Cuenta las victorias validadas que se cargan atadas a este objetivo.'
            }
          >
            <select className={claseInput} value={borrador.medida} onChange={(e) => setBorrador({ ...borrador, medida: e.target.value as Medida })}>
              {(Object.keys(ROTULO_MEDIDA) as Medida[]).map((m) => (
                <option key={m} value={m} disabled={m === 'reporte' && reportesActivos.length === 0}>
                  {ROTULO_MEDIDA[m]}
                </option>
              ))}
            </select>
          </Campo>
          {borrador.medida === 'reporte' && (
            <div className="grid gap-5 tab:grid-cols-2">
              <Campo etiqueta="Reporte">
                <select className={claseInput} value={borrador.reporte_id} onChange={(e) => setBorrador({ ...borrador, reporte_id: e.target.value, campo: '' })}>
                  <option value="">Elegí un reporte</option>
                  {reportesActivos.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.titulo}
                    </option>
                  ))}
                </select>
              </Campo>
              <Campo etiqueta="Número que suma">
                <select className={claseInput} value={borrador.campo} disabled={!reporteElegido} onChange={(e) => setBorrador({ ...borrador, campo: e.target.value })}>
                  <option value="">Elegí un campo</option>
                  {reporteElegido?.campos
                    .filter((c) => esNumerico(c.tipo))
                    .map((c) => (
                      <option key={c.clave} value={c.clave}>
                        {c.etiqueta}
                      </option>
                    ))}
                </select>
              </Campo>
            </div>
          )}
          <div className="grid gap-5 tab:grid-cols-3">
            <Campo etiqueta="Meta">
              <input
                required
                inputMode="decimal"
                className={claseInput}
                placeholder="12"
                value={borrador.meta}
                onChange={(e) => setBorrador({ ...borrador, meta: e.target.value })}
              />
            </Campo>
            <Campo etiqueta="Desde">
              <input type="date" required className={claseInput} value={borrador.desde} onChange={(e) => setBorrador({ ...borrador, desde: e.target.value })} />
            </Campo>
            <Campo etiqueta="Hasta">
              <input type="date" required className={claseInput} value={borrador.hasta} onChange={(e) => setBorrador({ ...borrador, hasta: e.target.value })} />
            </Campo>
          </div>
          <div className="flex gap-3">
            <Button type="submit" disabled={guardando}>
              {guardando ? 'Guardando…' : 'Guardar'}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setBorrador(null)}>
              Cancelar
            </Button>
          </div>
        </form>
      )}

      <section>
        <TituloSeccion
          eyebrow="En curso"
          titulo="Objetivos"
          acciones={
            puedeEditar && !borrador ? (
              <Button size="sm" onClick={() => setBorrador(nuevo())}>
                <Plus size={16} aria-hidden="true" /> Nuevo objetivo
              </Button>
            ) : null
          }
        />
        {enCurso.length === 0 ? (
          <p className="text-piedra text-[14px] max-w-[62ch]">
            {lidera
              ? 'Todavía no hay objetivos en curso. Un objetivo tiene meta y período, por ejemplo 12 cierres en diciembre para cada closer, y el avance sale solo de los reportes o de las victorias.'
              : 'Todavía no hay objetivos en curso para vos.'}
          </p>
        ) : (
          <ul className="grid gap-3 desk:grid-cols-2">{enCurso.map(tarjetaObjetivo)}</ul>
        )}
      </section>

      {terminados.length > 0 && (
        <section>
          <TituloSeccion eyebrow="Terminados" titulo="Períodos cerrados" />
          <ul className="grid gap-3 desk:grid-cols-2">{terminados.map(tarjetaObjetivo)}</ul>
        </section>
      )}

      <section>
        <TituloSeccion eyebrow="Por rol" titulo="Hitos" />
        <p className="text-piedra text-[14px] max-w-[62ch] -mt-3 mb-6">
          Lo que se espera de cada rol en sus primeros meses. Se cumple cuando se valida una victoria atada al hito.
        </p>
        {rolesHitos.length === 0 ? (
          <p className="text-piedra text-[14px]">Cuando sumes gente al equipo, acá aparecen los hitos de su rol.</p>
        ) : (
          <div className="grid gap-4 desk:grid-cols-2">
            {rolesHitos.map((rol) => {
              const propios = hitos.filter((h) => h.rol_comercial === rol);
              const deFirma = plantillas.filter((p) => p.rol_comercial === rol);
              const faltan = deFirma.filter((p) => !propios.some((h) => h.titulo.trim().toLowerCase() === p.titulo.trim().toLowerCase()));
              return (
                <div key={rol} className="bg-papel border border-borde-suave rounded-control p-5 flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-heading font-bold text-[16px]">{rotuloRol(rol)}</p>
                    {puedeEditar && faltan.length > 0 && (
                      <button type="button" className={`${claseLink} text-[13px]`} onClick={() => void usarPlantillas(rol)}>
                        Usar los de FIRMA ({faltan.length})
                      </button>
                    )}
                  </div>
                  {propios.length === 0 ? (
                    <p className="text-[13px] text-piedra">Sin hitos todavía.</p>
                  ) : (
                    <ul className="flex flex-col divide-y divide-borde-suave">
                      {propios.map((h) => {
                        const quienes = cumplidos
                          .filter((c) => c.hito_id === h.id)
                          .map((c) => persona.get(c.miembro_id)?.nombre)
                          .filter(Boolean);
                        return (
                          <li key={h.id} className={`py-2.5 flex items-start justify-between gap-3 ${h.activo ? '' : 'opacity-50'}`}>
                            <div className="min-w-0">
                              <p className="text-[14px]">
                                {h.titulo}
                                {h.plazo_dias ? <span className="text-piedra"> · día {h.plazo_dias}</span> : null}
                              </p>
                              {quienes.length > 0 && (
                                <p className="text-[12.5px] text-bosque mt-0.5">
                                  {new Set(quienes).size > 1 ? 'Lo cumplieron' : 'Lo cumplió'} {[...new Set(quienes)].join(', ')}
                                </p>
                              )}
                            </div>
                            {puedeEditar && (
                              <button type="button" className={`${claseLink} text-[12.5px] text-piedra shrink-0`} onClick={() => void alternarHito(h)}>
                                {h.activo ? 'Archivar' : 'Volver a usar'}
                              </button>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  {puedeEditar &&
                    (nuevoHito?.rol === rol ? (
                      <form onSubmit={guardarHito} className="flex flex-col gap-2 pt-1">
                        <input
                          className={claseInput}
                          autoFocus
                          maxLength={140}
                          placeholder="Primer cliente renovado"
                          value={nuevoHito.titulo}
                          onChange={(e) => setNuevoHito({ ...nuevoHito, titulo: e.target.value })}
                        />
                        <div className="flex flex-wrap items-center gap-2">
                          <input
                            inputMode="numeric"
                            className={`${claseInput} w-[150px]`}
                            placeholder="Día (opcional)"
                            value={nuevoHito.plazo}
                            onChange={(e) => setNuevoHito({ ...nuevoHito, plazo: e.target.value })}
                          />
                          <Button size="sm" type="submit">
                            Sumar
                          </Button>
                          <Button size="sm" variant="ghost" type="button" onClick={() => setNuevoHito(null)}>
                            Cancelar
                          </Button>
                        </div>
                      </form>
                    ) : (
                      <button type="button" className={`${claseLink} self-start text-[13px]`} onClick={() => setNuevoHito({ rol, titulo: '', plazo: '' })}>
                        Sumar un hito
                      </button>
                    ))}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};

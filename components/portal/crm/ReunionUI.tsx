import React, { useState } from 'react';
import { ExternalLink, Pencil, Video } from 'lucide-react';
import { Button } from '../../Button';
import { supabase } from '../supabase';
import { Aviso, Campo, Enlace, Etiqueta, claseInput } from '../ui';
import { mensajeAmable } from '../errores';
import { pedirGoogle } from '../google';
import { rolDe, type IntegranteEquipo } from './tipos';
import {
  COLUMNAS_REUNION,
  ESTADO_REUNION,
  RESULTADO_VENTA,
  TIPO_REUNION,
  aInputLocal,
  desdeInputLocal,
  hora,
  porCompletar,
  yaPaso,
  type EstadoReunion,
  type Reunion,
  type ResultadoVenta,
  type TipoReunion,
} from './reunionesDatos';
import { claseBotonHero } from '../../Button';
import { Selector, Fecha } from '../campos';

/** Un cliente para elegir con quién es la reunión. */
export interface ClienteOpcion {
  id: string;
  nombre: string;
  codigo?: string | null;
  responsable_id?: string | null;
}

interface Borrador {
  cliente_id: string;
  conProspecto: boolean;
  prospecto: string;
  titulo: string;
  tipo: TipoReunion | '';
  inicio: string;
  duracion_min: string;
  miembro_id: string;
  agendada_por: string;
  estado: EstadoReunion;
  resultado: ResultadoVenta | '';
  enlace: string;
  notas: string;
}

function borradorDe(r: Reunion | undefined, clienteId: string | undefined, miembroId: string | undefined, inicio?: string): Borrador {
  const enUnaHora = new Date(Date.now() + 3600_000);
  enUnaHora.setMinutes(0, 0, 0);
  return {
    cliente_id: r?.cliente_id ?? clienteId ?? '',
    conProspecto: Boolean(r && !r.cliente_id && r.prospecto),
    prospecto: r?.prospecto ?? '',
    titulo: r?.titulo ?? '',
    tipo: r?.tipo ?? '',
    inicio: aInputLocal(r?.inicio ?? inicio ?? enUnaHora.toISOString()),
    duracion_min: r?.duracion_min ? String(r.duracion_min) : '',
    miembro_id: r?.miembro_id ?? miembroId ?? '',
    agendada_por: r?.agendada_por ?? '',
    estado: r?.estado ?? 'agendada',
    resultado: r?.resultado ?? '',
    enlace: r?.enlace ?? '',
    notas: r?.notas ?? '',
  };
}

/** Personas del equipo para un menú: las activas y la que ya estaba elegida aunque hoy no lo esté. */
const paraElegir = (equipo: IntegranteEquipo[], actual: string) =>
  equipo.filter((m) => m.activo || m.id === actual).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

/** Alta y edición de una reunión. Con lista de clientes se elige con quién; sin lista es con el cliente de la ficha. */
export const FormReunion: React.FC<{
  orgId: string;
  equipo: IntegranteEquipo[];
  clientes?: ClienteOpcion[];
  clienteId?: string;
  inicial?: Reunion;
  miembroPorDefecto?: string;
  /** Para una reunión nueva, la hora elegida en el calendario. */
  inicioPorDefecto?: string;
  /** Personas del equipo con Google Calendar conectado (0080). */
  conectados?: Set<string>;
  puedeBorrar?: boolean;
  alGuardar: (r: Reunion) => void;
  alBorrar?: (id: string) => void;
  alCancelar: () => void;
}> = ({ orgId, equipo, clientes, clienteId, inicial, miembroPorDefecto, inicioPorDefecto, conectados, puedeBorrar, alGuardar, alBorrar, alCancelar }) => {
  const [b, setB] = useState<Borrador>(() => borradorDe(inicial, clienteId, miembroPorDefecto, inicioPorDefecto));
  const [estadoTocado, setEstadoTocado] = useState(Boolean(inicial));
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const set = <K extends keyof Borrador>(k: K, v: Borrador[K]) => setB((x) => ({ ...x, [k]: v }));
  const pasada = Boolean(b.inicio) && Date.parse(desdeInputLocal(b.inicio)) <= Date.now() + 3600_000;
  // Crearla también en el Google Calendar de la persona, con Meet (0080).
  const [enGoogle, setEnGoogle] = useState(true);
  const [invitar, setInvitar] = useState(true);
  const [avisoGoogle, setAvisoGoogle] = useState<{ texto: string; guardada: Reunion } | null>(null);
  const puedeGoogle = !inicial && Boolean(b.miembro_id) && Boolean(conectados?.has(b.miembro_id)) && b.estado === 'agendada';
  const nombrePersona = equipo.find((m) => m.id === b.miembro_id)?.nombre.split(' ')[0] ?? '';
  const conCliente = Boolean(clienteId) && !clientes;

  function cambiarInicio(v: string) {
    setB((x) => {
      const yaFue = Boolean(v) && Date.parse(desdeInputLocal(v)) <= Date.now();
      // Una reunión nueva con fecha pasada se carga como hecha, salvo que se haya elegido otro estado.
      return { ...x, inicio: v, estado: estadoTocado ? x.estado : yaFue ? 'realizada' : 'agendada' };
    });
  }

  function cambiarCliente(id: string) {
    const c = clientes?.find((x) => x.id === id);
    // La reunión queda por defecto con el Account Manager del cliente.
    setB((x) => ({ ...x, cliente_id: id, miembro_id: x.miembro_id || c?.responsable_id || '' }));
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    const prospecto = b.prospecto.trim().replace(/\s+/g, ' ');
    const cliente = conCliente ? (clienteId as string) : b.conProspecto ? null : b.cliente_id || null;
    if (!cliente && prospecto.length < 2 && !inicial?.interaccion_id) return setError('Elegí el cliente o escribí el nombre del prospecto.');
    if (!b.tipo) return setError('Elegí el tipo. Fathom no distingue un seguimiento de un cierre, por eso se marca acá.');
    if (!b.inicio) return setError('Falta la fecha y la hora.');
    const enlace = b.enlace.trim();
    if (enlace && !/^https?:\/\//i.test(enlace)) return setError('El link de la grabación tiene que empezar con https://');
    const duracion = b.duracion_min ? Number(b.duracion_min) : null;
    if (duracion !== null && (!Number.isInteger(duracion) || duracion < 5 || duracion > 600)) return setError('La duración va en minutos, entre 5 y 600.');
    if ((b.estado === 'realizada' || b.estado === 'no_asistio') && !pasada) return setError('Una reunión que todavía no pasó no se marca como hecha ni como faltazo.');
    const datos = {
      organizacion_id: orgId,
      cliente_id: cliente,
      prospecto: cliente ? null : prospecto || null,
      titulo: b.titulo.trim() || null,
      tipo: b.tipo,
      inicio: desdeInputLocal(b.inicio),
      duracion_min: duracion,
      miembro_id: b.miembro_id || null,
      agendada_por: b.agendada_por || null,
      estado: b.estado,
      resultado: b.tipo === 'venta' && b.estado === 'realizada' && b.resultado ? b.resultado : null,
      enlace: enlace || null,
      notas: b.notas.trim() || null,
    };
    setGuardando(true);
    setError(null);
    const consulta = inicial
      ? supabase.from('crm_reuniones').update(datos).eq('id', inicial.id).select(COLUMNAS_REUNION).single()
      : supabase.from('crm_reuniones').insert(datos).select(COLUMNAS_REUNION).single();
    const { data, error: e2 } = await consulta;
    if (e2 || !data) {
      setGuardando(false);
      return setError(mensajeAmable(e2, 'No se pudo guardar la reunión.'));
    }
    const guardada = data as Reunion;
    if (puedeGoogle && enGoogle) {
      try {
        const res = await pedirGoogle<{ enlace: string | null; evento: string }>('crear', { org: orgId, reunion_id: guardada.id, invitar: invitar && Boolean(cliente) });
        setGuardando(false);
        return alGuardar({ ...guardada, google_evento_id: res.evento, enlace_reunion: res.enlace });
      } catch (e) {
        setGuardando(false);
        return setAvisoGoogle({ texto: e instanceof Error ? e.message : 'No se pudo crear en Google.', guardada });
      }
    }
    setGuardando(false);
    alGuardar(guardada);
  }

  async function borrar() {
    if (!supabase || !inicial) return;
    if (!window.confirm('¿Borramos esta reunión? No se puede deshacer.')) return;
    setGuardando(true);
    const { data, error: e } = await supabase.from('crm_reuniones').delete().eq('id', inicial.id).select('id');
    setGuardando(false);
    if (e) return setError(mensajeAmable(e));
    if (!data?.length) return setError('La borra el titular de la empresa o quien la cargó.');
    alBorrar?.(inicial.id);
  }

  const personas = paraElegir(equipo, b.miembro_id);
  const agendadores = paraElegir(equipo, b.agendada_por);

  if (avisoGoogle)
    return (
      <div className="bg-marfil-oscuro p-6 desk:p-7 flex flex-col gap-4">
        <Aviso tipo="error">La reunión quedó guardada en el portal, pero no se pudo crear en Google Calendar. {avisoGoogle.texto}</Aviso>
        <div>
          <Button type="button" onClick={() => alGuardar(avisoGoogle.guardada)}>
            Cerrar
          </Button>
        </div>
      </div>
    );

  return (
    <form onSubmit={guardar} className="bg-marfil-oscuro p-6 desk:p-7 flex flex-col gap-5">
      <h3 className="h3">{inicial ? 'Editar reunión' : 'Nueva reunión'}</h3>
      {error && <Aviso tipo="error">{error}</Aviso>}
      <div className="grid gap-5 tab:grid-cols-2">
        {!conCliente && (
          <div className="tab:col-span-2 grid gap-3 tab:grid-cols-2 items-end">
            {b.conProspecto ? (
              <Campo etiqueta="Prospecto" ayuda="Alguien que todavía no es cliente. Cuando cierre, se da de alta en el CRM.">
                <input className={claseInput} maxLength={160} value={b.prospecto} onChange={(e) => set('prospecto', e.target.value)} placeholder="Nombre y apellido" />
              </Campo>
            ) : (
              <Campo etiqueta="Cliente">
                <Selector className={claseInput} value={b.cliente_id} onChange={(e) => cambiarCliente(e.target.value)}>
                  <option value="">Elegí el cliente</option>
                  {(clientes ?? []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                      {c.codigo ? ` · ${c.codigo}` : ''}
                    </option>
                  ))}
                </Selector>
              </Campo>
            )}
            <label className="flex items-center gap-2.5 text-sm h-11">
              <input type="checkbox" className="w-4 h-4 accent-bosque" checked={b.conProspecto} onChange={(e) => set('conProspecto', e.target.checked)} />
              Es con un prospecto, todavía no es cliente
            </label>
          </div>
        )}
        <Campo etiqueta="Tipo" ayuda="Lo marca una persona. De acá salen la asistencia y el cierre de cada uno.">
          <Selector className={claseInput} value={b.tipo} onChange={(e) => set('tipo', e.target.value as TipoReunion | '')}>
            <option value="">Elegí el tipo</option>
            {(Object.keys(TIPO_REUNION) as TipoReunion[]).map((t) => (
              <option key={t} value={t}>
                {TIPO_REUNION[t]}
              </option>
            ))}
          </Selector>
        </Campo>
        <Campo etiqueta="Fecha y hora">
          <Fecha type="datetime-local" required className={claseInput} value={b.inicio} onChange={(e) => cambiarInicio(e.target.value)} />
        </Campo>
        <Campo etiqueta="Con quién del equipo">
          <Selector className={claseInput} value={b.miembro_id} onChange={(e) => set('miembro_id', e.target.value)}>
            <option value="">Sin asignar</option>
            {personas.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nombre} · {rolDe(m)}
                {!m.activo ? ' · inactivo' : ''}
              </option>
            ))}
          </Selector>
        </Campo>
        <Campo etiqueta="La agendó" ayuda="Opcional. Por ejemplo el setter que consiguió la llamada.">
          <Selector className={claseInput} value={b.agendada_por} onChange={(e) => set('agendada_por', e.target.value)}>
            <option value="">Nadie en particular</option>
            {agendadores.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nombre} · {rolDe(m)}
              </option>
            ))}
          </Selector>
        </Campo>
        <Campo etiqueta="Estado">
          <Selector
            className={claseInput}
            value={b.estado}
            onChange={(e) => {
              setEstadoTocado(true);
              set('estado', e.target.value as EstadoReunion);
            }}
          >
            {(Object.keys(ESTADO_REUNION) as EstadoReunion[]).map((x) => (
              <option key={x} value={x} disabled={(x === 'realizada' || x === 'no_asistio') && !pasada}>
                {ESTADO_REUNION[x].titulo}
              </option>
            ))}
          </Selector>
        </Campo>
        {b.tipo === 'venta' && b.estado === 'realizada' ? (
          <Campo etiqueta="Resultado">
            <Selector className={claseInput} value={b.resultado} onChange={(e) => set('resultado', e.target.value as ResultadoVenta | '')}>
              <option value="">Sin cargar</option>
              {(Object.keys(RESULTADO_VENTA) as ResultadoVenta[]).map((x) => (
                <option key={x} value={x}>
                  {RESULTADO_VENTA[x]}
                </option>
              ))}
            </Selector>
          </Campo>
        ) : (
          <Campo etiqueta="Duración en minutos (opcional)">
            <input type="number" min={5} max={600} step={5} className={claseInput} value={b.duracion_min} onChange={(e) => set('duracion_min', e.target.value)} />
          </Campo>
        )}
        <Campo etiqueta="Link de la grabación" ayuda="El de Fathom u otro. Las llamadas que llegan de Fathom lo traen solo.">
          <input type="url" className={claseInput} maxLength={500} value={b.enlace} onChange={(e) => set('enlace', e.target.value)} placeholder="https://fathom.video/share/..." />
        </Campo>
        <Campo etiqueta="Título (opcional)">
          <input className={claseInput} maxLength={300} value={b.titulo} onChange={(e) => set('titulo', e.target.value)} placeholder="Revisión del primer mes" />
        </Campo>
        <div className="tab:col-span-2">
          <Campo etiqueta="Notas (opcional)">
            <textarea className={`${claseInput} h-24 py-2.5`} maxLength={4000} value={b.notas} onChange={(e) => set('notas', e.target.value)} />
          </Campo>
        </div>
      </div>
      {puedeGoogle && (
        <div className="flex flex-col gap-2 bg-papel border border-borde-suave rounded-[12px] p-3.5">
          <label className="flex items-center gap-2.5 text-sm">
            <input type="checkbox" className="w-4 h-4 accent-bosque" checked={enGoogle} onChange={(e) => setEnGoogle(e.target.checked)} />
            Crearla en el Google Calendar de {nombrePersona} con link de Meet
          </label>
          {enGoogle && (conCliente || (!b.conProspecto && b.cliente_id)) && (
            <label className="flex items-center gap-2.5 text-sm">
              <input type="checkbox" className="w-4 h-4 accent-bosque" checked={invitar} onChange={(e) => setInvitar(e.target.checked)} />
              Mandarle la invitación al cliente por mail
            </label>
          )}
        </div>
      )}
      {inicial?.google_evento_id && <p className="text-[12.5px] text-piedra">Está en Google Calendar. Si cambiás la fecha o la hora, cambiala también allá.</p>}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={guardando}>
          {guardando ? 'Guardando' : inicial ? 'Guardar cambios' : 'Guardar reunión'}
        </Button>
        <Button type="button" variant="ghost" onClick={alCancelar} disabled={guardando}>
          Cancelar
        </Button>
        {inicial && puedeBorrar && (
          <button type="button" onClick={borrar} disabled={guardando} className="ml-auto text-sm text-peligro underline underline-offset-4">
            Borrar reunión
          </button>
        )}
      </div>
    </form>
  );
};

/** Una reunión en una lista, con lo que se completa sin abrir el formulario: el tipo, si se hizo y el resultado de una venta. */
export const FilaReunion: React.FC<{
  r: Reunion;
  equipo: IntegranteEquipo[];
  /** Con quién fue, cuando la lista mezcla clientes. */
  conQuien?: { nombre: string; a?: string } | null;
  editable: boolean;
  alCambiar: (r: Reunion) => void;
  alEditar: () => void;
}> = ({ r, equipo, conQuien, editable, alCambiar, alEditar }) => {
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const persona = r.miembro_id ? equipo.find((m) => m.id === r.miembro_id) : null;
  const agendo = r.agendada_por ? equipo.find((m) => m.id === r.agendada_por) : null;
  const estado = ESTADO_REUNION[r.estado];
  const pendienteDeMarcar = r.estado === 'agendada' && yaPaso(r);

  async function actualizar(cambios: Partial<Pick<Reunion, 'tipo' | 'estado' | 'resultado'>>) {
    if (!supabase) return;
    setOcupado(true);
    setError(null);
    const { data, error: e } = await supabase.from('crm_reuniones').update(cambios).eq('id', r.id).select(COLUMNAS_REUNION).single();
    setOcupado(false);
    if (e || !data) return setError(mensajeAmable(e, 'No se pudo guardar.'));
    alCambiar(data as Reunion);
  }

  const boton = claseBotonHero('ghost', 'sm');

  return (
    <li className={`py-4 border-b border-tinta/10 last:border-b-0 flex flex-col gap-2.5 ${porCompletar(r) ? 'bg-niebla/40 -mx-3 px-3' : ''}`}>
      <div className="flex flex-wrap items-start gap-x-5 gap-y-2">
        <div className="w-14 shrink-0 tabular-nums font-semibold pt-0.5">{hora(r.inicio)}</div>
        <div className="flex-1 min-w-[220px]">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            {conQuien ? (
              conQuien.a ? (
                <Enlace a={conQuien.a} className="font-heading font-bold text-[15.5px] leading-tight hover:text-bosque">
                  {conQuien.nombre}
                </Enlace>
              ) : (
                <span className="font-heading font-bold text-[15.5px] leading-tight">{conQuien.nombre}</span>
              )
            ) : null}
            {r.tipo ? <Etiqueta tono="piedra">{TIPO_REUNION[r.tipo]}</Etiqueta> : <Etiqueta tono="alerta">Sin tipo</Etiqueta>}
            <Etiqueta tono={estado.tono}>{estado.titulo}</Etiqueta>
            {r.resultado && <Etiqueta tono={r.resultado === 'cerro' ? 'bosque' : 'piedra'}>{RESULTADO_VENTA[r.resultado]}</Etiqueta>}
          </div>
          <div className="text-[13px] text-piedra mt-1 flex flex-wrap gap-x-3">
            {r.titulo && <span>{r.titulo}</span>}
            <span>{persona ? `${persona.nombre} · ${rolDe(persona)}` : 'Sin persona del equipo'}</span>
            {agendo && <span>Agendó {agendo.nombre}</span>}
            {r.duracion_min && <span>{r.duracion_min} min</span>}
          </div>
          {r.notas && <p className="text-[13.5px] mt-1.5 max-w-[70ch] whitespace-pre-line">{r.notas}</p>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {r.enlace_reunion && Date.parse(r.inicio) > Date.now() - 2 * 3600_000 && r.estado === 'agendada' && (
            <a href={r.enlace_reunion} target="_blank" rel="noreferrer noopener" className={claseBotonHero('primary', 'sm')}>
              <Video size={14} aria-hidden="true" /> Unirse
            </a>
          )}
          {r.enlace && (
            <a href={r.enlace} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1.5 text-[13px] font-medium underline underline-offset-4 hover:text-bosque">
              <ExternalLink size={14} aria-hidden="true" /> Grabación
            </a>
          )}
          {editable && (
            <button type="button" onClick={alEditar} aria-label="Editar la reunión" className={claseBotonHero('ghost', 'sm', false, true)}>
              <Pencil size={14} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
      {editable && (!r.tipo || pendienteDeMarcar || (r.tipo === 'venta' && r.estado === 'realizada' && !r.resultado)) && (
        <div className="flex flex-wrap items-center gap-2 pl-0 tab:pl-[76px]">
          {!r.tipo && (
            <Selector
              aria-label="Tipo de reunión"
              className="h-8 pl-2.5 pr-8 text-[13px] bg-white border border-borde focus:outline-none focus:border-bosque"
              value=""
              disabled={ocupado}
              onChange={(e) => e.target.value && actualizar({ tipo: e.target.value as TipoReunion })}
            >
              <option value="">Elegí el tipo</option>
              {(Object.keys(TIPO_REUNION) as TipoReunion[]).map((t) => (
                <option key={t} value={t}>
                  {TIPO_REUNION[t]}
                </option>
              ))}
            </Selector>
          )}
          {pendienteDeMarcar && (
            <>
              <span className="text-[13px] text-piedra">¿Se hizo?</span>
              <button type="button" className={boton} disabled={ocupado} onClick={() => actualizar({ estado: 'realizada' })}>
                Sí, se hizo
              </button>
              <button type="button" className={boton} disabled={ocupado} onClick={() => actualizar({ estado: 'no_asistio' })}>
                No asistió
              </button>
              <button type="button" className={boton} disabled={ocupado} onClick={() => actualizar({ estado: 'cancelada' })}>
                Se canceló
              </button>
            </>
          )}
          {r.tipo === 'venta' && r.estado === 'realizada' && !r.resultado && (
            <>
              <span className="text-[13px] text-piedra">¿Cómo terminó?</span>
              {(Object.keys(RESULTADO_VENTA) as ResultadoVenta[]).map((x) => (
                <button key={x} type="button" className={boton} disabled={ocupado} onClick={() => actualizar({ resultado: x })}>
                  {RESULTADO_VENTA[x]}
                </button>
              ))}
            </>
          )}
        </div>
      )}
      {error && <p className="text-[13px] text-peligro">{error}</p>}
    </li>
  );
};

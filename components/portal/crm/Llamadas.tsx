import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Copy, MessageCircle } from 'lucide-react';
import { Button } from '../../Button';
import { supabase } from '../supabase';
import { Aviso, Campo, Cifras, Encabezado, Enlace, Etiqueta, Pestanas, TituloSeccion, claseInput } from '../ui';
import { useVistaPrevia } from '../vistaPrevia';
import { ROL_COMERCIAL, type IntegranteEquipo } from './tipos';
import { PasosFathom, urlWebhook } from './fathom';

/**
 * Llamadas de Fathom (migraciones 0049 y 0050).
 *   /portal/crm/llamadas
 * En Fathom los webhooks son de cada usuario, así que cada integrante que
 * graba tiene su URL y la carga en su propia cuenta de Fathom.
 *   Resumen      llamadas por semana, por integrante, sin cliente y las
 *                conexiones que necesitan atención.
 *   Conexiones   el estado de cada integrante. El titular conecta, manda el
 *                enlace de conexión a quien no tiene cuenta, pausa y
 *                desconecta.
 *   Llamadas     las recibidas; las que no se atribuyeron por el mail se
 *                asignan a mano.
 * Titular, CSM y FIRMA ven todo el negocio. Un closer ve «Mi Fathom» para
 * conectar la suya y solo sus llamadas. La transcripción no se muestra acá.
 */

interface Integracion {
  id: string;
  equipo_miembro_id: string;
  estado: 'pendiente' | 'activa' | 'pausada';
  invitacion_vence: string | null;
  ultima_recepcion: string | null;
  recepciones: number;
}

interface Llamada {
  id: string;
  cliente_id: string | null;
  equipo_miembro_id: string | null;
  titulo: string | null;
  ocurrida_en: string;
  duracion_seg: number | null;
}

interface ClienteCorto {
  id: string;
  nombre: string;
  codigo: string | null;
}

type Vista = 'resumen' | 'conexiones' | 'llamadas';

const SEMANAS = 12;
const DIA_MS = 86_400_000;

const ESTADO: Record<Integracion['estado'], { texto: string; tono: 'bosque' | 'piedra' | 'alerta' }> = {
  pendiente: { texto: 'Falta el secreto', tono: 'alerta' },
  activa: { texto: 'Activa', tono: 'bosque' },
  pausada: { texto: 'Pausada', tono: 'piedra' },
};

const fechaHora = (iso: string) => new Date(iso).toLocaleString('es-AR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const fechaCorta = (d: Date) => d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
const minutos = (s: number | null) => (s == null ? '—' : `${Math.max(1, Math.round(s / 60))} min`);
const horas = (s: number) => (s < 3600 ? `${Math.round(s / 60)} min` : `${(s / 3600).toLocaleString('es-AR', { maximumFractionDigits: 1 })} h`);

/** Lunes de la semana de una fecha, a las 0 h. */
function lunes(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}

/** Llamadas por semana, de la más vieja a la actual. Una sola serie: sin leyenda. */
const BarrasSemanales: React.FC<{ llamadas: Llamada[] }> = ({ llamadas }) => {
  const [activa, setActiva] = useState<number | null>(null);
  const semanas = useMemo(() => {
    const actual = lunes(new Date());
    const lista = Array.from({ length: SEMANAS }, (_, i) => ({ desde: new Date(actual.getTime() - (SEMANAS - 1 - i) * 7 * DIA_MS), cantidad: 0 }));
    for (const l of llamadas) {
      const i = SEMANAS - 1 - Math.round((actual.getTime() - lunes(new Date(l.ocurrida_en)).getTime()) / (7 * DIA_MS));
      if (i >= 0 && i < SEMANAS) lista[i].cantidad++;
    }
    return lista;
  }, [llamadas]);
  const maximo = Math.max(1, ...semanas.map((s) => s.cantidad));
  const detalle = activa === null ? semanas[SEMANAS - 1] : semanas[activa];

  return (
    <figure className="flex flex-col gap-3">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-sm font-medium">Llamadas por semana</span>
        <span className="text-sm text-piedra tabular-nums" aria-live="polite">
          Semana del {fechaCorta(detalle.desde)}: <span className="text-tinta font-medium">{detalle.cantidad}</span>
        </span>
      </figcaption>
      <div className="h-40 flex items-end gap-[2px] border-b border-borde-suave" onMouseLeave={() => setActiva(null)}>
        {semanas.map((s, i) => (
          <button
            key={s.desde.toISOString()}
            type="button"
            className="group flex-1 h-full flex items-end focus:outline-none"
            aria-label={`Semana del ${fechaCorta(s.desde)}: ${s.cantidad} ${s.cantidad === 1 ? 'llamada' : 'llamadas'}`}
            onMouseEnter={() => setActiva(i)}
            onFocus={() => setActiva(i)}
          >
            <span
              className={`block w-full max-w-[28px] mx-auto rounded-t-[4px] transition-opacity duration-150 ${s.cantidad ? 'bg-bosque' : 'bg-separador'} ${activa !== null && activa !== i ? 'opacity-45' : ''} group-focus-visible:ring-2 group-focus-visible:ring-bosque/40`}
              style={{ height: s.cantidad ? `${Math.max(4, (s.cantidad / maximo) * 100)}%` : '2px' }}
            />
          </button>
        ))}
      </div>
      <div className="flex justify-between text-xs text-piedra tabular-nums">
        <span>{fechaCorta(semanas[0].desde)}</span>
        <span>Esta semana</span>
      </div>
    </figure>
  );
};

export const Llamadas: React.FC<{ orgId: string; orgNombre: string; puedeGestionar: boolean; verTodo: boolean }> = ({ orgId, orgNombre, puedeGestionar, verTodo }) => {
  const [habilitado, setHabilitado] = useState<boolean | null>(null);
  const [equipo, setEquipo] = useState<IntegranteEquipo[]>([]);
  const [integraciones, setIntegraciones] = useState<Integracion[]>([]);
  const [llamadas, setLlamadas] = useState<Llamada[]>([]);
  const [clientes, setClientes] = useState<ClienteCorto[]>([]);
  const [miIntegrante, setMiIntegrante] = useState<string | null>(null);
  const [vista, setVista] = useState<Vista>('resumen');
  const [soloSinCliente, setSoloSinCliente] = useState(true);
  // Lo que se ve una sola vez: la URL recién generada o el enlace de conexión.
  const [nueva, setNueva] = useState<{ integranteId: string; url: string } | null>(null);
  const [enlace, setEnlace] = useState<{ integranteId: string; url: string } | null>(null);
  const [secreto, setSecreto] = useState<{ integracionId: string; valor: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const vistaPrevia = Boolean(useVistaPrevia());

  async function cargar() {
    if (!supabase) return;
    const { data: tiene, error: e } = await supabase.rpc('tiene_funcionalidad', { org: orgId, clave: 'fathom' });
    if (e) return setError('No pudimos leer el plan del negocio.');
    setHabilitado(Boolean(tiene));
    const desde = new Date(lunes(new Date()).getTime() - (SEMANAS - 1) * 7 * DIA_MS).toISOString();
    const [yo, m, i, l, c] = await Promise.all([
      supabase.rpc('equipo_vincular_mi_cuenta'),
      supabase.from('equipo_miembros').select('*').eq('organizacion_id', orgId).order('nombre'),
      supabase.from('integraciones').select('id, equipo_miembro_id, estado, invitacion_vence, ultima_recepcion, recepciones').eq('organizacion_id', orgId).eq('proveedor', 'fathom'),
      supabase
        .from('interacciones')
        .select('id, cliente_id, equipo_miembro_id, titulo, ocurrida_en, duracion_seg')
        .eq('organizacion_id', orgId)
        .gte('ocurrida_en', desde)
        .order('ocurrida_en', { ascending: false })
        .limit(2000),
      verTodo ? supabase.from('crm_clientes').select('id, nombre, codigo').eq('organizacion_id', orgId).order('nombre') : Promise.resolve({ data: [] }),
    ]);
    if (i.error || l.error) setError('No pudimos cargar las llamadas.');
    setMiIntegrante(typeof yo.data === 'string' ? yo.data : null);
    setEquipo((m.data as IntegranteEquipo[]) ?? []);
    setIntegraciones((i.data as Integracion[]) ?? []);
    setLlamadas((l.data as Llamada[]) ?? []);
    setClientes((c.data as ClienteCorto[]) ?? []);
  }

  useEffect(() => {
    setNueva(null);
    setEnlace(null);
    setSecreto(null);
    void cargar();
  }, [orgId]); // eslint-disable-line react-hooks/exhaustive-deps

  const porIntegrante = useMemo(() => new Map(integraciones.map((i) => [i.equipo_miembro_id, i])), [integraciones]);
  const nombreDe = useMemo(() => new Map(equipo.map((m) => [m.id, m.nombre])), [equipo]);
  const activos = equipo.filter((m) => m.activo);
  const sinCliente = llamadas.filter((l) => !l.cliente_id);
  const visibles = soloSinCliente && verTodo ? sinCliente : llamadas;
  const segundos = llamadas.reduce((s, l) => s + (l.duracion_seg ?? 0), 0);
  const conDuracion = llamadas.filter((l) => l.duracion_seg != null).length;

  const porPersona = useMemo(() => {
    const filas = new Map<string, { id: string; llamadas: number; segundos: number; ultima: string | null }>();
    for (const l of llamadas) {
      if (!l.equipo_miembro_id) continue;
      const f = filas.get(l.equipo_miembro_id) ?? { id: l.equipo_miembro_id, llamadas: 0, segundos: 0, ultima: null };
      f.llamadas++;
      f.segundos += l.duracion_seg ?? 0;
      if (!f.ultima || l.ocurrida_en > f.ultima) f.ultima = l.ocurrida_en;
      filas.set(f.id, f);
    }
    return [...filas.values()].sort((a, b) => b.llamadas - a.llamadas);
  }, [llamadas]);

  // Conexiones que necesitan que alguien haga algo.
  const atencion = useMemo(() => {
    const hace7 = Date.now() - 7 * DIA_MS;
    return integraciones.flatMap((i) => {
      const nombre = nombreDe.get(i.equipo_miembro_id) ?? 'Alguien del equipo';
      if (i.estado === 'pendiente')
        return [
          i.invitacion_vence && Date.parse(i.invitacion_vence) < Date.now()
            ? `${nombre}: el enlace de conexión venció sin usarse.`
            : i.invitacion_vence
              ? `${nombre}: tiene el enlace de conexión y todavía no lo completó.`
              : `${nombre}: falta pegar el secreto de Fathom.`,
        ];
      if (i.estado === 'pausada') return [`${nombre}: la conexión está pausada.`];
      if (!i.ultima_recepcion || Date.parse(i.ultima_recepcion) < hace7) return [`${nombre}: no llegan llamadas hace más de 7 días.`];
      return [];
    });
  }, [integraciones, nombreDe]);

  async function correr(accion: () => PromiseLike<{ error: { message: string } | null }>, mensaje: string) {
    setOcupado(true);
    setError(null);
    setOk(null);
    const { error: e } = await accion();
    setOcupado(false);
    if (e) {
      setError(e.message);
      return false;
    }
    setOk(mensaje);
    await cargar();
    return true;
  }

  async function generarUrl(integrante: IntegranteEquipo) {
    if (!supabase) return;
    if (porIntegrante.has(integrante.id) && !window.confirm(`La URL actual de ${integrante.nombre} va a dejar de andar. Hay que cargar la nueva en Fathom y pegar el secreto otra vez. ¿Seguimos?`)) return;
    setOcupado(true);
    setError(null);
    setOk(null);
    const { data, error: e } = await supabase.rpc('integracion_fathom_conectar', { p_integrante: integrante.id });
    setOcupado(false);
    if (e || typeof data !== 'string') return setError(e?.message ?? 'No pudimos generar la URL.');
    setEnlace(null);
    setNueva({ integranteId: integrante.id, url: urlWebhook(data) });
    await cargar();
  }

  async function generarEnlace(integrante: IntegranteEquipo) {
    if (!supabase) return;
    if (porIntegrante.get(integrante.id)?.estado === 'activa' && !window.confirm(`${integrante.nombre} ya está conectado. El enlace nuevo reemplaza su conexión actual. ¿Seguimos?`)) return;
    setOcupado(true);
    setError(null);
    setOk(null);
    const { data, error: e } = await supabase.rpc('integracion_fathom_invitar', { p_integrante: integrante.id });
    setOcupado(false);
    if (e || typeof data !== 'string') return setError(e?.message ?? 'No pudimos generar el enlace.');
    setNueva(null);
    setSecreto(null);
    setEnlace({ integranteId: integrante.id, url: `${window.location.origin}/conectar-fathom/${data}` });
    await cargar();
  }

  async function guardarSecreto(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase || !secreto) return;
    const listo = await correr(
      () => supabase!.rpc('integracion_guardar_secreto', { p_integracion: secreto.integracionId, p_secreto: secreto.valor }),
      'Listo. Las llamadas que se graben con esa cuenta van a aparecer acá.',
    );
    if (listo) {
      setSecreto(null);
      setNueva(null);
    }
  }

  async function copiar(texto: string, mensaje: string) {
    try {
      await navigator.clipboard.writeText(texto);
      setOk(mensaje);
    } catch {
      setError('No pudimos copiar. Seleccioná el texto y copialo a mano.');
    }
  }

  // Acciones de una conexión. Administrar a otros (enlace incluido) es del titular; la propia, de cada uno.
  function acciones(m: IntegranteEquipo, propia: boolean) {
    const i = porIntegrante.get(m.id);
    if (vistaPrevia || !(puedeGestionar || propia)) return null;
    return (
      <div className="inline-flex flex-wrap justify-end gap-x-4 gap-y-1">
        <button type="button" disabled={ocupado} className="underline underline-offset-4 hover:text-bosque" onClick={() => void generarUrl(m)}>
          {i ? 'URL nueva' : 'Conectar'}
        </button>
        {puedeGestionar && !propia && (
          <button type="button" disabled={ocupado} className="underline underline-offset-4 hover:text-bosque" onClick={() => void generarEnlace(m)}>
            Enviar enlace
          </button>
        )}
        {i && !i.invitacion_vence && (
          <button type="button" disabled={ocupado} className="underline underline-offset-4 hover:text-bosque" onClick={() => setSecreto({ integracionId: i.id, valor: '' })}>
            {i.estado === 'pendiente' ? 'Pegar secreto' : 'Cambiar secreto'}
          </button>
        )}
        {i && i.estado !== 'pendiente' && (
          <button
            type="button"
            disabled={ocupado}
            className="underline underline-offset-4 hover:text-bosque"
            onClick={() => void correr(() => supabase!.rpc('integracion_pausar', { p_integracion: i.id, p_pausar: i.estado === 'activa' }), i.estado === 'activa' ? 'Pausada.' : 'Reanudada.')}
          >
            {i.estado === 'activa' ? 'Pausar' : 'Reanudar'}
          </button>
        )}
        {i && (
          <button
            type="button"
            disabled={ocupado}
            className="underline underline-offset-4 hover:text-peligro"
            onClick={() => {
              if (window.confirm(`¿Desconectar Fathom de ${m.nombre}? Las llamadas que ya llegaron quedan.`)) {
                void correr(() => supabase!.rpc('integracion_quitar', { p_integracion: i.id }), 'Desconectado.');
              }
            }}
          >
            Desconectar
          </button>
        )}
      </div>
    );
  }

  function estadoDe(m: IntegranteEquipo) {
    const i = porIntegrante.get(m.id);
    if (!i) return <span className="text-piedra">Sin conectar</span>;
    if (i.estado === 'pendiente' && i.invitacion_vence)
      return Date.parse(i.invitacion_vence) < Date.now() ? <Etiqueta tono="alerta">Enlace vencido</Etiqueta> : <Etiqueta tono="tinta">Enlace enviado</Etiqueta>;
    return <Etiqueta tono={ESTADO[i.estado].tono}>{ESTADO[i.estado].texto}</Etiqueta>;
  }

  // Paneles que se ven una sola vez, debajo de la conexión que los generó.
  const paneles = (
    <>
      {nueva && (
        <div className="bg-marfil-oscuro p-6 desk:p-8 space-y-4 max-w-[760px]">
          <h3 className="h3">URL de {nombreDe.get(nueva.integranteId)}</h3>
          <p className="text-sm text-piedra">Se muestra una sola vez. Si la perdés, generá una nueva.</p>
          <div className="flex flex-col desk:flex-row gap-3">
            <input readOnly className={`${claseInput} font-mono text-[13px]`} value={nueva.url} onFocus={(e) => e.currentTarget.select()} aria-label="URL del webhook" />
            <Button type="button" variant="ghost" onClick={() => void copiar(nueva.url, 'URL copiada.')}>
              <Copy size={16} /> Copiar
            </Button>
          </div>
          <PasosFathom />
          {(() => {
            const i = porIntegrante.get(nueva.integranteId);
            return i && !secreto ? (
              <Button type="button" onClick={() => setSecreto({ integracionId: i.id, valor: '' })}>
                Pegar el secreto
              </Button>
            ) : null;
          })()}
        </div>
      )}

      {enlace && (
        <div className="bg-marfil-oscuro p-6 desk:p-8 space-y-4 max-w-[760px]">
          <h3 className="h3">Enlace para {nombreDe.get(enlace.integranteId)}</h3>
          <p className="text-sm text-piedra">
            Mandáselo por WhatsApp o mail. Lo abre sin cuenta en el portal, carga su URL en su Fathom y pega el secreto. Vale 7 días y se usa una sola vez. Se muestra solo ahora.
          </p>
          <div className="flex flex-col desk:flex-row gap-3">
            <input readOnly className={`${claseInput} font-mono text-[13px]`} value={enlace.url} onFocus={(e) => e.currentTarget.select()} aria-label="Enlace de conexión" />
            <Button type="button" variant="ghost" onClick={() => void copiar(enlace.url, 'Enlace copiado.')}>
              <Copy size={16} /> Copiar
            </Button>
            <a
              className="inline-flex items-center justify-center gap-2 h-11 px-4 border border-borde rounded-control text-sm font-medium hover:border-tinta"
              href={`https://wa.me/?text=${encodeURIComponent(`Para que tus llamadas de Fathom lleguen al CRM de ${orgNombre}, conectá tu cuenta acá: ${enlace.url}`)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <MessageCircle size={16} aria-hidden="true" /> WhatsApp
            </a>
          </div>
        </div>
      )}

      {secreto && (
        <form onSubmit={guardarSecreto} className="bg-marfil-oscuro p-6 desk:p-8 space-y-5 max-w-[760px]">
          <Campo etiqueta="Secreto del webhook" ayuda="Lo guardamos cifrado. Nadie lo puede volver a ver desde el portal.">
            <input
              required
              autoComplete="off"
              spellCheck={false}
              className={`${claseInput} font-mono text-[13px]`}
              placeholder="whsec_…"
              value={secreto.valor}
              onChange={(e) => setSecreto({ ...secreto, valor: e.target.value })}
            />
          </Campo>
          <div className="flex gap-3">
            <Button type="submit" disabled={ocupado}>
              {ocupado ? 'Guardando…' : 'Guardar'}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setSecreto(null)}>
              Cancelar
            </Button>
          </div>
        </form>
      )}
    </>
  );

  const yo = miIntegrante ? equipo.find((m) => m.id === miIntegrante) : undefined;
  // Quien no administra el negocio ve su conexión arriba; el titular la ve en Conexiones.
  const conMiFathom = Boolean(habilitado && yo && !puedeGestionar);

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
            Llamadas de <span className="text-bosque">{orgNombre}</span>
          </>
        }
        bajada={
          verTodo
            ? 'Las llamadas que graba el equipo con su Fathom llegan solas y quedan a nombre del cliente por su mail.'
            : 'Conectá tu Fathom y tus llamadas llegan solas al CRM.'
        }
      />
      <div className="wrap py-10 desk:py-12 flex flex-col gap-8">
        {error && <Aviso tipo="error">{error}</Aviso>}
        {ok && <Aviso tipo="ok">{ok}</Aviso>}
        {habilitado === false && <Aviso tipo="info">El plan del negocio no incluye las llamadas de Fathom. Escribinos si querés sumarlas.</Aviso>}

        {conMiFathom && yo && (
          <section className="flex flex-col gap-5">
            <TituloSeccion eyebrow="Tu cuenta" titulo="Mi Fathom" acciones={estadoDe(yo)} />
            <p className="text-sm text-piedra max-w-[70ch]">Usás tu propia cuenta de Fathom, también la gratuita. Generá tu URL, cargala en Fathom y pegá el secreto que te da.</p>
            <div className="flex justify-start">{acciones(yo, true)}</div>
            {paneles}
          </section>
        )}
        {habilitado && !yo && !verTodo && (
          <Aviso tipo="info">Para conectar tu Fathom, pedile al titular que te sume en Equipo con el mail de tu cuenta del portal.</Aviso>
        )}

        {(habilitado || llamadas.length > 0) && (
          <>
            <Pestanas<Vista>
              items={[
                { clave: 'resumen', titulo: 'Resumen' },
                ...(verTodo ? [{ clave: 'conexiones' as Vista, titulo: 'Conexiones', cuenta: atencion.length || undefined }] : []),
                { clave: 'llamadas', titulo: 'Llamadas', cuenta: verTodo ? sinCliente.length || undefined : undefined },
              ]}
              activa={vista}
              alCambiar={setVista}
            />

            {vista === 'resumen' && (
              <div className="flex flex-col gap-10">
                <Cifras
                  items={[
                    { titulo: `Llamadas · ${SEMANAS} semanas`, valor: llamadas.length },
                    { titulo: 'Tiempo grabado', valor: horas(segundos) },
                    { titulo: 'Duración promedio', valor: conDuracion ? minutos(segundos / conDuracion) : '—' },
                    ...(verTodo
                      ? [
                          {
                            titulo: 'Sin cliente',
                            valor: llamadas.length ? `${Math.round((sinCliente.length / llamadas.length) * 100)} %` : '—',
                            alerta: sinCliente.length > 0,
                            nota: sinCliente.length ? `${sinCliente.length} para asignar` : undefined,
                          },
                        ]
                      : []),
                  ]}
                />
                <BarrasSemanales llamadas={llamadas} />

                {verTodo && (
                  <section>
                    <TituloSeccion eyebrow="Equipo" titulo="Por integrante" />
                    <div className="overflow-x-auto">
                      <table className="tabla min-w-[560px]">
                        <thead>
                          <tr>
                            <th>Persona</th>
                            <th className="text-right">Llamadas</th>
                            <th className="text-right">Tiempo</th>
                            <th className="text-right">Promedio</th>
                            <th>Última</th>
                          </tr>
                        </thead>
                        <tbody>
                          {porPersona.length === 0 && (
                            <tr>
                              <td colSpan={5} className="p-6 text-piedra">
                                Todavía no llegó ninguna llamada.
                              </td>
                            </tr>
                          )}
                          {porPersona.map((f) => (
                            <tr key={f.id}>
                              <td className="font-medium">{nombreDe.get(f.id) ?? '—'}</td>
                              <td className="text-right tabular-nums">{f.llamadas}</td>
                              <td className="text-right tabular-nums">{horas(f.segundos)}</td>
                              <td className="text-right tabular-nums">{minutos(f.segundos / f.llamadas)}</td>
                              <td className="tabular-nums">{f.ultima ? fechaHora(f.ultima) : '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                )}

                {verTodo && atencion.length > 0 && (
                  <section>
                    <TituloSeccion
                      eyebrow="Conexiones"
                      titulo="Para revisar"
                      acciones={
                        <Button variant="ghost" onClick={() => setVista('conexiones')}>
                          Ver conexiones
                        </Button>
                      }
                    />
                    <ul className="flex flex-col gap-2 text-sm">
                      {atencion.map((t) => (
                        <li key={t} className="border border-borde-suave rounded-control px-4 py-3 bg-papel">
                          {t}
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
              </div>
            )}

            {vista === 'conexiones' && verTodo && (
              <section className="flex flex-col gap-6">
                {!puedeGestionar && <Aviso tipo="info">Las conexiones las administra el titular de la empresa.</Aviso>}
                <p className="text-sm text-piedra max-w-[70ch]">
                  Cada persona conecta su propia cuenta de Fathom, también la gratuita. Quien tiene cuenta en el portal lo hace solo desde Llamadas › Mi Fathom; a quien no la tiene, mandale el enlace de conexión.
                </p>
                <div className="overflow-x-auto">
                  <table className="tabla min-w-[680px]">
                    <thead>
                      <tr>
                        <th>Persona</th>
                        <th>Estado</th>
                        <th>Última llamada</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {activos.length === 0 && (
                        <tr>
                          <td colSpan={4} className="p-6 text-piedra">
                            Primero cargá al equipo en{' '}
                            <Enlace a="/portal/crm/equipo" className="underline underline-offset-4 hover:text-bosque">
                              Equipo
                            </Enlace>
                            .
                          </td>
                        </tr>
                      )}
                      {activos.map((m) => {
                        const ultima = porIntegrante.get(m.id)?.ultima_recepcion;
                        return (
                          <tr key={m.id}>
                            <td>
                              <div className="font-heading font-bold text-[16px] leading-tight">{m.nombre}</div>
                              <div className="text-xs text-piedra">
                                {ROL_COMERCIAL[m.rol_comercial]}
                                {m.usuario_id ? ' · con cuenta en el portal' : ''}
                              </div>
                            </td>
                            <td>{estadoDe(m)}</td>
                            <td className="tabular-nums">{ultima ? fechaHora(ultima) : '—'}</td>
                            <td className="text-right whitespace-nowrap">{acciones(m, m.id === miIntegrante)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {!conMiFathom && paneles}
              </section>
            )}

            {vista === 'llamadas' && (
              <section className="flex flex-col gap-4">
                {verTodo && (
                  <label className="inline-flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={soloSinCliente} onChange={(e) => setSoloSinCliente(e.target.checked)} />
                    Solo las que no tienen cliente
                  </label>
                )}
                <div className="overflow-x-auto">
                  <table className="tabla min-w-[720px]">
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        <th>Llamada</th>
                        <th>Grabó</th>
                        <th>Duración</th>
                        <th>Cliente</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibles.length === 0 && (
                        <tr>
                          <td colSpan={5} className="p-6 text-piedra">
                            {soloSinCliente && verTodo ? 'No hay llamadas sin cliente.' : 'Todavía no llegó ninguna llamada.'}
                          </td>
                        </tr>
                      )}
                      {visibles.map((l) => (
                        <tr key={l.id}>
                          <td className="tabular-nums whitespace-nowrap">{fechaHora(l.ocurrida_en)}</td>
                          <td>{l.titulo || <span className="text-piedra">Sin título</span>}</td>
                          <td>{(l.equipo_miembro_id && nombreDe.get(l.equipo_miembro_id)) || '—'}</td>
                          <td className="tabular-nums">{minutos(l.duracion_seg)}</td>
                          <td>
                            {verTodo ? (
                              <select
                                className={`${claseInput} min-w-[200px]`}
                                aria-label="Cliente de la llamada"
                                disabled={ocupado || vistaPrevia}
                                value={l.cliente_id ?? ''}
                                onChange={(e) =>
                                  void correr(
                                    () => supabase!.rpc('interaccion_asignar', { p_interaccion: l.id, p_cliente: e.target.value || null }),
                                    e.target.value ? 'Llamada asignada.' : 'Llamada sin cliente.',
                                  )
                                }
                              >
                                <option value="">Sin cliente</option>
                                {clientes.map((c) => (
                                  <option key={c.id} value={c.id}>
                                    {c.nombre}
                                    {c.codigo ? ` (${c.codigo})` : ''}
                                  </option>
                                ))}
                              </select>
                            ) : l.cliente_id ? (
                              <Enlace a={`/portal/crm/${l.cliente_id}`} className="underline underline-offset-4 hover:text-bosque">
                                Ver ficha
                              </Enlace>
                            ) : (
                              <span className="text-piedra">Sin cliente</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </>
  );
};

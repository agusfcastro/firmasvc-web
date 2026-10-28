import React, { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '../../Button';
import { supabase } from '../supabase';
import { Aviso, Campo, Etiqueta, claseInput } from '../ui';

const ZONA = 'America/Argentina/Buenos_Aires';

interface Newsletter {
  id: string;
  semana: string;
  video_titulo: string | null;
  video_url: string | null;
  articulo_titulo: string | null;
  articulo_bajada: string | null;
  articulo_url: string | null;
  activa: boolean;
  enviada_en: string | null;
}

type Borrador = { id?: string; semana: string; video_titulo: string; video_url: string; articulo_titulo: string; articulo_bajada: string; articulo_url: string };

const diaDe = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: ZONA }).format(d);

function sumarDias(dia: string, n: number): string {
  const d = new Date(`${dia}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const esLunes = (dia: string) => new Date(`${dia}T12:00:00Z`).getUTCDay() === 1;

/** El próximo lunes que todavía no salió. Sale a las 9 de Buenos Aires. */
function proximoLunes(): string {
  const hoy = diaDe(new Date());
  const hora = Number(new Intl.DateTimeFormat('en-GB', { timeZone: ZONA, hour: '2-digit', hourCycle: 'h23' }).format(new Date()));
  if (esLunes(hoy) && hora < 9) return hoy;
  const faltan = (8 - new Date(`${hoy}T12:00:00Z`).getUTCDay()) % 7 || 7;
  return sumarDias(hoy, faltan);
}

const fechaLarga = (dia: string) =>
  new Intl.DateTimeFormat('es-AR', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${dia}T12:00:00Z`));

const VACIO = (): Borrador => ({ semana: proximoLunes(), video_titulo: '', video_url: '', articulo_titulo: '', articulo_bajada: '', articulo_url: '' });

async function enviarPrueba(id: string): Promise<string | null> {
  if (!supabase) return 'Portal sin configurar.';
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return 'Tu sesión venció. Volvé a ingresar.';
  try {
    const r = await fetch('/api/portal/resumen', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ accion: 'prueba', id }),
    });
    const j = (await r.json().catch(() => ({}))) as { error?: string };
    return r.ok ? null : j.error || `Error ${r.status}`;
  } catch {
    return 'No hubo conexión. Probá de nuevo.';
  }
}

export const NewsletterAdmin: React.FC = () => {
  const [lista, setLista] = useState<Newsletter[]>([]);
  const [borrador, setBorrador] = useState<Borrador | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  async function cargar() {
    if (!supabase) return;
    const { data, error: err } = await supabase.from('newsletters').select('*').order('semana', { ascending: false }).limit(30);
    if (err) setError(err.message);
    setLista((data as Newsletter[]) ?? []);
  }

  useEffect(() => {
    void cargar();
  }, []);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase || !borrador) return;
    const b = Object.fromEntries(Object.entries(borrador).map(([k, v]) => [k, typeof v === 'string' ? v.trim() : v])) as Borrador;
    if (!esLunes(b.semana)) return setError('La fecha de envío tiene que ser un lunes.');
    if (!b.video_url && !b.articulo_url) return setError('Cargá el video, el artículo o los dos.');
    if (Boolean(b.video_titulo) !== Boolean(b.video_url)) return setError('El video lleva título y enlace.');
    if (Boolean(b.articulo_titulo) !== Boolean(b.articulo_url)) return setError('El artículo lleva título y enlace.');
    if ([b.video_url, b.articulo_url].some((u) => u && !/^https:\/\//.test(u))) return setError('Los enlaces tienen que empezar con https://');
    setGuardando(true);
    setError(null);
    setOk(null);
    const datos = {
      semana: b.semana,
      video_titulo: b.video_titulo || null,
      video_url: b.video_url || null,
      articulo_titulo: b.articulo_titulo || null,
      articulo_bajada: b.articulo_bajada || null,
      articulo_url: b.articulo_url || null,
      actualizado_en: new Date().toISOString(),
    };
    const { error: err } = b.id ? await supabase.from('newsletters').update(datos).eq('id', b.id) : await supabase.from('newsletters').insert(datos);
    setGuardando(false);
    if (err) return setError(err.code === '23505' ? 'Ya hay una newsletter para ese lunes. Editala desde la lista.' : err.message);
    setBorrador(null);
    void cargar();
  }

  async function borrar(n: Newsletter) {
    if (!supabase || !window.confirm(`¿Eliminar la newsletter del ${fechaLarga(n.semana)}?`)) return;
    const { error: err } = await supabase.from('newsletters').delete().eq('id', n.id);
    if (err) setError(err.message);
    void cargar();
  }

  async function activar(n: Newsletter, activa: boolean) {
    if (!supabase) return;
    if (activa && n.semana < diaDe(new Date())) return setError('Ese lunes ya pasó. Cambiá la fecha para activarla.');
    if (activa && !window.confirm(`¿Activar el envío? Sale el ${fechaLarga(n.semana)} a las 9 a todos los usuarios de las empresas activas.`)) return;
    setError(null);
    setOk(null);
    const { error: err } = await supabase.from('newsletters').update({ activa, actualizado_en: new Date().toISOString() }).eq('id', n.id);
    if (err) return setError(err.message);
    setOk(activa ? `Envío activado para el ${fechaLarga(n.semana)} a las 9.` : 'Envío desactivado. Ese lunes no sale el mail.');
    void cargar();
  }

  async function prueba(n: Newsletter) {
    setError(null);
    setOk(null);
    const fallo = await enviarPrueba(n.id);
    if (fallo) setError(fallo);
    else setOk('Te mandamos la prueba a tu mail. Es la versión que reciben closers y setters, sin el resumen de la empresa.');
  }

  const campo = (k: keyof Borrador) => ({
    value: borrador?.[k] ?? '',
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => borrador && setBorrador({ ...borrador, [k]: e.target.value }),
  });

  return (
    <div className="space-y-6">
      <p className="text-sm text-piedra max-w-[680px]">
        Sale los lunes a las 9 a todos los usuarios de las empresas activas, con un video y un artículo. Al titular y al CSM les llega en el mismo mail el resumen de su empresa y los vencimientos de la semana. Solo sale si activás el envío; sin una newsletter activa, ese lunes no sale nada.
      </p>
      {error && <Aviso tipo="error">{error}</Aviso>}
      {ok && <Aviso tipo="ok">{ok}</Aviso>}
      {borrador ? (
        <form onSubmit={guardar} className="bg-marfil-oscuro p-6 desk:p-8 space-y-5 max-w-[680px]">
          <h2 className="h3">{borrador.id ? 'Editar newsletter' : 'Nueva newsletter'}</h2>
          <Campo etiqueta="Sale el lunes" ayuda={esLunes(borrador.semana) ? fechaLarga(borrador.semana) : 'Elegí un lunes.'}>
            <input required type="date" className={claseInput} {...campo('semana')} />
          </Campo>
          <h3 className="font-heading font-bold text-[17px] pt-2">Video</h3>
          <Campo etiqueta="Título">
            <input className={claseInput} {...campo('video_titulo')} placeholder="Cómo responder un contracargo en 48 horas" />
          </Campo>
          <Campo etiqueta="Enlace" ayuda="YouTube muestra la miniatura en el mail. Vimeo, Loom y otros van como enlace.">
            <input type="url" className={claseInput} {...campo('video_url')} placeholder="https://www.youtube.com/watch?v=..." />
          </Campo>
          <h3 className="font-heading font-bold text-[17px] pt-2">Artículo</h3>
          <Campo etiqueta="Título">
            <input className={claseInput} {...campo('articulo_titulo')} placeholder="Qué cambia con la nueva ley de defensa del consumidor" />
          </Campo>
          <Campo etiqueta="Bajada" ayuda="Dos o tres líneas que invitan a leerlo. Hasta 400 caracteres.">
            <textarea rows={3} maxLength={400} className={`${claseInput} h-auto py-3`} {...campo('articulo_bajada')} />
          </Campo>
          <Campo etiqueta="Enlace">
            <input type="url" className={claseInput} {...campo('articulo_url')} placeholder="https://www.firmasvc.com/..." />
          </Campo>
          <div className="flex gap-3">
            <Button type="submit" disabled={guardando}>
              {guardando ? 'Guardando…' : 'Guardar'}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setBorrador(null)}>
              Cancelar
            </Button>
          </div>
        </form>
      ) : (
        <Button onClick={() => setBorrador(VACIO())}>
          <Plus size={16} /> Nueva newsletter
        </Button>
      )}

      <div className="overflow-x-auto">
        <table className="tabla min-w-[760px]">
          <thead>
            <tr>
              <th>Lunes</th>
              <th>Contenido</th>
              <th>Estado</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {lista.length === 0 && (
              <tr>
                <td colSpan={4} className="text-piedra">
                  Todavía no hay newsletters.
                </td>
              </tr>
            )}
            {lista.map((n) => (
              <tr key={n.id}>
                <td className="whitespace-nowrap">{fechaLarga(n.semana)}</td>
                <td>
                  {n.video_titulo && <div>Video: {n.video_titulo}</div>}
                  {n.articulo_titulo && <div>Artículo: {n.articulo_titulo}</div>}
                </td>
                <td>
                  {n.enviada_en ? <Etiqueta tono="tinta">Enviada</Etiqueta> : n.activa ? <Etiqueta tono="bosque">Activada</Etiqueta> : <Etiqueta>Borrador</Etiqueta>}
                </td>
                <td className="text-right whitespace-nowrap">
                  <button type="button" className="underline underline-offset-4 hover:text-bosque mr-4" onClick={() => prueba(n)}>
                    Enviarme una prueba
                  </button>
                  {!n.enviada_en && (
                    <>
                      <button type="button" className={`underline underline-offset-4 mr-4 ${n.activa ? 'hover:text-tinta' : 'font-medium text-bosque'}`} onClick={() => activar(n, !n.activa)}>
                        {n.activa ? 'Desactivar' : 'Activar envío'}
                      </button>
                      <button
                        type="button"
                        className="underline underline-offset-4 hover:text-bosque mr-4"
                        onClick={() =>
                          setBorrador({
                            id: n.id,
                            semana: n.semana,
                            video_titulo: n.video_titulo ?? '',
                            video_url: n.video_url ?? '',
                            articulo_titulo: n.articulo_titulo ?? '',
                            articulo_bajada: n.articulo_bajada ?? '',
                            articulo_url: n.articulo_url ?? '',
                          })
                        }
                      >
                        Editar
                      </button>
                      <button type="button" className="underline underline-offset-4 text-[#8a2b20]" onClick={() => borrar(n)}>
                        Eliminar
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

import React, { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '../../Button';
import { supabase } from '../supabase';
import { Aviso, Campo, Etiqueta, Interruptor, claseInput } from '../ui';
import type { Agenda, Organizacion } from '../tipos';
import { TiempoAgenda } from './TiempoAgenda';

type Borrador = Omit<Agenda, 'id'> & { id?: string };
const VACIO: Borrador = { organizacion_id: null, titulo: '', descripcion: '', duracion_min: 30, url: '', orden: 0, activa: true };

export const Agendas: React.FC = () => {
  const [lista, setLista] = useState<Agenda[]>([]);
  const [orgs, setOrgs] = useState<Organizacion[]>([]);
  const [borrador, setBorrador] = useState<Borrador | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  async function cargar() {
    if (!supabase) return;
    const [a, o] = await Promise.all([
      supabase.from('agendas').select('*').order('orden').order('titulo'),
      supabase.from('organizaciones').select('*').order('nombre'),
    ]);
    if (a.error) setError(a.error.message);
    setLista((a.data as Agenda[]) ?? []);
    setOrgs((o.data as Organizacion[]) ?? []);
  }

  useEffect(() => {
    void cargar();
  }, []);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase || !borrador) return;
    if (!/^https:\/\//.test(borrador.url.trim())) return setError('El enlace tiene que empezar con https://');
    setGuardando(true);
    setError(null);
    const datos = {
      organizacion_id: borrador.organizacion_id || null,
      titulo: borrador.titulo.trim(),
      descripcion: borrador.descripcion?.trim() || null,
      duracion_min: borrador.duracion_min ? Number(borrador.duracion_min) : null,
      url: borrador.url.trim(),
      orden: Number(borrador.orden) || 0,
      activa: borrador.activa,
    };
    const { error: err } = borrador.id ? await supabase.from('agendas').update(datos).eq('id', borrador.id) : await supabase.from('agendas').insert(datos);
    setGuardando(false);
    if (err) return setError(err.message);
    setBorrador(null);
    void cargar();
  }

  async function borrar(a: Agenda) {
    if (!supabase || !window.confirm(`¿Eliminar la agenda «${a.titulo}»?`)) return;
    const { error: err } = await supabase.from('agendas').delete().eq('id', a.id);
    if (err) setError(err.message);
    void cargar();
  }

  const nombreOrg = (id: string | null) => (id ? orgs.find((o) => o.id === id)?.nombre ?? 'Cliente' : 'Todos los clientes');

  return (
    <div className="space-y-6">
      <TiempoAgenda orgs={orgs} />
      {error && <Aviso tipo="error">{error}</Aviso>}
      {borrador ? (
        <form onSubmit={guardar} className="bg-marfil-oscuro p-6 desk:p-8 space-y-5 max-w-[680px]">
          <h2 className="h3">{borrador.id ? 'Editar agenda' : 'Nueva agenda'}</h2>
          <Campo etiqueta="Título">
            <input required className={claseInput} value={borrador.titulo} onChange={(e) => setBorrador({ ...borrador, titulo: e.target.value })} placeholder="Reunión de revisión de contratos" />
          </Campo>
          <Campo etiqueta="Enlace de reserva" ayuda="El link de Notion Calendar, Calendly o el sistema que uses.">
            <input required type="url" className={claseInput} value={borrador.url} onChange={(e) => setBorrador({ ...borrador, url: e.target.value })} placeholder="https://calendar.notion.so/meet/..." />
          </Campo>
          <div className="grid gap-5 tab:grid-cols-3">
            <Campo etiqueta="Duración (min)">
              <input type="number" min={5} max={480} className={claseInput} value={borrador.duracion_min ?? ''} onChange={(e) => setBorrador({ ...borrador, duracion_min: e.target.value ? Number(e.target.value) : null })} />
            </Campo>
            <Campo etiqueta="Orden">
              <input type="number" className={claseInput} value={borrador.orden} onChange={(e) => setBorrador({ ...borrador, orden: Number(e.target.value) })} />
            </Campo>
            <Campo etiqueta="Visible para">
              <select className={claseInput} value={borrador.organizacion_id ?? ''} onChange={(e) => setBorrador({ ...borrador, organizacion_id: e.target.value || null })}>
                <option value="">Todos los clientes</option>
                {orgs.map((o) => (
                  <option key={o.id} value={o.id}>
                    Solo {o.nombre}
                  </option>
                ))}
              </select>
            </Campo>
          </div>
          <Campo etiqueta="Descripción">
            <textarea rows={3} className={`${claseInput} h-auto py-3`} value={borrador.descripcion ?? ''} onChange={(e) => setBorrador({ ...borrador, descripcion: e.target.value })} />
          </Campo>
          <Interruptor activo={borrador.activa} alCambiar={(v) => setBorrador({ ...borrador, activa: v })} etiqueta="Visible en el portal" />
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
        <Button onClick={() => setBorrador({ ...VACIO, orden: lista.length + 1 })}>
          <Plus size={16} /> Nueva agenda
        </Button>
      )}

      <div className="overflow-x-auto">
        <table className="tabla min-w-[760px]">
          <thead>
            <tr>
              <th>Agenda</th>
              <th>Visible para</th>
              <th>Duración</th>
              <th>Estado</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {lista.length === 0 && (
              <tr>
                <td colSpan={5} className="text-piedra">
                  Todavía no hay agendas.
                </td>
              </tr>
            )}
            {lista.map((a) => (
              <tr key={a.id}>
                <td>
                  <div className="font-heading font-bold text-[16px] leading-tight">{a.titulo}</div>
                  <a href={a.url} target="_blank" rel="noopener noreferrer" className="text-xs text-piedra underline underline-offset-2 break-all">
                    {a.url}
                  </a>
                </td>
                <td>{nombreOrg(a.organizacion_id)}</td>
                <td>{a.duracion_min ? `${a.duracion_min} min` : '·'}</td>
                <td>{a.activa ? <Etiqueta tono="bosque">Visible</Etiqueta> : <Etiqueta>Oculta</Etiqueta>}</td>
                <td className="text-right whitespace-nowrap">
                  <button type="button" className="underline underline-offset-4 hover:text-bosque mr-4" onClick={() => setBorrador({ ...a })}>
                    Editar
                  </button>
                  <button type="button" className="underline underline-offset-4 text-[#8a2b20]" onClick={() => borrar(a)}>
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

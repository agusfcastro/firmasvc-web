import React, { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '../../Button';
import { supabase } from '../supabase';
import { Aviso, Campo, Etiqueta, claseInput } from '../ui';
import { iniciarVistaPrevia } from '../vistaPrevia';
import { PAISES, type Organizacion } from '../tipos';

type Borrador = Pick<Organizacion, 'nombre' | 'razon_social' | 'pais' | 'activa' | 'notas'> & { id?: string };
const VACIO: Borrador = { nombre: '', razon_social: '', pais: 'AR', activa: true, notas: '' };

export const Clientes: React.FC = () => {
  const [lista, setLista] = useState<Organizacion[]>([]);
  const [conteo, setConteo] = useState<Record<string, number>>({});
  const [borrador, setBorrador] = useState<Borrador | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  async function cargar() {
    if (!supabase) return;
    const [{ data: orgs, error: e1 }, { data: perfiles }] = await Promise.all([
      supabase.from('organizaciones').select('*').order('nombre'),
      supabase.from('perfiles').select('organizacion_id'),
    ]);
    if (e1) setError(e1.message);
    setLista((orgs as Organizacion[]) ?? []);
    const c: Record<string, number> = {};
    (perfiles ?? []).forEach((p: { organizacion_id: string | null }) => {
      if (p.organizacion_id) c[p.organizacion_id] = (c[p.organizacion_id] ?? 0) + 1;
    });
    setConteo(c);
  }

  useEffect(() => {
    void cargar();
  }, []);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase || !borrador) return;
    setGuardando(true);
    setError(null);
    const datos = {
      nombre: borrador.nombre.trim(),
      razon_social: borrador.razon_social?.trim() || null,
      pais: borrador.pais,
      activa: borrador.activa,
      notas: borrador.notas?.trim() || null,
    };
    const { error: err } = borrador.id
      ? await supabase.from('organizaciones').update(datos).eq('id', borrador.id)
      : await supabase.from('organizaciones').insert(datos);
    setGuardando(false);
    if (err) return setError(err.message);
    setBorrador(null);
    void cargar();
  }

  return (
    <div className="space-y-6">
      {error && <Aviso tipo="error">{error}</Aviso>}

      {borrador ? (
        <form onSubmit={guardar} className="bg-white border border-[rgba(27,31,27,0.15)] p-6 space-y-5 max-w-[640px]">
          <h2 className="h3">{borrador.id ? 'Editar cliente' : 'Nuevo cliente'}</h2>
          <Campo etiqueta="Nombre comercial">
            <input required className={claseInput} value={borrador.nombre} onChange={(e) => setBorrador({ ...borrador, nombre: e.target.value })} />
          </Campo>
          <Campo etiqueta="Razón social">
            <input className={claseInput} value={borrador.razon_social ?? ''} onChange={(e) => setBorrador({ ...borrador, razon_social: e.target.value })} />
          </Campo>
          <Campo etiqueta="País">
            <select className={claseInput} value={borrador.pais} onChange={(e) => setBorrador({ ...borrador, pais: e.target.value })}>
              {Object.entries(PAISES).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </Campo>
          <Campo etiqueta="Notas internas" ayuda="Solo las ven los admin de FIRMA.">
            <textarea rows={3} className={`${claseInput} h-auto py-2`} value={borrador.notas ?? ''} onChange={(e) => setBorrador({ ...borrador, notas: e.target.value })} />
          </Campo>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={borrador.activa} onChange={(e) => setBorrador({ ...borrador, activa: e.target.checked })} />
            Cliente activo. Si lo desactivás, nadie de su equipo puede ver sus datos.
          </label>
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
        <Button onClick={() => setBorrador({ ...VACIO })}>
          <Plus size={16} /> Nuevo cliente
        </Button>
      )}

      <div className="overflow-x-auto border border-[rgba(27,31,27,0.15)]">
        <table className="w-full text-sm">
          <thead className="bg-marfil-oscuro text-left">
            <tr>
              <th className="p-3 font-medium">Cliente</th>
              <th className="p-3 font-medium">País</th>
              <th className="p-3 font-medium">Usuarios</th>
              <th className="p-3 font-medium">Estado</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {lista.length === 0 && (
              <tr>
                <td colSpan={5} className="p-6 text-piedra">
                  Todavía no cargaste clientes.
                </td>
              </tr>
            )}
            {lista.map((o) => (
              <tr key={o.id} className="border-t border-[rgba(27,31,27,0.1)] bg-white">
                <td className="p-3">
                  <div className="font-medium">{o.nombre}</div>
                  {o.razon_social && <div className="text-xs text-piedra">{o.razon_social}</div>}
                </td>
                <td className="p-3">{PAISES[o.pais] ?? o.pais}</td>
                <td className="p-3">{conteo[o.id] ?? 0}</td>
                <td className="p-3">{o.activa ? <Etiqueta tono="bosque">Activo</Etiqueta> : <Etiqueta tono="alerta">Inactivo</Etiqueta>}</td>
                <td className="p-3 text-right whitespace-nowrap">
                  <button type="button" className="underline underline-offset-4 hover:text-bosque mr-4" onClick={() => iniciarVistaPrevia({ orgId: o.id, orgNombre: o.nombre, rol: 'titular', areas: [] })}>
                    Ver como titular
                  </button>
                  <button type="button" className="underline underline-offset-4 hover:text-bosque mr-4" onClick={() => iniciarVistaPrevia({ orgId: o.id, orgNombre: o.nombre, rol: 'miembro', areas: [] })}>
                    Ver como miembro
                  </button>
                  <button type="button" className="underline underline-offset-4 hover:text-bosque" onClick={() => setBorrador({ ...o })}>
                    Editar
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

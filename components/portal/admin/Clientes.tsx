import React, { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '../../Button';
import { supabase } from '../supabase';
import { Aviso, Campo, Etiqueta, Interruptor, claseInput } from '../ui';
import { iniciarVistaPrevia } from '../vistaPrevia';
import { PAISES, type Organizacion } from '../tipos';

type Borrador = Pick<Organizacion, 'nombre' | 'razon_social' | 'pais' | 'activa' | 'notas'> & { id?: string; prefijo_crm?: string | null; seguimiento_cobranza?: boolean };
const VACIO: Borrador = { nombre: '', razon_social: '', pais: 'AR', activa: true, notas: '', prefijo_crm: '', seguimiento_cobranza: false };

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
      prefijo_crm: borrador.prefijo_crm?.trim().toUpperCase() || null,
      seguimiento_cobranza: Boolean(borrador.seguimiento_cobranza),
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
        <form onSubmit={guardar} className="bg-marfil-oscuro p-6 desk:p-8 space-y-5 max-w-[680px]">
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
          <Campo etiqueta="Prefijo de códigos del CRM" ayuda="Por ejemplo TB para TB-001, TB-002.">
            <input className={`${claseInput} uppercase`} maxLength={6} value={borrador.prefijo_crm ?? ''} onChange={(e) => setBorrador({ ...borrador, prefijo_crm: e.target.value })} />
          </Campo>
          <Interruptor
            activo={Boolean(borrador.seguimiento_cobranza)}
            alCambiar={(v) => setBorrador({ ...borrador, seguimiento_cobranza: v })}
            etiqueta="Seguimiento de cobranza en el portal"
            ayuda="Apagado, el CRM solo guarda el plan pactado para el contrato. Encendido, el equipo marca las cuotas pagadas y ve las vencidas."
          />
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

      <div className="overflow-x-auto">
        <table className="tabla min-w-[760px]">
          <thead>
            <tr>
              <th>Cliente</th>
              <th>País</th>
              <th>Usuarios</th>
              <th>Cobranza</th>
              <th>Estado</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {lista.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-piedra">
                  Todavía no cargaste clientes.
                </td>
              </tr>
            )}
            {lista.map((o) => (
              <tr key={o.id}>
                <td>
                  <div className="font-heading font-bold text-[16px] leading-tight">{o.nombre}</div>
                  {o.razon_social && <div className="text-xs text-piedra">{o.razon_social}</div>}
                </td>
                <td>{PAISES[o.pais] ?? o.pais}</td>
                <td>{conteo[o.id] ?? 0}</td>
                <td>{o.seguimiento_cobranza ? <Etiqueta tono="bosque">Con seguimiento</Etiqueta> : <Etiqueta>Solo plan</Etiqueta>}</td>
                <td>{o.activa ? <Etiqueta tono="bosque">Activo</Etiqueta> : <Etiqueta tono="alerta">Inactivo</Etiqueta>}</td>
                <td className="text-right whitespace-nowrap">
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

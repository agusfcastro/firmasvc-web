import React, { useEffect, useState } from 'react';
import { ArrowLeft, Plus } from 'lucide-react';
import { Button } from '../../Button';
import { supabase } from '../supabase';
import { Aviso, Campo, Encabezado, Enlace, Etiqueta, claseInput } from '../ui';
import { useVistaPrevia } from '../vistaPrevia';
import { ROL_COMERCIAL, type IntegranteEquipo, type RolComercial } from './tipos';

/**
 * Equipo comercial de la empresa: closers, setters, account managers y CSM,
 * tengan o no cuenta en el portal. Lo carga el titular (o FIRMA) y lo ve todo
 * el equipo. Cada cliente del CRM puede llevar su closer, su setter y su
 * responsable. Más adelante, las llamadas de Fathom se atribuyen por el mail.
 * Nadie se borra: se desactiva y deja de aparecer al asignar clientes.
 *   /portal/crm/equipo
 */

interface Borrador {
  id?: string;
  nombre: string;
  rol_comercial: RolComercial;
  email: string;
  activo: boolean;
}

const VACIO: Borrador = { nombre: '', rol_comercial: 'closer', email: '', activo: true };

export const Equipo: React.FC<{ orgId: string; orgNombre: string; puedeGestionar: boolean }> = ({ orgId, orgNombre, puedeGestionar }) => {
  const [lista, setLista] = useState<IntegranteEquipo[]>([]);
  const [borrador, setBorrador] = useState<Borrador | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const soloLectura = Boolean(useVistaPrevia()) || !puedeGestionar;

  async function cargar() {
    if (!supabase) return;
    const { data, error: e } = await supabase.from('equipo_miembros').select('*').eq('organizacion_id', orgId).order('activo', { ascending: false }).order('nombre');
    if (e) setError(e.message);
    setLista((data as IntegranteEquipo[]) ?? []);
  }

  useEffect(() => {
    void cargar();
  }, [orgId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase || !borrador) return;
    const nombre = borrador.nombre.trim();
    const email = borrador.email.trim();
    if (nombre.length < 2) return setError('Poné el nombre de la persona.');
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setError('El mail no es válido.');

    setGuardando(true);
    setError(null);
    setOk(null);
    const datos = { nombre, rol_comercial: borrador.rol_comercial, email: email || null, activo: borrador.activo };
    const { error: err } = borrador.id
      ? await supabase.from('equipo_miembros').update(datos).eq('id', borrador.id)
      : await supabase.from('equipo_miembros').insert({ ...datos, organizacion_id: orgId });
    setGuardando(false);
    if (err) return setError(/duplicate|unique/i.test(err.message) ? `Ya hay alguien del equipo con el mail ${email}.` : err.message);
    setOk(borrador.id ? 'Datos actualizados.' : 'Listo. Ya se puede asignar a los clientes.');
    setBorrador(null);
    void cargar();
  }

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
            Equipo de <span className="text-bosque">{orgNombre}</span>
          </>
        }
        bajada="Quién vende y quién acompaña a cada cliente. No hace falta que tengan cuenta en el portal: si la tienen o la abren después, se unen solos por mail o por nombre."
        acciones={
          !soloLectura && !borrador ? (
            <Button size="lg" onClick={() => setBorrador({ ...VACIO })} className="self-end">
              <Plus size={18} /> Sumar al equipo
            </Button>
          ) : null
        }
      />
      <div className="wrap py-10 desk:py-12 flex flex-col gap-8">
        {error && <Aviso tipo="error">{error}</Aviso>}
        {ok && <Aviso tipo="ok">{ok}</Aviso>}
        {!puedeGestionar && <Aviso tipo="info">El equipo lo carga el titular de la empresa.</Aviso>}

        {borrador && (
          <form onSubmit={guardar} className="bg-marfil-oscuro p-6 desk:p-8 space-y-5 max-w-[680px]">
            <h2 className="h3">{borrador.id ? 'Editar integrante' : 'Sumar al equipo'}</h2>
            <Campo etiqueta="Nombre y apellido">
              <input required className={claseInput} maxLength={120} value={borrador.nombre} onChange={(e) => setBorrador({ ...borrador, nombre: e.target.value })} />
            </Campo>
            <Campo etiqueta="Rol">
              <select className={claseInput} value={borrador.rol_comercial} onChange={(e) => setBorrador({ ...borrador, rol_comercial: e.target.value as RolComercial })}>
                {(Object.keys(ROL_COMERCIAL) as RolComercial[]).map((r) => (
                  <option key={r} value={r}>
                    {ROL_COMERCIAL[r]}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo etiqueta="Mail (opcional)" ayuda="El mail con el que entra a las llamadas. Sirve para atribuirle cada llamada.">
              <input type="email" className={claseInput} value={borrador.email} onChange={(e) => setBorrador({ ...borrador, email: e.target.value })} />
            </Campo>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={borrador.activo} onChange={(e) => setBorrador({ ...borrador, activo: e.target.checked })} />
              Activo. Si lo desactivás, deja de aparecer al asignar clientes y conserva su historia.
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
        )}

        <div className="overflow-x-auto">
          <table className="tabla min-w-[560px]">
            <thead>
              <tr>
                <th>Persona</th>
                <th>Rol</th>
                <th>Portal</th>
                <th>Estado</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {lista.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-6 text-piedra">
                    Todavía no hay nadie cargado.
                  </td>
                </tr>
              )}
              {lista.map((m) => (
                <tr key={m.id}>
                  <td>
                    <div className="font-heading font-bold text-[16px] leading-tight">{m.nombre}</div>
                    {m.email && <div className="text-xs text-piedra">{m.email}</div>}
                  </td>
                  <td>{ROL_COMERCIAL[m.rol_comercial]}</td>
                  <td className="text-piedra text-sm">{m.usuario_id ? 'Con cuenta' : 'Sin cuenta'}</td>
                  <td>{m.activo ? <Etiqueta tono="bosque">Activo</Etiqueta> : <Etiqueta>Inactivo</Etiqueta>}</td>
                  <td className="text-right">
                    {!soloLectura && (
                      <button
                        type="button"
                        className="underline underline-offset-4 hover:text-bosque"
                        onClick={() => setBorrador({ id: m.id, nombre: m.nombre, rol_comercial: m.rol_comercial, email: m.email ?? '', activo: m.activo })}
                      >
                        Editar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
};

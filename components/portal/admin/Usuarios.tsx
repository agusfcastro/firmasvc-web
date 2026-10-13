import React, { useEffect, useMemo, useState } from 'react';
import { UserPlus } from 'lucide-react';
import { Button } from '../../Button';
import { supabase } from '../supabase';
import { llamarApiAdmin } from '../useSesion';
import { Aviso, Campo, Etiqueta, claseInput } from '../ui';
import { iniciarVistaPrevia } from '../vistaPrevia';
import { ROTULO_ROL, fechaCorta, type Area, type Organizacion, type Perfil, type Rol } from '../tipos';

interface Borrador {
  usuario_id?: string;
  email: string;
  nombre: string;
  rol: Rol;
  organizacion_id: string;
  areas: string[];
}

const VACIO: Borrador = { email: '', nombre: '', rol: 'miembro', organizacion_id: '', areas: [] };

export const Usuarios: React.FC<{ yo: Perfil }> = ({ yo }) => {
  const [usuarios, setUsuarios] = useState<Perfil[]>([]);
  const [orgs, setOrgs] = useState<Organizacion[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [filtroOrg, setFiltroOrg] = useState('todas');
  const [busqueda, setBusqueda] = useState('');
  const [borrador, setBorrador] = useState<Borrador | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);

  async function cargar() {
    if (!supabase) return;
    const [u, o, a] = await Promise.all([
      supabase.from('perfiles').select('*').order('creado_en', { ascending: false }),
      supabase.from('organizaciones').select('*').order('nombre'),
      supabase.from('areas').select('*').order('orden'),
    ]);
    if (u.error) setMensaje({ tipo: 'error', texto: u.error.message });
    setUsuarios((u.data as Perfil[]) ?? []);
    setOrgs((o.data as Organizacion[]) ?? []);
    setAreas((a.data as Area[]) ?? []);
  }

  useEffect(() => {
    void cargar();
  }, []);

  const nombreOrg = useMemo(() => Object.fromEntries(orgs.map((o) => [o.id, o.nombre])), [orgs]);

  const visibles = usuarios.filter((u) => {
    if (filtroOrg === 'firma' && u.rol !== 'admin') return false;
    if (filtroOrg !== 'todas' && filtroOrg !== 'firma' && u.organizacion_id !== filtroOrg) return false;
    const q = busqueda.trim().toLowerCase();
    return !q || u.email.toLowerCase().includes(q) || (u.nombre ?? '').toLowerCase().includes(q);
  });

  async function accion(cuerpo: Record<string, unknown>, exito: string, clave: string) {
    setOcupado(clave);
    setMensaje(null);
    const r = await llamarApiAdmin(cuerpo);
    setOcupado(null);
    setMensaje(r.ok ? { tipo: 'ok', texto: exito } : { tipo: 'error', texto: r.error ?? 'Error' });
    if (r.ok) await cargar();
    return r.ok;
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!borrador) return;
    const base = {
      nombre: borrador.nombre,
      rol: borrador.rol,
      organizacion_id: borrador.rol === 'admin' ? null : borrador.organizacion_id || null,
      areas: borrador.areas,
    };
    const ok = borrador.usuario_id
      ? await accion({ accion: 'actualizar', usuario_id: borrador.usuario_id, ...base }, 'Cambios guardados.', 'form')
      : await accion({ accion: 'invitar', email: borrador.email, ...base }, `Invitación enviada a ${borrador.email}. Le llega un mail para definir su contraseña.`, 'form');
    if (ok) setBorrador(null);
  }

  function alternarArea(clave: string) {
    if (!borrador) return;
    const tiene = borrador.areas.includes(clave);
    setBorrador({ ...borrador, areas: tiene ? borrador.areas.filter((a) => a !== clave) : [...borrador.areas, clave] });
  }

  return (
    <div className="space-y-6">
      {mensaje && <Aviso tipo={mensaje.tipo}>{mensaje.texto}</Aviso>}

      {borrador ? (
        <form onSubmit={guardar} className="bg-marfil-oscuro p-6 desk:p-8 space-y-5 max-w-[680px]">
          <h2 className="h3">{borrador.usuario_id ? 'Editar usuario' : 'Invitar usuario'}</h2>
          <Campo etiqueta="Mail" ayuda={borrador.usuario_id ? 'El mail no se puede cambiar.' : 'Le llega una invitación para que defina su contraseña.'}>
            <input type="email" required disabled={Boolean(borrador.usuario_id)} className={claseInput} value={borrador.email} onChange={(e) => setBorrador({ ...borrador, email: e.target.value })} />
          </Campo>
          <Campo etiqueta="Nombre y apellido">
            <input required className={claseInput} value={borrador.nombre} onChange={(e) => setBorrador({ ...borrador, nombre: e.target.value })} />
          </Campo>
          <Campo etiqueta="Rol">
            <select
              className={claseInput}
              value={borrador.rol}
              disabled={borrador.usuario_id === yo.id}
              onChange={(e) => setBorrador({ ...borrador, rol: e.target.value as Rol })}
            >
              <option value="miembro">{ROTULO_ROL.miembro}</option>
              <option value="titular">{ROTULO_ROL.titular}</option>
              <option value="admin">{ROTULO_ROL.admin}</option>
            </select>
          </Campo>
          {borrador.rol !== 'admin' && (
            <Campo etiqueta="Cliente">
              <select required className={claseInput} value={borrador.organizacion_id} onChange={(e) => setBorrador({ ...borrador, organizacion_id: e.target.value })}>
                <option value="">Elegí un cliente</option>
                {orgs
                  .filter((o) => o.activa || o.id === borrador.organizacion_id)
                  .map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.nombre}
                    </option>
                  ))}
              </select>
            </Campo>
          )}
          {borrador.rol === 'admin' && <Aviso tipo="info">Un admin FIRMA ve y edita la información de todos los clientes. Dalo solo a tu equipo interno.</Aviso>}
          {borrador.rol !== 'admin' && (
            <fieldset>
              <legend className="text-sm font-medium mb-2">Áreas</legend>
              <p className="text-xs text-piedra mb-3">Definen qué protocolos y videos va a ver. El titular ve todas.</p>
              <div className="flex flex-wrap gap-2">
                {areas.map((a) => {
                  const marcada = borrador.areas.includes(a.clave);
                  return (
                    <button
                      type="button"
                      key={a.clave}
                      onClick={() => alternarArea(a.clave)}
                      className={`px-3 h-9 text-sm border ${marcada ? 'bg-bosque text-marfil border-bosque' : 'bg-white border-[rgba(27,31,27,0.25)] hover:border-bosque'}`}
                      aria-pressed={marcada}
                    >
                      {a.nombre}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          )}
          <div className="flex gap-3">
            <Button type="submit" disabled={ocupado === 'form'}>
              {ocupado === 'form' ? 'Un momento…' : borrador.usuario_id ? 'Guardar cambios' : 'Enviar invitación'}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setBorrador(null)}>
              Cancelar
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap items-end gap-3">
          <Button onClick={() => setBorrador({ ...VACIO, organizacion_id: filtroOrg !== 'todas' && filtroOrg !== 'firma' ? filtroOrg : '' })}>
            <UserPlus size={16} /> Invitar usuario
          </Button>
          <div className="flex-1" />
          <select className={`${claseInput} !w-auto min-w-[200px]`} value={filtroOrg} onChange={(e) => setFiltroOrg(e.target.value)} aria-label="Filtrar por cliente">
            <option value="todas">Todos los clientes</option>
            <option value="firma">Equipo FIRMA</option>
            {orgs.map((o) => (
              <option key={o.id} value={o.id}>
                {o.nombre}
              </option>
            ))}
          </select>
          <input className={`${claseInput} !w-full tab:!w-64`} placeholder="Buscar por nombre o mail" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="tabla min-w-[760px]">
          <thead>
            <tr>
              <th>Usuario</th>
              <th>Cliente</th>
              <th>Rol</th>
              <th>Último ingreso</th>
              <th>Estado</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {visibles.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-piedra">
                  No hay usuarios para mostrar.
                </td>
              </tr>
            )}
            {visibles.map((u) => (
              <tr key={u.id}>
                <td>
                  <div className="font-heading font-bold text-[16px] leading-tight">{u.nombre || '·'}</div>
                  <div className="text-xs text-piedra">{u.email}</div>
                  {u.areas.length > 0 && <div className="text-xs text-piedra mt-1">{u.areas.map((a) => areas.find((x) => x.clave === a)?.nombre ?? a).join(', ')}</div>}
                </td>
                <td>{u.rol === 'admin' ? 'FIRMA' : nombreOrg[u.organizacion_id ?? ''] ?? '·'}</td>
                <td className="whitespace-nowrap">{ROTULO_ROL[u.rol]}</td>
                <td className="whitespace-nowrap">{u.ultimo_ingreso ? fechaCorta(u.ultimo_ingreso) : <Etiqueta>Invitación pendiente</Etiqueta>}</td>
                <td>{u.activo ? <Etiqueta tono="bosque">Activo</Etiqueta> : <Etiqueta tono="alerta">Desactivado</Etiqueta>}</td>
                <td>
                  <div className="flex flex-wrap justify-end gap-x-4 gap-y-1.5 whitespace-nowrap max-w-[260px] ml-auto">
                    <button
                      type="button"
                      className="underline underline-offset-4 hover:text-bosque"
                      onClick={() => setBorrador({ usuario_id: u.id, email: u.email, nombre: u.nombre ?? '', rol: u.rol, organizacion_id: u.organizacion_id ?? '', areas: u.areas })}
                    >
                      Editar
                    </button>
                    {u.rol !== 'admin' && u.organizacion_id && (
                      <button
                        type="button"
                        className="underline underline-offset-4 hover:text-bosque"
                        onClick={() =>
                          iniciarVistaPrevia({
                            orgId: u.organizacion_id!,
                            orgNombre: nombreOrg[u.organizacion_id!] ?? 'Cliente',
                            rol: u.rol as 'titular' | 'miembro',
                            areas: u.areas,
                            nombre: u.nombre ?? u.email,
                          })
                        }
                      >
                        Ver como
                      </button>
                    )}
                    {u.activo && (
                      <button
                        type="button"
                        disabled={ocupado === u.id}
                        className="underline underline-offset-4 hover:text-bosque"
                        onClick={() => accion({ accion: 'enviar_acceso', usuario_id: u.id }, `Enlace de acceso enviado a ${u.email}.`, u.id)}
                      >
                        Reenviar acceso
                      </button>
                    )}
                    {u.id !== yo.id && (
                      <button
                        type="button"
                        disabled={ocupado === u.id}
                        className={`underline underline-offset-4 ${u.activo ? 'text-[#8a2b20]' : 'hover:text-bosque'}`}
                        onClick={() => {
                          if (u.activo && !window.confirm(`¿Desactivar el acceso de ${u.email}? Deja de poder ingresar de inmediato.`)) return;
                          void accion(
                            { accion: u.activo ? 'desactivar' : 'activar', usuario_id: u.id },
                            u.activo ? `Acceso de ${u.email} desactivado.` : `Acceso de ${u.email} activado.`,
                            u.id,
                          );
                        }}
                      >
                        {u.activo ? 'Desactivar' : 'Activar'}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

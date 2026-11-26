import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Plus, Search, X } from 'lucide-react';
import { Button } from '../../Button';
import { supabase } from '../supabase';
import { Aviso, Cifras, Encabezado, Enlace, Pestanas, claseInput } from '../ui';
import { useVistaPrevia } from '../vistaPrevia';
import { mensajeAmable } from '../errores';
import { rolDe, type IntegranteEquipo } from './tipos';
import {
  COLUMNAS_REUNION,
  TIPO_REUNION,
  asistencia,
  cierre,
  claveDia,
  dia,
  porCompletar,
  porcentaje,
  yaPaso,
  type Reunion,
  type TipoReunion,
} from './reuniones';
import { FilaReunion, FormReunion, type ClienteOpcion } from './ReunionUI';
import { useConexionesGoogle } from '../google';

type Vista = 'proximas' | 'completar' | 'pasadas' | 'todas';
type Periodo = '30' | '90' | '365';

const DIA = 86400000;

/**
 * Reuniones del equipo con clientes y prospectos.
 *   Próximas         las agendadas que vienen
 *   Por completar    llamadas de Fathom sin tipo y agendadas que pasaron sin marcar
 *   Pasadas          lo que ya pasó, con asistencia y resultado
 * Abajo, la asistencia y el cierre de cada persona del equipo en el período.
 */
export const Reuniones: React.FC<{ orgId: string; orgNombre: string; puedeGestionar: boolean }> = ({ orgId, orgNombre, puedeGestionar }) => {
  const [lista, setLista] = useState<Reunion[]>([]);
  const [clientes, setClientes] = useState<ClienteOpcion[]>([]);
  const [equipo, setEquipo] = useState<IntegranteEquipo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [yo, setYo] = useState<string | null>(null);
  const [vista, setVista] = useState<Vista>('proximas');
  const [periodo, setPeriodo] = useState<Periodo>('90');
  const [persona, setPersona] = useState('');
  const [tipo, setTipo] = useState<TipoReunion | 'sin' | ''>('');
  const [busqueda, setBusqueda] = useState('');
  const [clienteFijo, setClienteFijo] = useState<string | null>(() => new URLSearchParams(window.location.search).get('cliente'));
  const [form, setForm] = useState<Reunion | 'nueva' | null>(null);
  const [mostrar, setMostrar] = useState(60);
  const soloLectura = Boolean(useVistaPrevia());
  const google = useConexionesGoogle(orgId);

  useEffect(() => {
    if (!supabase) return;
    let vigente = true;
    setCargando(true);
    const desde = new Date(Date.now() - Number(periodo) * DIA).toISOString();
    Promise.all([
      supabase.from('crm_reuniones').select(COLUMNAS_REUNION).eq('organizacion_id', orgId).gte('inicio', desde).order('inicio', { ascending: false }).limit(3000),
      supabase.from('crm_clientes').select('id, nombre, codigo, responsable_id').eq('organizacion_id', orgId).order('nombre'),
      supabase.from('equipo_miembros').select('*').eq('organizacion_id', orgId).order('nombre'),
      supabase.auth.getUser(),
    ]).then(([r, c, e, u]) => {
      if (!vigente) return;
      if (r.error) setError(/crm_reuniones/.test(r.error.message) ? 'Falta correr la migración 0078_crm_reuniones_roles.sql en Supabase.' : mensajeAmable(r.error));
      setLista((r.data as Reunion[]) ?? []);
      setClientes((c.data as ClienteOpcion[]) ?? []);
      setEquipo((e.data as IntegranteEquipo[]) ?? []);
      setYo(u.data.user?.id ?? null);
      setCargando(false);
    });
    return () => {
      vigente = false;
    };
  }, [orgId, periodo]);

  useEffect(() => setMostrar(60), [vista, persona, tipo, busqueda, clienteFijo, periodo]);

  const nombreCliente = useMemo(() => new Map(clientes.map((c) => [c.id, c.nombre])), [clientes]);
  const miIntegrante = equipo.find((m) => m.usuario_id && m.usuario_id === yo)?.id;

  // Filtros de persona, tipo, cliente y búsqueda. Las pestañas cortan después.
  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return lista.filter((r) => {
      if (clienteFijo && r.cliente_id !== clienteFijo) return false;
      if (persona && (persona === 'sin' ? r.miembro_id : r.miembro_id !== persona && r.agendada_por !== persona)) return false;
      if (tipo && (tipo === 'sin' ? r.tipo : r.tipo !== tipo)) return false;
      if (!q) return true;
      return [r.cliente_id ? nombreCliente.get(r.cliente_id) : null, r.prospecto, r.titulo, r.notas].some((v) => (v ?? '').toLowerCase().includes(q));
    });
  }, [lista, clienteFijo, persona, tipo, busqueda, nombreCliente]);

  const proximas = filtradas.filter((r) => r.estado === 'agendada' && !yaPaso(r)).sort((a, b) => a.inicio.localeCompare(b.inicio));
  const completar = filtradas.filter(porCompletar);
  const pasadas = filtradas.filter((r) => yaPaso(r));
  const deVista = { proximas, completar, pasadas, todas: filtradas }[vista];
  const visibles = deVista.slice(0, mostrar);

  const enSieteDias = proximas.filter((r) => Date.parse(r.inicio) < Date.now() + 7 * DIA).length;
  const asis = asistencia(pasadas);
  const cie = cierre(pasadas);

  // Por persona del equipo: lo que tuvo en el período.
  const porPersona = useMemo(() => {
    const filas = equipo
      .map((m) => {
        const suyas = lista.filter((r) => r.miembro_id === m.id && (!clienteFijo || r.cliente_id === clienteFijo));
        const pas = suyas.filter((r) => yaPaso(r));
        return {
          m,
          total: suyas.length,
          proximas: suyas.filter((r) => r.estado === 'agendada' && !yaPaso(r)).length,
          completar: suyas.filter(porCompletar).length,
          asis: asistencia(pas),
          seguimiento: asistencia(pas.filter((r) => r.tipo === 'seguimiento')),
          cie: cierre(pas),
          agendo: lista.filter((r) => r.agendada_por === m.id).length,
        };
      })
      .filter((f) => f.total > 0 || f.agendo > 0);
    return filas.sort((a, b) => b.total - a.total || a.m.nombre.localeCompare(b.m.nombre, 'es'));
  }, [equipo, lista, clienteFijo]);

  const reemplazar = (r: Reunion) => setLista((l) => [r, ...l.filter((x) => x.id !== r.id)].sort((a, b) => b.inicio.localeCompare(a.inicio)));
  const conQuien = (r: Reunion) =>
    r.cliente_id
      ? { nombre: nombreCliente.get(r.cliente_id) ?? 'Cliente', a: `/portal/crm/${r.cliente_id}` }
      : r.prospecto
        ? { nombre: `${r.prospecto} · prospecto` }
        : { nombre: 'Sin cliente asignado' };

  const elegirPersona = (id: string) => {
    setPersona(id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const selector = 'h-11 pl-3.5 pr-9 bg-white border border-borde rounded-control text-[15px] focus:outline-none focus:border-bosque focus:ring-2 focus:ring-bosque/25';

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
            Reuniones de <span className="text-bosque">{orgNombre}</span>
          </>
        }
        bajada="Cada reunión del equipo con clientes y prospectos. Las llamadas de Fathom llegan solas con su link y alguien marca el tipo, porque Fathom no distingue un seguimiento de un cierre."
        acciones={
          !soloLectura && (
            <Button size="lg" onClick={() => setForm('nueva')} className="self-end">
              <Plus size={18} /> Nueva reunión
            </Button>
          )
        }
      />

      <div className="wrap py-10 desk:py-14 flex flex-col gap-10">
        {error && <Aviso tipo="error">{error}</Aviso>}

        {form === 'nueva' && (
          <FormReunion
            orgId={orgId}
            equipo={equipo}
            clientes={clientes}
            clienteId={clienteFijo ?? undefined}
            miembroPorDefecto={persona && persona !== 'sin' ? persona : miIntegrante}
            conectados={google.activas}
            alGuardar={(r) => {
              reemplazar(r);
              setForm(null);
            }}
            alCancelar={() => setForm(null)}
          />
        )}

        <Cifras
          cargando={cargando}
          items={[
            { titulo: 'Próximos 7 días', valor: enSieteDias, nota: proximas.length > enSieteDias ? `${proximas.length} agendadas en total` : undefined },
            { titulo: 'Por completar', valor: completar.length, alerta: completar.length > 0, nota: 'Sin tipo o sin marcar si se hizo' },
            { titulo: 'Asistencia', valor: porcentaje(asis.tasa), nota: `${asis.hechas} hechas, ${asis.faltazos} sin asistencia` },
            { titulo: 'Cierre de ventas', valor: porcentaje(cie.tasa), nota: cie.ventas ? `${cie.cerradas} de ${cie.ventas} ventas con resultado` : 'Sin ventas con resultado' },
          ]}
        />

        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="relative flex-1 min-w-[220px] max-w-[360px]">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-piedra" aria-hidden="true" />
              <input className={`${claseInput} pl-10`} placeholder="Buscar cliente, prospecto o título" aria-label="Buscar reunión" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
            </div>
            <select aria-label="Persona del equipo" className={selector} value={persona} onChange={(e) => setPersona(e.target.value)}>
              <option value="">Todo el equipo</option>
              <option value="sin">Sin persona asignada</option>
              {equipo
                .filter((m) => m.activo || lista.some((r) => r.miembro_id === m.id))
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nombre} · {rolDe(m)}
                  </option>
                ))}
            </select>
            <select aria-label="Tipo de reunión" className={selector} value={tipo} onChange={(e) => setTipo(e.target.value as TipoReunion | 'sin' | '')}>
              <option value="">Todos los tipos</option>
              <option value="sin">Sin tipo</option>
              {(Object.keys(TIPO_REUNION) as TipoReunion[]).map((t) => (
                <option key={t} value={t}>
                  {TIPO_REUNION[t]}
                </option>
              ))}
            </select>
            <select aria-label="Período" className={selector} value={periodo} onChange={(e) => setPeriodo(e.target.value as Periodo)}>
              <option value="30">Últimos 30 días y lo que viene</option>
              <option value="90">Últimos 90 días y lo que viene</option>
              <option value="365">Último año y lo que viene</option>
            </select>
          </div>

          {clienteFijo && (
            <div className="flex items-center gap-2 text-sm">
              <span>
                Solo las de <strong>{nombreCliente.get(clienteFijo) ?? 'este cliente'}</strong>
              </span>
              <button
                type="button"
                aria-label="Ver todas las reuniones"
                className="w-7 h-7 inline-flex items-center justify-center border border-borde-suave bg-papel hover:border-tinta"
                onClick={() => {
                  setClienteFijo(null);
                  window.history.replaceState({}, '', '/portal/crm/reuniones');
                }}
              >
                <X size={13} aria-hidden="true" />
              </button>
            </div>
          )}

          <Pestanas<Vista>
            items={[
              { clave: 'proximas', titulo: 'Próximas', cuenta: cargando ? undefined : proximas.length },
              { clave: 'completar', titulo: 'Por completar', cuenta: cargando ? undefined : completar.length },
              { clave: 'pasadas', titulo: 'Pasadas', cuenta: cargando ? undefined : pasadas.length },
              { clave: 'todas', titulo: 'Todas', cuenta: cargando ? undefined : filtradas.length },
            ]}
            activa={vista}
            alCambiar={setVista}
          />

          {!cargando && visibles.length === 0 ? (
            <p className="text-piedra py-6">
              {vista === 'proximas'
                ? 'No hay reuniones agendadas con estos filtros.'
                : vista === 'completar'
                  ? 'Nada por completar. Todas tienen tipo y las agendadas que pasaron están marcadas.'
                  : 'No hay reuniones para mostrar con estos filtros.'}
            </p>
          ) : (
            <ul>
              {visibles.map((r, i) => (
                <React.Fragment key={r.id}>
                  {(i === 0 || claveDia(visibles[i - 1].inicio) !== claveDia(r.inicio)) && (
                    <li className="pt-6 first:pt-0 pb-1 text-[12.5px] font-semibold uppercase tracking-[0.06em] text-piedra border-b border-tinta/10">{dia(r.inicio)}</li>
                  )}
                  {form !== 'nueva' && form?.id === r.id ? (
                    <li className="py-3">
                      <FormReunion
                        orgId={orgId}
                        equipo={equipo}
                        clientes={clientes}
                        inicial={r}
                        puedeBorrar={puedeGestionar || r.creado_por === yo}
                        alGuardar={(n) => {
                          reemplazar(n);
                          setForm(null);
                        }}
                        alBorrar={(id) => {
                          setLista((l) => l.filter((x) => x.id !== id));
                          setForm(null);
                        }}
                        alCancelar={() => setForm(null)}
                      />
                    </li>
                  ) : (
                    <FilaReunion r={r} equipo={equipo} conQuien={conQuien(r)} editable={!soloLectura} alCambiar={reemplazar} alEditar={() => setForm(r)} />
                  )}
                </React.Fragment>
              ))}
            </ul>
          )}
          {deVista.length > visibles.length && (
            <div>
              <Button variant="ghost" size="sm" onClick={() => setMostrar((n) => n + 60)}>
                Mostrar más ({deVista.length - visibles.length})
              </Button>
            </div>
          )}
        </div>

        {porPersona.length > 0 && (
          <section className="flex flex-col gap-4">
            <div>
              <h2 className="h3">Por persona del equipo</h2>
              <p className="text-sm text-piedra mt-1 max-w-[70ch]">
                En el período elegido. La asistencia cuenta las reuniones que se hicieron contra las que el cliente faltó. La de seguimiento es la de un Account Manager con sus clientes.
                El cierre, las ventas que cerraron sobre las que tienen resultado.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="tabla min-w-[860px]">
                <thead>
                  <tr>
                    <th>Persona</th>
                    <th className="num">Reuniones</th>
                    <th className="num">Próximas</th>
                    <th className="num">Asistencia</th>
                    <th className="num">Asistencia a seguimientos</th>
                    <th className="num">Cierre</th>
                    <th className="num">Agendó</th>
                    <th className="num">Por completar</th>
                  </tr>
                </thead>
                <tbody>
                  {porPersona.map((f) => (
                    <tr key={f.m.id} className="fila-link" onClick={() => elegirPersona(f.m.id)}>
                      <td>
                        <div className="font-medium">{f.m.nombre}</div>
                        <div className="text-xs text-piedra mt-0.5">{rolDe(f.m)}</div>
                      </td>
                      <td className="num">{f.total}</td>
                      <td className="num">{f.proximas}</td>
                      <td className="num">
                        {porcentaje(f.asis.tasa)}
                        {f.asis.tasa !== null && <div className="text-xs text-piedra">{`${f.asis.hechas} de ${f.asis.hechas + f.asis.faltazos}`}</div>}
                      </td>
                      <td className="num">{porcentaje(f.seguimiento.tasa)}</td>
                      <td className="num">
                        {porcentaje(f.cie.tasa)}
                        {f.cie.ventas > 0 && <div className="text-xs text-piedra">{`${f.cie.cerradas} de ${f.cie.ventas}`}</div>}
                      </td>
                      <td className="num">{f.agendo || '·'}</td>
                      <td className={`num ${f.completar ? 'text-peligro font-medium' : ''}`}>{f.completar || '·'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </>
  );
};

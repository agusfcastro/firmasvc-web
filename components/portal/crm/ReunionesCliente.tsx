import React, { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '../../Button';
import { supabase } from '../supabase';
import { Bloque, Enlace } from '../ui';
import { type IntegranteEquipo } from './tipos';
import { COLUMNAS_REUNION, TIPO_REUNION, asistencia, claveDia, dia, fechaHora, porcentaje, yaPaso, type Reunion } from './reunionesDatos';
import { FilaReunion, FormReunion } from './ReunionUI';
import { useConexionesGoogle } from '../google';

/** Reuniones del equipo con un cliente, en su ficha: las que vienen, las que pasaron y su asistencia. */
export const ReunionesCliente: React.FC<{
  clienteId: string;
  orgId: string;
  equipo: IntegranteEquipo[];
  responsableId?: string | null;
  soloLectura: boolean;
  puedeGestionar: boolean;
}> = ({ clienteId, orgId, equipo, responsableId, soloLectura, puedeGestionar }) => {
  const [lista, setLista] = useState<Reunion[] | null>(null);
  const [sinTabla, setSinTabla] = useState(false);
  const [form, setForm] = useState<Reunion | 'nueva' | null>(null);
  const [todas, setTodas] = useState(false);
  const [yo, setYo] = useState<string | null>(null);
  const google = useConexionesGoogle(orgId);

  useEffect(() => {
    if (!supabase) return;
    let vigente = true;
    supabase
      .from('crm_reuniones')
      .select(COLUMNAS_REUNION)
      .eq('cliente_id', clienteId)
      .order('inicio', { ascending: false })
      .limit(200)
      .then(({ data, error }) => {
        if (!vigente) return;
        // Sin la migración 0078 la tabla no existe: la sección no aparece.
        if (error) return setSinTabla(true);
        setLista((data as Reunion[]) ?? []);
      });
    void supabase.auth.getUser().then(({ data }) => vigente && setYo(data.user?.id ?? null));
    return () => {
      vigente = false;
    };
  }, [clienteId]);

  if (sinTabla) return null;

  const miIntegrante = equipo.find((m) => m.usuario_id && m.usuario_id === yo)?.id;
  const proximas = (lista ?? []).filter((r) => !yaPaso(r) && r.estado === 'agendada').sort((a, b) => a.inicio.localeCompare(b.inicio));
  const pasadas = (lista ?? []).filter((r) => !proximas.includes(r));
  const visiblesPasadas = todas ? pasadas : pasadas.slice(0, 6);
  const { hechas, faltazos, tasa } = asistencia(pasadas);
  const proxima = proximas[0];
  const persona = proxima?.miembro_id ? equipo.find((m) => m.id === proxima.miembro_id) : null;

  const reemplazar = (r: Reunion) => setLista((l) => [r, ...(l ?? []).filter((x) => x.id !== r.id)].sort((a, b) => b.inicio.localeCompare(a.inicio)));

  const fila = (r: Reunion, conDia: boolean) => (
    <React.Fragment key={r.id}>
      {conDia && <li className="pt-5 first:pt-0 pb-1 text-[12.5px] font-semibold uppercase tracking-[0.06em] text-piedra">{dia(r.inicio)}</li>}
      {form !== 'nueva' && form?.id === r.id ? (
        <li className="py-3">
          <FormReunion
            orgId={orgId}
            equipo={equipo}
            clienteId={clienteId}
            inicial={r}
            puedeBorrar={puedeGestionar || r.creado_por === yo}
            alGuardar={(n) => {
              reemplazar(n);
              setForm(null);
            }}
            alBorrar={(id) => {
              setLista((l) => (l ?? []).filter((x) => x.id !== id));
              setForm(null);
            }}
            alCancelar={() => setForm(null)}
          />
        </li>
      ) : (
        <FilaReunion r={r} equipo={equipo} editable={!soloLectura} alCambiar={reemplazar} alEditar={() => setForm(r)} />
      )}
    </React.Fragment>
  );

  const conDias = (items: Reunion[]) => items.map((r, i) => fila(r, i === 0 || claveDia(items[i - 1].inicio) !== claveDia(r.inicio)));

  return (
    <Bloque
        titulo="Reuniones"
        acciones={
          soloLectura ? undefined : (
            <Button variant="ghost" size="sm" onClick={() => setForm('nueva')}>
              <Plus size={16} /> Agendar reunión
            </Button>
          )
        }
      >
      {lista === null ? (
        <p className="eyebrow text-piedra">Cargando</p>
      ) : (
        <div className="flex flex-col gap-6">
          {form === 'nueva' && (
            <FormReunion
              orgId={orgId}
              equipo={equipo}
              clienteId={clienteId}
              miembroPorDefecto={responsableId ?? miIntegrante}
              conectados={google.activas}
              alGuardar={(n) => {
                reemplazar(n);
                setForm(null);
              }}
              alCancelar={() => setForm(null)}
            />
          )}
          {lista.length === 0 ? (
            <p className="text-sm text-piedra">Sin reuniones. Las de Fathom llegan solas.</p>
          ) : (
            <>
              <div className="grid gap-4 tab:grid-cols-2">
                <div className="bg-papel border border-borde-suave p-4">
                  <p className="text-[12.5px] font-medium text-piedra">Próxima reunión</p>
                  {proxima ? (
                    <p className="mt-1 font-medium">
                      {fechaHora(proxima.inicio)} · {proxima.tipo ? TIPO_REUNION[proxima.tipo] : 'Sin tipo'}
                      {persona ? ` con ${persona.nombre}` : ''}
                    </p>
                  ) : (
                    <p className="mt-1 text-peligro font-medium">No hay ninguna agendada</p>
                  )}
                </div>
                <div className="bg-papel border border-borde-suave p-4">
                  <p className="text-[12.5px] font-medium text-piedra">Asistencia del cliente</p>
                  <p className="mt-1 font-medium">
                    {tasa === null ? 'Sin reuniones pasadas' : `${porcentaje(tasa)} · vino a ${hechas} de ${hechas + faltazos}`}
                  </p>
                </div>
              </div>
              {proximas.length > 0 && (
                <div>
                  <h3 className="text-[15px] font-semibold mb-1">Agendadas</h3>
                  <ul>{conDias(proximas)}</ul>
                </div>
              )}
              {pasadas.length > 0 && (
                <div>
                  <h3 className="text-[15px] font-semibold mb-1">Historial</h3>
                  <ul>{conDias(visiblesPasadas)}</ul>
                  <div className="mt-3 flex flex-wrap gap-4 text-sm">
                    {pasadas.length > visiblesPasadas.length && (
                      <button type="button" className="underline underline-offset-4 hover:text-bosque" onClick={() => setTodas(true)}>
                        Ver las {pasadas.length} reuniones del historial
                      </button>
                    )}
                    <Enlace a={`/portal/crm/reuniones?cliente=${clienteId}`} className="underline underline-offset-4 text-piedra hover:text-bosque">
                      Abrir en Reuniones
                    </Enlace>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </Bloque>
  );
};

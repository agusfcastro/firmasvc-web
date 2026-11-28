import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '../../Button';
import { Aviso, Bloque, Etiqueta } from '../ui';
import { avisoDeGoogle, conectarGoogle, pedirGoogle, useConexionesGoogle } from '../google';
import { FilaReunion, FormReunion } from '../crm/ReunionUI';
import { claveDia, dia, yaPaso, type Reunion } from '../crm/reunionesDatos';
import type { BaseEquipo } from './EquipoApp';
import { FilaItem } from './Personas';
import { entreManos, numerosDe, objetivosDe, riesgoLegalDe, tonoRendimiento, useDatosPersonas } from './personasDatos';
import { fechaLarga, numero } from './tipos';

const TONO_RIESGO = { bajo: '#3f7a5f', medio: '#b7791f', alto: 'var(--color-peligro)' } as const;

/**
 * Ficha de una persona del equipo: lo que tiene entre manos, sus reuniones,
 * victorias, números, objetivos y, para quien lidera, el riesgo legal del
 * vínculo. /portal/equipo/persona/<id>
 */
export const FichaPersona: React.FC<{ base: BaseEquipo; id: string }> = ({ base, id }) => {
  const { orgId, equipo, lidera, soloLectura, objetivos, reportes, yo, miCuenta } = base;
  const m = equipo.find((x) => x.id === id) ?? null;
  const puedeVer = Boolean(m) && (lidera || yo?.id === id);
  const datos = useDatosPersonas(orgId, lidera);
  const [form, setForm] = useState<Reunion | 'nueva' | null>(null);
  const [todas, setTodas] = useState(false);
  const google = useConexionesGoogle(orgId);
  const [aviso, setAviso] = useState(() => avisoDeGoogle());
  const [ocupadoGoogle, setOcupadoGoogle] = useState(false);
  async function conectar() {
    setOcupadoGoogle(true);
    try {
      await conectarGoogle(orgId);
    } catch (e) {
      setOcupadoGoogle(false);
      setAviso({ tipo: 'error', texto: e instanceof Error ? e.message : 'No se pudo conectar con Google.' });
    }
  }
  async function desconectar() {
    if (!window.confirm('¿Desconectamos tu Google Calendar de este negocio? El equipo deja de ver tu agenda.')) return;
    setOcupadoGoogle(true);
    try {
      await pedirGoogle('desconectar', { org: orgId });
      await google.recargar();
      setAviso({ tipo: 'ok', texto: 'Tu Google Calendar quedó desconectado de este negocio.' });
    } catch (e) {
      setAviso({ tipo: 'error', texto: e instanceof Error ? e.message : 'No se pudo desconectar.' });
    }
    setOcupadoGoogle(false);
  }

  if (!m || !puedeVer) return <Aviso tipo="error">No existe esa persona en el equipo o no tenés acceso a su ficha.</Aviso>;
  if (!datos.cargado)
    return (
      <p className="text-piedra text-sm" role="status">
        Cargando…
      </p>
    );

  const items = entreManos(m, datos, objetivos);
  const { cifras, rendimiento } = numerosDe(m, datos, objetivos);
  const obs = objetivosDe(m, objetivos, datos.avances);
  const riesgo = lidera ? riesgoLegalDe(m, datos, reportes) : null;
  const tono = tonoRendimiento(rendimiento);
  const clientes = datos.clientes.map((c) => ({ id: c.id, nombre: c.nombre, codigo: c.codigo, responsable_id: c.responsable_id }));
  const conQuien = (r: Reunion) =>
    r.cliente_id
      ? { nombre: datos.clientes.find((c) => c.id === r.cliente_id)?.nombre ?? 'Cliente', a: `/portal/crm/${r.cliente_id}` }
      : { nombre: r.prospecto ? `${r.prospecto} · prospecto` : r.titulo || 'Sin cliente' };

  const suyas = datos.reuniones.filter((r) => r.miembro_id === m.id || r.agendada_por === m.id);
  const proximas = suyas.filter((r) => r.estado === 'agendada' && !yaPaso(r)).sort((a, b) => a.inicio.localeCompare(b.inicio));
  const pasadas = suyas.filter((r) => !proximas.includes(r)).sort((a, b) => b.inicio.localeCompare(a.inicio));
  const victorias = datos.victorias.filter((v) => v.miembro_id === m.id).slice(0, 10);

  const lista = (rs: Reunion[]) =>
    rs.map((r, i) => (
      <React.Fragment key={r.id}>
        {(i === 0 || claveDia(rs[i - 1].inicio) !== claveDia(r.inicio)) && <li className="pt-4 first:pt-0 pb-1 text-[12px] font-semibold uppercase tracking-[0.06em] text-piedra">{dia(r.inicio)}</li>}
        {form !== 'nueva' && form?.id === r.id ? (
          <li className="py-3">
            <FormReunion
              orgId={orgId}
              equipo={equipo}
              clientes={clientes}
              inicial={r}
              puedeBorrar={lidera}
              alGuardar={(n) => {
                datos.reemplazar(n);
                setForm(null);
              }}
              alBorrar={() => {
                void datos.recargar();
                setForm(null);
              }}
              alCancelar={() => setForm(null)}
            />
          </li>
        ) : (
          <FilaReunion r={r} equipo={equipo} conQuien={conQuien(r)} editable={!soloLectura} alCambiar={datos.reemplazar} alEditar={() => setForm(r)} />
        )}
      </React.Fragment>
    ));

  const conexion = google.conexiones.find((c) => c.miembro_id === m.id && c.estado !== 'revocada') ?? null;
  const esYo = miCuenta?.id === m.id;

  return (
    <div className="flex flex-col gap-5">
    {aviso && <Aviso tipo={aviso.tipo}>{aviso.texto}</Aviso>}
    <div className="grid gap-5 desk:grid-cols-[7fr_5fr] items-start">
      <div className="flex flex-col gap-5 min-w-0">
        <Bloque titulo="Entre manos">
          {items.length ? (
            <ol className="-mx-2">
              {items.map((it, i) => (
                <FilaItem key={i} item={it} n={i + 1} />
              ))}
            </ol>
          ) : (
            <p className="text-sm text-piedra">Nada pendiente por ahora.</p>
          )}
        </Bloque>

        <Bloque
          titulo="Reuniones"
          acciones={
            soloLectura ? undefined : (
              <Button variant="ghost" size="sm" onClick={() => setForm('nueva')}>
                <Plus size={16} /> Agendar
              </Button>
            )
          }
        >
          <div className="flex flex-col gap-5">
            {form === 'nueva' && (
              <FormReunion
                orgId={orgId}
                equipo={equipo}
                clientes={clientes}
                miembroPorDefecto={m.id}
                conectados={google.activas}
                alGuardar={(n) => {
                  datos.reemplazar(n);
                  setForm(null);
                }}
                alCancelar={() => setForm(null)}
              />
            )}
            {!suyas.length && <p className="text-sm text-piedra">Sin reuniones en los últimos 90 días.</p>}
            {proximas.length > 0 && (
              <div>
                <h3 className="text-[15px] font-semibold mb-1">Agendadas</h3>
                <ul>{lista(proximas)}</ul>
              </div>
            )}
            {pasadas.length > 0 && (
              <div>
                <h3 className="text-[15px] font-semibold mb-1">Historial</h3>
                <ul>{lista(todas ? pasadas : pasadas.slice(0, 8))}</ul>
                {pasadas.length > 8 && !todas && (
                  <button type="button" className="mt-3 text-sm underline underline-offset-4 hover:text-bosque" onClick={() => setTodas(true)}>
                    Ver las {pasadas.length}
                  </button>
                )}
              </div>
            )}
          </div>
        </Bloque>

        <Bloque titulo="Victorias">
          {victorias.length ? (
            <ul className="flex flex-col">
              {victorias.map((v) => (
                <li key={v.id} className="flex items-baseline justify-between gap-3 py-2.5 border-t border-separador first:border-t-0 first:pt-0">
                  <span className="min-w-0">
                    <span className="block font-medium text-[14.5px] truncate">{v.titulo}</span>
                    <span className="block text-[12.5px] text-piedra">{fechaLarga(v.fecha)}</span>
                  </span>
                  <span className="flex items-center gap-2 shrink-0">
                    {v.valor !== null && (
                      <span className="tabular-nums text-[14px] font-semibold">
                        {v.moneda ?? ''} {numero(v.valor)}
                      </span>
                    )}
                    <Etiqueta tono={v.estado === 'validada' ? 'bosque' : v.estado === 'rechazada' ? 'alerta' : 'piedra'}>
                      {v.estado === 'validada' ? 'Validada' : v.estado === 'rechazada' ? 'No validada' : 'Para validar'}
                    </Etiqueta>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-piedra">Sin victorias en los últimos cuatro meses.</p>
          )}
        </Bloque>
      </div>

      <aside className="flex flex-col gap-5 min-w-0">
        <Bloque titulo="Números">
          <div className="grid grid-cols-3 gap-3">
            {cifras.map(([t, v]) => (
              <div key={t} className="min-w-0">
                <span className="block text-[12px] text-piedra leading-tight">{t}</span>
                <span className="block font-bold text-[18px] mt-1">{v}</span>
              </div>
            ))}
          </div>
          <div className="mt-4">
            <div className="flex justify-between text-[12.5px] text-piedra">
              <span>Rendimiento</span>
              <span className="font-semibold" style={{ color: tono }}>
                {rendimiento === null ? 'Sin datos todavía' : Math.round(rendimiento * 100)}
              </span>
            </div>
            <div className="h-2 bg-niebla rounded-pastilla mt-1.5">
              <div className="h-2 rounded-pastilla" style={{ width: `${Math.round((rendimiento ?? 0) * 100)}%`, background: tono }} />
            </div>
            <p className="text-[12px] text-piedra mt-2">Promedio de la asistencia a sus reuniones de los últimos 90 días y del avance de sus objetivos.</p>
          </div>
        </Bloque>

        <Bloque titulo="Objetivos">
          {obs.length ? (
            <ul className="flex flex-col gap-3.5">
              {obs.map(({ o, avance }) => (
                <li key={o.id}>
                  <div className="flex justify-between gap-3 text-[13.5px]">
                    <span className="font-medium min-w-0 truncate">{o.titulo}</span>
                    <span className="font-semibold tabular-nums whitespace-nowrap">
                      {numero(avance)} de {numero(o.meta)}
                    </span>
                  </div>
                  <div className="h-1.5 bg-niebla rounded-pastilla mt-1.5">
                    <div className="h-1.5 rounded-pastilla bg-bosque" style={{ width: `${Math.min(100, o.meta ? (avance / o.meta) * 100 : 0)}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-piedra">Sin objetivos vigentes para esta persona o su rol.</p>
          )}
        </Bloque>

        {riesgo && (
          <Bloque titulo="Riesgo legal del vínculo">
            <div className="flex gap-4">
              <div className="w-2.5 rounded-pastilla bg-niebla relative overflow-hidden shrink-0" style={{ minHeight: 96 }} aria-hidden="true">
                <div className="absolute left-0 right-0 bottom-0 rounded-pastilla" style={{ height: `${Math.max(6, riesgo.puntaje)}%`, background: TONO_RIESGO[riesgo.nivel] }} />
              </div>
              <div className="min-w-0 flex flex-col gap-2">
                <div className="flex items-baseline gap-2">
                  <span className="font-heading font-bold text-[28px] leading-none" style={{ color: TONO_RIESGO[riesgo.nivel] }}>
                    {riesgo.puntaje}
                  </span>
                  <span className="text-[13px] text-piedra">de 100 · riesgo {riesgo.nivel}</span>
                </div>
                <ul className="flex flex-col gap-1.5 text-[13.5px] leading-[1.45]">
                  {riesgo.motivos.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
                <p className="text-[12px] text-piedra">Puntaje orientativo. FIRMA lo afina con la entrevista de rol.</p>
              </div>
            </div>
          </Bloque>
        )}

        <Bloque titulo="Contacto">
          <dl className="flex flex-col text-[14px]">
            {(
              [
                ['Mail', m.email ?? 'Sin cargar'],
                ['Estado', m.activo ? 'Activo' : 'Inactivo'],
              ] as const
            ).map(([t, v]) => (
              <div key={t} className="flex justify-between gap-3 py-2 border-t border-separador first:border-t-0 first:pt-0">
                <dt className="text-piedra">{t}</dt>
                <dd className="font-medium truncate">{v}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-3 pt-3 border-t border-separador flex flex-col gap-2 text-[14px]">
            <div className="flex justify-between gap-3">
              <span className="text-piedra">Google Calendar</span>
              <span className="font-medium truncate">
                {conexion?.estado === 'activa' ? conexion.email : conexion?.estado === 'error' ? 'Hay que volver a conectar' : 'Sin conectar'}
              </span>
            </div>
            {esYo && !soloLectura && (
              <div className="flex gap-2">
                {conexion?.estado !== 'activa' ? (
                  <Button size="sm" onClick={() => void conectar()} disabled={ocupadoGoogle}>
                    {ocupadoGoogle ? 'Abriendo Google…' : 'Conectar mi Google Calendar'}
                  </Button>
                ) : (
                  <Button size="sm" variant="ghost" onClick={() => void desconectar()} disabled={ocupadoGoogle}>
                    Desconectar
                  </Button>
                )}
              </div>
            )}
            {!esYo && conexion?.estado !== 'activa' && <span className="text-[12.5px] text-piedra">Lo conecta la persona desde su cuenta del portal, en Equipo.</span>}
          </div>
        </Bloque>
      </aside>
    </div>
    </div>
  );
};

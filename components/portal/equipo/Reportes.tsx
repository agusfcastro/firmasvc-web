import React, { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { Button } from '../../Button';
import { supabase } from '../supabase';
import { Aviso, Campo, Etiqueta, TituloSeccion, claseInput } from '../ui';
import { mensajeAmable } from '../errores';
import { ROLES_ELEGIBLES, ROL_COMERCIAL, rolDe, type RolComercial } from '../crm/tipos';
import type { BaseEquipo } from './EquipoApp';
import {
  ROTULO_TIPO_CAMPO,
  aNumero,
  aTiempo,
  claveCampo,
  esNumerico,
  fechaCortaDia,
  horaDe,
  hoy,
  numero,
  periodoDe,
  reporteSeguro,
  textoPeriodo,
  type CampoReporte,
  type Frecuencia,
  type Reporte,
  type Respuesta,
  type TipoCampo,
  type ValorRespuesta,
} from './tipos';

/**
 * Reportes por rol, diarios o semanales. Cada persona manda el suyo y lo
 * puede corregir; quien lidera ve quién lo entregó y arma los reportes sin
 * código, o copia los de FIRMA. Piden resultados y no horarios: la base
 * rechaza un campo de horario o de fichaje salvo que lo sume FIRMA.
 */

const claseLink = 'underline underline-offset-4 hover:text-bosque';
const claseIcono = 'h-10 w-10 inline-flex items-center justify-center text-piedra transition-colors duration-150 hover:text-tinta disabled:opacity-30';
const rotuloRol = (r: RolComercial) => ROL_COMERCIAL[r] ?? r;

/** El texto de una respuesta para mostrar. */
function mostrar(v: ValorRespuesta | undefined): string {
  if (v === undefined || v === null || v === '') return '·';
  if (typeof v === 'boolean') return v ? 'Sí' : 'No';
  if (typeof v === 'number') return numero(v);
  return String(v);
}

export const Reportes: React.FC<{ base: BaseEquipo }> = ({ base }) => {
  const { orgId, equipo, yo, lidera, soloLectura, reportes } = base;
  const [respuestas, setRespuestas] = useState<Respuesta[]>([]);
  const [fecha, setFecha] = useState(hoy());
  const [abierta, setAbierta] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  async function cargar() {
    if (!supabase) return;
    const desde = new Date();
    desde.setDate(desde.getDate() - 70);
    const { data, error: e } = await supabase
      .from('equipo_reporte_respuestas')
      .select('*')
      .eq('organizacion_id', orgId)
      .gte('periodo', desde.toISOString().slice(0, 10))
      .order('periodo', { ascending: false })
      .limit(2000);
    if (e) setError(mensajeAmable(e));
    setRespuestas((data as Respuesta[]) ?? []);
  }

  useEffect(() => {
    void cargar();
  }, [orgId]); // eslint-disable-line react-hooks/exhaustive-deps

  const activos = reportes.filter((r) => r.activo);
  const misReportes = yo ? activos.filter((r) => r.rol_comercial === yo.rol_comercial) : [];
  // Quién tenía que entregar en la fecha elegida: cada persona activa con un reporte de su rol.
  const entregas = activos.flatMap((r) =>
    equipo
      .filter((m) => m.activo && m.rol_comercial === r.rol_comercial)
      .map((m) => ({ r, m, resp: respuestas.find((x) => x.reporte_id === r.id && x.miembro_id === m.id && x.periodo === periodoDe(r.frecuencia, fecha)) })),
  );
  const entregadas = entregas.filter((x) => x.resp).length;

  return (
    <div className="flex flex-col gap-10">
      {error && <Aviso tipo="error">{error}</Aviso>}
      {ok && <Aviso tipo="ok">{ok}</Aviso>}

      {yo && (
        <section className="flex flex-col gap-4">
          <TituloSeccion eyebrow="Tuyo" titulo="Tu reporte" />
          {misReportes.length === 0 ? (
            <p className="text-piedra text-[14px]">Tu rol todavía no tiene un reporte. Lo arma quien lidera el equipo.</p>
          ) : (
            misReportes.map((r) => (
              <FormularioReporte
                key={r.id}
                reporte={r}
                orgId={orgId}
                miembroId={yo.id}
                soloLectura={soloLectura}
                respuestas={respuestas}
                alGuardar={(m) => {
                  setOk(m);
                  void cargar();
                }}
              />
            ))
          )}
          {misReportes.length > 0 && <Historial reportes={misReportes} respuestas={respuestas.filter((x) => x.miembro_id === yo.id)} />}
        </section>
      )}

      {lidera && (
        <section>
          <TituloSeccion
            eyebrow="El equipo"
            titulo="Entregas"
            acciones={
              <label className="flex items-center gap-2 text-[13px]">
                <span className="text-piedra">Día</span>
                <input type="date" className={`${claseInput} w-[170px]`} max={hoy()} value={fecha} onChange={(e) => setFecha(e.target.value || hoy())} />
              </label>
            }
          />
          {entregas.length === 0 ? (
            <p className="text-piedra text-[14px] max-w-[62ch]">Cuando haya reportes activos y gente con ese rol en el equipo, acá ves quién entregó el suyo.</p>
          ) : (
            <>
              <p className="text-[14px] mb-4">
                {entregadas} de {entregas.length} entregados.
              </p>
              <div className="overflow-x-auto">
                <table className="tabla min-w-[620px]">
                  <thead>
                    <tr>
                      <th>Persona</th>
                      <th>Reporte</th>
                      <th>Estado</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {entregas.map(({ r, m, resp }) => {
                      const clave = `${r.id}:${m.id}`;
                      return (
                        <React.Fragment key={clave}>
                          <tr>
                            <td>
                              <div className="font-medium">{m.nombre}</div>
                              <div className="text-xs text-piedra">{rolDe(m)}</div>
                            </td>
                            <td>
                              {r.titulo}
                              <div className="text-xs text-piedra">De {textoPeriodo(r.frecuencia, fecha)}</div>
                            </td>
                            <td>
                              {resp ? (
                                <Etiqueta tono={aTiempo(resp, r.frecuencia) ? 'bosque' : 'piedra'}>
                                  {aTiempo(resp, r.frecuencia) ? 'Entregado' : 'Entregado tarde'} {fechaCortaDia(resp.enviado_en.slice(0, 10))} {horaDe(resp.enviado_en)}
                                </Etiqueta>
                              ) : (
                                <Etiqueta tono="alerta">Falta</Etiqueta>
                              )}
                            </td>
                            <td className="text-right">
                              {resp && (
                                <button type="button" className={claseLink} onClick={() => setAbierta(abierta === clave ? null : clave)}>
                                  {abierta === clave ? 'Cerrar' : 'Ver'}
                                </button>
                              )}
                            </td>
                          </tr>
                          {resp && abierta === clave && (
                            <tr>
                              <td colSpan={4} className="bg-marfil-oscuro">
                                <dl className="grid gap-x-6 gap-y-2 tab:grid-cols-2">
                                  {r.campos.map((c) => (
                                    <div key={c.clave}>
                                      <dt className="text-[12.5px] text-piedra">{c.etiqueta}</dt>
                                      <dd className="text-[14px] whitespace-pre-line">{mostrar(resp.respuestas[c.clave])}</dd>
                                    </div>
                                  ))}
                                </dl>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      )}

      {lidera && <ArmarReportes base={base} alAviso={setOk} alError={setError} />}

      {!yo && !lidera && <p className="text-piedra text-[14px]">Cuando estés en el equipo de la empresa, acá vas a mandar tu reporte.</p>}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* El formulario del reporte de una persona                             */
/* ------------------------------------------------------------------ */
const FormularioReporte: React.FC<{
  reporte: Reporte;
  orgId: string;
  miembroId: string;
  soloLectura: boolean;
  respuestas: Respuesta[];
  alGuardar: (mensaje: string) => void;
}> = ({ reporte, orgId, miembroId, soloLectura, respuestas, alGuardar }) => {
  const [fecha, setFecha] = useState(hoy());
  const periodo = periodoDe(reporte.frecuencia, fecha);
  const existente = respuestas.find((x) => x.reporte_id === reporte.id && x.miembro_id === miembroId && x.periodo === periodo);
  const [valores, setValores] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  // Al cambiar de período se cargan las respuestas que ya había.
  useEffect(() => {
    const v: Record<string, string> = {};
    for (const c of reporte.campos) {
      const r = existente?.respuestas[c.clave];
      v[c.clave] = r === undefined || r === null ? '' : typeof r === 'boolean' ? (r ? 'si' : 'no') : String(r);
    }
    setValores(v);
  }, [existente?.id, existente?.actualizado_en, periodo, reporte.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    const datos: Record<string, ValorRespuesta> = {};
    for (const c of reporte.campos) {
      const t = (valores[c.clave] ?? '').trim();
      if (!t) {
        if (c.obligatoria) return setError(`Falta completar «${c.etiqueta}».`);
        continue;
      }
      if (esNumerico(c.tipo)) {
        const n = aNumero(t);
        if (n === null || Number.isNaN(n) || n < 0) return setError(`«${c.etiqueta}» lleva un número.`);
        datos[c.clave] = n;
      } else if (c.tipo === 'sino') datos[c.clave] = t === 'si';
      else datos[c.clave] = t;
    }
    setGuardando(true);
    setError(null);
    const { error: err } = existente
      ? await supabase.from('equipo_reporte_respuestas').update({ respuestas: datos }).eq('id', existente.id)
      : await supabase.from('equipo_reporte_respuestas').insert({ organizacion_id: orgId, reporte_id: reporte.id, miembro_id: miembroId, periodo, respuestas: datos });
    setGuardando(false);
    if (err) return setError(mensajeAmable(err));
    alGuardar(existente ? 'Reporte corregido.' : `Listo, mandaste tu reporte de ${textoPeriodo(reporte.frecuencia, fecha)}.`);
  }

  return (
    <form onSubmit={enviar} className="bg-papel border border-borde-suave rounded-control p-6 flex flex-col gap-5 max-w-[720px]">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-heading font-bold text-[17px]">{reporte.titulo}</p>
          <p className="text-[13px] text-piedra mt-0.5">
            De {textoPeriodo(reporte.frecuencia, fecha)}
            {existente ? ` · enviado el ${fechaCortaDia(existente.enviado_en.slice(0, 10))} a las ${horaDe(existente.enviado_en)}` : ''}
          </p>
        </div>
        <label className="flex items-center gap-2 text-[13px]">
          <span className="text-piedra">{reporte.frecuencia === 'semanal' ? 'Semana del' : 'Día'}</span>
          <input type="date" className={`${claseInput} w-[170px]`} max={hoy()} value={fecha} onChange={(e) => setFecha(e.target.value || hoy())} />
        </label>
      </div>
      {error && <Aviso tipo="error">{error}</Aviso>}
      <div className="grid gap-5 tab:grid-cols-2">
        {reporte.campos.map((c) => (
          <div key={c.clave} className={c.tipo === 'largo' ? 'tab:col-span-2' : ''}>
            <Campo etiqueta={`${c.etiqueta}${c.obligatoria ? '' : ' (opcional)'}`} ayuda={c.ayuda}>
              {c.tipo === 'largo' ? (
                <textarea
                  className={`${claseInput} h-24 py-2.5`}
                  maxLength={2000}
                  disabled={soloLectura}
                  value={valores[c.clave] ?? ''}
                  onChange={(e) => setValores({ ...valores, [c.clave]: e.target.value })}
                />
              ) : c.tipo === 'sino' ? (
                <select className={claseInput} disabled={soloLectura} value={valores[c.clave] ?? ''} onChange={(e) => setValores({ ...valores, [c.clave]: e.target.value })}>
                  <option value="">Elegí</option>
                  <option value="si">Sí</option>
                  <option value="no">No</option>
                </select>
              ) : (
                <input
                  className={claseInput}
                  inputMode={esNumerico(c.tipo) ? 'decimal' : undefined}
                  maxLength={esNumerico(c.tipo) ? 20 : 2000}
                  disabled={soloLectura}
                  value={valores[c.clave] ?? ''}
                  onChange={(e) => setValores({ ...valores, [c.clave]: e.target.value })}
                />
              )}
            </Campo>
          </div>
        ))}
      </div>
      {!soloLectura && (
        <div>
          <Button type="submit" disabled={guardando}>
            {guardando ? 'Guardando…' : existente ? 'Corregir' : 'Mandar el reporte'}
          </Button>
        </div>
      )}
    </form>
  );
};

/** Los últimos reportes de la persona, con los números de cada uno. */
const Historial: React.FC<{ reportes: Reporte[]; respuestas: Respuesta[] }> = ({ reportes, respuestas }) => {
  const ultimos = respuestas.slice(0, 10);
  if (ultimos.length === 0) return null;
  return (
    <div className="overflow-x-auto max-w-[720px]">
      <p className="text-[13px] font-medium text-piedra mb-2">Tus últimos reportes</p>
      <table className="tabla">
        <tbody>
          {ultimos.map((x) => {
            const r = reportes.find((y) => y.id === x.reporte_id);
            if (!r) return null;
            const numeros = r.campos.filter((c) => esNumerico(c.tipo) && typeof x.respuestas[c.clave] === 'number');
            return (
              <tr key={x.id}>
                <td className="whitespace-nowrap">{fechaCortaDia(x.periodo)}</td>
                <td className="text-[13px] text-piedra">{numeros.map((c) => `${c.etiqueta} ${mostrar(x.respuestas[c.clave])}`).join(' · ') || r.titulo}</td>
                <td className="text-right">{aTiempo(x, r.frecuencia) ? null : <Etiqueta>Tarde</Etiqueta>}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Armar los reportes de la empresa                                     */
/* ------------------------------------------------------------------ */
interface CampoEdit extends CampoReporte {
  /** Campo recién sumado: su clave sale del texto al guardar. */
  nuevo?: boolean;
}

interface BorradorReporte {
  id?: string;
  titulo: string;
  rol_comercial: RolComercial;
  frecuencia: Frecuencia;
  activo: boolean;
  campos: CampoEdit[];
}

const campoNuevo = (): CampoEdit => ({ clave: '', etiqueta: '', tipo: 'numero', nuevo: true });

const ArmarReportes: React.FC<{ base: BaseEquipo; alAviso: (m: string) => void; alError: (m: string | null) => void }> = ({ base, alAviso, alError }) => {
  const { orgId, equipo, soloLectura, reportes, recargar } = base;
  const [plantillas, setPlantillas] = useState<Reporte[]>([]);
  const [borrador, setBorrador] = useState<BorradorReporte | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    supabase
      .from('equipo_reportes')
      .select('*')
      .is('organizacion_id', null)
      .eq('activo', true)
      .then(({ data }) => setPlantillas(((data as Reporte[]) ?? []).map(reporteSeguro)));
  }, []);

  const roles = [...new Set(equipo.filter((m) => m.activo).map((m) => m.rol_comercial))];
  const faltanDeFirma = plantillas.filter((p) => roles.includes(p.rol_comercial) && !reportes.some((r) => r.rol_comercial === p.rol_comercial));

  async function usarPlantillas(rol: RolComercial) {
    if (!supabase) return;
    alError(null);
    const { error: err } = await supabase.rpc('equipo_cargar_plantillas', { org: orgId, rol });
    if (err) return alError(mensajeAmable(err));
    alAviso(`Listo, ya está el reporte de ${rotuloRol(rol).toLowerCase()} de FIRMA. Lo podés ajustar.`);
    await recargar();
  }

  function mover(i: number, d: -1 | 1) {
    if (!borrador) return;
    const campos = [...borrador.campos];
    const j = i + d;
    if (j < 0 || j >= campos.length) return;
    [campos[i], campos[j]] = [campos[j], campos[i]];
    setBorrador({ ...borrador, campos });
  }

  function cambiar(i: number, c: Partial<CampoEdit>) {
    if (!borrador) return;
    setBorrador({ ...borrador, campos: borrador.campos.map((x, k) => (k === i ? { ...x, ...c } : x)) });
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase || !borrador) return;
    if (borrador.titulo.trim().length < 2) return setError('Poné un nombre al reporte.');
    if (!borrador.campos.length) return setError('Sumá al menos un campo.');
    const usadas = borrador.campos.filter((c) => !c.nuevo).map((c) => c.clave);
    const campos: CampoReporte[] = [];
    for (const c of borrador.campos) {
      const etiqueta = c.etiqueta.trim();
      if (etiqueta.length < 2) return setError('Hay un campo sin texto.');
      const clave = c.nuevo ? claveCampo(etiqueta, usadas) : c.clave;
      if (c.nuevo) usadas.push(clave);
      campos.push({ clave, etiqueta, tipo: c.tipo, ...(c.ayuda?.trim() ? { ayuda: c.ayuda.trim() } : {}), ...(c.obligatoria ? { obligatoria: true } : {}) });
    }
    setGuardando(true);
    setError(null);
    const datos = { titulo: borrador.titulo.trim(), rol_comercial: borrador.rol_comercial, frecuencia: borrador.frecuencia, activo: borrador.activo, campos };
    const { error: err } = borrador.id
      ? await supabase.from('equipo_reportes').update(datos).eq('id', borrador.id)
      : await supabase.from('equipo_reportes').insert({ ...datos, organizacion_id: orgId });
    setGuardando(false);
    if (err) return setError(mensajeAmable(err));
    alAviso(borrador.id ? 'Reporte actualizado. Lo ya enviado queda como estaba.' : 'Reporte creado. Ya le aparece a cada persona con ese rol.');
    setBorrador(null);
    await recargar();
  }

  return (
    <section className="flex flex-col gap-5">
      <TituloSeccion
        eyebrow="Cómo se reporta"
        titulo="Reportes de la empresa"
        acciones={
          !soloLectura && !borrador ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setBorrador({ titulo: '', rol_comercial: roles[0] ?? 'closer', frecuencia: 'diaria', activo: true, campos: [campoNuevo()] })}
            >
              <Plus size={16} aria-hidden="true" /> Nuevo reporte
            </Button>
          ) : null
        }
      />
      {!soloLectura && faltanDeFirma.length > 0 && (
        <div className="bg-papel border border-borde-suave rounded-control p-5 flex flex-col gap-3 max-w-[720px]">
          <p className="text-[14px]">FIRMA tiene reportes armados para estos roles de tu equipo. Piden resultados, no horarios.</p>
          <div className="flex flex-wrap gap-2">
            {faltanDeFirma.map((p) => (
              <Button key={p.id} size="sm" variant="ghost" onClick={() => void usarPlantillas(p.rol_comercial)}>
                Usar el de {rotuloRol(p.rol_comercial).toLowerCase()}
              </Button>
            ))}
          </div>
        </div>
      )}

      {borrador && (
        <form onSubmit={guardar} className="bg-marfil-oscuro p-6 desk:p-8 flex flex-col gap-5 max-w-[820px]">
          <h2 className="h3">{borrador.id ? 'Editar reporte' : 'Nuevo reporte'}</h2>
          <p className="text-[13px] text-piedra -mt-2 max-w-[62ch]">
            Pedí resultados y no horarios. Un campo de horario o de fichaje puede servir de prueba de una relación laboral, así que solo lo suma FIRMA.
          </p>
          {error && <Aviso tipo="error">{error}</Aviso>}
          <Campo etiqueta="Nombre">
            <input
              required
              className={claseInput}
              maxLength={120}
              placeholder="Reporte del día del closer"
              value={borrador.titulo}
              onChange={(e) => setBorrador({ ...borrador, titulo: e.target.value })}
            />
          </Campo>
          <div className="grid gap-5 tab:grid-cols-2">
            <Campo etiqueta="Rol">
              <select className={claseInput} value={borrador.rol_comercial} onChange={(e) => setBorrador({ ...borrador, rol_comercial: e.target.value as RolComercial })}>
                {ROLES_ELEGIBLES.map((r) => (
                  <option key={r} value={r}>
                    {ROL_COMERCIAL[r]}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo etiqueta="Cada cuánto">
              <select className={claseInput} value={borrador.frecuencia} onChange={(e) => setBorrador({ ...borrador, frecuencia: e.target.value as Frecuencia })}>
                <option value="diaria">Todos los días</option>
                <option value="semanal">Una vez por semana</option>
              </select>
            </Campo>
          </div>
          <div className="flex flex-col gap-3">
            <p className="text-[13px] font-medium">Campos</p>
            {borrador.campos.map((c, i) => (
              <div key={c.nuevo ? `n${i}` : c.clave} className="bg-white border border-borde-suave rounded-control p-4 flex flex-col gap-3">
                <div className="grid gap-3 tab:grid-cols-[minmax(0,1fr)_170px]">
                  <input
                    className={claseInput}
                    maxLength={120}
                    placeholder="Llamadas agendadas"
                    aria-label="Texto del campo"
                    value={c.etiqueta}
                    onChange={(e) => cambiar(i, { etiqueta: e.target.value })}
                  />
                  <select className={claseInput} aria-label="Tipo" value={c.tipo} onChange={(e) => cambiar(i, { tipo: e.target.value as TipoCampo })}>
                    {(Object.keys(ROTULO_TIPO_CAMPO) as TipoCampo[]).map((t) => (
                      <option key={t} value={t}>
                        {ROTULO_TIPO_CAMPO[t]}
                      </option>
                    ))}
                  </select>
                </div>
                <input
                  className={claseInput}
                  maxLength={200}
                  placeholder="Ayuda (opcional)"
                  aria-label="Ayuda"
                  value={c.ayuda ?? ''}
                  onChange={(e) => cambiar(i, { ayuda: e.target.value })}
                />
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={Boolean(c.obligatoria)} onChange={(e) => cambiar(i, { obligatoria: e.target.checked })} />
                    Obligatorio
                  </label>
                  <div className="flex">
                    <button type="button" className={claseIcono} aria-label="Subir" disabled={i === 0} onClick={() => mover(i, -1)}>
                      <ArrowUp size={16} />
                    </button>
                    <button type="button" className={claseIcono} aria-label="Bajar" disabled={i === borrador.campos.length - 1} onClick={() => mover(i, 1)}>
                      <ArrowDown size={16} />
                    </button>
                    <button
                      type="button"
                      className={claseIcono}
                      aria-label="Quitar"
                      onClick={() => setBorrador({ ...borrador, campos: borrador.campos.filter((_, k) => k !== i) })}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {borrador.campos.length < 20 && (
              <button type="button" className={`${claseLink} self-start text-[13.5px]`} onClick={() => setBorrador({ ...borrador, campos: [...borrador.campos, campoNuevo()] })}>
                Sumar un campo
              </button>
            )}
          </div>
          {borrador.id && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={borrador.activo} onChange={(e) => setBorrador({ ...borrador, activo: e.target.checked })} />
              Activo. Si lo desactivás, deja de pedirse y lo ya enviado se conserva.
            </label>
          )}
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

      {reportes.length === 0 ? (
        <p className="text-piedra text-[14px]">Todavía no hay reportes. Usá los de FIRMA o armá uno.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="tabla min-w-[560px]">
            <thead>
              <tr>
                <th>Reporte</th>
                <th>Rol</th>
                <th>Cada cuánto</th>
                <th>Estado</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {reportes.map((r) => (
                <tr key={r.id}>
                  <td>
                    <div className="font-medium">{r.titulo}</div>
                    <div className="text-xs text-piedra">{r.campos.length} campos</div>
                  </td>
                  <td>{rotuloRol(r.rol_comercial)}</td>
                  <td>{r.frecuencia === 'semanal' ? 'Semanal' : 'Diario'}</td>
                  <td>{r.activo ? <Etiqueta tono="bosque">Activo</Etiqueta> : <Etiqueta>Inactivo</Etiqueta>}</td>
                  <td className="text-right">
                    {!soloLectura && (
                      <button
                        type="button"
                        className={claseLink}
                        onClick={() =>
                          setBorrador({
                            id: r.id,
                            titulo: r.titulo,
                            rol_comercial: r.rol_comercial,
                            frecuencia: r.frecuencia,
                            activo: r.activo,
                            campos: r.campos.map((c) => ({ ...c })),
                          })
                        }
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
      )}
    </section>
  );
};

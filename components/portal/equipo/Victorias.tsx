import React, { useEffect, useMemo, useState } from 'react';
import { Paperclip, Trophy } from 'lucide-react';
import { Button } from '../../Button';
import { supabase } from '../supabase';
import { Aviso, Campo, Cifras, Etiqueta, MontosPorMoneda, TituloSeccion, claseInput } from '../ui';
import { mensajeAmable } from '../errores';
import { rolDe } from '../crm/tipos';
import type { BaseEquipo } from './EquipoApp';
import { BUCKET_EQUIPO, MAX_EVIDENCIA, ROTULO_ESTADO, TIPOS_EVIDENCIA, aNumero, fechaLarga, hoy, mesDe, numero, tipoEvidencia, type Victoria } from './tipos';

/**
 * Victorias. Cada persona carga las suyas con evidencia y quedan para
 * validar; quien lidera el equipo valida o explica por qué no. Solo las
 * validadas suman y se ven en el muro de toda la empresa.
 */

const claseLink = 'underline underline-offset-4 hover:text-bosque';

export const Victorias: React.FC<{ base: BaseEquipo; nueva: boolean; cerrarNueva: () => void }> = ({ base, nueva, cerrarNueva }) => {
  const { orgId, equipo, yo, lidera, esAdmin, soloLectura, objetivos, hitos } = base;
  const [lista, setLista] = useState<Victoria[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [rechazando, setRechazando] = useState<{ id: string; motivo: string } | null>(null);
  const [borrando, setBorrando] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);

  async function cargar() {
    if (!supabase) return;
    const desde = new Date();
    desde.setDate(desde.getDate() - 120);
    const { data, error: e } = await supabase
      .from('equipo_victorias')
      .select('*')
      .eq('organizacion_id', orgId)
      .or(`estado.eq.pendiente,fecha.gte.${desde.toISOString().slice(0, 10)}`)
      .order('fecha', { ascending: false })
      .order('creado_en', { ascending: false })
      .limit(400);
    if (e) setError(mensajeAmable(e));
    setLista((data as Victoria[]) ?? []);
  }

  useEffect(() => {
    void cargar();
  }, [orgId]); // eslint-disable-line react-hooks/exhaustive-deps

  const persona = useMemo(() => new Map(equipo.map((m) => [m.id, m])), [equipo]);
  const objetivo = useMemo(() => new Map(objetivos.map((o) => [o.id, o])), [objetivos]);
  const hito = useMemo(() => new Map(hitos.map((h) => [h.id, h])), [hitos]);

  const esMia = (v: Victoria) => Boolean(yo && v.miembro_id === yo.id);
  const puedoValidar = (v: Victoria) => lidera && !soloLectura && (esAdmin || !esMia(v));
  const pendientes = lista.filter((v) => v.estado === 'pendiente' && lidera);
  // Las propias pendientes de quien lidera ya salen en «Para validar».
  const mias = lista.filter((v) => esMia(v) && v.estado !== 'validada' && !(lidera && v.estado === 'pendiente'));
  const muro = lista.filter((v) => v.estado === 'validada');
  const { desde } = mesDe(hoy());
  const delMes = muro.filter((v) => v.fecha >= desde);
  const montos: Record<string, number> = {};
  for (const v of delMes) if (v.valor) montos[v.moneda ?? 'USD'] = (montos[v.moneda ?? 'USD'] ?? 0) + Number(v.valor);

  async function decidir(v: Victoria, decision: 'validada' | 'rechazada', motivo?: string) {
    if (!supabase) return;
    setOcupado(v.id);
    setError(null);
    setOk(null);
    const { error: e } = await supabase.rpc('equipo_victoria_validar', { victoria: v.id, decision, motivo: motivo ?? null });
    setOcupado(null);
    if (e) return setError(mensajeAmable(e));
    setRechazando(null);
    setOk(decision === 'validada' ? `Validada. «${v.titulo}» ya está en el muro.` : 'Listo. La persona ve el motivo y la puede corregir.');
    void cargar();
  }

  async function borrar(v: Victoria) {
    if (!supabase) return;
    setOcupado(v.id);
    const { error: e } = await supabase.from('equipo_victorias').delete().eq('id', v.id);
    setOcupado(null);
    setBorrando(null);
    if (e) return setError(mensajeAmable(e));
    void cargar();
  }

  async function abrirEvidencia(v: Victoria) {
    if (!supabase) return;
    if (v.evidencia_url && !v.evidencia_ruta) return void window.open(v.evidencia_url, '_blank', 'noopener');
    if (!v.evidencia_ruta) return;
    const { data, error: e } = await supabase.storage.from(BUCKET_EQUIPO).createSignedUrl(v.evidencia_ruta, 60);
    if (e || !data?.signedUrl) return setError(mensajeAmable(e, 'No se pudo abrir la evidencia.'));
    window.open(data.signedUrl, '_blank', 'noopener');
  }

  // Una función y no un componente: así el motivo que se escribe no pierde el foco en cada tecla.
  const tarjeta = (v: Victoria, acciones?: React.ReactNode) => {
    const m = persona.get(v.miembro_id);
    const o = v.objetivo_id ? objetivo.get(v.objetivo_id) : undefined;
    const h = v.hito_id ? hito.get(v.hito_id) : undefined;
    return (
      <li key={v.id} className="bg-papel border border-borde-suave rounded-control p-5 flex flex-col gap-2.5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-heading font-bold text-[16.5px] leading-snug">{v.titulo}</p>
            <p className="text-[13px] text-piedra mt-0.5">
              {m?.nombre ?? 'Sin nombre'}
              {m ? ` · ${rolDe(m)}` : ''} · {fechaLarga(v.fecha)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {v.valor !== null && (
              <span className="font-heading font-bold text-bosque tabular-nums">
                {v.moneda ?? ''} {numero(v.valor)}
              </span>
            )}
            {v.estado !== 'validada' && <Etiqueta tono={v.estado === 'rechazada' ? 'alerta' : 'tinta'}>{ROTULO_ESTADO[v.estado]}</Etiqueta>}
          </div>
        </div>
        {v.detalle && <p className="text-[14px] leading-[1.5] whitespace-pre-line">{v.detalle}</p>}
        {(o || h || v.evidencia_ruta || v.evidencia_url) && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-piedra">
            {o && <span>Objetivo {o.titulo}</span>}
            {h && <span>Hito {h.titulo}</span>}
            {(v.evidencia_ruta || v.evidencia_url) && (
              <button type="button" className={`${claseLink} inline-flex items-center gap-1`} onClick={() => void abrirEvidencia(v)}>
                <Paperclip size={13} aria-hidden="true" /> Ver evidencia
              </button>
            )}
          </div>
        )}
        {v.estado === 'rechazada' && v.nota && <p className="text-[13px] text-peligro-fuerte">No se validó. {v.nota}</p>}
        {acciones}
      </li>
    );
  };

  return (
    <div className="flex flex-col gap-10">
      {error && <Aviso tipo="error">{error}</Aviso>}
      {ok && <Aviso tipo="ok">{ok}</Aviso>}

      {nueva && !soloLectura && (
        <NuevaVictoria
          base={base}
          alCerrar={cerrarNueva}
          alGuardar={(mensaje) => {
            setOk(mensaje);
            cerrarNueva();
            void cargar();
          }}
        />
      )}

      <Cifras
        items={[
          { titulo: 'Victorias del mes', valor: delMes.length },
          { titulo: 'Personas con victorias', valor: new Set(delMes.map((v) => v.miembro_id)).size },
          ...(Object.keys(montos).length ? [{ titulo: 'Valor validado del mes', valor: <MontosPorMoneda montos={montos} /> }] : []),
          ...(lidera ? [{ titulo: 'Para validar', valor: pendientes.length, alerta: pendientes.length > 0 }] : []),
        ]}
      />

      {pendientes.length > 0 && (
        <section>
          <TituloSeccion eyebrow={pendientes.some(puedoValidar) ? 'Te toca' : 'Esperan validación'} titulo="Para validar" />
          <ul className="grid gap-3 desk:grid-cols-2">
            {pendientes.map((v) =>
              tarjeta(
                v,
                puedoValidar(v) ? (
                  rechazando?.id === v.id ? (
                    <div className="flex flex-col gap-2 pt-1">
                      <textarea
                        className={`${claseInput} h-20 py-2.5`}
                        placeholder="Por qué no se valida, así sabe qué corregir"
                        maxLength={600}
                        value={rechazando.motivo}
                        onChange={(e) => setRechazando({ id: v.id, motivo: e.target.value })}
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="dark"
                          disabled={ocupado === v.id || rechazando.motivo.trim().length < 3}
                          onClick={() => void decidir(v, 'rechazada', rechazando.motivo)}
                        >
                          No validar
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setRechazando(null)}>
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2 pt-1">
                      <Button size="sm" disabled={ocupado === v.id} onClick={() => void decidir(v, 'validada')}>
                        Validar
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setRechazando({ id: v.id, motivo: '' })}>
                        No validar
                      </Button>
                    </div>
                  )
                ) : esMia(v) ? (
                  <p className="text-[12.5px] text-piedra">Es tuya, la valida otra persona que lidera el equipo.</p>
                ) : null,
              ),
            )}
          </ul>
        </section>
      )}

      {mias.length > 0 && (
        <section>
          <TituloSeccion eyebrow="Tuyas" titulo="En revisión" />
          <ul className="grid gap-3 desk:grid-cols-2">
            {mias.map((v) =>
              tarjeta(
                v,
                v.estado === 'pendiente' && !soloLectura ? (
                  borrando === v.id ? (
                    <div className="flex items-center gap-3 text-[13px]">
                      <span>¿La borrás?</span>
                      <button type="button" className={claseLink} disabled={ocupado === v.id} onClick={() => void borrar(v)}>
                        Sí, borrar
                      </button>
                      <button type="button" className={claseLink} onClick={() => setBorrando(null)}>
                        No
                      </button>
                    </div>
                  ) : (
                    <button type="button" className={`${claseLink} self-start text-[13px] text-piedra`} onClick={() => setBorrando(v.id)}>
                      Borrar
                    </button>
                  )
                ) : null,
              ),
            )}
          </ul>
        </section>
      )}

      <section>
        <TituloSeccion eyebrow="El muro" titulo="Victorias validadas" />
        {muro.length === 0 ? (
          <div className="bg-papel border border-borde-suave rounded-control p-8 flex flex-col items-start gap-3 max-w-[620px]">
            <Trophy size={22} className="text-bosque" aria-hidden="true" />
            <p className="font-heading font-bold text-[17px]">Todavía no hay victorias validadas</p>
            <p className="text-piedra text-[14px]">
              Un cierre, un testimonio, un cliente que renovó. Cargalas con su evidencia y, cuando se validan, aparecen acá para todo el equipo.
            </p>
          </div>
        ) : (
          <ul className="grid gap-3 desk:grid-cols-2">{muro.map((v) => tarjeta(v))}</ul>
        )}
      </section>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Cargar una victoria                                                  */
/* ------------------------------------------------------------------ */
const NuevaVictoria: React.FC<{ base: BaseEquipo; alCerrar: () => void; alGuardar: (mensaje: string) => void }> = ({ base, alCerrar, alGuardar }) => {
  const { orgId, equipo, yo, lidera, esAdmin, objetivos, hitos, monedas } = base;
  const activos = equipo.filter((m) => m.activo);
  const [miembroId, setMiembroId] = useState(yo?.id ?? (lidera ? (activos[0]?.id ?? '') : ''));
  const [titulo, setTitulo] = useState('');
  const [detalle, setDetalle] = useState('');
  const [fecha, setFecha] = useState(hoy());
  const [valor, setValor] = useState('');
  const [moneda, setMoneda] = useState(monedas[0] ?? 'USD');
  const [vinculo, setVinculo] = useState('');
  const [enlace, setEnlace] = useState('');
  const [archivo, setArchivo] = useState<File | null>(null);
  const [errorArchivo, setErrorArchivo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const quien = equipo.find((m) => m.id === miembroId);
  const hoyIso = hoy();
  // Los objetivos y los hitos que le tocan a esa persona.
  const susObjetivos = objetivos.filter(
    (o) =>
      o.medida !== 'reporte' &&
      o.hasta >= fecha &&
      o.desde <= fecha &&
      (o.alcance === 'negocio' || (o.alcance === 'rol' && o.rol_comercial === quien?.rol_comercial) || o.miembro_id === miembroId),
  );
  const susHitos = hitos.filter((h) => h.activo && h.rol_comercial === quien?.rol_comercial);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    if (!miembroId) return setError('Elegí de quién es la victoria.');
    if (titulo.trim().length < 2) return setError('Contá qué se logró.');
    const monto = aNumero(valor);
    if (monto !== null && (Number.isNaN(monto) || monto < 0)) return setError('El valor tiene que ser un número.');
    const url = enlace.trim();
    if (url && !/^https?:\/\//i.test(url)) return setError('El enlace tiene que empezar con https://');
    if (archivo && archivo.size > MAX_EVIDENCIA) return setError('El archivo pesa más de 10 MB.');

    setGuardando(true);
    setError(null);
    const id = crypto.randomUUID();
    let ruta: string | null = null;
    if (archivo) {
      const limpio =
        archivo.name
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^\w.-]+/g, '_')
          .slice(-80) || 'evidencia';
      ruta = `${orgId}/${id}/${limpio}`;
      const { error: es } = await supabase.storage.from(BUCKET_EQUIPO).upload(ruta, archivo, { contentType: tipoEvidencia(archivo), upsert: false });
      if (es) {
        setGuardando(false);
        return setError(
          /mime|not supported|tipo de archivo/i.test(es.message)
            ? 'Ese tipo de archivo no se puede subir. Usá una captura, un audio o un PDF.'
            : mensajeAmable(es, 'No se pudo subir la evidencia.'),
        );
      }
    }
    const [tipo, vid] = vinculo.split(':');
    const { error: ei } = await supabase.from('equipo_victorias').insert({
      id,
      organizacion_id: orgId,
      miembro_id: miembroId,
      titulo: titulo.trim(),
      detalle: detalle.trim() || null,
      fecha,
      valor: monto,
      moneda: monto !== null ? moneda : null,
      objetivo_id: tipo === 'o' ? vid : null,
      hito_id: tipo === 'h' ? vid : null,
      evidencia_url: url || null,
      evidencia_ruta: ruta,
      evidencia_nombre: archivo?.name.slice(0, 200) ?? null,
    });
    setGuardando(false);
    if (ei) return setError(mensajeAmable(ei));
    const propia = quien?.usuario_id && yo?.id === miembroId;
    alGuardar(lidera && (!propia || esAdmin) ? 'Victoria cargada y validada. Ya está en el muro.' : 'Listo. Queda para que la valide quien lidera el equipo.');
  }

  return (
    <form onSubmit={guardar} className="bg-marfil-oscuro p-6 desk:p-8 flex flex-col gap-5 max-w-[720px]">
      <h2 className="h3">Cargar una victoria</h2>
      {lidera ? (
        <Campo etiqueta="¿De quién es?">
          <select className={claseInput} value={miembroId} onChange={(e) => setMiembroId(e.target.value)}>
            {!miembroId && <option value="">Elegí una persona</option>}
            {activos.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nombre} · {rolDe(m)}
              </option>
            ))}
          </select>
        </Campo>
      ) : null}
      <Campo etiqueta="¿Qué se logró?">
        <input
          required
          className={claseInput}
          maxLength={160}
          placeholder="Cerré a Juan Pérez por el programa de 6 meses"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
        />
      </Campo>
      <Campo etiqueta="Contá un poco más (opcional)">
        <textarea className={`${claseInput} h-24 py-2.5`} maxLength={2000} value={detalle} onChange={(e) => setDetalle(e.target.value)} />
      </Campo>
      <div className="grid gap-5 tab:grid-cols-3">
        <Campo etiqueta="Fecha">
          <input type="date" required className={claseInput} max={hoyIso} value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </Campo>
        <Campo etiqueta={`Valor en ${moneda} (opcional)`}>
          <input inputMode="decimal" className={claseInput} placeholder="2000" value={valor} onChange={(e) => setValor(e.target.value)} />
        </Campo>
        {monedas.length > 1 ? (
          <Campo etiqueta="Moneda">
            <select className={claseInput} value={moneda} onChange={(e) => setMoneda(e.target.value)}>
              {monedas.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </Campo>
        ) : (
          <div />
        )}
      </div>
      {(susObjetivos.length > 0 || susHitos.length > 0) && (
        <Campo etiqueta="¿Suma a un objetivo o es un hito? (opcional)">
          <select className={claseInput} value={vinculo} onChange={(e) => setVinculo(e.target.value)}>
            <option value="">No, es una victoria suelta</option>
            {susObjetivos.length > 0 && (
              <optgroup label="Objetivos">
                {susObjetivos.map((o) => (
                  <option key={o.id} value={`o:${o.id}`}>
                    {o.titulo}
                  </option>
                ))}
              </optgroup>
            )}
            {susHitos.length > 0 && (
              <optgroup label="Hitos">
                {susHitos.map((h) => (
                  <option key={h.id} value={`h:${h.id}`}>
                    {h.titulo}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </Campo>
      )}
      <div className="grid gap-5 tab:grid-cols-2">
        <Campo etiqueta="Evidencia, un archivo (opcional)" ayuda="Captura, audio o PDF, hasta 10 MB.">
          {/* El selector nativo sale en el idioma del navegador; este botón dice lo mismo en castellano. */}
          <span className="flex items-center gap-3">
            <span className="inline-flex items-center gap-2 h-10 px-4 border border-borde bg-white rounded-control text-[14px] font-medium cursor-pointer hover:border-tinta">
              <Paperclip size={15} aria-hidden="true" /> Elegir archivo
            </span>
            <span className="text-[13.5px] text-piedra truncate">{archivo ? archivo.name : 'Ninguno elegido'}</span>
          </span>
          <input
            type="file"
            accept={TIPOS_EVIDENCIA}
            className="sr-only"
            onChange={(e) => {
              const elegido = e.target.files?.[0] ?? null;
              // El límite se avisa al elegir, al lado del campo, y no recién al guardar.
              if (elegido && elegido.size > MAX_EVIDENCIA) {
                setErrorArchivo(`${elegido.name} pesa más de 10 MB. Elegí uno más liviano o pegá un enlace.`);
                setArchivo(null);
                e.target.value = '';
                return;
              }
              setErrorArchivo(null);
              setArchivo(elegido);
            }}
          />
          {errorArchivo && <span className="block text-[13px] text-peligro-fuerte mt-1.5">{errorArchivo}</span>}
        </Campo>
        <Campo etiqueta="O un enlace (opcional)">
          <input type="url" className={claseInput} placeholder="https://" value={enlace} onChange={(e) => setEnlace(e.target.value)} />
        </Campo>
      </div>
      {error && <Aviso tipo="error">{error}</Aviso>}
      <div className="flex gap-3">
        <Button type="submit" disabled={guardando}>
          {guardando ? 'Guardando…' : 'Guardar'}
        </Button>
        <Button type="button" variant="ghost" onClick={alCerrar}>
          Cancelar
        </Button>
      </div>
    </form>
  );
};

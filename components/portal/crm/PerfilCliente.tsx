import React, { useEffect, useState } from 'react';
import { Check, Plus, X } from 'lucide-react';
import { Button } from '../../Button';
import { supabase } from '../supabase';
import { Aviso, Campo, Etiqueta, TituloSeccion, claseInput } from '../ui';
import { hoyISO } from './tipos';

type Arquetipo = { clave: string; nombre: string; descripcion: string; umbral: number; ventana_dias: number; orden: number };
type TipoSenal = { clave: string; arquetipo: string; nombre: string; descripcion: string | null; origen: 'crm' | 'manual' | 'llamada'; peso: number; orden: number; activo: boolean };
type Senal = {
  id: string;
  tipo: string;
  origen: 'crm' | 'manual' | 'llamada';
  detalle: string;
  ocurrida_en: string;
  descartada_en: string | null;
  motivo_descarte: string | null;
};
type Perfil = {
  id: string;
  arquetipo: string;
  senales: string[];
  puntos: number;
  estado: 'propuesto' | 'confirmado' | 'rechazado' | 'vencido';
  propuesto_en: string;
  vigente_hasta: string;
  decidido_en: string | null;
  motivo: string | null;
};

const ESTADO: Record<Perfil['estado'], { texto: string; tono: 'bosque' | 'piedra' | 'alerta' | 'tinta' }> = {
  propuesto: { texto: 'Para revisar', tono: 'alerta' },
  confirmado: { texto: 'Confirmado', tono: 'bosque' },
  rechazado: { texto: 'Rechazado', tono: 'tinta' },
  vencido: { texto: 'Vencido', tono: 'piedra' },
};
const ORIGEN: Record<Senal['origen'], string> = { crm: 'CRM', manual: 'Equipo', llamada: 'Llamada' };

const fecha = (iso: string) => new Date(iso.length === 10 ? iso + 'T12:00:00' : iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' });

/**
 * Perfil conductual del cliente (migración 0045). El sistema propone un
 * arquetipo cuando las señales llegan al umbral; una persona lo confirma o
 * lo rechaza. Solo con la funcionalidad perfiles_conductuales (Blindaje).
 */
export const PerfilCliente: React.FC<{ clienteId: string; soloLectura: boolean; mostrarPlan: boolean }> = ({ clienteId, soloLectura, mostrarPlan }) => {
  const [habilitado, setHabilitado] = useState<boolean | null>(null);
  const [arquetipos, setArquetipos] = useState<Arquetipo[]>([]);
  const [tipos, setTipos] = useState<TipoSenal[]>([]);
  const [senales, setSenales] = useState<Senal[]>([]);
  const [perfiles, setPerfiles] = useState<Perfil[]>([]);
  const [nueva, setNueva] = useState<{ tipo: string; fecha: string; detalle: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function cargar() {
    if (!supabase) return;
    // Trae las señales del CRM y propone lo que llegó al umbral antes de leer.
    const { data: ok, error: e } = await supabase.rpc('perfil_sincronizar', { cliente: clienteId });
    if (e) {
      // Sin la migración 0045 la sección no se muestra.
      setHabilitado(false);
      return setError(/perfil_sincronizar/.test(e.message) ? null : 'No pudimos cargar el perfil del cliente.');
    }
    setHabilitado(Boolean(ok));
    if (!ok) return;
    const [a, t, s, p] = await Promise.all([
      supabase.from('arquetipos').select('*').eq('activo', true).order('orden'),
      supabase.from('senal_tipos').select('*').order('orden'),
      supabase.from('perfil_senales').select('*').eq('cliente_id', clienteId).order('ocurrida_en', { ascending: false }),
      supabase.from('perfiles_conductuales').select('*').eq('cliente_id', clienteId).order('propuesto_en', { ascending: false }),
    ]);
    setArquetipos((a.data as Arquetipo[]) ?? []);
    setTipos((t.data as TipoSenal[]) ?? []);
    setSenales((s.data as Senal[]) ?? []);
    setPerfiles((p.data as Perfil[]) ?? []);
  }

  useEffect(() => {
    void cargar();
  }, [clienteId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (habilitado === null) return null;
  if (!habilitado)
    return error ? (
      <Aviso tipo="error">{error}</Aviso>
    ) : mostrarPlan ? (
      <section>
        <TituloSeccion eyebrow="Perfil" titulo="Perfil conductual" />
        <p className="text-sm text-piedra max-w-[64ch]">
          Con el plan Blindaje el CRM propone el perfil de cada cliente a partir de señales observables (atrasos, casos de conflicto y lo que registra el equipo), para anticipar reclamos.
        </p>
      </section>
    ) : null;

  const tipo = (clave: string) => tipos.find((x) => x.clave === clave);
  const arquetipo = (clave: string) => arquetipos.find((x) => x.clave === clave);
  const abiertos = perfiles.filter((p) => p.estado === 'propuesto' || p.estado === 'confirmado');
  const anteriores = perfiles.filter((p) => p.estado === 'rechazado' || p.estado === 'vencido');
  const manuales = tipos.filter((x) => x.origen === 'manual' && x.activo);

  async function decidir(p: Perfil, confirmar: boolean) {
    if (!supabase) return;
    let motivo: string | null = null;
    if (!confirmar) {
      motivo = window.prompt('¿Por qué no corresponde este perfil? Queda registrado.');
      if (motivo === null) return;
    }
    setOcupado(true);
    setError(null);
    const { error: e } = await supabase.rpc('perfil_decidir', { perfil: p.id, confirmar, motivo });
    setOcupado(false);
    if (e) return setError(e.message);
    void cargar();
  }

  async function descartar(s: Senal) {
    if (!supabase) return;
    const motivo = window.prompt('¿Por qué se descarta esta señal? Queda registrado.');
    if (motivo === null) return;
    setOcupado(true);
    setError(null);
    const { error: e } = await supabase.from('perfil_senales').update({ descartada_en: new Date().toISOString(), motivo_descarte: motivo }).eq('id', s.id);
    setOcupado(false);
    if (e) return setError(/perfil_senales_descarte/.test(e.message) ? 'Escribí un motivo de al menos 3 letras.' : e.message);
    void cargar();
  }

  async function registrar(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase || !nueva) return;
    setOcupado(true);
    setError(null);
    const { data: c } = await supabase.from('crm_clientes').select('organizacion_id').eq('id', clienteId).maybeSingle();
    const { error: err } = await supabase.from('perfil_senales').insert({
      organizacion_id: c?.organizacion_id,
      cliente_id: clienteId,
      tipo: nueva.tipo,
      ocurrida_en: nueva.fecha,
      detalle: nueva.detalle,
    });
    setOcupado(false);
    if (err) return setError(err.message);
    setNueva(null);
    void cargar();
  }

  const lineaSenal = (s: Senal, conDescarte: boolean) => (
    <li key={s.id} className="flex flex-col tab:flex-row tab:items-start gap-2 tab:gap-4 py-3" style={{ borderTop: '1px solid var(--color-borde-suave)' }}>
      <span className="text-[13px] text-piedra tabular-nums whitespace-nowrap tab:w-28 shrink-0">{fecha(s.ocurrida_en)}</span>
      <div className="flex-1 min-w-0">
        <span className={`font-medium text-[15px] ${s.descartada_en ? 'line-through text-piedra' : ''}`}>{tipo(s.tipo)?.nombre ?? s.tipo}</span>
        <span className="ml-2 text-[12px] text-piedra">{ORIGEN[s.origen]}</span>
        <p className="text-sm text-piedra mt-0.5">{s.detalle}</p>
        {s.descartada_en && <p className="text-xs text-piedra mt-0.5">Descartada: {s.motivo_descarte}</p>}
      </div>
      {conDescarte && !soloLectura && !s.descartada_en && (
        <button type="button" disabled={ocupado} onClick={() => void descartar(s)} className="text-[13px] text-piedra underline underline-offset-4 hover:text-tinta disabled:opacity-40 self-start">
          Descartar
        </button>
      )}
    </li>
  );

  return (
    <section>
      <TituloSeccion
        eyebrow="Perfil"
        titulo="Perfil conductual"
        acciones={
          soloLectura || nueva ? undefined : (
            <Button variant="ghost" size="sm" onClick={() => setNueva({ tipo: manuales[0]?.clave ?? '', fecha: hoyISO(), detalle: '' })}>
              <Plus size={16} /> Registrar señal
            </Button>
          )
        }
      />
      <p className="text-sm text-piedra -mt-3 mb-6 max-w-[64ch]">
        El CRM propone un perfil cuando las señales llegan al umbral. Es orientativo: confirmalo solo si lo ves en el trato con el cliente. Todo perfil vence solo.
      </p>
      {error && (
        <div className="mb-6">
          <Aviso tipo="error">{error}</Aviso>
        </div>
      )}

      {nueva && (
        <form onSubmit={registrar} className="mb-8 grid gap-4 tab:grid-cols-[1fr_180px] items-start bg-marfil-oscuro p-5">
          <Campo etiqueta="Señal">
            <select required className={claseInput} value={nueva.tipo} onChange={(e) => setNueva({ ...nueva, tipo: e.target.value })}>
              {arquetipos.map((a) => (
                <optgroup key={a.clave} label={a.nombre}>
                  {manuales
                    .filter((x) => x.arquetipo === a.clave)
                    .map((x) => (
                      <option key={x.clave} value={x.clave}>
                        {x.nombre}
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
          </Campo>
          <Campo etiqueta="Fecha">
            <input required type="date" max={hoyISO()} className={claseInput} value={nueva.fecha} onChange={(e) => setNueva({ ...nueva, fecha: e.target.value })} />
          </Campo>
          <div className="tab:col-span-2">
            <Campo etiqueta="Qué pasó" ayuda="Lo que el cliente hizo o dijo, y por qué canal. Hechos, no opiniones sobre la persona.">
              <textarea
                required
                minLength={5}
                maxLength={500}
                rows={3}
                className={`${claseInput} h-auto py-3`}
                placeholder="Ej.: En la llamada del martes pidió pasar de 6 a 12 cuotas."
                value={nueva.detalle}
                onChange={(e) => setNueva({ ...nueva, detalle: e.target.value })}
              />
            </Campo>
          </div>
          <div className="tab:col-span-2 flex flex-wrap gap-3">
            <Button type="submit" disabled={ocupado}>
              Registrar señal
            </Button>
            <Button type="button" variant="ghost" onClick={() => setNueva(null)}>
              Cancelar
            </Button>
          </div>
        </form>
      )}

      {abiertos.length === 0 ? (
        <p className="text-sm text-piedra max-w-[64ch]">Sin perfil por ahora. {senales.length === 0 ? 'No hay señales registradas.' : 'Las señales todavía no alcanzan para proponer uno.'}</p>
      ) : (
        <ul className="grid gap-4">
          {abiertos.map((p) => {
            const a = arquetipo(p.arquetipo);
            return (
              <li key={p.id} className="p-tarjeta">
                <div className="p-tarjeta-cabeza flex-wrap">
                  <span className="font-heading font-bold text-[17px] leading-tight flex-1 min-w-0">{a?.nombre ?? p.arquetipo}</span>
                  <Etiqueta tono={ESTADO[p.estado].tono}>{ESTADO[p.estado].texto}</Etiqueta>
                </div>
                <div className="px-5 py-4 flex flex-col gap-3">
                  {a && <p className="text-sm text-piedra">{a.descripcion}</p>}
                  <p className="text-[13px] text-piedra">
                    {p.puntos} {p.puntos === 1 ? 'punto' : 'puntos'} de {a?.umbral ?? '—'} necesarios · {p.estado === 'confirmado' ? `Confirmado el ${fecha(p.decidido_en!)}` : `Propuesto el ${fecha(p.propuesto_en)}`} · vence el {fecha(p.vigente_hasta)}
                  </p>
                  <ul>{senales.filter((s) => p.senales.includes(s.id)).map((s) => lineaSenal(s, false))}</ul>
                  {p.estado === 'propuesto' && !soloLectura && (
                    <div className="flex flex-wrap gap-3 pt-1">
                      <Button size="sm" disabled={ocupado} onClick={() => void decidir(p, true)}>
                        <Check size={16} /> Confirmar
                      </Button>
                      <Button size="sm" variant="ghost" disabled={ocupado} onClick={() => void decidir(p, false)}>
                        <X size={16} /> Rechazar
                      </Button>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {senales.length > 0 && (
        <details className="mt-8">
          <summary className="cursor-pointer text-[13px] font-medium">Todas las señales ({senales.length})</summary>
          <ul className="mt-3">{senales.map((s) => lineaSenal(s, true))}</ul>
        </details>
      )}
      {anteriores.length > 0 && (
        <details className="mt-4">
          <summary className="cursor-pointer text-[13px] font-medium">Perfiles anteriores ({anteriores.length})</summary>
          <ul className="mt-3">
            {anteriores.map((p) => (
              <li key={p.id} className="py-3 text-sm" style={{ borderTop: '1px solid var(--color-borde-suave)' }}>
                <span className="font-medium">{arquetipo(p.arquetipo)?.nombre ?? p.arquetipo}</span> · {ESTADO[p.estado].texto.toLowerCase()} el{' '}
                {fecha(p.estado === 'rechazado' ? p.decidido_en! : p.vigente_hasta)}
                {p.motivo && <span className="block text-xs text-piedra mt-0.5">{p.motivo}</span>}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
};

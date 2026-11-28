import React, { useEffect, useState } from 'react';
import { ArrowDown, ArrowUpRight, Plus } from 'lucide-react';
import { supabase } from '../supabase';
import { Aviso, Enlace, Etiqueta, claseInput } from '../ui';
import { ESTADO_SOBRE } from '../../firma/comun';
import { rolDe, type IntegranteEquipo } from '../crm/tipos';
import { vencimientoContrato } from '../descargas';
import type { Documento } from '../tipos';
import { COLUMNAS_FIRMANTE, descargarSobre, type Firmante, type Sobre } from './api';
import { claseBotonHero } from '../../Button';

/**
 * Contratos de cada persona del equipo, en Documentos › Contratos con tu equipo.
 * Son de dos orígenes: los mandados a firmar desde Firmas (migración 0064),
 * con quién falta firmar y el PDF firmado, y los documentos que FIRMA carga
 * atados a una persona (0068). Cada tarjeta lleva el nombre completo, el rol
 * y el vencimiento del contrato. La base los deja ver solo a FIRMA, al
 * titular, a Legales u Operaciones y, los envíos, a quien los mandó.
 */

interface Fila {
  clave: string;
  persona: IntegranteEquipo | undefined;
  vence: string | null;
  sobre?: Sobre;
  firmantes: Firmante[];
  doc?: Documento;
}

const fecha = (iso: string) => new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' });

const claseAccion = claseBotonHero('primary', 'md');
const claseSecundaria =
  'inline-flex items-center gap-1.5 min-h-[40px] text-[14px] font-medium text-bosque underline underline-offset-4 decoration-bosque/30 transition-colors duration-150 hover:decoration-bosque';

export const ContratosEquipoFirmados: React.FC<{
  orgId: string;
  /** Falso en Ver como: se mira sin mandar ni cambiar nada. */
  puedeEnviar: boolean;
  /** Documentos de la sección atados a una persona, ya filtrados por lo que ve el usuario. */
  docs: Documento[];
  bajandoDoc: string | null;
  alDescargarDoc: (d: Documento) => void;
  alAbrirDoc: (d: Documento) => void;
}> = ({ orgId, puedeEnviar, docs, bajandoDoc, alDescargarDoc, alAbrirDoc }) => {
  const [sobres, setSobres] = useState<Sobre[] | null>(null);
  const [firmantes, setFirmantes] = useState<Firmante[]>([]);
  const [personas, setPersonas] = useState<Map<string, IntegranteEquipo>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [bajando, setBajando] = useState<string | null>(null);
  // Envío al que se le está cargando el vencimiento del contrato.
  const [editando, setEditando] = useState<{ id: string; fecha: string } | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    let vivo = true;
    (async () => {
      const { data, error: e } = await supabase!
        .from('firma_sobres')
        .select('*')
        .eq('organizacion_id', orgId)
        .not('equipo_miembro_id', 'is', null)
        .neq('estado', 'anulado')
        .order('creado_en', { ascending: false });
      if (!vivo) return;
      // Sin la migración 0064 la columna no existe: quedan solo los documentos.
      const lista = e ? [] : ((data ?? []) as Sobre[]);
      if (lista.length) {
        const { data: fs } = await supabase!.from('firma_firmantes').select(COLUMNAS_FIRMANTE).in('sobre_id', lista.map((s) => s.id));
        if (!vivo) return;
        setFirmantes((fs ?? []) as unknown as Firmante[]);
      }
      setSobres(lista);
    })();
    return () => {
      vivo = false;
    };
  }, [orgId]);

  // Las personas de los envíos y de los documentos.
  const ids = [...new Set([...(sobres ?? []).map((s) => s.equipo_miembro_id as string), ...docs.map((d) => d.equipo_miembro_id as string)])].sort().join(',');
  useEffect(() => {
    if (!supabase || !ids) return;
    let vivo = true;
    void supabase
      .from('equipo_miembros')
      .select('*')
      .in('id', ids.split(','))
      .then(({ data }) => {
        if (vivo) setPersonas(new Map(((data ?? []) as IntegranteEquipo[]).map((p) => [p.id, p])));
      });
    return () => {
      vivo = false;
    };
  }, [ids]);

  async function bajar(id: string) {
    setBajando(id);
    setError(null);
    const fallo = await descargarSobre(id, 'final');
    setBajando(null);
    if (fallo) setError(fallo);
  }

  async function guardarVencimiento() {
    if (!supabase || !editando) return;
    setGuardando(true);
    setError(null);
    const fechaNueva = editando.fecha || null;
    const { error: e } = await supabase.rpc('firma_sobre_vencimiento', { p_sobre: editando.id, p_fecha: fechaNueva });
    setGuardando(false);
    if (e) return setError('No pudimos guardar el vencimiento. Probá de nuevo en un momento.');
    setSobres((xs) => (xs ?? []).map((s) => (s.id === editando.id ? { ...s, contrato_vence_el: fechaNueva } : s)));
    setEditando(null);
  }

  if (sobres === null) return null;

  const filas: Fila[] = [
    ...sobres.map((s) => ({
      clave: `s-${s.id}`,
      persona: personas.get(s.equipo_miembro_id as string),
      vence: s.contrato_vence_el ?? null,
      sobre: s,
      firmantes: firmantes.filter((f) => f.sobre_id === s.id).sort((a, b) => a.orden - b.orden),
    })),
    ...docs.map((d) => ({ clave: `d-${d.id}`, persona: personas.get(d.equipo_miembro_id as string), vence: d.contrato_vence_el ?? null, doc: d, firmantes: [] })),
  ].sort((a, b) => (a.persona?.nombre ?? '').localeCompare(b.persona?.nombre ?? '', 'es'));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h3 className="font-heading font-semibold text-[18px] leading-tight">Contratos de tu equipo, firmados y en curso</h3>
          <p className="text-[14px] text-piedra leading-[1.55] max-w-[60ch]">
            El contrato de cada persona, con su rol y su vencimiento. Solo los ven el titular y las áreas Legales y Operaciones.
          </p>
        </div>
        {puedeEnviar && (
          <Enlace a="/portal/firmas/nuevo" className={claseSecundaria}>
            <Plus size={15} aria-hidden="true" /> Mandar uno a firmar
          </Enlace>
        )}
      </div>

      {error && <Aviso tipo="error">{error}</Aviso>}

      {filas.length === 0 ? (
        <p className="text-[14px] text-piedra">
          Todavía no hay. Cuando mandes un contrato desde Firmas, elegí a la persona en «Persona del equipo» y aparece acá.
        </p>
      ) : (
        <div className="grid grid-cols-1 tab:grid-cols-2 gap-4 desk:gap-5">
          {filas.map(({ clave, persona, vence, sobre: s, firmantes: fs, doc: d }) => {
            const nombre = persona?.nombre ?? 'Persona del equipo';
            const vencimiento = vencimientoContrato(vence);
            const estado = s ? ESTADO_SOBRE[s.estado] : null;
            const faltan = fs.filter((f) => f.estado !== 'firmado');
            const firmado = Boolean(s && s.estado === 'completado' && s.final_ruta);
            const editandoEste = s && editando?.id === s.id;
            return (
              <article key={clave} className="p-tarjeta flex flex-col gap-2.5 p-5 desk:p-6">
                <div className="flex flex-wrap items-center justify-end gap-2 min-h-[24px]">
                  {vencimiento?.estado === 'pronto' && <Etiqueta tono="alerta">Vence pronto</Etiqueta>}
                  {vencimiento?.estado === 'vencido' && <Etiqueta tono="alerta">Vencido</Etiqueta>}
                  {s && estado ? <Etiqueta tono={estado.tono}>{s.estado === 'completado' ? 'Firmado' : estado.texto}</Etiqueta> : <Etiqueta>Cargado por FIRMA</Etiqueta>}
                </div>
                <h4 className="font-heading font-semibold text-[18px] leading-snug">
                  {nombre}
                  {persona && <span className="text-piedra font-medium"> · {rolDe(persona)}</span>}
                </h4>
                {editandoEste && editando ? (
                  <div className="flex flex-wrap items-end gap-2">
                    <label className="flex flex-col gap-1 text-[12.5px] text-piedra">
                      Vencimiento del contrato
                      <input type="date" className={`${claseInput} h-10 w-[180px]`} value={editando.fecha} onChange={(e) => setEditando({ id: editando.id, fecha: e.target.value })} />
                    </label>
                    <button type="button" className={claseAccion} onClick={() => void guardarVencimiento()} disabled={guardando}>
                      {guardando ? 'Guardando' : 'Guardar'}
                    </button>
                    <button type="button" className={claseSecundaria} onClick={() => setEditando(null)}>
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <p className="flex flex-wrap items-baseline gap-x-3 text-[14.5px] leading-[1.5]">
                    <span className={vencimiento ? 'font-medium text-tinta' : 'text-piedra'}>{vencimiento?.texto ?? 'Sin vencimiento cargado'}</span>
                    {s && puedeEnviar && (
                      <button type="button" className="text-[13px] text-bosque underline underline-offset-4 decoration-bosque/30 hover:decoration-bosque" onClick={() => setEditando({ id: s.id, fecha: vence ?? '' })}>
                        {vence ? 'Cambiar' : 'Cargar vencimiento'}
                      </button>
                    )}
                  </p>
                )}
                <p className="text-[14px] leading-[1.55] text-piedra">{s ? s.titulo : d?.titulo}</p>
                <p className="text-[13px] text-piedra">
                  {s
                    ? firmado && s.completado_en
                      ? `Firmado el ${fecha(s.completado_en)}`
                      : s.estado === 'en_curso'
                        ? `${faltan.length === 1 ? 'Falta firmar' : 'Faltan firmar'}: ${faltan.map((f) => f.nombre).join(', ')} · Plazo para firmar: ${fecha(s.vence_en)}`
                        : `Enviado el ${fecha(s.creado_en)}`
                    : d
                      ? `Actualizado el ${fecha(d.actualizado_en)}`
                      : ''}
                </p>
                <div className="mt-auto pt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
                  {s && firmado && (
                    <button type="button" className={claseAccion} onClick={() => void bajar(s.id)} disabled={bajando === s.id} aria-label={`Descargar el contrato firmado de ${nombre}`}>
                      <ArrowDown size={16} aria-hidden="true" />
                      {bajando === s.id ? 'Preparando' : 'Descargar firmado'}
                    </button>
                  )}
                  {s && (
                    <Enlace a={`/portal/firmas/${s.id}`} className={claseSecundaria}>
                      Ver seguimiento <ArrowUpRight size={14} aria-hidden="true" />
                    </Enlace>
                  )}
                  {d &&
                    (d.archivo_ruta ? (
                      <button type="button" className={claseAccion} onClick={() => alDescargarDoc(d)} disabled={bajandoDoc === d.id} aria-label={`Descargar el contrato de ${nombre}`}>
                        <ArrowDown size={16} aria-hidden="true" />
                        {bajandoDoc === d.id ? 'Preparando' : 'Descargar'}
                      </button>
                    ) : d.url ? (
                      <a href={d.url} target="_blank" rel="noopener noreferrer" className={claseAccion} aria-label={`Abrir el contrato de ${nombre}`} onClick={() => alAbrirDoc(d)}>
                        <ArrowUpRight size={16} aria-hidden="true" />
                        Abrir
                      </a>
                    ) : null)}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};

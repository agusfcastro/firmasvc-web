import React, { useEffect, useState } from 'react';
import { ArrowDown, ArrowUpRight, Plus } from 'lucide-react';
import { supabase } from '../supabase';
import { Aviso, Enlace, Etiqueta } from '../ui';
import { ESTADO_SOBRE } from '../../firma/comun';
import { ROL_COMERCIAL, type IntegranteEquipo } from '../crm/tipos';
import { COLUMNAS_FIRMANTE, descargarSobre, type Firmante, type Sobre } from './api';

/**
 * Contratos del equipo mandados a firmar desde Firmas, atados a una persona
 * del equipo (migración 0064). En Documentos › Contratos con tu equipo, con
 * los en curso (quién falta firmar) y los firmados (con el PDF). La base los
 * deja ver solo a FIRMA, al titular, a Legales u Operaciones y a quien los mandó.
 */

interface Fila {
  sobre: Sobre;
  persona: IntegranteEquipo | undefined;
  firmantes: Firmante[];
}

const fecha = (iso: string) => new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' });

const claseAccion =
  'inline-flex items-center justify-center gap-2 h-10 px-4 rounded-[10px] bg-bosque text-marfil text-[14px] font-medium whitespace-nowrap transition-colors duration-150 hover:bg-bosque-dark disabled:opacity-60 disabled:cursor-wait';
const claseSecundaria =
  'inline-flex items-center gap-1.5 min-h-[40px] text-[14px] font-medium text-bosque underline underline-offset-4 decoration-bosque/30 transition-colors duration-150 hover:decoration-bosque';

export const ContratosEquipoFirmados: React.FC<{ orgId: string; puedeEnviar: boolean }> = ({ orgId, puedeEnviar }) => {
  const [filas, setFilas] = useState<Fila[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bajando, setBajando] = useState<string | null>(null);

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
      // Sin la migración 0064 la columna no existe: el bloque no se muestra.
      if (e) return setFilas([]);
      const sobres = (data ?? []) as Sobre[];
      if (!sobres.length) return setFilas([]);
      const ids = [...new Set(sobres.map((s) => s.equipo_miembro_id as string))];
      const [{ data: gente }, { data: fs }] = await Promise.all([
        supabase!.from('equipo_miembros').select('*').in('id', ids),
        supabase!.from('firma_firmantes').select(COLUMNAS_FIRMANTE).in('sobre_id', sobres.map((s) => s.id)),
      ]);
      if (!vivo) return;
      const personas = new Map(((gente ?? []) as IntegranteEquipo[]).map((p) => [p.id, p]));
      const firmantes = (fs ?? []) as unknown as Firmante[];
      setFilas(
        sobres.map((s) => ({
          sobre: s,
          persona: personas.get(s.equipo_miembro_id as string),
          firmantes: firmantes.filter((f) => f.sobre_id === s.id).sort((a, b) => a.orden - b.orden),
        })),
      );
    })();
    return () => {
      vivo = false;
    };
  }, [orgId]);

  async function bajar(id: string) {
    setBajando(id);
    setError(null);
    const fallo = await descargarSobre(id, 'final');
    setBajando(null);
    if (fallo) setError(fallo);
  }

  if (filas === null) return null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h3 className="font-heading font-semibold text-[18px] leading-tight">Contratos de tu equipo, firmados y en curso</h3>
          <p className="text-[14px] text-piedra leading-[1.55] max-w-[60ch]">
            Los que mandaste a firmar vinculados a alguien del equipo. Solo los ven el titular y las áreas Legales y Operaciones.
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
          {filas.map(({ sobre: s, persona, firmantes }) => {
            const estado = ESTADO_SOBRE[s.estado];
            const faltan = firmantes.filter((f) => f.estado !== 'firmado');
            const firmado = s.estado === 'completado' && Boolean(s.final_ruta);
            return (
              <article key={s.id} className="p-tarjeta flex flex-col gap-2.5 p-5 desk:p-6">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[12.5px] text-piedra">{persona ? ROL_COMERCIAL[persona.rol_comercial] : 'Equipo'}</span>
                  <Etiqueta tono={estado.tono}>{s.estado === 'completado' ? 'Firmado' : estado.texto}</Etiqueta>
                </div>
                <h4 className="font-heading font-semibold text-[18px] leading-snug">{persona?.nombre ?? 'Persona del equipo'}</h4>
                <p className="text-[14px] leading-[1.55] text-piedra">{s.titulo}</p>
                <p className="text-[13px] text-piedra">
                  {firmado && s.completado_en
                    ? `Firmado el ${fecha(s.completado_en)}`
                    : s.estado === 'en_curso'
                      ? `${faltan.length === 1 ? 'Falta firmar' : 'Faltan firmar'}: ${faltan.map((f) => f.nombre).join(', ')} · Vence el ${fecha(s.vence_en)}`
                      : `Enviado el ${fecha(s.creado_en)}`}
                </p>
                <div className="mt-auto pt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
                  {firmado && (
                    <button type="button" className={claseAccion} onClick={() => void bajar(s.id)} disabled={bajando === s.id} aria-label={`Descargar el contrato firmado de ${persona?.nombre ?? s.titulo}`}>
                      <ArrowDown size={16} aria-hidden="true" />
                      {bajando === s.id ? 'Preparando' : 'Descargar firmado'}
                    </button>
                  )}
                  <Enlace a={`/portal/firmas/${s.id}`} className={claseSecundaria}>
                    Ver seguimiento <ArrowUpRight size={14} aria-hidden="true" />
                  </Enlace>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};

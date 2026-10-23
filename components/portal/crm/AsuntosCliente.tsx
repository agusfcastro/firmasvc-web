import React, { useEffect, useState } from 'react';
import { ArrowRight, Plus } from 'lucide-react';
import { Button } from '../../Button';
import { supabase } from '../supabase';
import { navegar } from '../navegacion';
import { Aviso, Enlace, Etiqueta, TituloSeccion } from '../ui';
import { ESTADO_ASUNTO, MOTIVO_CONFLICTO, TIPO_ASUNTO, fechaAsunto, type Asunto } from '../asuntos';

/**
 * Asuntos vinculados a un cliente del CRM, en su ficha. Los mismos que se
 * ven en Estado de asuntos, con acceso directo a cada uno.
 */
export const AsuntosCliente: React.FC<{ clienteId: string; soloLectura: boolean; esFirma: boolean }> = ({ clienteId, soloLectura, esFirma }) => {
  const [asuntos, setAsuntos] = useState<Asunto[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) return;
    let vigente = true;
    supabase
      .from('asuntos')
      .select('*')
      .eq('cliente_id', clienteId)
      .order('actualizado_en', { ascending: false })
      .then(({ data, error: e }) => {
        if (!vigente) return;
        // Sin la migración 0024 no existe la columna: la sección queda vacía.
        setError(e && !/cliente_id/.test(e.message) ? 'No pudimos cargar los asuntos del cliente.' : null);
        setAsuntos((data as Asunto[] | null) ?? []);
      });
    return () => {
      vigente = false;
    };
  }, [clienteId]);

  return (
    <section>
      <TituloSeccion
        eyebrow="Asuntos"
        titulo="Asuntos del cliente"
        acciones={
          soloLectura ? undefined : (
            <Button variant="ghost" size="sm" onClick={() => navegar(`/portal/asuntos?cliente=${clienteId}`)}>
              <Plus size={16} /> Nuevo asunto
            </Button>
          )
        }
      />
      {error && <Aviso tipo="error">{error}</Aviso>}
      {asuntos === null ? (
        <p className="eyebrow text-piedra">Cargando</p>
      ) : asuntos.length === 0 ? (
        !error && <p className="text-sm text-piedra max-w-[64ch]">Sin asuntos vinculados. Los que se abran con este cliente, con su chat y sus documentos, aparecen acá.</p>
      ) : (
        <ul className="grid gap-3">
          {asuntos.map((a) => (
            <li key={a.id}>
              <Enlace
                a={`/portal/asuntos/${a.id}`}
                className="flex flex-col tab:flex-row tab:items-center gap-3 bg-white border border-[rgba(27,31,27,0.15)] p-4 transition-colors duration-150 hover:border-bosque"
              >
                <div className="flex flex-col gap-1.5 min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-3">
                    {a.codigo && <span className="font-mono text-[12px] font-medium text-bosque bg-[#E4E9E3] px-2 py-0.5">{a.codigo}</span>}
                    <span className="eyebrow text-[11px] text-piedra">{a.motivo ? MOTIVO_CONFLICTO[a.motivo].titulo : TIPO_ASUNTO[a.tipo]}</span>
                    <Etiqueta tono={ESTADO_ASUNTO[a.estado].tono}>{esFirma ? ESTADO_ASUNTO[a.estado].firma : ESTADO_ASUNTO[a.estado].cliente}</Etiqueta>
                  </div>
                  <span className="font-medium leading-[1.35]">{a.titulo}</span>
                </div>
                <span className="flex items-center gap-1 text-[13px] text-piedra shrink-0">
                  Actualizado el {fechaAsunto(a.actualizado_en)} <ArrowRight size={14} aria-hidden="true" className="text-bosque" />
                </span>
              </Enlace>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

import React, { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '../../Button';
import { supabase } from '../supabase';
import { navegar } from '../navegacion';
import { TituloSeccion } from '../ui';
import { ListaComprobantes, type Comprobante } from './Comprobantes';

/** Invoices y recibos emitidos a un cliente del CRM, en su ficha. */
export const ComprobantesCliente: React.FC<{ clienteId: string; soloLectura: boolean }> = ({ clienteId, soloLectura }) => {
  const [lista, setLista] = useState<Comprobante[] | null>(null);

  useEffect(() => {
    if (!supabase) return;
    let vigente = true;
    supabase
      .from('comprobantes')
      .select('id, organizacion_id, tipo, numero, cliente_id, fecha, moneda, total, receptor, anulado_en, motivo_anulacion, creado_en')
      .eq('cliente_id', clienteId)
      .order('creado_en', { ascending: false })
      .then(({ data }) => {
        // Sin la migración 0053 la tabla no existe: la sección queda vacía.
        if (vigente) setLista((data as Comprobante[] | null) ?? []);
      });
    return () => {
      vigente = false;
    };
  }, [clienteId]);

  return (
    <section>
      <TituloSeccion
        eyebrow="Comprobantes"
        titulo="Invoices y recibos"
        acciones={
          soloLectura ? undefined : (
            <div className="flex flex-wrap gap-2">
              <Button variant="ghost" size="sm" onClick={() => navegar(`/portal/crm/comprobantes/nuevo?tipo=recibo&cliente=${clienteId}`)}>
                <Plus size={16} /> Recibo
              </Button>
              <Button variant="ghost" size="sm" onClick={() => navegar(`/portal/crm/comprobantes/nuevo?tipo=invoice&cliente=${clienteId}`)}>
                <Plus size={16} /> Invoice
              </Button>
            </div>
          )
        }
      />
      {lista === null ? (
        <p className="eyebrow text-piedra">Cargando</p>
      ) : lista.length === 0 ? (
        <p className="text-sm text-piedra max-w-[64ch]">Sin comprobantes emitidos. Los invoices y recibos que le emitas aparecen acá, con su número.</p>
      ) : (
        <ListaComprobantes items={lista} />
      )}
    </section>
  );
};

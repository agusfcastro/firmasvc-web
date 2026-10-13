import React, { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { Aviso } from '../ui';
import { fechaCorta, type EntradaRegistro } from '../tipos';

const ACCIONES: Record<string, string> = {
  ingreso: 'Ingresó al portal',
  invitacion: 'Invitación enviada',
  actualizacion: 'Datos o permisos modificados',
  activacion: 'Acceso activado',
  desactivacion: 'Acceso desactivado',
  envio_acceso: 'Enlace de acceso reenviado',
};

export const Registro: React.FC = () => {
  const [filas, setFilas] = useState<EntradaRegistro[]>([]);
  const [mails, setMails] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) return;
    void (async () => {
      const [{ data, error: e }, { data: perfiles }] = await Promise.all([
        supabase!.from('registro_accesos').select('*').order('creado_en', { ascending: false }).limit(300),
        supabase!.from('perfiles').select('id, email'),
      ]);
      if (e) setError(e.message);
      setFilas((data as EntradaRegistro[]) ?? []);
      const m: Record<string, string> = {};
      (perfiles ?? []).forEach((p: { id: string; email: string }) => (m[p.id] = p.email));
      setMails(m);
    })();
  }, []);

  return (
    <div className="space-y-4">
      {error && <Aviso tipo="error">{error}</Aviso>}
      <p className="text-sm text-piedra">Últimos 300 movimientos. Sirve como respaldo de quién accedió y quién cambió permisos.</p>
      <div className="overflow-x-auto border border-[rgba(27,31,27,0.15)]">
        <table className="w-full text-sm">
          <thead className="bg-marfil-oscuro text-left">
            <tr>
              <th className="p-3 font-medium">Fecha</th>
              <th className="p-3 font-medium">Movimiento</th>
              <th className="p-3 font-medium">Usuario</th>
              <th className="p-3 font-medium">Hecho por</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr key={f.id} className="border-t border-[rgba(27,31,27,0.1)] bg-white">
                <td className="p-3 whitespace-nowrap">{fechaCorta(f.creado_en)}</td>
                <td className="p-3">{ACCIONES[f.accion] ?? f.accion}</td>
                <td className="p-3">{(f.usuario_id && mails[f.usuario_id]) || '·'}</td>
                <td className="p-3">{(f.actor_id && mails[f.actor_id]) || '·'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

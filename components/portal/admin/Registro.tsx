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
  descarga_documento: 'Descargó un documento',
  zapsign_conectado: 'ZapSign conectado',
  zapsign_desconectado: 'ZapSign desconectado',
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
      <p className="text-sm text-piedra">Últimos 300 movimientos. Sirve como respaldo de quién accedió, quién cambió permisos y quién descargó documentos.</p>
      <div className="overflow-x-auto">
        <table className="tabla min-w-[760px]">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Movimiento</th>
              <th>Usuario</th>
              <th>Hecho por</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr key={f.id}>
                <td className="whitespace-nowrap">{fechaCorta(f.creado_en)}</td>
                <td>
                  {ACCIONES[f.accion] ?? f.accion}
                  {(typeof f.detalle?.titulo === 'string' || typeof f.detalle?.empresa === 'string') && (
                    <div className="text-xs text-piedra mt-1">{String(f.detalle.titulo ?? f.detalle.empresa)}</div>
                  )}
                </td>
                <td>{(f.usuario_id && mails[f.usuario_id]) || '·'}</td>
                <td>{(f.actor_id && mails[f.actor_id]) || '·'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

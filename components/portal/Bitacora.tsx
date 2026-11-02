import React, { useEffect, useState } from 'react';
import { ShieldCheck, ShieldX } from 'lucide-react';
import { Button } from '../Button';
import { supabase } from './supabase';
import { Aviso, Encabezado, Etiqueta, Marco } from './ui';
import { ACCIONES } from './acciones';
import { fechaCorta, type EntradaRegistro, type Organizacion, type Perfil } from './tipos';

/**
 * Bitácora de la empresa, para el titular: quién ingresó, quién cambió
 * permisos, quién descargó documentos y todo lo que hizo FIRMA en la cuenta.
 * Cada movimiento queda encadenado con el anterior y no se puede editar ni
 * borrar. «Verificar» recalcula la cadena entera en la base.
 *   /portal/bitacora
 */

const POR_PAGINA = 100;

export const Bitacora: React.FC<{ perfil: Perfil; organizacion: Organizacion | null }> = ({ perfil, organizacion }) => {
  const [filas, setFilas] = useState<EntradaRegistro[]>([]);
  const [nombres, setNombres] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [verificacion, setVerificacion] = useState<{ ok: boolean; texto: string } | null>(null);
  const [verificando, setVerificando] = useState(false);
  const orgId = organizacion?.id ?? perfil.organizacion_id;

  useEffect(() => {
    if (!supabase || !orgId) return;
    void (async () => {
      const [{ data, error: e }, { data: perfiles }] = await Promise.all([
        supabase!.from('registro_accesos').select('*').eq('organizacion_id', orgId).order('id', { ascending: false }).limit(POR_PAGINA),
        // El titular ve los perfiles de su equipo. Los de FIRMA no: se muestran como FIRMA.
        supabase!.from('perfiles').select('id, nombre, email'),
      ]);
      if (e) setError(e.message);
      setFilas((data as EntradaRegistro[]) ?? []);
      setNombres(Object.fromEntries(((perfiles ?? []) as { id: string; nombre: string | null; email: string }[]).map((p) => [p.id, p.nombre || p.email])));
      setCargando(false);
    })();
  }, [orgId]);

  async function verificar() {
    if (!supabase || !orgId) return;
    setVerificando(true);
    const { data, error: e } = await supabase.rpc('bitacora_verificar', { org: orgId });
    setVerificando(false);
    if (e) return setVerificacion({ ok: false, texto: 'No se pudo verificar la bitácora.' });
    setVerificacion(
      data === null
        ? { ok: true, texto: 'La cadena está entera: ningún movimiento fue alterado ni borrado.' }
        : { ok: false, texto: `La cadena no cierra en el movimiento ${data}. Avisale a FIRMA.` },
    );
  }

  const quien = (f: EntradaRegistro) => {
    if (f.actor_es_staff) return 'FIRMA';
    const id = f.actor_id ?? f.usuario_id;
    if (!id) return '·';
    return nombres[id] ?? 'Una cuenta que ya no está';
  };

  return (
    <Marco perfil={perfil}>
      <Encabezado
        eyebrow="Seguridad"
        titulo={
          <>
            Bitácora de <span className="text-bosque">{organizacion?.nombre ?? 'tu empresa'}</span>
          </>
        }
        bajada="Quién entró y qué se hizo en la cuenta, incluido lo que hizo FIRMA. Nadie puede editar ni borrar un movimiento."
        acciones={
          <Button variant="ghost" size="lg" onClick={() => void verificar()} disabled={verificando} className="self-end">
            <ShieldCheck size={18} /> {verificando ? 'Verificando…' : 'Verificar'}
          </Button>
        }
      />
      <div className="wrap py-10 desk:py-12 flex flex-col gap-6">
        {error && <Aviso tipo="error">{error}</Aviso>}
        {verificacion && (
          <Aviso tipo={verificacion.ok ? 'ok' : 'error'}>
            <span className="inline-flex items-center gap-2">
              {verificacion.ok ? <ShieldCheck size={16} aria-hidden="true" /> : <ShieldX size={16} aria-hidden="true" />}
              {verificacion.texto}
            </span>
          </Aviso>
        )}
        <p className="text-sm text-piedra">Últimos {POR_PAGINA} movimientos.</p>
        <div className="overflow-x-auto">
          <table className="tabla min-w-[640px]">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Movimiento</th>
                <th>Quién</th>
              </tr>
            </thead>
            <tbody>
              {!cargando && filas.length === 0 && (
                <tr>
                  <td colSpan={3} className="p-6 text-piedra">
                    Todavía no hay movimientos.
                  </td>
                </tr>
              )}
              {filas.map((f) => (
                <tr key={f.id}>
                  <td className="whitespace-nowrap">{fechaCorta(f.creado_en)}</td>
                  <td>
                    {ACCIONES[f.accion] ?? f.accion}
                    {typeof f.detalle?.titulo === 'string' && <div className="text-xs text-piedra mt-1">{f.detalle.titulo}</div>}
                  </td>
                  <td>{f.actor_es_staff ? <Etiqueta tono="bosque">FIRMA</Etiqueta> : quien(f)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Marco>
  );
};

export default Bitacora;

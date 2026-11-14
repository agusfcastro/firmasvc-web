import React, { useEffect, useState } from 'react';
import { ShieldCheck, ShieldX } from 'lucide-react';
import { Button } from '../Button';
import { supabase } from './supabase';
import { Aviso, Encabezado, Etiqueta, Marco } from './ui';
import { ACCIONES } from './acciones';
import { fechaCorta, type EntradaRegistro, type Organizacion, type Perfil } from './tipos';
import { mensajeAmable } from './errores';

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
  const [hayMas, setHayMas] = useState(false);
  const [trayendo, setTrayendo] = useState(false);
  const orgId = organizacion?.id ?? perfil.organizacion_id;

  useEffect(() => {
    if (!supabase || !orgId) return;
    void (async () => {
      const [{ data, error: e }, { data: perfiles }] = await Promise.all([
        supabase!.from('registro_accesos').select('*').eq('organizacion_id', orgId).order('id', { ascending: false }).limit(POR_PAGINA),
        // El titular ve los perfiles de su equipo. Los de FIRMA no: se muestran como FIRMA.
        supabase!.from('perfiles').select('id, nombre, email'),
      ]);
      if (e) setError(mensajeAmable(e, 'No pudimos cargar la bitácora.'));
      setFilas((data as EntradaRegistro[]) ?? []);
      setHayMas((data?.length ?? 0) === POR_PAGINA);
      setNombres(Object.fromEntries(((perfiles ?? []) as { id: string; nombre: string | null; email: string }[]).map((p) => [p.id, p.nombre || p.email])));
      setCargando(false);
    })();
  }, [orgId]);

  /** Trae los movimientos anteriores al último que está en pantalla. */
  async function traerMas() {
    const ultimo = filas[filas.length - 1];
    if (!supabase || !orgId || !ultimo) return;
    setTrayendo(true);
    const { data, error: e } = await supabase.from('registro_accesos').select('*').eq('organizacion_id', orgId).lt('id', ultimo.id).order('id', { ascending: false }).limit(POR_PAGINA);
    setTrayendo(false);
    if (e) return setError(mensajeAmable(e, 'No pudimos traer más movimientos.'));
    setFilas((f) => [...f, ...((data as EntradaRegistro[]) ?? [])]);
    setHayMas((data?.length ?? 0) === POR_PAGINA);
  }

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
            <ShieldCheck size={18} aria-hidden="true" /> {verificando ? 'Verificando…' : 'Verificar'}
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
        <p className="text-sm text-piedra" role="status">
          {cargando ? 'Cargando los movimientos…' : hayMas ? `Los ${filas.length} movimientos más recientes.` : filas.length ? `${filas.length} ${filas.length === 1 ? 'movimiento' : 'movimientos'} en total.` : ''}
        </p>
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
        {hayMas && (
          <Button variant="ghost" onClick={() => void traerMas()} disabled={trayendo} className="self-start">
            {trayendo ? 'Trayendo…' : 'Ver movimientos anteriores'}
          </Button>
        )}
      </div>
    </Marco>
  );
};

export default Bitacora;

import React, { useEffect, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Button } from '../../Button';
import { supabase } from '../supabase';
import { Aviso, Campo, claseInput } from '../ui';
import { MarcoPublico, fechaHora, usePaginaPrivada } from '../../firma/comun';
import { PasosFathom, urlWebhook } from './fathom';

/**
 * Página pública del enlace de conexión. /conectar-fathom/<enlace>
 * Para quien graba llamadas con su Fathom personal y no tiene cuenta en el
 * portal. El titular le manda el enlace; acá ve su URL, la carga en Fathom y
 * pega el secreto. No ve nada más del CRM. El enlace vale 7 días y se usa
 * una sola vez (migración 0049).
 */

interface Datos {
  integrante: string;
  negocio: string;
  token: string;
  vence_en: string;
}

export const ConectarFathom: React.FC<{ enlace: string }> = ({ enlace }) => {
  usePaginaPrivada('Conectar Fathom · FIRMA');
  const [datos, setDatos] = useState<Datos | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [secreto, setSecreto] = useState('');
  const [copiada, setCopiada] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [listo, setListo] = useState(false);

  useEffect(() => {
    if (!supabase) return setError('El portal no está configurado.');
    supabase.rpc('integracion_invitacion_abrir', { p_invitacion: enlace }).then(({ data, error: e }) => {
      // Los errores propios de la base (enlace vencido o inválido) vienen con 42501 y ya están redactados.
      if (e || !data) return setError(e?.code === '42501' ? e.message : 'El enlace no es válido o venció. Pedile uno nuevo a quien te lo mandó.');
      setDatos(data as Datos);
    });
  }, [enlace]);

  async function copiar(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopiada(true);
    } catch {
      setError('No pudimos copiar. Seleccioná la URL y copiala a mano.');
    }
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setGuardando(true);
    setError(null);
    const { error: err } = await supabase.rpc('integracion_invitacion_secreto', { p_invitacion: enlace, p_secreto: secreto });
    setGuardando(false);
    if (err) return setError(err.code === '42501' || err.code === 'P0001' ? err.message : 'No pudimos guardar el secreto. Probá de nuevo en un rato.');
    setListo(true);
  }

  return (
    <MarcoPublico eyebrow="Conexión con Fathom" pie="Llamadas de Fathom en el CRM de FIRMA · Castro & Partners">
      <div className="wrap py-12 desk:py-16 max-w-[760px] flex flex-col gap-6">
        {listo ? (
          <>
            <h1 className="h2">Listo, quedó conectado</h1>
            <Aviso tipo="ok">
              Las llamadas que grabes con Fathom van a llegar al CRM de {datos?.negocio}. Ya podés cerrar esta página.
            </Aviso>
          </>
        ) : !datos ? (
          error ? <Aviso tipo="error">{error}</Aviso> : <p className="text-piedra">Cargando…</p>
        ) : (
          <>
            <div className="flex flex-col gap-2">
              <p className="eyebrow text-piedra">{datos.negocio}</p>
              <h1 className="h2">Conectá tu Fathom, {datos.integrante}</h1>
              <p className="text-piedra">
                Así las llamadas que grabás llegan solas al CRM. Usás tu cuenta de Fathom de siempre; nadie ve tu contraseña. El enlace vence el {fechaHora(datos.vence_en)}
              </p>
            </div>
            {error && <Aviso tipo="error">{error}</Aviso>}
            <div className="flex flex-col tab:flex-row gap-3">
              <input readOnly className={`${claseInput} font-mono text-[13px]`} value={urlWebhook(datos.token)} onFocus={(e) => e.currentTarget.select()} aria-label="URL del webhook" />
              <Button type="button" variant="ghost" onClick={() => void copiar(urlWebhook(datos.token))}>
                {copiada ? <Check size={16} /> : <Copy size={16} />} {copiada ? 'Copiada' : 'Copiar'}
              </Button>
            </div>
            <PasosFathom />
            <form onSubmit={guardar} className="bg-marfil-oscuro p-6 desk:p-8 space-y-5">
              <Campo etiqueta="Secreto del webhook" ayuda="Lo guardamos cifrado. Nadie lo puede volver a ver.">
                <input
                  required
                  autoComplete="off"
                  spellCheck={false}
                  className={`${claseInput} font-mono text-[13px]`}
                  placeholder="whsec_…"
                  value={secreto}
                  onChange={(e) => setSecreto(e.target.value)}
                />
              </Campo>
              <Button type="submit" disabled={guardando}>
                {guardando ? 'Guardando…' : 'Conectar'}
              </Button>
            </form>
          </>
        )}
      </div>
    </MarcoPublico>
  );
};

export default ConectarFathom;

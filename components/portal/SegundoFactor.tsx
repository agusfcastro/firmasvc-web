import React, { useEffect, useState } from 'react';
import { Button } from '../Button';
import { supabase } from './supabase';
import { navegar } from './navegacion';
import { Aviso, Campo, claseInput } from './ui';
import { LayoutAcceso } from './LayoutAcceso';
import { QrMarca } from './QrMarca';
import type { EstadoSesion } from './useSesion';

interface Alta {
  id: string;
  uri: string;
  secreto: string;
}

/**
 * Verificación en dos pasos de las cuentas de FIRMA. Sin ella la base no da
 * permisos de admin (migración 0033) y la API tampoco.
 * Con una app autenticadora ya registrada pide el código; si no hay ninguna,
 * muestra el QR para registrarla.
 */
export const SegundoFactor: React.FC<{ estado: EstadoSesion }> = ({ estado }) => {
  const registrada = estado.mfa?.posible === 'aal2';
  const [alta, setAlta] = useState<Alta | null>(null);
  const [codigo, setCodigo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (registrada || !supabase) return;
    let vivo = true;
    (async () => {
      // Las altas que quedaron a medias se borran, así no se acumulan.
      const { data: lista } = await supabase.auth.mfa.listFactors();
      for (const f of lista?.all ?? []) {
        if (f.status !== 'verified') await supabase.auth.mfa.unenroll({ factorId: f.id });
      }
      const { data, error: err } = await supabase.auth.mfa.enroll({ factorType: 'totp', issuer: 'FIRMA' });
      if (!vivo) return;
      if (err || !data) return setError('No se pudo preparar el código QR. Recargá la página.');
      setAlta({ id: data.id, uri: data.totp.uri, secreto: data.totp.secret });
    })();
    return () => {
      vivo = false;
    };
  }, [registrada]);

  async function verificar(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setEnviando(true);
    setError(null);
    let factorId = alta?.id;
    if (registrada) {
      const { data } = await supabase.auth.mfa.listFactors();
      factorId = data?.totp[0]?.id;
    }
    if (!factorId) {
      setEnviando(false);
      return setError('No encontramos tu app autenticadora. Recargá la página.');
    }
    const { error: err } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: codigo.replace(/\s/g, '') });
    setEnviando(false);
    if (err) {
      setCodigo('');
      return setError('El código no es correcto o ya venció. Probá con el que muestra ahora la app.');
    }
    await estado.recargarMfa();
  }

  return (
    <LayoutAcceso>
      <p className="eyebrow text-piedra mb-4">Verificación en dos pasos</p>
      <h1 className="h2 mb-3">
        {registrada ? (
          <>
            Ingresá tu <span className="text-bosque">código</span>
          </>
        ) : (
          <>
            Protegé tu <span className="text-bosque">cuenta</span>
          </>
        )}
      </h1>
      <p className="text-piedra mb-8">
        {registrada
          ? 'Abrí tu app autenticadora y escribí el código de 6 números del Portal FIRMA.'
          : 'Las cuentas de FIRMA ven los datos de todos los clientes, así que además de la contraseña piden un código. Escaneá el QR con Google Authenticator, 1Password o la app que uses, y escribí el código que aparece.'}
      </p>

      {!registrada && (
        <div className="mb-8">
          {alta ? (
            <>
              <QrMarca texto={alta.uri} etiqueta="Código QR para la app autenticadora" className="w-56 h-56 shadow-[0_1px_4px_rgba(27,31,27,0.15)] rounded-[10px]" />
              <p className="mt-4 text-xs text-piedra leading-relaxed">
                ¿No podés escanear? Cargá esta clave a mano: <span className="font-mono text-tinta break-all select-all">{alta.secreto}</span>
              </p>
            </>
          ) : (
            !error && <p className="eyebrow text-piedra animate-pulse">Preparando el código QR</p>
          )}
        </div>
      )}

      <form onSubmit={verificar} className="space-y-5">
        {error && <Aviso tipo="error">{error}</Aviso>}
        <Campo etiqueta="Código de 6 números">
          <input
            required
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9 ]{6,7}"
            maxLength={7}
            className={claseInput}
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
          />
        </Campo>
        <Button type="submit" size="lg" fullWidth disabled={enviando || (!registrada && !alta)}>
          {enviando ? 'Verificando…' : registrada ? 'Entrar' : 'Activar y entrar'}
        </Button>
      </form>

      <button
        type="button"
        className="mt-6 text-sm underline underline-offset-4 hover:text-bosque"
        onClick={async () => {
          await supabase?.auth.signOut();
          navegar('/portal/ingresar');
        }}
      >
        Salir
      </button>

      {registrada && (
        <p className="mt-12 pt-6 text-xs text-piedra leading-relaxed" style={{ borderTop: '1px solid rgba(27,31,27,0.15)' }}>
          ¿Perdiste el celular? En Supabase, en Authentication › Users, abrí tu usuario y borrá el factor. Al volver a entrar te pide registrar la app de nuevo.
        </p>
      )}
    </LayoutAcceso>
  );
};

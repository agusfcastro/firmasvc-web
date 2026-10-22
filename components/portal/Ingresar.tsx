import React, { useState } from 'react';
import { Button } from '../Button';
import { supabase } from './supabase';
import { navegar } from './navegacion';
import { Aviso, Campo, claseInput } from './ui';
import { LayoutAcceso } from './LayoutAcceso';

export const Ingresar: React.FC = () => {
  const [email, setEmail] = useState('');
  const [clave, setClave] = useState('');
  const [modo, setModo] = useState<'ingreso' | 'olvido'>('ingreso');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  async function ingresar(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setEnviando(true);
    setError(null);
    const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password: clave });
    setEnviando(false);
    if (err) {
      setError(/banned/i.test(err.message) ? 'Tu acceso está desactivado. Escribinos si creés que es un error.' : 'Mail o contraseña incorrectos.');
      return;
    }
    await supabase.rpc('registrar_ingreso');
    navegar('/portal');
  }

  async function recuperar(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setEnviando(true);
    setError(null);
    // El mail sale por Resend con la plantilla de FIRMA. Si la función no responde, lo manda Supabase.
    const r = await fetch('/api/portal/recuperar', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: email.trim() }),
    }).catch(() => null);
    if (!r?.ok) await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/portal/clave` });
    setEnviando(false);
    // Mismo mensaje exista o no la cuenta, para no revelar qué mails están registrados.
    setOk('Si ese mail tiene acceso al portal, en unos minutos te llega un enlace para definir una contraseña nueva.');
  }

  return (
    <LayoutAcceso>
      <p className="eyebrow text-piedra mb-4">{modo === 'ingreso' ? 'Acceso de clientes' : 'Recuperar acceso'}</p>
      <h1 className="h2 mb-3">
        {modo === 'ingreso' ? (
          <>
            Ingresá al <span className="text-bosque">portal</span>
          </>
        ) : (
          <>
            Definí una <span className="text-bosque">contraseña nueva</span>
          </>
        )}
      </h1>
      <p className="text-piedra mb-10">{modo === 'ingreso' ? 'Con el mail que registramos al darte de alta.' : 'Te mandamos un enlace al mail con el que te dimos de alta.'}</p>

      <form onSubmit={modo === 'ingreso' ? ingresar : recuperar} className="space-y-5">
        {error && <Aviso tipo="error">{error}</Aviso>}
        {ok && <Aviso tipo="ok">{ok}</Aviso>}
        <Campo etiqueta="Mail">
          <input type="email" required autoComplete="email" className={claseInput} value={email} onChange={(e) => setEmail(e.target.value)} />
        </Campo>
        {modo === 'ingreso' && (
          <Campo etiqueta="Contraseña">
            <input type="password" required autoComplete="current-password" className={claseInput} value={clave} onChange={(e) => setClave(e.target.value)} />
          </Campo>
        )}
        <Button type="submit" size="lg" fullWidth disabled={enviando}>
          {enviando ? (modo === 'ingreso' ? 'Verificando…' : 'Enviando…') : modo === 'ingreso' ? 'Ingresar' : 'Enviar enlace'}
        </Button>
      </form>

      <button
        type="button"
        className="mt-6 text-sm underline underline-offset-4 hover:text-bosque"
        onClick={() => {
          setModo(modo === 'ingreso' ? 'olvido' : 'ingreso');
          setError(null);
          setOk(null);
        }}
      >
        {modo === 'ingreso' ? 'Olvidé mi contraseña' : 'Volver a ingresar'}
      </button>

      <p className="mt-12 pt-6 text-xs text-piedra leading-relaxed" style={{ borderTop: '1px solid rgba(27,31,27,0.15)' }}>
        El acceso es personal y por invitación. Si trabajás en una empresa cliente de FIRMA y todavía no tenés usuario, pedíselo al titular de la cuenta.
      </p>
    </LayoutAcceso>
  );
};

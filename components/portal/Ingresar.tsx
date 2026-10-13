import React, { useState } from 'react';
import { Button } from '../Button';
import { supabase } from './supabase';
import { navegar } from './navegacion';
import { Aviso, Campo, Marco, claseInput } from './ui';

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
    await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/portal/clave` });
    setEnviando(false);
    // Mismo mensaje exista o no la cuenta, para no revelar qué mails están registrados.
    setOk('Si ese mail tiene acceso al portal, en unos minutos te llega un enlace para definir una contraseña nueva.');
  }

  return (
    <Marco ancho="angosto">
      <p className="eyebrow text-piedra mb-3">Portal de clientes</p>
      <h1 className="h2 mb-8">{modo === 'ingreso' ? 'Ingresá a tu cuenta' : 'Recuperá tu acceso'}</h1>

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
        <Button type="submit" fullWidth disabled={enviando}>
          {enviando ? 'Un momento…' : modo === 'ingreso' ? 'Ingresar' : 'Enviarme el enlace'}
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

      <p className="mt-10 text-xs text-piedra leading-relaxed">
        El acceso es solo por invitación. Si sos parte del equipo de un cliente de FIRMA y todavía no tenés cuenta, pedíselo a la persona responsable de tu empresa.
      </p>
    </Marco>
  );
};

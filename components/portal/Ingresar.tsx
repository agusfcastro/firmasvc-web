import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
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
  const [verClave, setVerClave] = useState(false);
  const [faltan, setFaltan] = useState<{ email?: string; clave?: string }>({});

  /** Validación propia, en el tono del portal y debajo de cada campo. */
  function revisar(): boolean {
    const f: { email?: string; clave?: string } = {};
    const m = email.trim();
    if (!m) f.email = 'Escribí tu mail.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(m)) f.email = 'Revisá el mail, parece que le falta algo.';
    if (modo === 'ingreso' && !clave) f.clave = 'Escribí tu contraseña.';
    setFaltan(f);
    return !f.email && !f.clave;
  }

  async function ingresar(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase || !revisar()) return;
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
    if (!supabase || !revisar()) return;
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
      <p className="text-[13px] font-medium text-piedra mb-2">{modo === 'ingreso' ? 'Acceso de clientes' : 'Recuperar acceso'}</p>
      <h1 className="p-titulo-grande mb-3">
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
      <p className="text-piedra text-[15px] mb-8">{modo === 'ingreso' ? 'Con el mail que registramos al darte de alta.' : 'Te mandamos un enlace al mail con el que te dimos de alta.'}</p>

      <form noValidate onSubmit={modo === 'ingreso' ? ingresar : recuperar} className="space-y-5">
        {error && <Aviso tipo="error">{error}</Aviso>}
        {ok && <Aviso tipo="ok">{ok}</Aviso>}
        <Campo etiqueta="Mail">
          <input
            type="email"
            required
            autoComplete="email"
            inputMode="email"
            aria-invalid={Boolean(faltan.email)}
            aria-describedby={faltan.email ? 'falta-email' : undefined}
            className={`${claseInput} ${faltan.email ? 'border-peligro' : ''}`}
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (faltan.email) setFaltan((f) => ({ ...f, email: undefined }));
            }}
          />
          {faltan.email && (
            <span id="falta-email" className="block mt-1.5 text-[13px] text-peligro">
              {faltan.email}
            </span>
          )}
        </Campo>
        {modo === 'ingreso' && (
          <Campo etiqueta="Contraseña">
            <span className="relative block">
              <input
                type={verClave ? 'text' : 'password'}
                required
                autoComplete="current-password"
                aria-invalid={Boolean(faltan.clave)}
                aria-describedby={faltan.clave ? 'falta-clave' : undefined}
                className={`${claseInput} pr-12 ${faltan.clave ? 'border-peligro' : ''}`}
                value={clave}
                onChange={(e) => {
                  setClave(e.target.value);
                  if (faltan.clave) setFaltan((f) => ({ ...f, clave: undefined }));
                }}
              />
              <button
                type="button"
                onClick={() => setVerClave((v) => !v)}
                aria-label={verClave ? 'Ocultar la contraseña' : 'Mostrar la contraseña'}
                aria-pressed={verClave}
                className="absolute right-0 top-0 h-full w-11 grid place-items-center text-piedra hover:text-tinta"
              >
                {verClave ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
              </button>
            </span>
            {faltan.clave && (
              <span id="falta-clave" className="block mt-1.5 text-[13px] text-peligro">
                {faltan.clave}
              </span>
            )}
          </Campo>
        )}
        <Button type="submit" size="lg" fullWidth disabled={enviando}>
          {enviando ? (modo === 'ingreso' ? 'Verificando…' : 'Enviando…') : modo === 'ingreso' ? 'Ingresar' : 'Enviar enlace'}
        </Button>
      </form>

      <button
        type="button"
        className="mt-3 inline-flex items-center min-h-[44px] text-sm underline underline-offset-4 hover:text-bosque"
        onClick={() => {
          setModo(modo === 'ingreso' ? 'olvido' : 'ingreso');
          setError(null);
          setOk(null);
          setFaltan({});
        }}
      >
        {modo === 'ingreso' ? 'Olvidé mi contraseña' : 'Volver a ingresar'}
      </button>

      <p className="mt-10 pt-6 text-[13px] text-piedra leading-relaxed border-t border-borde-suave">
        El acceso es personal y por invitación. Si trabajás en una empresa cliente de FIRMA y todavía no tenés usuario, pedíselo al titular de la cuenta.
      </p>
    </LayoutAcceso>
  );
};

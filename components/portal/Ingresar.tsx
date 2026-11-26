import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Button } from '../Button';
import { supabase } from './supabase';
import { navegar, tomarDestino } from './navegacion';
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
  // Vuelta de Google con error: el mail de esa cuenta no está dado de alta (las altas son por invitación).
  const [errorGoogle] = useState<string | null>(() => {
    const p = new URLSearchParams(window.location.hash.replace(/^#/, '') || window.location.search);
    const d = p.get('error_description') || p.get('error');
    if (!d) return null;
    return /signup|not allowed|registr/i.test(d)
      ? 'Esa cuenta de Google no tiene acceso al portal. Entrá con la cuenta de Google del mail con el que te dimos de alta, o con tu mail y contraseña.'
      : 'No se pudo ingresar con Google. Probá de nuevo o entrá con tu mail y contraseña.';
  });
  const [conGoogle, setConGoogle] = useState(false);

  /** Ingreso con Google. Entra a la misma cuenta si el mail de Google es el de la invitación. */
  async function ingresarConGoogle() {
    if (!supabase) return;
    setConGoogle(true);
    setError(null);
    try {
      // Para anotar el ingreso en la bitácora cuando vuelve de Google.
      window.sessionStorage.setItem('firma-ingreso-google', '1');
    } catch {
      /* sin almacenamiento: se entra igual */
    }
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/portal/ingresar`, queryParams: { prompt: 'select_account' } },
    });
    if (err) {
      setConGoogle(false);
      setError('No se pudo abrir Google. Probá de nuevo o entrá con tu mail y contraseña.');
    }
  }

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
      const m = err.message;
      setError(
        /banned/i.test(m)
          ? 'Tu acceso está desactivado. Escribinos si creés que es un error.'
          : /fetch|network|load failed/i.test(m) || err.status === 0
            ? 'No hay conexión. Revisá tu internet y probá de nuevo.'
            : err.status === 429 || /rate limit|too many/i.test(m)
              ? 'Demasiados intentos seguidos. Esperá unos minutos y probá de nuevo.'
              : err.status && err.status >= 500
                ? 'El servidor no respondió. Probá de nuevo en un rato.'
                : 'Mail o contraseña incorrectos.',
      );
      return;
    }
    // Es solo el registro del ingreso en la bitácora: si falla, se entra igual.
    await supabase.rpc('registrar_ingreso').then(
      () => undefined,
      () => undefined,
    );
    navegar(tomarDestino());
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

      {modo === 'ingreso' && (
        <>
          {errorGoogle && !error && (
            <div className="mb-5">
              <Aviso tipo="error">{errorGoogle}</Aviso>
            </div>
          )}
          <button
            type="button"
            onClick={() => void ingresarConGoogle()}
            disabled={conGoogle}
            className="w-full h-12 inline-flex items-center justify-center gap-3 rounded-control border border-borde bg-white text-[15px] font-medium text-tinta hover:border-tinta disabled:opacity-60"
          >
            <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
            </svg>
            {conGoogle ? 'Abriendo Google…' : 'Continuar con Google'}
          </button>
          <div className="flex items-center gap-3 my-6 text-[12.5px] text-piedra" aria-hidden="true">
            <span className="flex-1 h-px bg-borde-suave" />o con tu mail<span className="flex-1 h-px bg-borde-suave" />
          </div>
        </>
      )}

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

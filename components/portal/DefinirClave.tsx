import React, { useState } from 'react';
import { Button } from '../Button';
import { supabase } from './supabase';
import { navegar } from './navegacion';
import { Aviso, Campo, claseInput } from './ui';
import { LayoutAcceso } from './LayoutAcceso';
import type { EstadoSesion } from './useSesion';

const MINIMO = 10;

function problemaDeClave(clave: string): string | null {
  if (clave.length < MINIMO) return `Tiene que tener al menos ${MINIMO} caracteres.`;
  if (!/[a-zA-Z]/.test(clave) || !/\d/.test(clave)) return 'Combiná letras y números.';
  return null;
}

export const DefinirClave: React.FC<{ estado: EstadoSesion }> = ({ estado }) => {
  const [clave, setClave] = useState('');
  const [repetir, setRepetir] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!estado.sesion) {
    return (
      <LayoutAcceso>
        <p className="eyebrow text-piedra mb-4">Acceso</p>
        <h1 className="h2 mb-6">
          El enlace <span className="text-bosque">venció</span>
        </h1>
        <p className="text-piedra mb-8">Los enlaces de acceso duran poco tiempo y se pueden usar una sola vez. Pedí uno nuevo desde la pantalla de ingreso.</p>
        <Button size="lg" onClick={() => navegar('/portal/ingresar')}>Ir al ingreso</Button>
      </LayoutAcceso>
    );
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    const problema = problemaDeClave(clave);
    if (problema) return setError(problema);
    if (clave !== repetir) return setError('Las contraseñas no coinciden.');
    setEnviando(true);
    setError(null);
    const { error: err } = await supabase.auth.updateUser({ password: clave });
    setEnviando(false);
    if (err) {
      setError(/different|same/i.test(err.message) ? 'Elegí una contraseña distinta de la anterior.' : 'No se pudo guardar. Probá con otra contraseña o pedí un enlace nuevo.');
      return;
    }
    await supabase.rpc('registrar_ingreso');
    estado.terminarEnlace();
    window.history.replaceState({}, '', '/portal');
    navegar('/portal');
  }

  return (
    <LayoutAcceso>
      <p className="eyebrow text-piedra mb-4">Primer ingreso</p>
      <h1 className="h2 mb-3">
        Definí tu <span className="text-bosque">contraseña</span>
      </h1>
      <p className="text-piedra mb-8">Cuenta {estado.sesion.user.email}. Solo vos la vas a conocer, nadie en FIRMA puede verla.</p>
      <form onSubmit={guardar} className="space-y-5">
        {error && <Aviso tipo="error">{error}</Aviso>}
        <Campo etiqueta="Contraseña nueva" ayuda={`Mínimo ${MINIMO} caracteres, con letras y números.`}>
          <input type="password" required autoComplete="new-password" className={claseInput} value={clave} onChange={(e) => setClave(e.target.value)} />
        </Campo>
        <Campo etiqueta="Repetila">
          <input type="password" required autoComplete="new-password" className={claseInput} value={repetir} onChange={(e) => setRepetir(e.target.value)} />
        </Campo>
        <Button type="submit" size="lg" fullWidth disabled={enviando}>
          {enviando ? 'Guardando…' : 'Guardar y entrar'}
        </Button>
      </form>
    </LayoutAcceso>
  );
};

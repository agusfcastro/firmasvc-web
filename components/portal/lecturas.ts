import { supabase } from './supabase';

export type TipoLectura = 'negocio' | 'crm_cliente' | 'perfil_conductual' | 'asunto' | 'firma_sobre';

/**
 * Avisa a la bitácora que se abrió algo (migración 0046). La base decide si
 * se anota: todo lo que abre FIRMA y lo sensible del resto. No frena la
 * pantalla: si falla, se sigue igual.
 */
export function registrarLectura(tipo: TipoLectura, id: string): void {
  if (!supabase) return;
  supabase.rpc('bitacora_lectura', { tipo, objeto: id }).then(
    () => undefined,
    () => undefined,
  );
}

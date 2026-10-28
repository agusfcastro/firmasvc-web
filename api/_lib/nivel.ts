/**
 * Nivel de la sesión que trae el token de Supabase: aal2 cuando pasó la
 * verificación en dos pasos. Se lee sin validar la firma, así que se usa solo
 * después de que sb.auth.getUser(token) aceptó ese mismo token.
 */
export function nivelDe(token: string): string | null {
  try {
    const datos = JSON.parse(Buffer.from(token.split('.')[1] || '', 'base64url').toString('utf8')) as { aal?: unknown };
    return typeof datos.aal === 'string' ? datos.aal : null;
  } catch {
    return null;
  }
}

export const FALTA_SEGUNDO_FACTOR = 'Falta la verificación en dos pasos. Volvé a ingresar al portal.';

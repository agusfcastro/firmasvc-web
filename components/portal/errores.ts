/**
 * Errores de Supabase en castellano. La base y la red contestan en inglés y con
 * términos técnicos; en pantalla va qué pasó y qué hacer. Lo que no se reconoce
 * sale con un texto general y el detalle al final, para poder pasárselo a FIRMA.
 */
export function mensajeAmable(e: { message?: string; code?: string } | string | null | undefined, respaldo = 'No se pudo completar la operación.'): string {
  if (!e) return respaldo;
  const m = (typeof e === 'string' ? e : e.message ?? '').trim();
  const codigo = typeof e === 'string' ? '' : e.code ?? '';
  if (/failed to fetch|networkerror|load failed|fetch failed|network request failed/i.test(m)) return 'No hay conexión. Revisá tu internet y probá de nuevo.';
  if (/jwt expired|invalid jwt|refresh token|session.*(missing|expired)|not authenticated/i.test(m) || codigo === 'PGRST301') return 'Tu sesión venció. Volvé a ingresar al portal.';
  if (/row-level security|permission denied/i.test(m) || codigo === '42501') return 'No tenés permiso para hacer esto.';
  if (/duplicate key|unique constraint/i.test(m) || codigo === '23505') return 'Ya existe un registro con esos datos.';
  if (/foreign key/i.test(m) || codigo === '23503') return 'No se puede, porque hay otros datos que dependen de este.';
  if (/not-null|null value/i.test(m) || codigo === '23502') return 'Falta completar un dato obligatorio.';
  if (/check constraint/i.test(m) || codigo === '23514') return 'Hay un dato que no tiene el formato esperado. Revisalo y probá de nuevo.';
  if (/timeout|timed out|statement canceled/i.test(m) || codigo === '57014') return 'Tardó demasiado. Probá de nuevo en un rato.';
  if (/rate limit|too many requests/i.test(m)) return 'Demasiados intentos seguidos. Esperá unos minutos y probá de nuevo.';
  if (/payload too large|exceeded the maximum allowed size/i.test(m)) return 'El archivo es demasiado pesado.';
  // Los mensajes que escribe la propia base (raise exception) ya vienen en castellano.
  if (m && /[áéíóúñ¿¡]/i.test(m)) return m;
  return m ? `${respaldo} Probá de nuevo y, si sigue, avisanos con este detalle: ${m.slice(0, 160)}` : respaldo;
}

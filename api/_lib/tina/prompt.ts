/**
 * Prompt de sistema de Tina. La fuente es docs/TINA_SYSTEM_PROMPT.md (vercel.json
 * la incluye en la función): todo lo que está entre el primer «---» y
 * «## Contexto del cliente» es la parte estática, y lo que sigue, el contexto.
 *
 * La parte estática va primero y con cache_control, así la API la cachea: no
 * cambia entre pedidos salvo por el plan y el teléfono del responsable, que
 * son pocos valores. El contexto del cliente (fecha y hora, casos, eventos)
 * va en un bloque aparte, después del corte de caché.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ARCHIVO = 'docs/TINA_SYSTEM_PROMPT.md';

let cache: { estatico: string; contexto: string } | null = null;

function leerDoc(): string {
  const candidatos = [path.join(process.cwd(), ARCHIVO)];
  try {
    candidatos.push(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..', ARCHIVO));
  } catch {
    // Sin import.meta.url (por ejemplo, empaquetado): queda solo process.cwd().
  }
  for (const c of candidatos) {
    try {
      return readFileSync(c, 'utf8');
    } catch {
      // Probar el siguiente.
    }
  }
  throw new Error(`No se encontró ${ARCHIVO}.`);
}

/** Partes del documento, leídas una vez por instancia de la función. */
export function partesDelPrompt(): { estatico: string; contexto: string } {
  if (cache) return cache;
  const doc = leerDoc();
  const inicio = doc.indexOf('\n---\n');
  const corte = doc.indexOf('## Contexto del cliente');
  if (inicio < 0 || corte < 0 || corte < inicio) throw new Error(`${ARCHIVO} no tiene el formato esperado.`);
  const estatico = doc.slice(inicio + 5, corte).replace(/\n---\s*$/, '').trim();
  const contexto = doc.slice(corte).trim();
  cache = { estatico, contexto };
  return cache;
}

function completar(plantilla: string, valores: Record<string, string>): string {
  return plantilla.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (todo, clave: string) => (clave in valores ? valores[clave] : todo));
}

export interface DatosPrompt {
  plan: 'Starter' | 'Eminent';
  telefonoResponsable: string;
  clienteNombre: string;
  empresa: string;
  pais: string;
  tipoSocietario: string;
  usuarioNombre: string;
  usuarioRol: string;
  fechaHoraLocal: string;
  responsableNombre: string;
  casosAbiertos: string;
  eventosHoy: string;
  listaContratos: string;
}

/** Los dos bloques de texto del prompt de sistema: estático y contexto. */
export function armarPrompt(d: DatosPrompt): { estatico: string; contexto: string } {
  const partes = partesDelPrompt();
  return {
    estatico: completar(partes.estatico, { plan: d.plan, telefono_responsable: d.telefonoResponsable }),
    contexto: completar(partes.contexto, {
      cliente_nombre: d.clienteNombre,
      empresa: d.empresa,
      pais: d.pais,
      tipo_societario: d.tipoSocietario,
      plan: d.plan,
      usuario_nombre: d.usuarioNombre,
      usuario_rol: d.usuarioRol,
      fecha_hora_local: d.fechaHoraLocal,
      responsable_nombre: d.responsableNombre,
      casos_abiertos: d.casosAbiertos,
      eventos_hoy: d.eventosHoy,
      lista_contratos: d.listaContratos,
    }),
  };
}

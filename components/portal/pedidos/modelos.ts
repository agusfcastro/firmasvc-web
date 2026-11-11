import { CLOSER } from './closer';
import { SETTER } from './setter';
import { SUMAR, paraSumar, texto, type Modelo, type Respuestas } from './formulario';

/** Los formularios de contrato con el equipo, en el orden en que se muestran. */
export const MODELOS = { closer: CLOSER, setter: SETTER } as const;

export type ClaveModelo = keyof typeof MODELOS;

/** El formulario de un pedido: el completo, o el corto si es para sumar a alguien con el contrato modelo. */
export function modeloDe(clave: ClaveModelo, r: Respuestas): Modelo {
  return texto(r, SUMAR) ? paraSumar(MODELOS[clave]) : MODELOS[clave];
}

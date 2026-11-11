import { CLOSER } from './closer';
import { SETTER } from './setter';

/** Los formularios de contrato con el equipo, en el orden en que se muestran. */
export const MODELOS = { closer: CLOSER, setter: SETTER } as const;

export type ClaveModelo = keyof typeof MODELOS;

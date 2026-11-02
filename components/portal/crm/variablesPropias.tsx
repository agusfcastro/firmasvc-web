import React from 'react';
import { claseInput } from '../ui';
import type { VariablePropia } from './tipos';

/**
 * Campo para cargar el valor de una variable propia del negocio. Lo usan la
 * pantalla de Variables (las del negocio) y la ficha del cliente (las de
 * cliente). El valor viaja como se guarda en la base: texto, número,
 * booleano, fecha AAAA-MM-DD o null.
 */
export const CampoVariable: React.FC<{ v: VariablePropia; valor: unknown; alCambiar: (valor: unknown) => void; deshabilitado?: boolean }> = ({
  v,
  valor,
  alCambiar,
  deshabilitado,
}) => {
  if (v.tipo === 'booleano')
    return (
      <select className={claseInput} disabled={deshabilitado} value={valor === true ? 'si' : valor === false ? 'no' : ''} onChange={(e) => alCambiar(e.target.value === '' ? null : e.target.value === 'si')}>
        <option value="">Sin dato</option>
        <option value="si">Sí</option>
        <option value="no">No</option>
      </select>
    );
  if (v.tipo === 'opcion')
    return (
      <select className={claseInput} disabled={deshabilitado} value={typeof valor === 'string' ? valor : ''} onChange={(e) => alCambiar(e.target.value || null)}>
        <option value="">Sin dato</option>
        {(v.opciones ?? []).map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    );
  if (v.tipo === 'numero' || v.tipo === 'monto')
    return (
      <input
        type="number"
        step={v.tipo === 'monto' ? '0.01' : 'any'}
        min={v.tipo === 'monto' ? '0' : undefined}
        className={claseInput}
        disabled={deshabilitado}
        value={typeof valor === 'number' ? String(valor) : ''}
        onChange={(e) => alCambiar(e.target.value === '' ? null : Number(e.target.value))}
      />
    );
  if (v.tipo === 'fecha')
    return <input type="date" className={claseInput} disabled={deshabilitado} value={typeof valor === 'string' ? valor : ''} onChange={(e) => alCambiar(e.target.value || null)} />;
  return <input className={claseInput} disabled={deshabilitado} maxLength={2000} value={typeof valor === 'string' ? valor : ''} onChange={(e) => alCambiar(e.target.value === '' ? null : e.target.value)} />;
};

/** Saca las claves sin valor, así datos_extra guarda solo lo cargado. */
export function sinVacios(valores: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(valores).filter(([, v]) => v !== null && v !== undefined && v !== ''));
}

import React from 'react';
import { Campo, claseInput } from '../ui';
import type { TipoCliente } from './tipos';

/**
 * Quién contrata: una persona o una empresa, de cualquier país. Lo usan el
 * alta y la ficha. En una empresa, nombre es la razón social, el domicilio
 * es el de la empresa y el documento, el mail y el teléfono son de quien la
 * representa, que es quien firma el contrato.
 */
export interface Identidad {
  tipo: TipoCliente;
  nombre: string;
  id_fiscal: string;
  representante: string;
  cargo: string;
  dni: string;
  email: string;
  telefono: string;
  domicilio: string;
}

const TIPOS = [
  ['persona', 'Persona', 'Contrata a título personal.'],
  ['empresa', 'Empresa', 'Contrata una sociedad, de cualquier país. Firma su representante.'],
] as const;

/** Lo que se guarda en crm_clientes. Si es una persona, los datos de empresa quedan vacíos. */
export function filaIdentidad(d: Identidad) {
  const empresa = d.tipo === 'empresa';
  const limpio = (s: string) => s.trim() || null;
  return {
    tipo: d.tipo,
    nombre: d.nombre.trim(),
    id_fiscal: empresa ? limpio(d.id_fiscal) : null,
    representante: empresa ? limpio(d.representante) : null,
    cargo: empresa ? limpio(d.cargo) : null,
    dni: limpio(d.dni),
    email: d.email.trim().toLowerCase() || null,
    telefono: limpio(d.telefono),
    domicilio: limpio(d.domicilio),
  };
}

export const DatosCliente: React.FC<{ d: Identidad; alCambiar: (k: keyof Identidad, v: string) => void; mailObligatorio?: boolean; nombreGrupo: string }> = ({
  d,
  alCambiar,
  mailObligatorio,
  nombreGrupo,
}) => {
  const empresa = d.tipo === 'empresa';
  const contacto = (
    <>
      <Campo etiqueta="Mail">
        <input type="email" required={mailObligatorio} className={claseInput} value={d.email} onChange={(e) => alCambiar('email', e.target.value)} />
      </Campo>
      <Campo etiqueta="Teléfono">
        <input className={claseInput} value={d.telefono} onChange={(e) => alCambiar('telefono', e.target.value)} />
      </Campo>
    </>
  );
  return (
    <div className="flex flex-col gap-5">
      <fieldset className="grid gap-3 tab:grid-cols-2">
        <legend className="sr-only">Quién contrata</legend>
        {TIPOS.map(([clave, rotulo, ayuda]) => (
          <label
            key={clave}
            className={`flex items-start gap-3 p-4 border cursor-pointer ${d.tipo === clave ? 'border-tinta bg-white' : 'border-[rgba(27,31,27,0.18)] hover:border-tinta'}`}
          >
            <input type="radio" name={nombreGrupo} checked={d.tipo === clave} onChange={() => alCambiar('tipo', clave)} className="mt-1 w-4 h-4 accent-[#173A2F] shrink-0" />
            <span className="flex flex-col gap-0.5">
              <span className="text-sm font-medium">{rotulo}</span>
              <span className="text-xs text-piedra leading-[1.5]">{ayuda}</span>
            </span>
          </label>
        ))}
      </fieldset>

      {empresa ? (
        <>
          <div className="grid gap-5 tab:grid-cols-2">
            <Campo etiqueta="Razón social">
              <input required className={claseInput} value={d.nombre} maxLength={200} placeholder="Ejemplo S.A., Ejemplo LLC" onChange={(e) => alCambiar('nombre', e.target.value)} />
            </Campo>
            <Campo etiqueta="Identificación fiscal" ayuda="Escribí el tipo y el número, tal como va en el contrato.">
              <input className={claseInput} value={d.id_fiscal} maxLength={60} placeholder="CUIT 30-71234567-8, EIN 12-3456789, RUT, RFC, NIF…" onChange={(e) => alCambiar('id_fiscal', e.target.value)} />
            </Campo>
            <div className="tab:col-span-2">
              <Campo etiqueta="Domicilio de la empresa" ayuda="Calle, número, localidad, provincia o estado y país. Va en el contrato.">
                <input className={claseInput} value={d.domicilio} maxLength={300} onChange={(e) => alCambiar('domicilio', e.target.value)} />
              </Campo>
            </div>
          </div>
          <div className="pt-5 flex flex-col gap-5" style={{ borderTop: '1px solid rgba(27,31,27,0.15)' }}>
            <p className="eyebrow text-piedra">Representante · firma el contrato</p>
            <div className="grid gap-5 tab:grid-cols-2">
              <Campo etiqueta="Nombre completo">
                <input required className={claseInput} value={d.representante} maxLength={160} onChange={(e) => alCambiar('representante', e.target.value)} />
              </Campo>
              <Campo etiqueta="Cargo">
                <input className={claseInput} value={d.cargo} maxLength={120} placeholder="Director, socio gerente, apoderado…" onChange={(e) => alCambiar('cargo', e.target.value)} />
              </Campo>
              <Campo etiqueta="DNI o documento">
                <input className={claseInput} value={d.dni} onChange={(e) => alCambiar('dni', e.target.value)} />
              </Campo>
              {contacto}
            </div>
          </div>
        </>
      ) : (
        <div className="grid gap-5 tab:grid-cols-2">
          <Campo etiqueta="Nombre completo">
            <input required className={claseInput} value={d.nombre} onChange={(e) => alCambiar('nombre', e.target.value)} />
          </Campo>
          <Campo etiqueta="DNI o documento">
            <input className={claseInput} value={d.dni} onChange={(e) => alCambiar('dni', e.target.value)} />
          </Campo>
          {contacto}
          <div className="tab:col-span-2">
            <Campo etiqueta="Domicilio" ayuda="Calle, número, localidad, provincia o estado y país. Va en el contrato.">
              <input className={claseInput} value={d.domicilio} maxLength={300} onChange={(e) => alCambiar('domicilio', e.target.value)} />
            </Campo>
          </div>
        </div>
      )}
    </div>
  );
};

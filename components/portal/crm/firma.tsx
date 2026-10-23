import React, { useEffect, useState } from 'react';
import { Check, ClipboardCopy } from 'lucide-react';

/** Copiar al portapapeles, con el botón que se usa en el CRM y en el panel. */

export async function copiarAlPortapapeles(texto: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    // Respaldo para navegadores que no dan acceso al portapapeles.
    try {
      const area = document.createElement('textarea');
      area.value = texto;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand('copy');
      area.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

/** Botón de portapapeles. En la tabla va solo el ícono, en la ficha con texto. */
export const BotonCopiar: React.FC<{ texto: string; etiqueta?: string; descripcion: string; variante?: 'icono' | 'claro' }> = ({ texto, etiqueta, descripcion, variante = 'icono' }) => {
  const [estado, setEstado] = useState<'' | 'ok' | 'error'>('');

  useEffect(() => {
    if (!estado) return;
    const t = window.setTimeout(() => setEstado(''), 2000);
    return () => window.clearTimeout(t);
  }, [estado]);

  const Icono = estado === 'ok' ? Check : ClipboardCopy;
  const clase =
    variante === 'icono'
      ? `inline-flex items-center justify-center w-9 h-9 border transition-colors duration-150 ${estado === 'ok' ? 'border-bosque bg-bosque text-marfil' : 'border-[rgba(27,31,27,0.22)] bg-white text-tinta hover:border-tinta'}`
      : 'inline-flex items-center gap-2 h-11 px-5 bg-marfil text-tinta text-sm font-medium transition-colors duration-150 hover:bg-white';

  return (
    <button
      type="button"
      title={estado === 'ok' ? 'Copiado' : descripcion}
      aria-label={descripcion}
      onClick={async (e) => {
        e.stopPropagation();
        setEstado((await copiarAlPortapapeles(texto)) ? 'ok' : 'error');
      }}
      className={clase}
    >
      <Icono size={variante === 'icono' ? 16 : 16} aria-hidden="true" />
      {variante !== 'icono' && (estado === 'ok' ? 'Copiado' : estado === 'error' ? 'No se pudo copiar' : etiqueta)}
      <span className="sr-only" aria-live="polite">
        {estado === 'ok' ? 'Link copiado' : estado === 'error' ? 'No se pudo copiar el link' : ''}
      </span>
    </button>
  );
};

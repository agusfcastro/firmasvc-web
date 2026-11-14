import React from 'react';

/**
 * Red de contención del portal. Sin esto, un error al dibujar una pantalla o un
 * paquete que no baja dejaba la página en blanco.
 *
 * Caso típico: se publica una versión nueva mientras alguien tiene el portal
 * abierto. Los paquetes viejos ya no existen en el servidor y, al entrar a una
 * sección, la descarga falla. Ahí se recarga sola, una vez, para traer la
 * versión nueva. Si vuelve a fallar, se muestra el aviso con el botón.
 */
const CLAVE_RECARGA = 'firma.recarga-por-version';

const esFalloDePaquete = (e: unknown): boolean =>
  /dynamically imported module|importing a module script failed|failed to fetch|chunk|error loading/i.test(String((e as Error | undefined)?.message ?? e));

function yaRecargo(): boolean {
  try {
    const t = Number(window.sessionStorage.getItem(CLAVE_RECARGA));
    return Boolean(t) && Date.now() - t < 60_000;
  } catch {
    // Sin almacenamiento no hay cómo saber si ya se recargó: mejor no entrar en un bucle.
    return true;
  }
}

interface Props {
  children: React.ReactNode;
  /** Qué mostrar si falla. Sin esto, la pantalla completa con el botón de recargar. null = no mostrar nada. */
  respaldo?: React.ReactNode;
}

export class LimiteError extends React.Component<Props, { fallo: boolean; recargando: boolean }> {
  state = { fallo: false, recargando: false };

  static getDerivedStateFromError() {
    return { fallo: true };
  }

  componentDidCatch(error: unknown) {
    if (!esFalloDePaquete(error) || yaRecargo()) return;
    try {
      window.sessionStorage.setItem(CLAVE_RECARGA, String(Date.now()));
    } catch {
      return;
    }
    this.setState({ recargando: true });
    window.location.reload();
  }

  render() {
    if (!this.state.fallo) return this.props.children;
    if (this.props.respaldo !== undefined) return this.props.respaldo;
    return (
      <div className="portal min-h-screen bg-marfil text-tinta grid place-items-center px-6" role="alert">
        <div className="max-w-[440px] flex flex-col items-start gap-4">
          <p className="p-volanta text-piedra">Portal de clientes</p>
          <h1 className="p-titulo">{this.state.recargando ? 'Actualizando el portal…' : 'Algo no cargó bien'}</h1>
          {!this.state.recargando && (
            <>
              <p className="text-piedra text-[15px] leading-[1.55]">
                No pudimos mostrar esta pantalla. Tus datos están a salvo. Recargá la página y, si sigue pasando, escribinos a agustin@firmasvc.com.
              </p>
              <div className="flex flex-wrap gap-3">
                <button type="button" onClick={() => window.location.reload()} className="h-11 px-5 rounded-control bg-tinta text-marfil text-[14.5px] font-medium hover:bg-grafito">
                  Recargar
                </button>
                <a href="/portal" className="h-11 px-5 inline-flex items-center rounded-control border border-borde-suave bg-papel text-[14.5px] font-medium hover:border-tinta">
                  Ir al inicio
                </a>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }
}

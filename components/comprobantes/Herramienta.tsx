import React, { useEffect, useState } from 'react';
import '@fontsource-variable/archivo/wdth.css';
import { Download, RotateCcw, Upload, X } from 'lucide-react';
import { Button, DensidadBotones } from '../Button';
import { Logo as LogoFirma } from '../Logo';
import { Aviso } from '../portal/ui';
import { datosNuevos, faltantes, numeroVisible, parteVacia, type DatosComprobante, type TipoComprobante } from './modelo';
import { descargar, generarPdf, logoParaPdf, nombreArchivo, type Logo } from './pdf';
import { Editor } from './Editor';

/**
 * Generador público de invoices y recibos. /herramientas/invoice y
 * /herramientas/recibo. Sin cuenta y sin guardar nada en FIRMA: los datos
 * del emisor, el logo y el último número quedan solo en este navegador.
 * No se indexa (vercel.json); se comparte por enlace.
 */
const CLAVE = 'firma-herramientas-comprobantes';

interface Recordado {
  emisor?: DatosComprobante['emisor'];
  pie?: string;
  moneda?: string;
  idioma?: Partial<Record<TipoComprobante, DatosComprobante['idioma']>>;
  numero?: Partial<Record<TipoComprobante, string>>;
  logo?: string | null;
}

function leer(): Recordado {
  try {
    return JSON.parse(window.localStorage.getItem(CLAVE) || '{}') as Recordado;
  } catch {
    return {};
  }
}

function guardar(r: Recordado) {
  try {
    window.localStorage.setItem(CLAVE, JSON.stringify({ ...leer(), ...r }));
  } catch {
    /* sin almacenamiento: la herramienta funciona igual */
  }
}

/** 0007 pasa a 0008; INV-12 a INV-13. Lo que no termina en número queda igual. */
function siguiente(n: string): string {
  const m = /^(.*?)(\d+)$/.exec(n.trim());
  if (!m) return n;
  return m[1] + String(Number(m[2]) + 1).padStart(m[2].length, '0');
}

function inicial(tipo: TipoComprobante): { datos: DatosComprobante; numero: string } {
  const r = leer();
  return {
    datos: datosNuevos(tipo, {
      emisor: { ...parteVacia(), ...r.emisor },
      pie: r.pie ?? '',
      moneda: r.moneda ?? 'USD',
      ...(r.idioma?.[tipo] ? { idioma: r.idioma[tipo] } : {}),
    }),
    numero: r.numero?.[tipo] ?? numeroVisible(1),
  };
}

const Herramienta: React.FC<{ tipo: TipoComprobante }> = ({ tipo }) => {
  const [estado, setEstado] = useState(() => inicial(tipo));
  const [logoUrl, setLogoUrl] = useState<string | null>(() => leer().logo ?? null);
  const [logo, setLogo] = useState<Logo | null>(null);
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);
  const [bajando, setBajando] = useState(false);
  const { datos, numero } = estado;

  useEffect(() => setEstado(inicial(tipo)), [tipo]);

  useEffect(() => {
    document.title = tipo === 'invoice' ? 'Generador de invoices · FIRMA' : 'Generador de recibos · FIRMA';
    // El encabezado X-Robots-Tag ya lo pide; esto cubre a quien lea solo el HTML.
    const meta = document.querySelector('meta[name="robots"]');
    const previo = meta?.getAttribute('content');
    meta?.setAttribute('content', 'noindex, nofollow');
    return () => {
      if (previo) meta?.setAttribute('content', previo);
    };
  }, [tipo]);

  useEffect(() => {
    let vigente = true;
    if (!logoUrl) return setLogo(null);
    logoParaPdf(logoUrl).then((l) => vigente && setLogo(l));
    return () => {
      vigente = false;
    };
  }, [logoUrl]);

  // Lo del emisor se recuerda mientras se escribe, para la próxima vez.
  useEffect(() => {
    guardar({ emisor: datos.emisor, pie: datos.pie, moneda: datos.moneda, idioma: { ...leer().idioma, [tipo]: datos.idioma } });
  }, [datos.emisor, datos.pie, datos.moneda, datos.idioma, tipo]);

  async function elegirLogo(archivo: File | undefined) {
    if (!archivo) return;
    if (!/^image\/(png|jpeg|webp|svg\+xml)$/.test(archivo.type)) return setAviso({ tipo: 'error', texto: 'El logo tiene que ser PNG, JPG, WEBP o SVG.' });
    if (archivo.size > 2 * 1024 * 1024) return setAviso({ tipo: 'error', texto: 'El logo no puede pesar más de 2 MB.' });
    const original = await new Promise<string>((r) => {
      const lector = new FileReader();
      lector.onload = () => r(String(lector.result));
      lector.readAsDataURL(archivo);
    });
    // Se guarda achicado, así entra en el almacenamiento del navegador.
    const chico = await logoParaPdf(original);
    if (!chico) return setAviso({ tipo: 'error', texto: 'No pudimos leer esa imagen. Probá con otra.' });
    const url = `data:image/png;base64,${btoa(Array.from(chico.bytes, (b) => String.fromCharCode(b)).join(''))}`;
    setAviso(null);
    setLogoUrl(url);
    guardar({ logo: url });
  }

  function quitarLogo() {
    setLogoUrl(null);
    guardar({ logo: null });
  }

  async function bajar() {
    setBajando(true);
    try {
      const bytes = await generarPdf(datos, { numero, logo, marca: true });
      descargar(bytes, nombreArchivo(datos, numero));
      const proximo = siguiente(numero);
      guardar({ numero: { ...leer().numero, [tipo]: proximo } });
      setAviso({ tipo: 'ok', texto: `Listo, se descargó ${tipo === 'invoice' ? 'el invoice' : 'el recibo'} ${numero}. El próximo queda con el número ${proximo}.` });
    } catch {
      setAviso({ tipo: 'error', texto: 'No pudimos armar el PDF. Revisá los datos e intentá de nuevo.' });
    } finally {
      setBajando(false);
    }
  }

  function otro() {
    setEstado({ datos: { ...datosNuevos(tipo, { emisor: datos.emisor, pie: datos.pie, moneda: datos.moneda, idioma: datos.idioma }) }, numero: leer().numero?.[tipo] ?? siguiente(numero) });
    setAviso(null);
    window.scrollTo(0, 0);
  }

  const pendientes = faltantes(datos);

  return (
    <DensidadBotones.Provider value="compacta">
      <div className="min-h-screen bg-marfil text-tinta flex flex-col">
        <header className="bg-marfil border-b border-tinta/12">
          <div className="wrap flex items-center justify-between gap-6 h-20">
            <a href="/" aria-label="Ir a firmasvc.com">
              <LogoFirma className="h-[40px] desk:h-[48px] max-w-[52vw]" />
            </a>
            <nav className="flex gap-1 text-[14px] font-medium" aria-label="Herramientas">
              {(['invoice', 'recibo'] as const).map((t) => (
                <a
                  key={t}
                  href={`/herramientas/${t}`}
                  aria-current={t === tipo ? 'page' : undefined}
                  className={`px-3 py-2 rounded-control ${t === tipo ? 'bg-tinta text-marfil' : 'text-piedra hover:text-tinta'}`}
                >
                  {t === 'invoice' ? 'Invoice' : 'Recibo'}
                </a>
              ))}
            </nav>
          </div>
        </header>

        <main className="flex-1 wrap py-10 desk:py-14 flex flex-col gap-8">
          <div className="flex flex-col gap-3 max-w-[760px]">
            <p className="eyebrow text-piedra">Herramienta gratuita de FIRMA</p>
            <h1 className="text-[34px] desk:text-[44px] font-bold leading-[1.05] tracking-[-0.02em]">{tipo === 'invoice' ? 'Generador de invoices' : 'Generador de recibos de dinero'}</h1>
            <p className="text-piedra text-[16px] leading-[1.5] max-w-[62ch]">
              {tipo === 'invoice'
                ? 'Completá los datos y descargá el PDF. Sirve para cobrarle a clientes del exterior o documentar un servicio.'
                : 'Completá los datos y descargá el PDF del recibo, con el monto en letras y lugar para la firma.'}{' '}
              Nada de lo que escribís sale de tu navegador.
            </p>
          </div>

          {aviso && <Aviso tipo={aviso.tipo}>{aviso.texto}</Aviso>}

          <Editor
            datos={datos}
            alCambiar={(d) => setEstado((e) => ({ ...e, datos: d }))}
            numero={numero}
            alCambiarNumero={(n) => {
              setEstado((e) => ({ ...e, numero: n }));
              guardar({ numero: { ...leer().numero, [tipo]: n } });
            }}
            ayudaNumero="Al descargar, el siguiente queda listo en este navegador."
            emisorEditable
            ayudaEmisor="Quedan guardados en este navegador para la próxima vez."
            despuesEmisor={
              <div className="flex flex-wrap items-center gap-3">
                {logoUrl && <img src={logoUrl} alt="Logo" className="h-11 w-auto max-w-[160px] object-contain bg-white border border-borde-suave rounded-control p-1.5" />}
                <label className="inline-flex items-center gap-2 h-9 px-3.5 text-[13.5px] font-medium border border-borde-suave bg-papel rounded-control cursor-pointer hover:border-tinta">
                  <Upload size={15} /> {logoUrl ? 'Cambiar logo' : 'Subir logo'}
                  <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="sr-only" onChange={(e) => void elegirLogo(e.target.files?.[0])} />
                </label>
                {logoUrl && (
                  <Button type="button" variant="ghost" size="sm" onClick={quitarLogo}>
                    <X size={15} /> Quitar
                  </Button>
                )}
              </div>
            }
            logo={logo}
            marca
            acciones={
              <>
                <Button type="button" onClick={() => void bajar()} disabled={bajando || pendientes.length > 0}>
                  <Download size={17} /> {bajando ? 'Armando el PDF' : 'Descargar PDF'}
                </Button>
                <Button type="button" variant="ghost" onClick={otro}>
                  <RotateCcw size={16} /> Empezar otro
                </Button>
              </>
            }
          />

          <p className="text-[12.5px] text-piedra leading-[1.5] max-w-[80ch] pt-6 border-t border-borde-suave">
            {tipo === 'invoice'
              ? 'Este invoice es un documento comercial. No reemplaza la factura electrónica que exija la autoridad fiscal de tu país (en la Argentina, la de ARCA).'
              : 'Este recibo documenta un pago entre partes. Si tu actividad te obliga a emitir comprobantes fiscales electrónicos, no los reemplaza.'}{' '}
            ¿Necesitás ordenar los contratos y la cobranza de tu negocio?{' '}
            <a href="/" className="underline underline-offset-2 hover:text-bosque">
              Conocé FIRMA
            </a>
            .
          </p>
        </main>
      </div>
    </DensidadBotones.Provider>
  );
};

export default Herramienta;

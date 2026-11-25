/**
 * Tipografías de los Word que se ven en el portal (visor y editor).
 *
 * docx-preview pide cada letra por su nombre (Archivo, Calibri). El navegador
 * solo la encuentra si está instalada en la compu, y Office para Mac guarda las
 * suyas adentro de la app, así que Chrome y Safari no las ven y caían en Times.
 * Acá cada nombre apunta primero a la letra instalada y, si no está, a una
 * copia alojada en firmasvc.com:
 *   Archivo   la misma Archivo variable de los mails (/mail/archivo.woff2)
 *   Calibri   Carlito, que tiene las mismas medidas, así el texto corta igual
 * Se carga una sola vez y solo en las pantallas que muestran un Word.
 */
const ID = 'fuentes-documentos';

const CARLITO = [
  ['400', 'normal'],
  ['400', 'italic'],
  ['700', 'normal'],
  ['700', 'italic'],
] as const;

function reglas(): string {
  const archivo = `@font-face{font-family:'Archivo';font-style:normal;font-weight:100 900;font-stretch:62% 125%;font-display:swap;src:local('Archivo'),url(/mail/archivo.woff2) format('woff2')}`;
  // Calibri Light es el título del tema de Office. Carlito no tiene versión fina, se usa la normal.
  const calibri = ['Calibri', 'Calibri Light', 'Carlito']
    .flatMap((familia) =>
      CARLITO.map(
        ([peso, estilo]) =>
          `@font-face{font-family:'${familia}';font-style:${estilo};font-weight:${peso};font-display:swap;src:local('${familia}${peso === '700' ? ' Bold' : ''}${estilo === 'italic' ? ' Italic' : ''}'),url(/fuentes/carlito-${peso}-${estilo}.woff2) format('woff2')}`,
      ),
    )
    .join('');
  return archivo + calibri;
}

export function cargarFuentesDocumentos(): void {
  if (typeof document === 'undefined' || document.getElementById(ID)) return;
  const estilo = document.createElement('style');
  estilo.id = ID;
  estilo.textContent = reglas();
  document.head.appendChild(estilo);
}

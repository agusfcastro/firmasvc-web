export const CALENDLY_URL = 'https://calendly.com/agustinlegales/30min';

const BASE = 'https://assets.calendly.com/assets/external/widget';
let cargando: Promise<void> | null = null;

/**
 * Carga el script y el CSS de Calendly una sola vez, recién cuando alguien
 * quiere agendar. Así no bloquean el primer render de ninguna página.
 */
function cargarCalendly(): Promise<void> {
  if (window.Calendly) return Promise.resolve();
  if (!cargando) {
    cargando = new Promise<void>((resolve, reject) => {
      const css = document.createElement('link');
      css.rel = 'stylesheet';
      css.href = `${BASE}.css`;
      document.head.appendChild(css);
      const js = document.createElement('script');
      js.src = `${BASE}.js`;
      js.async = true;
      js.onload = () => resolve();
      js.onerror = () => {
        cargando = null;
        reject(new Error('No se pudo cargar Calendly'));
      };
      document.head.appendChild(js);
    });
  }
  return cargando;
}

/**
 * Opens the Calendly popup widget with brand-matched settings.
 * pageSettings is honored by Calendly's embed script and overrides
 * defaults set in the dashboard for this single booking flow.
 * Si el script no carga (bloqueador, red), abre Calendly en otra pestaña.
 */
export function openCalendly() {
  abrir();
}

/**
 * Abre Calendly desde /planes. El plan va como UTM, así figura en el detalle
 * de la reserva y en los reportes de Calendly.
 */
export function agendarPlan(plan: string) {
  abrir({ utmSource: 'planes', utmCampaign: `plan-${plan}` });
}

function abrir(utm?: Record<string, string>) {
  cargarCalendly()
    .then(() =>
      window.Calendly?.initPopupWidget({
        url: CALENDLY_URL,
        pageSettings: {
          backgroundColor: 'F5F3EC',
          hideEventTypeDetails: false,
          hideLandingPageDetails: false,
          primaryColor: '173A2F',
          textColor: '1B1F1B',
        },
        ...(utm ? { utm } : {}),
      }),
    )
    .catch(() => {
      const url = new URL(CALENDLY_URL);
      if (utm) Object.entries(utm).forEach(([k, v]) => url.searchParams.set(k.replace(/^utm(.)/, (_, c: string) => `utm_${c.toLowerCase()}`), v));
      window.open(url.toString(), '_blank', 'noopener');
    });
}

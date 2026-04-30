export const CALENDLY_URL = 'https://calendly.com/agustinlegales/30min';

/**
 * Opens the Calendly popup widget with brand-matched settings.
 * pageSettings is honored by Calendly's embed script and overrides
 * defaults set in the dashboard for this single booking flow.
 */
export function openCalendly() {
  window.Calendly?.initPopupWidget({
    url: CALENDLY_URL,
    pageSettings: {
      backgroundColor: 'ffffff',
      hideEventTypeDetails: false,
      hideLandingPageDetails: false,
      primaryColor: '4B6BFF',
      textColor: '111827',
    },
  });
}

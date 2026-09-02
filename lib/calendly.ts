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
      backgroundColor: 'F5F3EC',
      hideEventTypeDetails: false,
      hideLandingPageDetails: false,
      primaryColor: '173A2F',
      textColor: '1B1F1B',
    },
  });
}

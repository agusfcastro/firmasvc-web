import React from 'react';

declare global {
  interface Window {
    Calendly?: {
      initPopupWidget: (options: {
        url: string;
        pageSettings?: {
          backgroundColor?: string;
          hideEventTypeDetails?: boolean;
          hideLandingPageDetails?: boolean;
          hideGdprBanner?: boolean;
          primaryColor?: string;
          textColor?: string;
        };
        prefill?: {
          name?: string;
          email?: string;
          customAnswers?: Record<string, string>;
        };
        utm?: Record<string, string>;
      }) => void;
    };
  }
}

export interface ServiceItem {
  title: string;
  description: string;
  icon: React.ElementType;
}

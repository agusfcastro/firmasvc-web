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

export interface Testimonial {
  name: string;
  role: string;
  text: string;
  image: string;
}

export enum ImageSize {
  Size1K = '1K',
  Size2K = '2K',
  Size4K = '4K',
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
}
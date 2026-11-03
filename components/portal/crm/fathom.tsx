import React from 'react';
import { ExternalLink } from 'lucide-react';

/** Sección API Access de la configuración de Fathom, donde se crea el webhook. */
export const FATHOM_AJUSTES = 'https://fathom.video/customize#api-access-header';

/** URL del webhook de una integración, a partir de su token. */
export const urlWebhook = (token: string) => `${window.location.origin}/api/webhooks/fathom/${token}`;

/**
 * Pasos para cargar la URL en Fathom. Los usan la pantalla de Llamadas y la
 * página pública del enlace de conexión. Cada persona lo hace con su propia
 * cuenta de Fathom, también la gratuita.
 */
export const PasosFathom: React.FC = () => (
  <ol className="list-decimal pl-5 text-sm space-y-2">
    <li>
      Entrá a{' '}
      <a href={FATHOM_AJUSTES} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium underline underline-offset-4 hover:text-bosque">
        Fathom › Settings › API Access
        <ExternalLink size={13} aria-hidden="true" />
        <span className="sr-only">(se abre en otra pestaña)</span>
      </a>{' '}
      con tu cuenta y tocá <strong>Manage › Add Webhook</strong>.
    </li>
    <li>Pegá la URL de arriba como destino.</li>
    <li>
      En qué grabaciones lo disparan, elegí <strong>tus grabaciones</strong>. En qué datos incluir, marcá <strong>la transcripción</strong>.
    </li>
    <li>Guardá y copiá el secreto que muestra Fathom (empieza con whsec_). Pegalo acá abajo.</li>
    <li>Para probarlo, grabá una llamada corta de un par de minutos: aparece en el CRM cuando Fathom la termina de procesar.</li>
  </ol>
);

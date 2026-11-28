import React from 'react';
import { ArrowRight, FileSpreadsheet, FolderOpen, MessageCircle, PenTool, Receipt, StickyNote } from 'lucide-react';
import { Reveal } from '../Reveal';

// «Lo que hoy tenés repartido»: lo que el portal junta. Sin nombrar marcas, y sin el CRM
// del cliente: el portal complementa al CRM que ya usan (Go High Level y afines).

const antes = [
  { icono: FolderOpen, texto: 'Contratos en carpetas compartidas' },
  { icono: PenTool, texto: 'Firmas en otra plataforma' },
  { icono: Receipt, texto: 'Cobros y cuotas en una planilla' },
  { icono: MessageCircle, texto: 'Consultas al abogado por WhatsApp' },
  { icono: FileSpreadsheet, texto: 'Reportes del equipo en Excel' },
  { icono: StickyNote, texto: 'Vencimientos en tu cabeza' },
];

export const Repartido: React.FC = () => (
  <section className="section bg-tinta text-marfil">
    <div className="wrap flex flex-col gap-12">
      <Reveal>
        <div className="flex flex-col items-center gap-4 max-w-[60ch] mx-auto text-center">
          <p className="eyebrow text-calido">Un solo lugar</p>
          <h2 className="h2">Hoy lo legal de tu negocio está en todos lados. Y en ningún lado.</h2>
          <p className="text-[17px] leading-[1.55] text-calido">
            Contratos en un Drive, firmas en otra app, cuotas en una planilla y las consultas perdidas en el WhatsApp. El día que un cliente no paga, nadie encuentra nada.
          </p>
        </div>
      </Reveal>

      <div className="grid grid-cols-1 desk:grid-cols-[1fr_auto_1fr] gap-6 desk:gap-10 items-center">
        <ul className="grid grid-cols-1 min-[480px]:grid-cols-2 gap-3">
          {antes.map((a, i) => (
            <li key={a.texto}>
              <Reveal delay={i * 60} className="h-full">
                <div className="repartido-item">
                  <a.icono size={18} strokeWidth={1.8} className="shrink-0" />
                  <span>{a.texto}</span>
                </div>
              </Reveal>
            </li>
          ))}
        </ul>

        <ArrowRight
          size={32}
          strokeWidth={1.5}
          className="mx-auto text-calido rotate-90 desk:rotate-0"
          aria-hidden="true"
        />

        <Reveal delay={200}>
          <div className="repartido-destino">
            <span className="eyebrow text-bosque-claro">El portal de FIRMA</span>
            <span className="font-heading font-black text-[clamp(24px,3vw,34px)] leading-[1.1] tracking-[-0.015em]">
              Cuando algo sale mal, tenés todo en un lugar.
            </span>
            <span className="text-[15px] leading-[1.6] text-lateral-texto">
              Y un abogado que ya conoce tu caso.
            </span>
          </div>
        </Reveal>
      </div>
    </div>
  </section>
);

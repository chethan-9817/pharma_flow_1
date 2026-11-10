import type { ReactNode } from 'react';
import type { Medicine, MedicineForm } from '../domain/types';

/**
 * Drawn product pictures. They are simple flat illustrations made here, not brand photos: real pack
 * shots are the brands' copyrighted images, and the app has to work offline with no image service.
 * Each item gets a shape that matches what it is (a blister strip, a dropper bottle, a toothbrush …)
 * in its own colour.
 */
type Kind =
  | 'strip'
  | 'capsules'
  | 'syrup'
  | 'pillbottle'
  | 'tube'
  | 'jar'
  | 'dropper'
  | 'pump'
  | 'pack'
  | 'toothbrush'
  | 'syringe'
  | 'bandage'
  | 'thermometer'
  | 'box'
  | 'sachet'
  | 'antiseptic';

const ART: Record<string, [Kind, string]> = {
  'med-dolo650': ['strip', '#2563EB'],
  'med-augmentin': ['strip', '#9333EA'],
  'med-pand': ['capsules', '#B45309'],
  'med-okacet': ['strip', '#0891B2'],
  'med-azithral500': ['strip', '#16A34A'],
  'med-shelcal500': ['strip', '#EA580C'],
  'med-becosules': ['capsules', '#DC2626'],
  'med-benadryl': ['syrup', '#B91C1C'],
  'med-electral': ['sachet', '#F97316'],
  'med-volini': ['tube', '#E11D48'],
  'med-limcee': ['strip', '#F59E0B'],
  'med-accuchek': ['box', '#16A34A'],
  'med-crocin': ['strip', '#E11D48'],
  'med-allegra': ['strip', '#7C3AED'],
  'med-glycomet': ['strip', '#0284C7'],
  'med-telma40': ['strip', '#059669'],
  'med-thyronorm': ['pillbottle', '#0F766E'],
  'med-digene': ['strip', '#15803D'],
  'med-betadine': ['tube', '#92400E'],
  'med-cifran': ['strip', '#1D4ED8'],
  'med-calpol': ['syrup', '#DB2777'],
  'med-omez': ['capsules', '#7C3AED'],
  'med-vicks': ['jar', '#1E40AF'],
  'med-strepsils': ['strip', '#CA8A04'],
  'med-liv52': ['pillbottle', '#15803D'],
  'med-revital': ['capsules', '#C2410C'],
  'med-pantocid': ['strip', '#0369A1'],
  'med-montairlc': ['strip', '#4F46E5'],
  'med-ecosprin': ['strip', '#BE123C'],
  'med-zincovit': ['strip', '#0D9488'],
  'prd-whisper': ['pack', '#7C3AED'],
  'prd-stayfree': ['pack', '#DB2777'],
  'prd-neutrogena-spf': ['tube', '#F59E0B'],
  'prd-lakme-spf': ['tube', '#EC4899'],
  'prd-minimalist-serum': ['dropper', '#0D9488'],
  'prd-dermaco-vitc': ['dropper', '#EA580C'],
  'prd-cetaphil': ['pump', '#2563EB'],
  'prd-himalaya-facewash': ['tube', '#16A34A'],
  'prd-colgate-brush': ['toothbrush', '#DC2626'],
  'prd-oralb-brush': ['toothbrush', '#2563EB'],
  'prd-sensodyne': ['tube', '#0284C7'],
  'prd-pampers': ['pack', '#10B981'],
  'prd-dispovan': ['syringe', '#0284C7'],
  'prd-hansaplast': ['bandage', '#D97706'],
  'prd-dettol': ['antiseptic', '#15803D'],
  'prd-thermometer': ['thermometer', '#0EA5E9'],
};

/** For items added later without their own picture: a shape from the form, a colour from the id. */
const BY_FORM: Record<MedicineForm, Kind> = {
  TABLET: 'strip',
  CAPSULE: 'capsules',
  SYRUP: 'syrup',
  GEL: 'tube',
  CREAM: 'tube',
  SACHET: 'sachet',
  DEVICE: 'box',
  LIQUID: 'pump',
  PAD: 'pack',
};
const PALETTE = ['#2563EB', '#16A34A', '#9333EA', '#EA580C', '#0891B2', '#DB2777', '#CA8A04', '#0D9488'];
const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

function artFor(m: Pick<Medicine, 'id' | 'form'>): [Kind, string] {
  return ART[m.id] ?? [BY_FORM[m.form], PALETTE[hash(m.id) % PALETTE.length]!];
}

const INK = '#1F2937';
const STEEL = '#94A3B8';

/** White label with two coloured lines, the "text" on a pack. */
const Label = ({ x, y, w, h, c }: { x: number; y: number; w: number; h: number; c: string }) => (
  <g>
    <rect x={x} y={y} width={w} height={h} rx={2.5} fill="#fff" />
    <rect x={x + 4} y={y + h * 0.3} width={w - 8} height={2.6} rx={1.3} fill={c} />
    <rect x={x + 4} y={y + h * 0.62} width={(w - 8) * 0.6} height={2.2} rx={1.1} fill={c} opacity={0.45} />
  </g>
);

function shape(kind: Kind, c: string): ReactNode {
  switch (kind) {
    case 'strip':
    case 'capsules':
      return (
        <g transform="rotate(-14 48 48)">
          <rect x={16} y={26} width={64} height={46} rx={7} fill="#E5E7EB" stroke="#CBD5E1" strokeWidth={1.5} />
          <rect x={16} y={26} width={64} height={11} rx={7} fill={c} />
          <rect x={16} y={31} width={64} height={6} fill={c} />
          {[0, 1].map((r) =>
            [0, 1, 2].map((i) =>
              kind === 'strip' ? (
                <circle key={`${r}${i}`} cx={30 + i * 18} cy={48 + r * 14} r={5.6} fill="#fff" stroke={c} strokeWidth={2} />
              ) : (
                <g key={`${r}${i}`} transform={`translate(${23 + i * 18} ${44 + r * 14})`}>
                  <rect width={14} height={7} rx={3.5} fill="#fff" stroke={c} strokeWidth={1.5} />
                  <rect width={7} height={7} rx={3.5} fill={c} />
                  <rect x={4} width={3} height={7} fill={c} />
                </g>
              ),
            ),
          )}
        </g>
      );
    case 'syrup':
      return (
        <g>
          <rect x={38} y={12} width={20} height={11} rx={2.5} fill={INK} />
          <path d="M37 23h22v6c7 3 10 8 10 14v33a6 6 0 0 1-6 6H33a6 6 0 0 1-6-6V43c0-6 3-11 10-14z" fill={c} />
          <path d="M37 23h22v6c7 3 10 8 10 14v33a6 6 0 0 1-6 6H48V23z" fill="#000" opacity={0.1} />
          <Label x={31} y={48} w={34} h={20} c={c} />
        </g>
      );
    case 'pillbottle':
      return (
        <g>
          <rect x={30} y={16} width={36} height={14} rx={3} fill={c} />
          <rect x={30} y={18} width={36} height={3} fill="#000" opacity={0.12} />
          <rect x={27} y={30} width={42} height={52} rx={8} fill="#F8FAFC" stroke="#CBD5E1" strokeWidth={1.5} />
          <rect x={27} y={42} width={42} height={26} fill={c} opacity={0.9} />
          <rect x={33} y={48} width={30} height={14} rx={2.5} fill="#fff" />
          <rect x={37} y={53} width={22} height={2.6} rx={1.3} fill={c} />
        </g>
      );
    case 'tube':
      return (
        <g transform="rotate(-24 48 48)">
          <rect x={30} y={13} width={36} height={7} rx={2} fill={c} />
          <rect x={30} y={13} width={36} height={7} rx={2} fill="#000" opacity={0.2} />
          <path d="M30 20h36l-5 52H35z" fill={c} />
          <path d="M48 20h18l-5 52H48z" fill="#000" opacity={0.08} />
          <Label x={37} y={34} w={22} h={22} c={c} />
          <rect x={39} y={72} width={18} height={12} rx={2.5} fill={INK} />
        </g>
      );
    case 'jar':
      return (
        <g>
          <rect x={24} y={28} width={48} height={14} rx={4} fill={c} />
          <rect x={24} y={28} width={48} height={14} rx={4} fill="#000" opacity={0.25} />
          <rect x={26} y={40} width={44} height={38} rx={7} fill={c} />
          <rect x={48} y={40} width={22} height={38} rx={7} fill="#000" opacity={0.1} />
          <Label x={32} y={50} w={32} h={18} c={c} />
        </g>
      );
    case 'dropper':
      return (
        <g>
          <path d="M43 30V18a5 5 0 0 1 10 0v12z" fill={INK} />
          <rect x={39} y={30} width={18} height={11} rx={2} fill="#E5E7EB" stroke="#CBD5E1" />
          <rect x={31} y={41} width={34} height={42} rx={7} fill={c} />
          <rect x={48} y={41} width={17} height={42} rx={7} fill="#000" opacity={0.1} />
          <Label x={36} y={53} w={24} h={18} c={c} />
        </g>
      );
    case 'pump':
      return (
        <g>
          <path d="M45 26v-9h16v5H51v4z" fill="#E5E7EB" stroke="#CBD5E1" />
          <rect x={41} y={26} width={14} height={9} rx={2} fill="#E5E7EB" stroke="#CBD5E1" />
          <rect x={29} y={35} width={38} height={48} rx={9} fill={c} />
          <rect x={48} y={35} width={19} height={48} rx={9} fill="#000" opacity={0.1} />
          <Label x={35} y={48} w={26} h={22} c={c} />
        </g>
      );
    case 'pack':
      return (
        <g>
          <rect x={36} y={14} width={24} height={10} rx={4} fill="none" stroke={c} strokeWidth={4} />
          <rect x={18} y={22} width={60} height={60} rx={11} fill={c} />
          <path d="M18 58c10-8 20-8 30 0s20 8 30 0v12c-10 8-20 8-30 0s-20-8-30 0z" fill="#fff" opacity={0.3} />
          <rect x={28} y={32} width={40} height={14} rx={3} fill="#fff" />
          <rect x={33} y={37.5} width={30} height={3} rx={1.5} fill={c} />
          <circle cx={48} cy={60} r={6} fill="#fff" opacity={0.9} />
        </g>
      );
    case 'toothbrush':
      return (
        <g transform="rotate(-38 48 48)">
          <rect x={44} y={34} width={9} height={54} rx={4.5} fill={c} />
          <rect x={48} y={34} width={5} height={54} rx={2.5} fill="#000" opacity={0.12} />
          <rect x={45.5} y={10} width={6} height={26} rx={3} fill={c} />
          <rect x={36} y={11} width={10} height={20} rx={2} fill="#E0F2FE" stroke="#7DD3FC" strokeWidth={1} />
          {[14, 18, 22, 26].map((y) => (
            <line key={y} x1={37} x2={45} y1={y} y2={y} stroke="#38BDF8" strokeWidth={1} />
          ))}
        </g>
      );
    case 'syringe':
      return (
        <g transform="rotate(-42 48 48)">
          <rect x={47} y={8} width={2} height={16} fill="#64748B" />
          <rect x={44} y={22} width={8} height={6} rx={1} fill={c} />
          <rect x={41} y={28} width={14} height={40} rx={2} fill="#fff" stroke={STEEL} strokeWidth={2} />
          <rect x={43} y={44} width={10} height={22} fill={c} opacity={0.55} />
          {[34, 40, 46, 52, 58].map((y) => (
            <line key={y} x1={41} x2={46} y1={y} y2={y} stroke={STEEL} strokeWidth={1.2} />
          ))}
          <rect x={36} y={67} width={24} height={4} rx={1.5} fill={STEEL} />
          <rect x={46} y={71} width={4} height={12} fill="#64748B" />
          <rect x={40} y={83} width={16} height={4} rx={1.5} fill="#64748B" />
        </g>
      );
    case 'bandage':
      return (
        <g transform="rotate(-32 48 48)">
          <rect x={14} y={37} width={68} height={22} rx={11} fill={c} />
          <rect x={14} y={37} width={68} height={22} rx={11} fill="#fff" opacity={0.25} />
          <rect x={37} y={39} width={22} height={18} rx={3} fill="#FDE68A" />
          {[22, 28, 34, 62, 68, 74].map((x) => (
            <circle key={x} cx={x} cy={48} r={1.2} fill="#fff" opacity={0.8} />
          ))}
        </g>
      );
    case 'thermometer':
      return (
        <g transform="rotate(-36 48 48)">
          <rect x={39} y={10} width={18} height={60} rx={9} fill="#fff" stroke={STEEL} strokeWidth={2} />
          <rect x={42} y={18} width={12} height={15} rx={2} fill="#0F172A" />
          <rect x={44} y={22} width={8} height={2.5} rx={1} fill="#4ADE80" />
          <rect x={44} y={27} width={5} height={2.5} rx={1} fill="#4ADE80" />
          <circle cx={48} cy={44} r={4} fill={c} />
          <rect x={45} y={68} width={6} height={18} rx={3} fill={STEEL} />
        </g>
      );
    case 'box':
      return (
        <g>
          <path d="M20 34 48 23l28 11-28 11z" fill={c} />
          <path d="M20 34 48 23l28 11-28 11z" fill="#fff" opacity={0.35} />
          <path d="M20 34l28 11v36L20 70z" fill={c} />
          <path d="M76 34 48 45v36l28-11z" fill={c} />
          <path d="M76 34 48 45v36l28-11z" fill="#000" opacity={0.18} />
          <path d="M25 46l18 7v10l-18-7z" fill="#fff" />
        </g>
      );
    case 'sachet':
      return (
        <g transform="rotate(-10 48 48)">
          <path
            d="M24 18l4 4 4-4 4 4 4-4 4 4 4-4 4 4 4-4 4 4 4-4 4 4v56l-4-4-4 4-4-4-4 4-4-4-4 4-4-4-4 4-4-4-4 4-4-4-4 4z"
            fill={c}
          />
          <Label x={30} y={36} w={36} h={24} c={c} />
        </g>
      );
    case 'antiseptic':
      return (
        <g>
          <rect x={40} y={12} width={16} height={10} rx={2} fill="#F8FAFC" stroke="#CBD5E1" />
          <path d="M40 22h16v6l8 8v42a6 6 0 0 1-6 6H38a6 6 0 0 1-6-6V36l8-8z" fill={c} />
          <path d="M48 22h8v6l8 8v42a6 6 0 0 1-6 6H48z" fill="#000" opacity={0.12} />
          <circle cx={48} cy={58} r={11} fill="#fff" />
          <path d="M43 53h10l-5 10z" fill={c} />
        </g>
      );
  }
}

/** A product picture on a soft tile in the product's own colour. */
export function ProductArt({ medicine, className = 'size-16' }: { medicine: Pick<Medicine, 'id' | 'form'>; className?: string }) {
  const [kind, color] = artFor(medicine);
  return (
    <span aria-hidden className={`grid shrink-0 place-items-center overflow-hidden rounded-xl ${className}`} style={{ background: `${color}1A` }}>
      <svg viewBox="0 0 96 96" className="size-[86%]">
        {shape(kind, color)}
      </svg>
    </span>
  );
}

import type { ButtonHTMLAttributes, ComponentType, HTMLAttributes, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { ExpiryBucket } from '../domain/rules/expiry';

const cx = (...parts: (string | false | undefined)[]) => parts.filter(Boolean).join(' ');

/**
 * solid: primary, eco, danger (one main action per view).
 * soft: tinted versions for repeated or secondary actions, so a list of them stays calm.
 * ghost: white with a hairline border.
 */
type Variant = 'primary' | 'soft' | 'eco' | 'ecoSoft' | 'danger' | 'dangerSoft' | 'amber' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-medical text-white hover:bg-medical-dark focus-visible:ring-medical/30',
  soft: 'bg-medical-tint text-medical-dark ring-1 ring-inset ring-medical-ring hover:bg-sky-200/70 focus-visible:ring-medical/30',
  eco: 'bg-eco text-white hover:bg-eco-dark focus-visible:ring-eco/30',
  ecoSoft: 'bg-eco-tint text-eco-dark ring-1 ring-inset ring-emerald-300/70 hover:bg-emerald-200/70 focus-visible:ring-eco/30',
  danger: 'bg-blood text-white hover:bg-rose-800 focus-visible:ring-blood/30',
  dangerSoft: 'bg-blood-tint text-blood ring-1 ring-inset ring-rose-300/70 hover:bg-rose-200/70 focus-visible:ring-blood/30',
  amber: 'bg-expiry-tint text-expiry-ink ring-1 ring-inset ring-amber-300/70 hover:bg-amber-200/70 focus-visible:ring-expiry/30',
  ghost: 'bg-white text-slate-700 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 focus-visible:ring-slate-300/60',
};

const SIZES: Record<Size, string> = {
  sm: 'h-8 px-3 text-[13px] rounded-lg gap-1.5',
  md: 'h-10 px-4 text-sm rounded-xl gap-2',
  lg: 'h-12 px-5 text-[15px] rounded-xl gap-2.5',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  block?: boolean;
}

export function Button({ variant = 'primary', size = 'md', block, className, ...rest }: ButtonProps) {
  return (
    <button
      {...rest}
      className={cx(
        'inline-flex items-center justify-center font-semibold outline-none focus-visible:ring-4',
        VARIANTS[variant],
        SIZES[size],
        block && 'w-full',
        className,
      )}
    />
  );
}

export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div {...rest} className={cx('rounded-2xl bg-white p-4 shadow-card ring-1 ring-slate-200', className)} />;
}

type Tone = 'slate' | 'blue' | 'green' | 'amber' | 'red' | 'orange';
const TONES: Record<Tone, string> = {
  slate: 'bg-slate-100 text-slate-700 ring-slate-300/70',
  blue: 'bg-sky-100 text-sky-800 ring-sky-600/20',
  green: 'bg-emerald-100 text-emerald-800 ring-emerald-600/20',
  amber: 'bg-amber-100 text-amber-800 ring-amber-600/25',
  orange: 'bg-orange-100 text-orange-800 ring-orange-600/20',
  red: 'bg-rose-100 text-rose-700 ring-rose-600/20',
};

/**
 * A stat takes the colour of its meaning: a light tinted tile, a label in the tone's dark shade
 * and a solid icon chip. The number itself stays near-black so it is always easy to read.
 */
const STAT: Record<Tone, { tile: string; label: string; chip: string }> = {
  slate: { tile: 'bg-white ring-slate-200', label: 'text-slate-500', chip: 'bg-slate-600' },
  blue: { tile: 'bg-sky-50 ring-sky-200', label: 'text-sky-800', chip: 'bg-sky-600' },
  green: { tile: 'bg-emerald-50 ring-emerald-200', label: 'text-emerald-800', chip: 'bg-emerald-600' },
  amber: { tile: 'bg-amber-50 ring-amber-200', label: 'text-amber-800', chip: 'bg-amber-500' },
  orange: { tile: 'bg-orange-50 ring-orange-200', label: 'text-orange-800', chip: 'bg-orange-500' },
  red: { tile: 'bg-rose-50 ring-rose-200', label: 'text-rose-800', chip: 'bg-rose-600' },
};

export function Badge({ tone = 'slate', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cx('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset', TONES[tone], className)}>
      {children}
    </span>
  );
}

const BUCKET_TONE: Record<ExpiryBucket, Tone> = { SAFE: 'green', LOCKOUT: 'amber', CRITICAL: 'orange', EXPIRED: 'red' };

/** The translated name of an expiry bucket: Safe, Lockout, Critical or Expired. */
export function useBucketLabel(): (bucket: ExpiryBucket) => string {
  const { t } = useTranslation();
  return (bucket) => t(`chemist.${bucket.toLowerCase()}`);
}

export function BucketBadge({ bucket }: { bucket: ExpiryBucket }) {
  const label = useBucketLabel();
  return <Badge tone={BUCKET_TONE[bucket]}>{label(bucket)}</Badge>;
}

type IconType = ComponentType<{ className?: string }>;

/** A number on a tile tinted by its meaning, with an optional icon chip. */
export function Stat({ label, value, hint, tone = 'slate', icon: Icon }: { label: string; value: ReactNode; hint?: string; tone?: Tone; icon?: IconType }) {
  const s = STAT[tone];
  return (
    <div className={cx('flex items-start justify-between gap-3 rounded-2xl p-4 shadow-card ring-1', s.tile)}>
      <div className="flex min-w-0 flex-col gap-1">
        <span className={cx('text-[13px] font-medium', s.label)}>{label}</span>
        <span className="text-2xl font-semibold tabular-nums tracking-tight text-slate-900">{value}</span>
        {hint && <span className="text-xs text-slate-600">{hint}</span>}
      </div>
      {Icon ? (
        <span aria-hidden className={cx('grid size-9 shrink-0 place-items-center rounded-xl text-white', s.chip)}>
          <Icon className="size-[18px]" />
        </span>
      ) : (
        tone !== 'slate' && <span aria-hidden className={cx('mt-1.5 size-2.5 shrink-0 rounded-full', s.chip)} />
      )}
    </div>
  );
}

/** The header of a role page: a light brand-blue card with a solid icon chip. */
export function PageHero({ icon: Icon, title, subtitle, aside, children }: { icon: IconType; title: ReactNode; subtitle?: ReactNode; aside?: ReactNode; children?: ReactNode }) {
  return (
    <section className="rounded-2xl bg-sky-100/70 p-5 shadow-card ring-1 ring-sky-200">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <span aria-hidden className="grid size-12 shrink-0 place-items-center rounded-xl bg-medical text-white shadow-card">
            <Icon className="size-6" />
          </span>
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight text-slate-900">{title}</h1>
            {subtitle && <p className="text-sm text-slate-600">{subtitle}</p>}
          </div>
        </div>
        {aside && <div className="flex flex-wrap items-center gap-3">{aside}</div>}
      </div>
      {children}
    </section>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="flex items-center gap-2 text-[15px] font-semibold text-slate-800">
        <span aria-hidden className="h-4 w-1 rounded-full bg-medical" />
        {children}
      </h2>
      {action}
    </div>
  );
}

export const inr = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

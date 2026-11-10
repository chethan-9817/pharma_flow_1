import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react';
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
  soft: 'bg-medical-tint text-medical-dark ring-1 ring-inset ring-medical-ring/70 hover:bg-sky-100 focus-visible:ring-medical/30',
  eco: 'bg-eco text-white hover:bg-eco-dark focus-visible:ring-eco/30',
  ecoSoft: 'bg-eco-tint text-eco-dark ring-1 ring-inset ring-emerald-200/80 hover:bg-emerald-100 focus-visible:ring-eco/30',
  danger: 'bg-blood text-white hover:bg-rose-800 focus-visible:ring-blood/30',
  dangerSoft: 'bg-blood-tint text-blood ring-1 ring-inset ring-rose-200/80 hover:bg-rose-100 focus-visible:ring-blood/30',
  amber: 'bg-expiry-tint text-expiry-ink ring-1 ring-inset ring-amber-200/80 hover:bg-amber-100 focus-visible:ring-expiry/30',
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
  slate: 'bg-slate-100 text-slate-700 ring-slate-300/60',
  blue: 'bg-sky-50 text-sky-800 ring-sky-600/15',
  green: 'bg-emerald-50 text-emerald-800 ring-emerald-600/15',
  amber: 'bg-amber-50 text-amber-800 ring-amber-600/20',
  orange: 'bg-orange-50 text-orange-700 ring-orange-600/15',
  red: 'bg-rose-50 text-rose-700 ring-rose-600/15',
};

/** The small coloured dot that marks a stat's meaning (expiry bucket, money, hazard). */
const DOTS: Record<Tone, string> = {
  slate: 'bg-slate-400',
  blue: 'bg-sky-600',
  green: 'bg-emerald-600',
  amber: 'bg-amber-500',
  orange: 'bg-orange-500',
  red: 'bg-rose-600',
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

/** A number with a quiet label. The colour sits in a small dot, not in the number. */
export function Stat({ label, value, hint, tone = 'slate' }: { label: string; value: ReactNode; hint?: string; tone?: Tone }) {
  return (
    <Card className="flex flex-col gap-1.5">
      <span className="flex items-center gap-2 text-[13px] font-medium text-slate-500">
        {tone !== 'slate' && <span aria-hidden className={cx('size-2 shrink-0 rounded-full', DOTS[tone])} />}
        {label}
      </span>
      <span className="text-2xl font-semibold tabular-nums tracking-tight text-slate-900">{value}</span>
      {hint && <span className="text-xs text-slate-500">{hint}</span>}
    </Card>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-sm font-semibold text-slate-700">{children}</h2>
      {action}
    </div>
  );
}

export const inr = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react';
import type { ExpiryBucket } from '../domain/rules/expiry';
import { BUCKET_LABEL } from '../domain/rules/expiry';

const cx = (...parts: (string | false | undefined)[]) => parts.filter(Boolean).join(' ');

type Variant = 'primary' | 'eco' | 'danger' | 'ghost' | 'dark' | 'amber';
type Size = 'sm' | 'md' | 'lg';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-medical text-white shadow-sm hover:bg-medical-dark focus-visible:ring-medical/40',
  eco: 'bg-eco text-white shadow-sm hover:bg-eco-dark focus-visible:ring-eco/40',
  danger: 'bg-blood text-white shadow-sm hover:bg-rose-700 focus-visible:ring-blood/40',
  amber: 'bg-expiry text-slate-900 shadow-sm hover:bg-amber-400 focus-visible:ring-expiry/40',
  ghost: 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 focus-visible:ring-slate-300',
  dark: 'bg-slate-800 text-white ring-1 ring-slate-700 hover:bg-slate-700 focus-visible:ring-slate-500',
};

const SIZES: Record<Size, string> = {
  sm: 'h-8 px-3 text-xs rounded-lg gap-1.5',
  md: 'h-10 px-4 text-sm rounded-xl gap-2',
  lg: 'h-14 px-6 text-base rounded-2xl gap-2.5',
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
  return <div {...rest} className={cx('rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200/70', className)} />;
}

type Tone = 'slate' | 'blue' | 'green' | 'amber' | 'red' | 'orange';
const TONES: Record<Tone, string> = {
  slate: 'bg-slate-100 text-slate-700',
  blue: 'bg-sky-50 text-sky-700',
  green: 'bg-emerald-50 text-emerald-700',
  amber: 'bg-amber-50 text-amber-700',
  orange: 'bg-orange-50 text-orange-700',
  red: 'bg-rose-50 text-rose-700',
};

export function Badge({ tone = 'slate', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cx('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold', TONES[tone], className)}>
      {children}
    </span>
  );
}

const BUCKET_TONE: Record<ExpiryBucket, Tone> = { SAFE: 'green', LOCKOUT: 'amber', CRITICAL: 'orange', EXPIRED: 'red' };

export function BucketBadge({ bucket }: { bucket: ExpiryBucket }) {
  return <Badge tone={BUCKET_TONE[bucket]}>{BUCKET_LABEL[bucket]}</Badge>;
}

export function Stat({ label, value, hint, tone = 'slate' }: { label: string; value: ReactNode; hint?: string; tone?: Tone }) {
  return (
    <Card className="flex flex-col gap-1">
      <span className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</span>
      <span className={cx('text-2xl font-bold tabular-nums', tone === 'slate' ? 'text-slate-900' : TONES[tone].split(' ')[1])}>{value}</span>
      {hint && <span className="text-xs text-slate-500">{hint}</span>}
    </Card>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{children}</h2>
      {action}
    </div>
  );
}

export const inr = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

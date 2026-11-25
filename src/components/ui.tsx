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
  sm: 'min-h-9 px-3 py-1.5 text-[13px] rounded-lg gap-1.5',
  md: 'min-h-11 px-4 py-2 text-sm rounded-xl gap-2',
  lg: 'min-h-12 px-5 py-2.5 text-[15px] rounded-xl gap-2.5',
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
        'inline-flex shrink-0 items-center justify-center text-center leading-snug font-semibold outline-none focus-visible:ring-4',
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

/** Neutral tiles with semantic colour confined to the icon. */
const STAT: Record<Tone, { chip: string; dot: string }> = {
  slate: { chip: 'bg-slate-100 text-slate-600', dot: 'bg-slate-500' },
  blue: { chip: 'bg-medical-tint text-medical-dark', dot: 'bg-medical' },
  green: { chip: 'bg-eco-tint text-eco-dark', dot: 'bg-eco' },
  amber: { chip: 'bg-expiry-tint text-expiry-ink', dot: 'bg-expiry' },
  orange: { chip: 'bg-critical-tint text-critical-ink', dot: 'bg-critical-ink' },
  red: { chip: 'bg-blood-tint text-blood', dot: 'bg-blood' },
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

/** A quiet metric card; the label and icon retain the status meaning. */
export function Stat({ label, value, hint, tone = 'slate', icon: Icon }: { label: string; value: ReactNode; hint?: string; tone?: Tone; icon?: IconType }) {
  const s = STAT[tone];
  return (
    <div className="relative min-w-0 rounded-2xl bg-white p-4 shadow-card ring-1 ring-slate-200 sm:p-5">
      <div className="flex min-w-0 flex-col gap-1">
        <span className="min-h-9 pr-10 text-[13px] font-medium leading-relaxed text-slate-600">{label}</span>
        <span className="break-words text-2xl font-semibold tabular-nums tracking-tight text-slate-900">{value}</span>
        {hint && <span className="text-xs text-slate-600">{hint}</span>}
      </div>
      {Icon ? (
        <span aria-hidden className={cx('absolute right-4 top-4 grid size-9 place-items-center rounded-xl sm:right-5 sm:top-5', s.chip)}>
          <Icon className="size-[18px]" />
        </span>
      ) : (
        tone !== 'slate' && <span aria-hidden className={cx('absolute right-5 top-5 size-2.5 rounded-full', s.dot)} />
      )}
    </div>
  );
}

/** Shared page heading with a quiet surface and clear type hierarchy. */
export function PageHero({ icon: Icon, title, subtitle, aside, children }: { icon: IconType; title: ReactNode; subtitle?: ReactNode; aside?: ReactNode; children?: ReactNode }) {
  return (
    <section className="rounded-2xl bg-white p-5 shadow-card ring-1 ring-slate-200 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <span aria-hidden className="grid size-12 shrink-0 place-items-center rounded-xl bg-medical-tint text-medical-dark">
            <Icon className="size-6" />
          </span>
          <div className="min-w-0">
            <h1 className="break-words text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">{title}</h1>
            {subtitle && <p className="mt-1 text-sm leading-relaxed text-slate-600">{subtitle}</p>}
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
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <h2 className="flex items-center gap-2 text-[15px] font-semibold text-slate-800">
        {children}
      </h2>
      {action}
    </div>
  );
}

/** A row of pill tabs that splits a long page into views. */
export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: { id: T; label: string; icon?: IconType; count?: number }[];
  value: T;
  onChange: (id: T) => void;
}) {
  return (
    <div role="tablist" className="inline-flex max-w-full gap-1 overflow-x-auto rounded-2xl bg-white p-1 shadow-card ring-1 ring-slate-200">
      {tabs.map(({ id, label, icon: Icon, count }) => (
        <button
          key={id}
          role="tab"
          aria-selected={value === id}
          onClick={() => onChange(id)}
          className={cx(
            'flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-xl px-3.5 text-sm font-medium',
            value === id ? 'bg-medical-tint text-medical-dark' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
          )}
        >
          {Icon && <Icon className="size-4" />}
          {label}
          {count ? (
            <span className={cx('rounded-full px-1.5 text-[11px] font-semibold tabular-nums', value === id ? 'bg-white text-medical-dark' : 'bg-slate-100 text-slate-600')}>{count}</span>
          ) : null}
        </button>
      ))}
    </div>
  );
}

export const inr = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

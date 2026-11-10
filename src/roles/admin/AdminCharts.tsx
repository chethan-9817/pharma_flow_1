import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ACTIVITY_FAMILIES, activityByFamily, impactTimeline, stockByBucket } from '../../domain/impact';
import { type ExpiryBucket } from '../../domain/rules/expiry';
import type { AppState } from '../../domain/state';
import { Card, SectionTitle, useBucketLabel } from '../../components/ui';
import { SEED } from '../../seed';
import type { Entry } from '../../store/persistence';

/** Same colours as the expiry badges elsewhere in the app, deep enough to read on white. */
const BUCKET_COLOR: Record<ExpiryBucket, string> = { SAFE: '#059669', LOCKOUT: '#D97706', CRITICAL: '#EA580C', EXPIRED: '#BE123C' };
const AXIS = { fontSize: 11, fill: '#667085' };
const GRID = '#eaecf0';
const TOOLTIP = {
  contentStyle: { borderRadius: 12, border: '1px solid #eaecf0', boxShadow: '0 12px 32px -8px rgb(16 24 40 / 0.14)', fontSize: 12 },
  labelStyle: { color: '#475467', fontWeight: 500 },
} as const;

const rupee = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: n < 100 ? 2 : 0 })}`;

/**
 * Charts for the admin portal. Every number is derived from the event log:
 * stock health is read from the current state, and the other two replay the log.
 */
export default function AdminCharts({ app, chain }: { app: AppState; chain: Entry[] }) {
  const { t } = useTranslation();
  const bucketLabel = useBucketLabel();
  const stock = stockByBucket(app);
  const stockData = (Object.keys(stock) as ExpiryBucket[]).map((b) => ({ bucket: b, name: bucketLabel(b), value: stock[b] }));
  const totalUnits = stockData.reduce((n, d) => n + d.value, 0);

  const events = useMemo(() => chain.map((e) => e.event), [chain]);
  const timeline = useMemo(() => impactTimeline(SEED, events), [events]);
  const activity = useMemo(() => activityByFamily(events), [events]);
  // The area names come from the domain in English; the chart shows them in the chosen language when a key exists.
  const activityRows = activity.map((a) => ({ ...a, label: ACTIVITY_FAMILIES.includes(a.family) ? t(`admin.charts.family.${a.family}`) : a.family }));

  return (
    <section className="@container space-y-3">
      <SectionTitle>{t('admin.charts.title')}</SectionTitle>
      <div className="grid gap-4 @3xl:grid-cols-3">
        <Card className="space-y-2">
          <h3 className="text-sm font-semibold text-slate-900">{t('admin.charts.stockHealth')}</h3>
          <p className="text-xs text-slate-500">{t('admin.charts.stockHint')}</p>
          <div className="relative h-52">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={stockData} dataKey="value" nameKey="name" innerRadius="58%" outerRadius="88%" paddingAngle={2} stroke="none">
                  {stockData.map((d) => (
                    <Cell key={d.bucket} fill={BUCKET_COLOR[d.bucket]} />
                  ))}
                </Pie>
                <Tooltip {...TOOLTIP} formatter={(v) => [`${v} ${t('admin.charts.units')}`, '']} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
              <div>
                <p className="text-2xl font-semibold tabular-nums text-slate-900">{totalUnits}</p>
                <p className="text-[11px] text-slate-500">{t('admin.charts.units')}</p>
              </div>
            </div>
          </div>
          <ul className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
            {stockData.map((d) => (
              <li key={d.bucket} className="flex items-center gap-2">
                <span className="size-2.5 rounded-full" style={{ background: BUCKET_COLOR[d.bucket] }} />
                <span className="text-slate-600">{d.name}</span>
                <span className="ml-auto font-semibold tabular-nums text-slate-900">{d.value}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="space-y-2">
          <h3 className="text-sm font-semibold text-slate-900">{t('admin.charts.money')}</h3>
          <p className="text-xs text-slate-500">{t('admin.charts.moneyHint')}</p>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={timeline} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
                <XAxis dataKey="step" type="number" domain={[0, 'dataMax']} allowDecimals={false} tick={AXIS} tickLine={false} axisLine={false} />
                <YAxis tickFormatter={rupee} tick={AXIS} tickLine={false} axisLine={false} width={56} />
                <Tooltip {...TOOLTIP} formatter={(v) => rupee(Number(v))} labelFormatter={(l) => t('admin.charts.afterEvent', { n: l })} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="stepAfter" dataKey="ecoRevenue" name={t('admin.charts.ecoLine')} stroke="#0369A1" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="stepAfter" dataKey="ngoValue" name={t('admin.charts.ngoLine')} stroke="#059669" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="stepAfter" dataKey="ngoFund" name={t('admin.charts.fundLine')} stroke="#7C3AED" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          {timeline.length < 3 && <p className="text-xs text-slate-500">{t('admin.charts.moneyEmpty')}</p>}
        </Card>

        <Card className="space-y-2">
          <h3 className="text-sm font-semibold text-slate-900">{t('admin.charts.activity')}</h3>
          <p className="text-xs text-slate-500">{t('admin.charts.activityHint')}</p>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={activityRows} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID} horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={AXIS} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="label" tick={AXIS} tickLine={false} axisLine={false} width={86} />
                <Tooltip {...TOOLTIP} formatter={(v) => [t('admin.charts.eventsCount', { count: Number(v) }), '']} cursor={{ fill: '#f2f4f7' }} />
                <Bar dataKey="count" fill="#0369A1" radius={[0, 6, 6, 0]} barSize={14} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </section>
  );
}

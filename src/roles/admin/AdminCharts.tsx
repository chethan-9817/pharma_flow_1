import { useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { activityByFamily, impactTimeline, stockByBucket } from '../../domain/impact';
import { BUCKET_LABEL, type ExpiryBucket } from '../../domain/rules/expiry';
import type { AppState } from '../../domain/state';
import { Card, SectionTitle } from '../../components/ui';
import { SEED } from '../../seed';
import type { Entry } from '../../store/persistence';

const BUCKET_COLOR: Record<ExpiryBucket, string> = { SAFE: '#10B981', LOCKOUT: '#F59E0B', CRITICAL: '#F97316', EXPIRED: '#E11D48' };
const AXIS = { fontSize: 11, fill: '#64748b' };

const rupee = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

/**
 * Charts for the admin portal. Every number is derived from the event log:
 * stock health is read from the current state, and the other two replay the log.
 */
export default function AdminCharts({ app, chain }: { app: AppState; chain: Entry[] }) {
  const stock = stockByBucket(app);
  const stockData = (Object.keys(stock) as ExpiryBucket[]).map((b) => ({ bucket: b, name: BUCKET_LABEL[b], value: stock[b] }));
  const totalUnits = stockData.reduce((n, d) => n + d.value, 0);

  const events = useMemo(() => chain.map((e) => e.event), [chain]);
  const timeline = useMemo(() => impactTimeline(SEED, events), [events]);
  const activity = useMemo(() => activityByFamily(events), [events]);

  return (
    <section className="@container space-y-3">
      <SectionTitle>Impact at a glance</SectionTitle>
      <div className="grid gap-4 @3xl:grid-cols-3">
        <Card className="space-y-2">
          <h3 className="text-sm font-semibold text-slate-900">Stock health</h3>
          <p className="text-xs text-slate-500">Units on shelves, by expiry bucket</p>
          <div className="relative h-52">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={stockData} dataKey="value" nameKey="name" innerRadius="58%" outerRadius="88%" paddingAngle={2} stroke="none">
                  {stockData.map((d) => (
                    <Cell key={d.bucket} fill={BUCKET_COLOR[d.bucket]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => [`${v} units`, '']} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
              <div>
                <p className="text-2xl font-bold tabular-nums text-slate-900">{totalUnits}</p>
                <p className="text-[11px] text-slate-500">units</p>
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
          <h3 className="text-sm font-semibold text-slate-900">Money recovered</h3>
          <p className="text-xs text-slate-500">Cumulative, as actions happen</p>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={timeline} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="step" type="number" domain={[0, 'dataMax']} allowDecimals={false} tick={AXIS} tickLine={false} axisLine={false} />
                <YAxis tickFormatter={rupee} tick={AXIS} tickLine={false} axisLine={false} width={56} />
                <Tooltip formatter={(v) => rupee(Number(v))} labelFormatter={(l) => `After event #${l}`} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="stepAfter" dataKey="ecoRevenue" name="Eco-Sale revenue" stroke="#0284C7" strokeWidth={2.5} dot={{ r: 3 }} />
                <Line type="stepAfter" dataKey="ngoValue" name="Medicines to NGOs" stroke="#10B981" strokeWidth={2.5} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          {timeline.length < 3 && <p className="text-xs text-slate-500">Sell an Eco-Sale item or complete a donation and the line steps up.</p>}
        </Card>

        <Card className="space-y-2">
          <h3 className="text-sm font-semibold text-slate-900">Platform activity</h3>
          <p className="text-xs text-slate-500">Events in the audit ledger, by area</p>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={activity} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={AXIS} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="family" tick={AXIS} tickLine={false} axisLine={false} width={86} />
                <Tooltip formatter={(v) => [`${v} events`, '']} cursor={{ fill: '#f1f5f9' }} />
                <Bar dataKey="count" fill="#0284C7" radius={[0, 6, 6, 0]} barSize={14} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </section>
  );
}

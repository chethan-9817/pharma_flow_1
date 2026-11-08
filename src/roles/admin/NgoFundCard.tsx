import { HeartHandshake, Landmark } from 'lucide-react';
import { fundSummary } from '../../domain/selectors';
import { NGO_FUND_SHARE_PCT, PLATFORM_FEE_PCT } from '../../domain/rules/fund';
import { SPONSOR_AMOUNT } from '../../domain/rules/sponsor';
import { Badge, Card, SectionTitle, inr } from '../../components/ui';
import { useApp } from '../../store';

/**
 * The NGO fund: change left over from sponsor payments plus a small share of the platform's fee.
 * It can only be spent on medicines for NGOs, never paid out as cash.
 */
export function NgoFundCard() {
  const app = useApp();
  const f = fundSummary(app);

  return (
    <section>
      <SectionTitle>NGO fund</SectionTitle>
      <Card className="space-y-4">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-eco-dark">
            <Landmark className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-2xl font-bold tabular-nums text-slate-900">{inr(f.balance)}</p>
            <p className="text-xs text-slate-500">Closed-loop: it only buys medicines for NGOs, never paid out as cash.</p>
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-xl bg-slate-50 p-3">
            <dt className="text-xs text-slate-500">From sponsors</dt>
            <dd className="font-semibold tabular-nums text-slate-900">{inr(f.fromSponsors)}</dd>
            <dd className="text-[11px] text-slate-500">Change from {inr(SPONSOR_AMOUNT)} sponsorships</dd>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <dt className="text-xs text-slate-500">From the platform</dt>
            <dd className="font-semibold tabular-nums text-slate-900">{inr(f.fromPlatform)}</dd>
            <dd className="text-[11px] text-slate-500">
              {NGO_FUND_SHARE_PCT}% of the {PLATFORM_FEE_PCT}% fee on delivered orders
            </dd>
          </div>
        </dl>

        <p className="flex items-center gap-2 text-xs text-slate-600">
          <HeartHandshake className="size-3.5" /> {f.packsSponsored} packs sponsored and delivered
          {f.sponsorsPending > 0 && <Badge tone="blue">{f.sponsorsPending} on the way</Badge>}
        </p>

        {f.recent.length > 0 && (
          <ul className="divide-y divide-slate-100 rounded-xl ring-1 ring-slate-100">
            {f.recent.slice(0, 5).map((e) => (
              <li key={e.id} className="flex items-center gap-3 px-3 py-2 text-xs">
                <span className="min-w-0 flex-1 truncate text-slate-700">
                  {e.kind === 'SPONSOR_CHANGE' ? 'Sponsor change' : 'Platform share'} · {e.refId}
                </span>
                <span className="text-slate-400">{e.date}</span>
                <span className="font-semibold tabular-nums text-slate-900">+{inr(e.amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </section>
  );
}

import { motion } from 'framer-motion';
import { HeartHandshake, Plus } from 'lucide-react';
import { useState } from 'react';
import { SPONSOR_AMOUNT } from '../../domain/rules/sponsor';
import { requiresRx } from '../../domain/rules/prescription';
import { ecoListings } from '../../domain/selectors';
import type { User } from '../../domain/types';
import { Badge, Button, Card, inr } from '../../components/ui';
import { toast } from '../../components/toast';
import { useApp } from '../../store';
import { useCart } from './cart';
import { SponsorPanel } from './SponsorPanel';

export function DealsTab({ user }: { user: User }) {
  const app = useApp();
  const add = useCart((s) => s.add);
  const deals = ecoListings(app);
  const [sponsoring, setSponsoring] = useState<string | null>(null);

  if (deals.length === 0) {
    return (
      <Card className="text-center text-sm text-slate-500">
        No Eco-Sale stock right now. When a chemist puts a near-expiry batch on sale, it appears here instantly.
      </Card>
    );
  }

  return (
    <div className="grid items-start gap-3 @2xl:grid-cols-2 @5xl:grid-cols-3">
      <p className="text-xs text-slate-500 @2xl:col-span-2 @5xl:col-span-3">
        Near-expiry stock at 40–60% off. Prescription rules still apply. Or sponsor a batch: {inr(SPONSOR_AMOUNT)} puts packs into an NGO&apos;s hands.
      </p>
      {deals.map((d, i) => (
        <motion.div key={d.batch.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
          <Card className="space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-semibold text-slate-900">{d.medicine.brand}</h3>
                <p className="text-xs text-slate-500">{d.medicine.salt} · {d.medicine.packSize}</p>
              </div>
              <Badge tone="amber">{d.discountPct}% OFF</Badge>
            </div>
            <p className="rounded-lg bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800">
              Expires in {d.daysLeft} days • fits a {Math.min(d.fitsCourseDays, d.medicine.courseDays)}-day course • {d.batch.qty} left
            </p>
            <div className="flex items-end justify-between">
              <div>
                <span className="text-xl font-bold text-slate-900">{inr(d.price)}</span>{' '}
                <span className="text-sm text-slate-400 line-through">{inr(d.medicine.mrp)}</span>
                {requiresRx(d.medicine) && <div className="mt-1"><Badge tone="red">Prescription required</Badge></div>}
              </div>
              <Button
                size="sm"
                onClick={() => {
                  add({ medicineId: d.medicine.id, qty: 1, batchId: d.batch.id });
                  toast(`${d.medicine.brand} added to cart`);
                }}
              >
                <Plus className="size-4" /> Buy for myself
              </Button>
            </div>
            {sponsoring === d.batch.id ? (
              <SponsorPanel user={user} batchId={d.batch.id} onDone={() => setSponsoring(null)} />
            ) : (
              <Button size="sm" variant="eco" block onClick={() => setSponsoring(d.batch.id)}>
                <HeartHandshake className="size-4" /> Sponsor batch for NGO ({inr(SPONSOR_AMOUNT)})
              </Button>
            )}
          </Card>
        </motion.div>
      ))}
    </div>
  );
}

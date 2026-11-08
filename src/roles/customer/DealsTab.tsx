import { motion } from 'framer-motion';
import { Plus } from 'lucide-react';
import { requiresRx } from '../../domain/rules/prescription';
import { ecoListings } from '../../domain/selectors';
import { Badge, Button, Card, inr } from '../../components/ui';
import { toast } from '../../components/toast';
import { useApp } from '../../store';
import { useCart } from './cart';

export function DealsTab() {
  const app = useApp();
  const add = useCart((s) => s.add);
  const deals = ecoListings(app);

  if (deals.length === 0) {
    return (
      <Card className="text-center text-sm text-slate-500">
        No Eco-Sale stock right now. When a chemist puts a near-expiry batch on sale, it appears here instantly.
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500">Near-expiry stock at 40–60% off. Prescription rules still apply.</p>
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
          </Card>
        </motion.div>
      ))}
    </div>
  );
}

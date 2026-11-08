import { motion } from 'framer-motion';
import { Plus, Search, Tag } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { nearestStoreId, stockFor } from '../../domain/checkout';
import { genericOffer } from '../../domain/rules/generic';
import { requiresRx } from '../../domain/rules/prescription';
import { ecoListings } from '../../domain/selectors';
import type { User } from '../../domain/types';
import { Badge, Button, Card, inr } from '../../components/ui';
import { toast } from '../../components/toast';
import { useApp } from '../../store';
import { useCart } from './cart';

export function ShopTab({ user }: { user: User }) {
  const { t } = useTranslation();
  const app = useApp();
  const add = useCart((s) => s.add);
  const [query, setQuery] = useState('');
  const storeId = nearestStoreId(app, user.id);
  const store = storeId ? app.stores[storeId] : undefined;

  const medicines = useMemo(() => {
    const q = query.trim().toLowerCase();
    return Object.values(app.medicines).filter((m) => !q || m.brand.toLowerCase().includes(q) || m.salt.toLowerCase().includes(q));
  }, [app.medicines, query]);

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('customer.shop.search')}
          className="h-11 w-full rounded-2xl border border-slate-200 bg-white pl-10 pr-3 text-sm outline-none transition focus:border-medical focus:ring-4 focus:ring-medical/15"
        />
      </div>
      {store && <p className="text-xs text-slate-500">{t('customer.shop.deliveringFrom')} <b>{store.name}</b>, {store.area}</p>}

      <div className="grid gap-3 @2xl:grid-cols-2 @5xl:grid-cols-3">
        {medicines.map((m, i) => {
          const stock = storeId ? stockFor(app, storeId, m.id) : 0;
          const offer = genericOffer(m);
          const eco = ecoListings(app).find((d) => d.medicine.id === m.id);
          return (
            <motion.div key={m.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 8) * 0.03 }}>
              <Card className="space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-semibold text-slate-900">{m.brand}</h3>
                    <p className="truncate text-xs text-slate-500">{m.salt}</p>
                    <p className="text-xs text-slate-400">{m.packSize} · {m.manufacturer}</p>
                  </div>
                  {requiresRx(m) ? <Badge tone="red">{t('customer.shop.rxBadge', { schedule: m.schedule })}</Badge> : <Badge tone="green">{t('customer.shop.otc')}</Badge>}
                </div>

                {offer && (
                  <div className="rounded-xl bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
                    <b>{t('customer.shop.cheaperGeneric')}</b> {offer.name}, {inr(offer.price)}. {t('customer.shop.save', { amount: inr(offer.saving), pct: offer.savingPct })}
                    <span className="block text-emerald-700">{offer.label} · {t('customer.shop.askJanAushadhi')}</span>
                  </div>
                )}
                {eco && (
                  <p className="flex items-center gap-1.5 rounded-xl bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800">
                    <Tag className="size-3.5" /> {t('customer.shop.ecoBatch', { pct: eco.discountPct })}
                  </p>
                )}

                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-lg font-bold text-slate-900">{inr(m.mrp)}</span>
                    <span className="ml-2 text-xs text-slate-500">{stock > 0 ? t('customer.shop.inStock', { count: stock }) : t('customer.shop.outOfStock')}</span>
                  </div>
                  <Button
                    size="sm"
                    disabled={stock === 0}
                    onClick={() => {
                      add({ medicineId: m.id, qty: 1 });
                      toast(t('customer.shop.added', { brand: m.brand }));
                    }}
                  >
                    <Plus className="size-4" /> {t('customer.shop.add')}
                  </Button>
                </div>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

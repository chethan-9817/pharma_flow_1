import { AnimatePresence, motion } from 'framer-motion';
import { Leaf, Package, ShoppingBag, ShoppingCart, Store, Tag, Wallet } from 'lucide-react';
import { useState, type ComponentType } from 'react';
import { ecoListings } from '../../domain/selectors';
import type { User } from '../../domain/types';
import { inr } from '../../components/ui';
import { useApp } from '../../store';
import { useCart } from './cart';
import { CartTab } from './CartTab';
import { DealsTab } from './DealsTab';
import { OrdersTab } from './OrdersTab';
import { ShopTab } from './ShopTab';

type TabId = 'shop' | 'deals' | 'cart' | 'orders';

const TABS: { id: TabId; label: string; icon: ComponentType<{ className?: string }> }[] = [
  { id: 'shop', label: 'Shop', icon: Store },
  { id: 'deals', label: 'Deals', icon: Tag },
  { id: 'cart', label: 'Cart', icon: ShoppingCart },
  { id: 'orders', label: 'Orders', icon: Package },
];

export function CustomerPage({ user }: { user: User }) {
  const app = useApp();
  const [tab, setTab] = useState<TabId>('shop');
  const cartCount = useCart((s) => s.lines.reduce((n, l) => n + l.qty, 0));
  const dealCount = ecoListings(app).length;
  const openOrders = Object.values(app.orders).filter(
    (o) => o.customerId === user.id && o.status !== 'DELIVERED' && o.status !== 'CANCELLED',
  ).length;
  const badge: Partial<Record<TabId, number>> = { deals: dealCount, cart: cartCount, orders: openOrders };

  return (
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md flex-col bg-canvas sm:my-4 sm:h-[820px] sm:min-h-0 sm:overflow-hidden sm:rounded-[2rem] sm:shadow-xl sm:ring-8 sm:ring-slate-900/90">
      <header className="bg-white px-5 pb-4 pt-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-500">Hello,</p>
            <h1 className="text-xl font-bold text-slate-900">{user.name}</h1>
          </div>
          <ShoppingBag className="size-6 text-medical" />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-emerald-50 p-3">
            <div className="flex items-center gap-1.5 text-xs font-medium text-eco-dark">
              <Leaf className="size-3.5" /> Eco-Karma
            </div>
            <div className="mt-0.5 text-xl font-bold tabular-nums text-emerald-900">{app.karma[user.id] ?? 0}</div>
          </div>
          <div className="rounded-xl bg-sky-50 p-3">
            <div className="flex items-center gap-1.5 text-xs font-medium text-medical-dark">
              <Wallet className="size-3.5" /> MedWallet
            </div>
            <div className="mt-0.5 text-xl font-bold tabular-nums text-sky-900">{inr(app.wallet[user.id] ?? 0)}</div>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 pb-24 sm:pb-4">
        <AnimatePresence mode="wait">
          <motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
            {tab === 'shop' && <ShopTab user={user} />}
            {tab === 'deals' && <DealsTab />}
            {tab === 'cart' && <CartTab user={user} onPlaced={() => setTab('orders')} />}
            {tab === 'orders' && <OrdersTab user={user} />}
          </motion.div>
        </AnimatePresence>
      </main>

      <nav className="sticky bottom-0 grid grid-cols-4 border-t border-slate-200 bg-white/95 backdrop-blur" aria-label="Customer sections">
        {TABS.map(({ id, label, icon: Icon }) => {
          const active = tab === id;
          const count = badge[id] ?? 0;
          return (
            <button
              key={id}
              onClick={() => setTab(id)}
              aria-current={active ? 'page' : undefined}
              className={`relative flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold transition-colors ${active ? 'text-medical' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <Icon className="size-5" />
              {label}
              {count > 0 && (
                <span className="absolute right-[28%] top-1.5 grid min-w-4 place-items-center rounded-full bg-blood px-1 text-[10px] font-bold text-white">{count}</span>
              )}
              {active && <motion.span layoutId="tab-underline" className="absolute inset-x-6 top-0 h-0.5 rounded-full bg-medical" />}
            </button>
          );
        })}
      </nav>
    </div>
  );
}

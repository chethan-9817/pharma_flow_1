import { AnimatePresence, motion } from 'framer-motion';
import { HeartHandshake, Leaf, Package, ShoppingBag, ShoppingCart, Store, Tag, Wallet } from 'lucide-react';
import { useState, type ComponentType } from 'react';
import { courseReminders, ecoListings } from '../../domain/selectors';
import type { User } from '../../domain/types';
import { inr } from '../../components/ui';
import { useEmbedded } from '../../components/layout';
import { useApp } from '../../store';
import { useCart } from './cart';
import { CartTab } from './CartTab';
import { CivicTab } from './CivicTab';
import { DealsTab } from './DealsTab';
import { OrdersTab } from './OrdersTab';
import { ShopTab } from './ShopTab';

type TabId = 'shop' | 'deals' | 'cart' | 'orders' | 'civic';

/** `short` is the label used in the narrow phone navigation bar. */
const TABS: { id: TabId; label: string; short?: string; icon: ComponentType<{ className?: string }> }[] = [
  { id: 'shop', label: 'Shop', icon: Store },
  { id: 'deals', label: 'Deals', icon: Tag },
  { id: 'cart', label: 'Cart', icon: ShoppingCart },
  { id: 'orders', label: 'Orders', icon: Package },
  { id: 'civic', label: 'Civic hub', short: 'Civic', icon: HeartHandshake },
];

function Stats({ user }: { user: User }) {
  const app = useApp();
  return (
    <div className="grid grid-cols-2 gap-2">
      <div className="rounded-xl bg-emerald-50 p-3">
        <div className="flex items-center gap-1.5 whitespace-nowrap text-xs font-medium text-eco-dark">
          <Leaf className="size-3.5" /> Eco-Karma
        </div>
        <div className="mt-0.5 text-xl font-bold tabular-nums text-emerald-900">{app.karma[user.id] ?? 0}</div>
      </div>
      <div className="rounded-xl bg-sky-50 p-3">
        <div className="flex items-center gap-1.5 whitespace-nowrap text-xs font-medium text-medical-dark">
          <Wallet className="size-3.5" /> MedWallet
        </div>
        <div className="mt-0.5 text-xl font-bold tabular-nums text-sky-900">{inr(app.wallet[user.id] ?? 0)}</div>
      </div>
    </div>
  );
}

export function CustomerPage({ user }: { user: User }) {
  const app = useApp();
  const embedded = useEmbedded();
  const [tab, setTab] = useState<TabId>('shop');
  const cartCount = useCart((s) => s.lines.reduce((n, l) => n + l.qty, 0));
  const dealCount = ecoListings(app).length;
  const openOrders = Object.values(app.orders).filter(
    (o) => o.customerId === user.id && o.status !== 'DELIVERED' && o.status !== 'CANCELLED',
  ).length;
  const reminderCount = courseReminders(app, user.id).length;
  const badge: Partial<Record<TabId, number>> = { deals: dealCount, cart: cartCount, orders: openOrders, civic: reminderCount };

  const content = (
    <AnimatePresence mode="wait">
      <motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
        {tab === 'shop' && <ShopTab user={user} />}
        {tab === 'deals' && <DealsTab />}
        {tab === 'cart' && <CartTab user={user} onPlaced={() => setTab('orders')} />}
        {tab === 'orders' && <OrdersTab user={user} />}
        {tab === 'civic' && <CivicTab user={user} />}
      </motion.div>
    </AnimatePresence>
  );

  // Compact phone-style app, used inside the presenter's "All 4" panes.
  if (embedded) {
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
          <div className="mt-3">
            <Stats user={user} />
          </div>
        </header>

        <main className="@container flex-1 overflow-y-auto p-4 pb-24 sm:pb-4">{content}</main>

        <nav className="sticky bottom-0 grid grid-cols-5 border-t border-slate-200 bg-white/95 backdrop-blur" aria-label="Customer sections">
          {TABS.map(({ id, label, short, icon: Icon }) => {
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
                {short ?? label}
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

  // Laptop layout for a customer opened on their own: sidebar on the left, roomy content on the right.
  return (
    <div className="mx-auto grid max-w-7xl gap-6 p-4 sm:p-6 lg:grid-cols-[250px_minmax(0,1fr)]">
      <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200/70">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">Hello,</p>
              <h1 className="text-lg font-bold text-slate-900">{user.name}</h1>
            </div>
            <ShoppingBag className="size-6 text-medical" />
          </div>
          <Stats user={user} />
        </div>

        <nav aria-label="Customer sections" className="flex gap-1 overflow-x-auto rounded-2xl bg-white p-1.5 shadow-sm ring-1 ring-slate-200/70 lg:flex-col lg:overflow-visible">
          {TABS.map(({ id, label, icon: Icon }) => {
            const active = tab === id;
            const count = badge[id] ?? 0;
            return (
              <button
                key={id}
                onClick={() => setTab(id)}
                aria-current={active ? 'page' : undefined}
                className={`flex shrink-0 items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-colors lg:w-full ${
                  active ? 'bg-medical text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Icon className="size-5" />
                <span className="flex-1 text-left">{label}</span>
                {count > 0 && (
                  <span className={`grid min-w-5 place-items-center rounded-full px-1.5 text-[11px] font-bold ${active ? 'bg-white/25 text-white' : 'bg-blood text-white'}`}>{count}</span>
                )}
              </button>
            );
          })}
        </nav>
      </aside>

      <main className="@container min-w-0">{content}</main>
    </div>
  );
}

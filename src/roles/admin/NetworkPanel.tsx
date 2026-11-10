import { Bike, ClipboardList, Store, UserCheck, Users, Warehouse } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { networkSummary, orderRows, storeRows } from '../../domain/network';
import { Badge, Card, SectionTitle, Stat, inr } from '../../components/ui';
import { useApp } from '../../store';

const KYC_TONE = { APPROVED: 'green', PENDING_KYC: 'amber', REJECTED: 'red' } as const;
const ORDER_TONE = { PLACED: 'slate', RX_APPROVED: 'blue', PACKED: 'amber', OUT_FOR_DELIVERY: 'blue', DELIVERED: 'green', CANCELLED: 'red' } as const;

const TH = 'px-4 py-3 font-semibold';
const TD = 'px-4 py-3';

/** Everything the admin needs to know about the network: who is on it, every store and every order. */
export function NetworkPanel() {
  const { t } = useTranslation();
  const app = useApp();
  const n = networkSummary(app);
  const stores = storeRows(app);
  const orders = orderRows(app);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Stat label={t('network.stores')} value={n.stores} hint={t('network.storesHint', { approved: n.storesApproved, pending: n.storesPending })} tone="blue" icon={Store} />
        <Stat label={t('network.customers')} value={n.customers} tone="slate" icon={Users} />
        <Stat label={t('network.riders')} value={n.riders} hint={t('network.ridersHint', { online: n.ridersOnline })} tone="green" icon={Bike} />
        <Stat label={t('network.dealers')} value={n.dealers} tone="slate" icon={Warehouse} />
        <Stat label={t('network.orders')} value={n.orders} hint={t('network.ordersHint', { active: n.activeOrders, delivered: n.delivered })} tone="amber" icon={ClipboardList} />
        <Stat label={t('network.assigned')} value={n.assignedOrders} hint={t('network.assignedHint', { waiting: n.waitingForRider })} tone="blue" icon={UserCheck} />
      </div>

      <section>
        <SectionTitle>{t('network.storeTable')}</SectionTitle>
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-600">
              <tr>
                <th className={TH}>{t('network.col.store')}</th>
                <th className={TH}>{t('network.col.chemist')}</th>
                <th className={TH}>{t('network.col.kyc')}</th>
                <th className={`${TH} text-right`}>{t('network.col.stock')}</th>
                <th className={`${TH} text-right`}>{t('network.col.eco')}</th>
                <th className={`${TH} text-right`}>{t('network.col.orders')}</th>
                <th className={`${TH} text-right`}>{t('network.col.active')}</th>
                <th className={`${TH} text-right`}>{t('network.col.delivered')}</th>
                <th className={`${TH} text-right`}>{t('network.col.sales')}</th>
              </tr>
            </thead>
            <tbody>
              {stores.map((r) => (
                <tr key={r.store.id} className="border-b border-slate-100 transition-colors last:border-0 hover:bg-slate-50">
                  <td className={TD}>
                    <div className="font-semibold text-slate-900">{r.store.name}</div>
                    <div className="text-xs text-slate-500">{r.store.area}</div>
                  </td>
                  <td className={`${TD} text-slate-700`}>{r.chemist?.name ?? '-'}</td>
                  <td className={TD}>
                    <Badge tone={KYC_TONE[r.store.kyc]}>{t(`network.kyc.${r.store.kyc}`)}</Badge>
                  </td>
                  <td className={`${TD} text-right tabular-nums`}>{r.units.toLocaleString('en-IN')}</td>
                  <td className={`${TD} text-right tabular-nums`}>{r.ecoListings}</td>
                  <td className={`${TD} text-right tabular-nums`}>{r.orders}</td>
                  <td className={`${TD} text-right tabular-nums`}>{r.activeOrders}</td>
                  <td className={`${TD} text-right tabular-nums`}>{r.delivered}</td>
                  <td className={`${TD} text-right font-medium tabular-nums text-slate-900`}>{inr(r.sales)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </section>

      <section>
        <SectionTitle>{t('network.orderTable')}</SectionTitle>
        <Card className="overflow-x-auto p-0">
          {orders.length === 0 ? (
            <p className="p-4 text-sm text-slate-500">{t('network.noOrders')}</p>
          ) : (
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-600">
                <tr>
                  <th className={TH}>{t('network.ocol.customer')}</th>
                  <th className={TH}>{t('network.ocol.store')}</th>
                  <th className={`${TH} text-right`}>{t('network.ocol.items')}</th>
                  <th className={`${TH} text-right`}>{t('network.ocol.total')}</th>
                  <th className={TH}>{t('network.ocol.rider')}</th>
                  <th className={TH}>{t('network.ocol.status')}</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((r) => (
                  <tr key={r.order.id} className="border-b border-slate-100 transition-colors last:border-0 hover:bg-slate-50">
                    <td className={`${TD} font-medium text-slate-900`}>{r.customer}</td>
                    <td className={`${TD} text-slate-700`}>{r.store}</td>
                    <td className={`${TD} text-right tabular-nums`}>{r.packs}</td>
                    <td className={`${TD} text-right tabular-nums`}>{inr(r.order.total)}</td>
                    <td className={TD}>{r.rider ?? <span className="text-slate-400">{t('network.unassigned')}</span>}</td>
                    <td className={TD}>
                      <Badge tone={ORDER_TONE[r.order.status]}>{t(`customer.orders.status.${r.order.status}`)}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </section>
    </div>
  );
}

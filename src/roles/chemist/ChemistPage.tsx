import { motion } from 'framer-motion';
import { FileCheck, Gift, PackageCheck, ScanLine, ShieldCheck, Tag, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { parseGs1 } from '../../domain/rules/gs1';
import { suggestedDiscount } from '../../domain/rules/ecoSale';
import { bucketCounts, storeInventory, type BatchView } from '../../domain/selectors';
import type { Batch, User } from '../../domain/types';
import { Badge, BucketBadge, Button, Card, SectionTitle, Stat, inr } from '../../components/ui';
import { report } from '../../components/toast';
import { newId } from '../../lib/id';
import { BARCODE_PRESETS } from '../../seed/barcodes';
import { dispatch, useApp } from '../../store';

const NGO_ID = 'ngo-seva';

export function ChemistPage({ user }: { user: User }) {
  const app = useApp();
  const storeId = user.storeId!;
  const store = app.stores[storeId]!;
  const inventory = storeInventory(app, storeId);
  const counts = bucketCounts(inventory);
  const [preset, setPreset] = useState(0);
  const orders = Object.values(app.orders)
    .filter((o) => o.storeId === storeId && (o.status === 'PLACED' || o.status === 'RX_APPROVED'))
    .reverse();
  const qaQueue = Object.values(app.pickups).filter((p) => p.qaStoreId === storeId && p.status === 'COLLECTED');

  const rejectRx = async (orderId: string) => {
    const reason = window.prompt('Reason for rejecting the prescription', 'Unreadable prescription');
    if (reason) report(await dispatch(user.id, { type: 'RX_REJECTED', orderId, reason }), 'Prescription rejected. The customer can re-upload');
  };

  const rejectQa = async (pickupId: string) => {
    const note = window.prompt('Why are these medicines rejected?', 'Seal broken');
    if (note) report(await dispatch(user.id, { type: 'PICKUP_QA_REJECTED', pickupId, note }), 'Rejected. A rider will take it to the CBWTF');
  };

  const scan = async () => {
    const parsed = parseGs1(BARCODE_PRESETS[preset]!.code);
    if (!parsed.ok) return report({ ok: false, error: parsed.error });
    const medicine = Object.values(app.medicines).find((m) => m.gtin === parsed.value.gtin);
    if (!medicine) return report({ ok: false, error: 'This barcode is not in the catalog' });
    const batch: Batch = {
      id: newId('b'),
      storeId,
      medicineId: medicine.id,
      batchNo: parsed.value.batch ?? 'UNKNOWN',
      expiry: parsed.value.expiry!,
      qty: 50,
      status: 'IN_STOCK',
    };
    report(await dispatch(user.id, { type: 'STOCK_INGESTED', batch }), `${medicine.brand} added: batch ${batch.batchNo}`);
  };

  const ecoSale = async (v: BatchView) =>
    report(
      await dispatch(user.id, { type: 'ECO_SALE_LISTED', batchId: v.batch.id, discountPct: suggestedDiscount(v.daysLeft) }),
      `${v.medicine.brand} is live in the Eco-Sale store`,
    );

  const schedulePickup = async (v: BatchView, kind: 'DONATION' | 'DISPOSAL') => {
    const ngo = app.ngos[NGO_ID]!;
    const result = await dispatch(user.id, {
      type: 'PICKUP_SCHEDULED',
      pickup: {
        id: newId('pk'),
        kind,
        sourceStoreId: storeId,
        qaStoreId: kind === 'DONATION' ? storeId : undefined,
        ngoId: kind === 'DONATION' ? ngo.id : undefined,
        batchId: v.batch.id,
        items: [
          { medicineId: v.medicine.id, batchNo: v.batch.batchNo, expiry: v.batch.expiry, qty: v.batch.qty, sealed: true, openedLiquid: false },
        ],
        status: 'SCHEDULED',
        address: `${store.name}, ${store.area}`,
        lat: store.lat,
        lng: store.lng,
        scheduledAt: app.today,
      },
    });
    report(result, kind === 'DONATION' ? `Rider summoned to donate to ${ngo.name}` : 'Yellow-Bag pickup scheduled for the CBWTF');
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl bg-gradient-to-r from-medical to-sky-500 p-5 text-white">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold">{store.name}</h1>
            <p className="text-sm text-sky-100">{store.area} · Licence {store.drugLicence}</p>
          </div>
          <Badge tone={store.kyc === 'APPROVED' ? 'green' : 'amber'}>{store.kyc === 'APPROVED' ? 'KYC approved' : 'Awaiting KYC'}</Badge>
        </div>
        <p className="mt-3 text-sm font-medium">₹0 licence · ₹0 add-ons · ₹0 AMC — saved ₹35,000/yr vs legacy ERPs</p>
      </motion.section>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Safe" value={counts.SAFE} hint="> 180 days" tone="green" />
        <Stat label="Lockout" value={counts.LOCKOUT} hint="30–180 days" tone="amber" />
        <Stat label="Critical" value={counts.CRITICAL} hint="1–29 days" tone="orange" />
        <Stat label="Expired" value={counts.EXPIRED} hint="Bio-hazard" tone="red" />
      </div>

      <Card className="space-y-3">
        <SectionTitle>Scan to ingest</SectionTitle>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={preset}
            onChange={(e) => setPreset(Number(e.target.value))}
            className="h-10 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-4 focus:ring-medical/20"
            aria-label="Preset barcode"
          >
            {BARCODE_PRESETS.map((p, i) => (
              <option key={p.code} value={i}>
                {p.label}
              </option>
            ))}
          </select>
          <Button onClick={() => void scan()}>
            <ScanLine className="size-4" /> Scan preset barcode
          </Button>
        </div>
        <p className="font-mono text-xs text-slate-500">{BARCODE_PRESETS[preset]!.code}</p>
        <p className="text-xs text-slate-500">GS1 parsing fills GTIN, batch and expiry automatically. Camera scanning arrives with the next roadmap step.</p>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <SectionTitle>Order packing desk</SectionTitle>
          <div className="space-y-3">
            {orders.length === 0 && <Card className="text-sm text-slate-500">No orders waiting. New customer orders appear here live.</Card>}
            {orders.map((o) => {
              const rx = o.prescriptionId ? app.prescriptions[o.prescriptionId] : undefined;
              const canPack = o.status === 'RX_APPROVED' || (o.status === 'PLACED' && o.rxStatus === 'NOT_REQUIRED');
              return (
                <Card key={o.id} className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-slate-900">{o.items.map((i) => `${app.medicines[i.medicineId]?.brand} ×${i.qty}`).join(', ')}</p>
                      <p className="text-xs text-slate-500">{app.users[o.customerId]?.name} · {inr(o.total)}</p>
                    </div>
                    {o.rxStatus === 'NOT_REQUIRED' && <Badge tone="green">OTC</Badge>}
                    {o.rxStatus === 'PENDING' && <Badge tone="amber">Rx to review</Badge>}
                    {o.rxStatus === 'APPROVED' && <Badge tone="green">Rx approved</Badge>}
                    {o.rxStatus === 'REJECTED' && <Badge tone="red">Rx rejected</Badge>}
                  </div>
                  {rx && (
                    <dl className="grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-3 text-xs">
                      <div><dt className="text-slate-500">Doctor</dt><dd className="font-semibold">{rx.doctorName}</dd></div>
                      <div><dt className="text-slate-500">Reg. no</dt><dd className="font-mono font-semibold">{rx.registrationNo}</dd></div>
                      <div><dt className="text-slate-500">Patient</dt><dd className="font-semibold">{rx.patientName}</dd></div>
                      <div><dt className="text-slate-500">Date</dt><dd className="font-semibold">{rx.date}</dd></div>
                    </dl>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {o.rxStatus === 'PENDING' && (
                      <>
                        <Button size="sm" variant="eco" onClick={async () => report(await dispatch(user.id, { type: 'RX_APPROVED', orderId: o.id }), 'Prescription approved')}>
                          <FileCheck className="size-4" /> Approve Rx
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => void rejectRx(o.id)}>Reject Rx</Button>
                      </>
                    )}
                    {canPack && (
                      <Button size="sm" onClick={async () => report(await dispatch(user.id, { type: 'ORDER_PACKED', orderId: o.id }), 'Packed. Riders can see the mission')}>
                        <PackageCheck className="size-4" /> Pack &amp; summon rider
                      </Button>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        </section>

        <section>
          <SectionTitle>Returned-medicine QA desk</SectionTitle>
          <div className="space-y-3">
            {qaQueue.length === 0 && <Card className="text-sm text-slate-500">Nothing to inspect. Donated strips arrive here after a rider collects them.</Card>}
            {qaQueue.map((p) => (
              <Card key={p.id} className="space-y-3">
                <div>
                  <p className="font-semibold text-slate-900">{p.items.map((i) => `${app.medicines[i.medicineId]?.brand} ×${i.qty}`).join(', ')}</p>
                  <p className="text-xs text-slate-500">
                    Batch {p.items[0]?.batchNo} · expires {p.items[0]?.expiry} · for {p.ngoId ? app.ngos[p.ngoId]?.name : 'NGO'}
                  </p>
                </div>
                <p className="text-xs text-slate-500">Check the seal, batch and expiry before releasing.</p>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="eco" onClick={async () => report(await dispatch(user.id, { type: 'PICKUP_QA_VERIFIED', pickupId: p.id }), 'QA verified. Released to NGO')}>
                    <ShieldCheck className="size-4" /> QA verified, release to NGO
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => void rejectQa(p.id)}>Reject, send to bio-disposal</Button>
                </div>
              </Card>
            ))}
          </div>
        </section>
      </div>

      <section>
        <SectionTitle>Expiry ledger</SectionTitle>
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Medicine</th>
                <th className="px-4 py-3">Batch</th>
                <th className="px-4 py-3 text-right">Qty</th>
                <th className="px-4 py-3">Expiry</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {inventory.map((v) => (
                <tr key={v.batch.id} className="border-b border-slate-50 transition-colors last:border-0 hover:bg-slate-50/60">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-slate-900">{v.medicine.brand}</div>
                    <div className="text-xs text-slate-500">{v.medicine.schedule === 'OTC' ? 'OTC' : `Schedule ${v.medicine.schedule}`}</div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{v.batch.batchNo}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{v.batch.qty}</td>
                  <td className="px-4 py-3">
                    <div className="tabular-nums">{v.batch.expiry}</div>
                    <div className="text-xs text-slate-500">{v.daysLeft > 0 ? `${v.daysLeft} days left` : `${-v.daysLeft} days ago`}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      <BucketBadge bucket={v.bucket} />
                      {v.batch.status === 'ECO_SALE' && <Badge tone="blue">Eco-Sale {v.batch.ecoDiscountPct}% off</Badge>}
                      {v.batch.status === 'DONATION_PENDING' && <Badge tone="green">Donation pickup</Badge>}
                      {v.batch.status === 'DISPOSAL_PENDING' && <Badge tone="orange">Yellow-Bag pickup</Badge>}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {v.batch.status === 'IN_STOCK' && v.batch.qty > 0 && (
                      <div className="flex justify-end gap-1.5">
                        {v.bucket !== 'EXPIRED' && (
                          <>
                            <Button size="sm" variant="amber" onClick={() => void ecoSale(v)}>
                              <Tag className="size-3.5" /> Eco-Sale
                            </Button>
                            <Button size="sm" variant="eco" onClick={() => void schedulePickup(v, 'DONATION')}>
                              <Gift className="size-3.5" /> Donate
                            </Button>
                          </>
                        )}
                        {v.bucket === 'EXPIRED' && (
                          <Button size="sm" variant="danger" onClick={() => void schedulePickup(v, 'DISPOSAL')}>
                            <Trash2 className="size-3.5" /> Dispose
                          </Button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </section>
    </div>
  );
}

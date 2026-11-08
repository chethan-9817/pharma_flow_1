import { motion } from 'framer-motion';
import { CheckCircle2, Droplets, Package, ShieldCheck, Skull, TrendingUp, XCircle } from 'lucide-react';
import { kpis } from '../../domain/selectors';
import type { User } from '../../domain/types';
import { Badge, Button, Card, SectionTitle, Stat, inr } from '../../components/ui';
import { report, toast } from '../../components/toast';
import { dispatch, pharma, useApp, usePharma } from '../../store';

export function AdminPage({ user }: { user: User }) {
  const app = useApp();
  const chain = usePharma((s) => s.chain);
  const k = kpis(app);
  const pending = Object.values(app.stores).filter((s) => s.kyc === 'PENDING_KYC');
  const recent = [...chain].reverse().slice(0, 10);

  const verify = async () => {
    const result = await pharma.getState().verifyLedger();
    if (result.ok) toast(`Chain intact: ${result.length} events verified`);
    else toast(`Tampering detected at event #${result.brokenAt}: ${result.reason}`, 'error');
  };

  const decide = async (storeId: string, decision: 'APPROVED' | 'REJECTED') =>
    report(await dispatch(user.id, { type: 'KYC_DECIDED', storeId, decision }), `Pharmacy ${decision.toLowerCase()}`);

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <h1 className="text-xl font-bold text-slate-900">Admin &amp; regulatory portal</h1>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Dead stock recovered" value={inr(k.deadStockRecovered)} hint="Eco-Sale revenue" tone="blue" />
        <Stat label="Hazardous waste diverted" value={`${k.hazardousKgDiverted} kg`} hint="Via CBWTF" tone="orange" />
        <Stat label="Medicines to NGOs" value={inr(k.ngoMedicineValue)} hint="At MRP" tone="green" />
        <Stat label="Blood donations" value={`${k.bloodDonationsCompleted}/${k.bloodDonationsBooked}`} hint="Completed / booked" tone="red" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <SectionTitle>Pharmacy KYC queue</SectionTitle>
          <div className="space-y-3">
            {pending.length === 0 && <Card className="text-sm text-slate-500">No pharmacies waiting for review.</Card>}
            {pending.map((s) => (
              <motion.div key={s.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                <Card className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-semibold text-slate-900">{s.name}</h3>
                      <p className="text-xs text-slate-500">{s.area}</p>
                    </div>
                    <Badge tone="amber">PENDING_KYC</Badge>
                  </div>
                  <dl className="grid grid-cols-2 gap-2 text-xs">
                    <div><dt className="text-slate-500">Drug licence</dt><dd className="font-mono font-semibold">{s.drugLicence}</dd></div>
                    <div><dt className="text-slate-500">GSTIN</dt><dd className="font-mono font-semibold">{s.gstin}</dd></div>
                  </dl>
                  <div className="flex gap-2">
                    <Button size="sm" variant="eco" onClick={() => void decide(s.id, 'APPROVED')}><CheckCircle2 className="size-4" /> Approve</Button>
                    <Button size="sm" variant="ghost" onClick={() => void decide(s.id, 'REJECTED')}><XCircle className="size-4" /> Reject</Button>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
          <p className="mt-3 flex items-center gap-2 text-xs text-slate-500">
            <Package className="size-3.5" /> {k.ordersDelivered} orders delivered
            <Skull className="ml-2 size-3.5" /> Expired stock goes only to CBWTF
            <Droplets className="ml-2 size-3.5" /> Blood rewards carry no money value
          </p>
        </section>

        <section>
          <SectionTitle
            action={
              <Button size="sm" onClick={() => void verify()}>
                <ShieldCheck className="size-4" /> Verify ledger integrity
              </Button>
            }
          >
            Audit trail
          </SectionTitle>
          <Card className="divide-y divide-slate-100 p-0">
            {recent.length === 0 && <p className="p-4 text-sm text-slate-500">No events yet. Actions in the other tabs appear here live.</p>}
            {recent.map((e) => (
              <div key={e.hash} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <TrendingUp className="size-4 shrink-0 text-slate-400" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-slate-900">{e.event.type.replaceAll('_', ' ').toLowerCase()}</p>
                  <p className="truncate text-xs text-slate-500">{app.users[e.event.actorId]?.name ?? e.event.actorId} · {e.event.at}</p>
                </div>
                <code className="text-[11px] text-slate-400">#{e.index} {e.hash.slice(0, 8)}</code>
              </div>
            ))}
          </Card>
        </section>
      </div>
    </div>
  );
}

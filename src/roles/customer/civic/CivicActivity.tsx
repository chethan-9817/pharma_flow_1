import { Award, Download, Droplets, Truck } from 'lucide-react';
import type { AppState, Certificate } from '../../../domain/state';
import type { Pickup, PickupStatus, User } from '../../../domain/types';
import { Badge, Button, Card, SectionTitle } from '../../../components/ui';
import { toast } from '../../../components/toast';
import { downloadCertificate } from '../../../lib/certificatePdf';
import { useApp } from '../../../store';

const CERT_TITLE: Record<Certificate['kind'], string> = {
  NGO_DONOR: 'NGO Donor',
  GREEN_CITIZEN: 'Green Citizen',
  BLOOD_DONOR: 'Blood Donor',
};

function pickupStatus(app: AppState, p: Pickup): { text: string; tone: 'blue' | 'green' | 'amber' | 'orange' | 'red' } {
  const ngo = p.ngoId ? app.ngos[p.ngoId]?.name : undefined;
  const map: Record<PickupStatus, { text: string; tone: 'blue' | 'green' | 'amber' | 'orange' | 'red' }> = {
    SCHEDULED: { text: p.riderId ? 'Rider is on the way' : 'Waiting for a rider', tone: 'blue' },
    COLLECTED: { text: p.kind === 'DONATION' ? 'Collected. The pharmacist is checking it' : 'Collected. On the way to the CBWTF plant', tone: 'amber' },
    QA_VERIFIED: { text: `Verified. Heading to ${ngo ?? 'the NGO'}`, tone: 'green' },
    QA_REJECTED: { text: 'Did not pass the check. Going for safe disposal', tone: 'orange' },
    DELIVERED_TO_NGO: { text: `Delivered to ${ngo ?? 'the NGO'}`, tone: 'green' },
    INCINERATED: { text: p.kind === 'DISPOSAL' ? 'Safely incinerated' : 'Safely incinerated after the check', tone: p.kind === 'DISPOSAL' ? 'green' : 'orange' },
  };
  return map[p.status];
}

export function CivicActivity({ user }: { user: User }) {
  const app = useApp();
  const pickups = Object.values(app.pickups).filter((p) => p.sourceUserId === user.id).reverse();
  const bookings = Object.values(app.bloodBookings).filter((b) => b.userId === user.id).reverse();
  const certificates = app.certificates.filter((c) => c.userId === user.id).reverse();

  const download = async (cert: Certificate) => {
    try {
      await downloadCertificate(cert, { holderName: user.name, origin: window.location.origin });
    } catch {
      toast('Could not create the PDF. Please try again.', 'error');
    }
  };

  return (
    <div className="grid gap-6 @3xl:grid-cols-2">
      <section className="space-y-3">
        <SectionTitle>My pickups</SectionTitle>
        {pickups.length === 0 && <Card className="text-sm text-slate-500">No pickups yet. Donate or dispose of medicines above and track them here.</Card>}
        {pickups.map((p) => {
          const st = pickupStatus(app, p);
          return (
            <Card key={p.id} className="space-y-2">
              <div className="flex items-start gap-3">
                <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${p.kind === 'DONATION' ? 'bg-emerald-50 text-eco-dark' : 'bg-orange-50 text-orange-600'}`}>
                  <Truck className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-900">
                    {p.kind === 'DONATION' ? 'Donation' : 'Yellow-Bag disposal'}: {p.items.map((i) => `${app.medicines[i.medicineId]?.brand} ×${i.qty}`).join(', ')}
                  </p>
                  <Badge tone={st.tone}>{st.text}</Badge>
                </div>
              </div>
              {p.qaNote && <p className="rounded-lg bg-slate-50 px-3 py-1.5 text-xs text-slate-600">Pharmacist note: {p.qaNote}</p>}
            </Card>
          );
        })}
      </section>

      <div className="space-y-6">
        <section className="space-y-3">
          <SectionTitle>My blood appointments</SectionTitle>
          {bookings.length === 0 && <Card className="text-sm text-slate-500">No appointments yet.</Card>}
          {bookings.map((b) => (
            <Card key={b.id} className="flex items-center gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-rose-50 text-blood">
                <Droplets className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-900">{app.bloodBanks[b.bloodBankId]?.name}</p>
                <p className="text-xs text-slate-500">{b.date} · group {b.bloodGroup}</p>
              </div>
              <Badge tone={b.status === 'DONATED' ? 'green' : 'amber'}>{b.status === 'DONATED' ? 'Donated' : 'Booked'}</Badge>
            </Card>
          ))}
        </section>

        <section className="space-y-3">
          <SectionTitle>My certificates</SectionTitle>
          {certificates.length === 0 && <Card className="text-sm text-slate-500">Complete a donation, a safe disposal or a blood donation to earn a certificate with a QR code.</Card>}
          {certificates.map((c) => (
            <Card key={c.id} className="flex items-center gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-amber-50 text-expiry">
                <Award className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-900">
                  <span className="truncate">{CERT_TITLE[c.kind]} Certificate</span>
                  {c.kind === 'BLOOD_DONOR' && <Badge tone="red">Lifesaver badge</Badge>}
                </p>
                <p className="truncate text-xs text-slate-500">{c.summary} · code {c.verifyCode}</p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => void download(c)}>
                <Download className="size-4" /> PDF
              </Button>
            </Card>
          ))}
        </section>
      </div>
    </div>
  );
}

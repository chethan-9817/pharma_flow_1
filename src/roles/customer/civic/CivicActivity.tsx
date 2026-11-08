import { Award, Download, Droplets, HeartHandshake, Truck } from 'lucide-react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { customerSponsorships, type SponsorshipView } from '../../../domain/selectors';
import type { AppState, Certificate } from '../../../domain/state';
import type { Pickup, User } from '../../../domain/types';
import { Badge, Button, Card, SectionTitle, inr } from '../../../components/ui';
import { toast } from '../../../components/toast';
import { downloadCertificate } from '../../../lib/certificatePdf';
import { useApp } from '../../../store';

type Tone = 'blue' | 'green' | 'amber' | 'orange' | 'red';
type Status = { text: string; tone: Tone };

function pickupStatus(app: AppState, p: Pickup, t: TFunction): Status {
  const ngo = p.ngoId ? app.ngos[p.ngoId]?.name : undefined;
  const donation = p.kind === 'DONATION';
  switch (p.status) {
    case 'SCHEDULED':
      return { text: p.riderId ? t('customer.activity.status.riderComing') : t('customer.activity.status.waitingRider'), tone: 'blue' };
    case 'COLLECTED':
      return { text: donation ? t('customer.activity.status.collectedDonation') : t('customer.activity.status.collectedDisposal'), tone: 'amber' };
    case 'QA_VERIFIED':
      return { text: t('customer.activity.status.verified', { ngo: ngo ?? t('customer.activity.status.theNgo') }), tone: 'green' };
    case 'QA_REJECTED':
      return { text: t('customer.activity.status.rejected'), tone: 'orange' };
    case 'DELIVERED_TO_NGO':
      return { text: t('customer.activity.status.deliveredTo', { ngo: ngo ?? t('customer.activity.status.theNgo') }), tone: 'green' };
    case 'INCINERATED':
      return donation
        ? { text: t('customer.activity.status.incineratedAfterCheck'), tone: 'orange' }
        : { text: t('customer.activity.status.incinerated'), tone: 'green' };
  }
}

function sponsorshipStatus(app: AppState, v: SponsorshipView, t: TFunction): Status {
  const { sponsorship: sp, pickup } = v;
  if (sp.status === 'DELIVERED') return { text: t('customer.activity.status.deliveredTo', { ngo: v.ngoName }), tone: 'green' };
  if (sp.status === 'REFUNDED') return { text: t('customer.activity.status.refunded', { amount: inr(sp.amount) }), tone: 'orange' };
  return pickup ? pickupStatus(app, pickup, t) : { text: t('customer.activity.status.waitingRider'), tone: 'blue' };
}

export function CivicActivity({ user }: { user: User }) {
  const { t } = useTranslation();
  const app = useApp();
  const pickups = Object.values(app.pickups).filter((p) => p.sourceUserId === user.id).reverse();
  const sponsorships = customerSponsorships(app, user.id);
  const bookings = Object.values(app.bloodBookings).filter((b) => b.userId === user.id).reverse();
  const certificates = app.certificates.filter((c) => c.userId === user.id).reverse();

  const download = async (cert: Certificate) => {
    try {
      await downloadCertificate(cert, { holderName: user.name, origin: window.location.origin });
    } catch {
      toast(t('customer.activity.pdfFailed'), 'error');
    }
  };

  return (
    <div className="grid gap-6 @3xl:grid-cols-2">
      <section className="space-y-3">
        <SectionTitle>{t('customer.activity.myPickups')}</SectionTitle>
        {pickups.length === 0 && <Card className="text-sm text-slate-500">{t('customer.activity.noPickups')}</Card>}
        {pickups.map((p) => {
          const st = pickupStatus(app, p, t);
          return (
            <Card key={p.id} className="space-y-2">
              <div className="flex items-start gap-3">
                <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${p.kind === 'DONATION' ? 'bg-emerald-50 text-eco-dark' : 'bg-orange-50 text-orange-600'}`}>
                  <Truck className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-900">
                    {p.kind === 'DONATION' ? t('customer.activity.donation') : t('customer.activity.disposal')}: {p.items.map((i) => `${app.medicines[i.medicineId]?.brand} ×${i.qty}`).join(', ')}
                  </p>
                  <Badge tone={st.tone}>{st.text}</Badge>
                </div>
              </div>
              {p.qaNote && <p className="rounded-lg bg-slate-50 px-3 py-1.5 text-xs text-slate-600">{t('customer.activity.pharmacistNote', { note: p.qaNote })}</p>}
            </Card>
          );
        })}
      </section>

      <div className="space-y-6">
        <section className="space-y-3">
          <SectionTitle>{t('customer.activity.mySponsorships')}</SectionTitle>
          {sponsorships.length === 0 && <Card className="text-sm text-slate-500">{t('customer.activity.noSponsorships')}</Card>}
          {sponsorships.map((v) => {
            const st = sponsorshipStatus(app, v, t);
            const { sponsorship: sp } = v;
            return (
              <Card key={sp.id} className="space-y-2">
                <div className="flex items-start gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-emerald-50 text-eco-dark">
                    <HeartHandshake className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {t('customer.activity.sponsorLine', { brand: v.medicine.brand, qty: sp.qty, ngo: v.ngoName })}
                    </p>
                    <p className="truncate text-xs text-slate-500">{t('customer.activity.sponsorFrom', { amount: inr(sp.amount), store: v.storeName })}</p>
                    <Badge tone={st.tone}>{st.text}</Badge>
                  </div>
                </div>
              </Card>
            );
          })}
        </section>

        <section className="space-y-3">
          <SectionTitle>{t('customer.activity.myBlood')}</SectionTitle>
          {bookings.length === 0 && <Card className="text-sm text-slate-500">{t('customer.activity.noBlood')}</Card>}
          {bookings.map((b) => (
            <Card key={b.id} className="flex items-center gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-rose-50 text-blood">
                <Droplets className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-900">{app.bloodBanks[b.bloodBankId]?.name}</p>
                <p className="text-xs text-slate-500">{b.date} · {t('admin.group', { group: b.bloodGroup })}</p>
              </div>
              <Badge tone={b.status === 'DONATED' ? 'green' : 'amber'}>{b.status === 'DONATED' ? t('customer.activity.donated') : t('customer.activity.bookedBadge')}</Badge>
            </Card>
          ))}
        </section>

        <section className="space-y-3">
          <SectionTitle>{t('customer.activity.myCertificates')}</SectionTitle>
          {certificates.length === 0 && <Card className="text-sm text-slate-500">{t('customer.activity.noCertificates')}</Card>}
          {certificates.map((c) => (
            <Card key={c.id} className="flex items-center gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-amber-50 text-expiry">
                <Award className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-900">
                  <span className="truncate">{t('customer.activity.certificate', { title: t(`customer.activity.certKinds.${c.kind}`) })}</span>
                  {c.kind === 'BLOOD_DONOR' && <Badge tone="red">{t('customer.activity.lifesaver')}</Badge>}
                </p>
                <p className="truncate text-xs text-slate-500">{c.summary} · {t('verify.code').toLowerCase()} {c.verifyCode}</p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => void download(c)}>
                <Download className="size-4" /> {t('customer.activity.pdf')}
              </Button>
            </Card>
          ))}
        </section>
      </div>
    </div>
  );
}

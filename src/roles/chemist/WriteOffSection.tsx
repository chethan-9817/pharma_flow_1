import { FileText } from 'lucide-react';
import { storeWriteOffs } from '../../domain/selectors';
import type { User } from '../../domain/types';
import { Badge, Button, Card, SectionTitle, inr } from '../../components/ui';
import { toast } from '../../components/toast';
import { downloadWriteOff } from '../../lib/certificatePdf';
import { useApp } from '../../store';

/**
 * "Inventory Write-Off & NGO Donation Receipt" for finished donations and disposals.
 * It records the GST input-tax-credit reversal (CGST Sec 17(5)(h)). It is not an 80G receipt.
 */
export function WriteOffSection({ user }: { user: User }) {
  const app = useApp();
  const store = app.stores[user.storeId!]!;
  const items = storeWriteOffs(app, store.id);

  const download = async (index: number) => {
    const item = items[index]!;
    try {
      await downloadWriteOff(item.certificate, {
        storeName: store.name,
        storeArea: store.area,
        drugLicence: store.drugLicence,
        gstin: store.gstin,
        reference: `WO-${item.pickup.id}`,
      });
    } catch {
      toast('Could not create the PDF. Please try again.', 'error');
    }
  };

  return (
    <section>
      <SectionTitle>Write-off receipts</SectionTitle>
      <div className="grid gap-3 @container md:grid-cols-2">
        {items.length === 0 && (
          <Card className="text-sm text-slate-500 md:col-span-2">
            When a donation reaches an NGO or expired stock is incinerated, its receipt with the GST ITC reversal appears here as a PDF.
          </Card>
        )}
        {items.map(({ pickup, certificate }, i) => (
          <Card key={pickup.id} className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-sky-50 text-medical">
              <FileText className="size-5" />
            </span>
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate font-semibold text-slate-900">{certificate.lines.map((l) => `${l.brand} ×${l.qty}`).join(', ')}</p>
                <Badge tone={certificate.reason === 'NGO_DONATION' ? 'green' : 'orange'}>
                  {certificate.reason === 'NGO_DONATION' ? 'NGO donation' : 'Bio-disposal'}
                </Badge>
              </div>
              <p className="text-xs text-slate-500">To {certificate.recipient}</p>
              <p className="text-xs text-slate-600">
                Cost value {inr(certificate.totalCostValue)} · <b>ITC reversal {inr(certificate.totalItcReversal)}</b> at {certificate.gstRatePct}%
              </p>
            </div>
            <Button size="sm" variant="ghost" onClick={() => void download(i)}>
              PDF
            </Button>
          </Card>
        ))}
      </div>
    </section>
  );
}

import { Printer } from 'lucide-react';
import QRCode from 'qrcode';
import { useEffect, useState } from 'react';
import { Button } from '../../components/ui';
import { BARCODE_PRESETS } from '../../seed/barcodes';

/**
 * QR codes that carry the same GS1 strings as the preset barcodes. Show this page on a phone
 * (or print it) and point the chemist camera at it to demo scan-to-ingest without real strips.
 */
export function DemoBarcodes() {
  const [images, setImages] = useState<Record<string, string>>({});

  useEffect(() => {
    let alive = true;
    void Promise.all(
      BARCODE_PRESETS.map(async (p) => [p.code, await QRCode.toDataURL(p.code, { width: 360, margin: 2, errorCorrectionLevel: 'M' })] as const),
    ).then((pairs) => alive && setImages(Object.fromEntries(pairs)));
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Demo barcodes</h1>
          <p className="text-sm text-slate-500">Open the Chemist tab, press “Scan with camera” and hold one of these in front of the camera.</p>
        </div>
        <Button onClick={() => window.print()}>
          <Printer className="size-4" /> Print
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {BARCODE_PRESETS.map((p) => (
          <figure key={p.code} className="break-inside-avoid rounded-2xl bg-white p-4 text-center shadow-sm ring-1 ring-slate-200">
            {images[p.code] ? (
              <img src={images[p.code]} alt={`QR code for ${p.label}`} className="mx-auto size-56" />
            ) : (
              <div className="mx-auto size-56 animate-pulse rounded-xl bg-slate-100" />
            )}
            <figcaption className="mt-3 space-y-1">
              <p className="text-sm font-semibold text-slate-900">{p.label}</p>
              <p className="break-all font-mono text-[11px] text-slate-500">{p.code}</p>
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}

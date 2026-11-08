import { Camera, FileText, Loader2, ScanText } from 'lucide-react';
import { useRef, useState } from 'react';
import type { Medicine, Prescription } from '../../domain/types';
import { parseRxText } from '../../domain/rules/rxText';
import { readImageAsDataUrl } from '../../lib/image';
import { readPrescriptionText } from '../../lib/ocr';
import { toast } from '../../components/toast';

export interface RxDraft {
  doctorName: string;
  registrationNo: string;
  date: string;
  patientName: string;
  /** Quantity the prescription covers, per drug. */
  qty: Record<string, number>;
  imageDataUrl?: string;
}

export function emptyDraft(patientName: string, today: string, drugs: { medicineId: string; qty: number }[]): RxDraft {
  return {
    doctorName: '',
    registrationNo: '',
    date: today,
    patientName,
    qty: Object.fromEntries(drugs.map((d) => [d.medicineId, d.qty])),
  };
}

export function draftToPrescription(draft: RxDraft, id: string, customerId: string): Prescription {
  return {
    id,
    customerId,
    doctorName: draft.doctorName.trim(),
    registrationNo: draft.registrationNo.trim(),
    date: draft.date,
    patientName: draft.patientName.trim(),
    drugs: Object.entries(draft.qty).map(([medicineId, qty]) => ({ medicineId, qty })),
    ...(draft.imageDataUrl ? { imageDataUrl: draft.imageDataUrl } : {}),
  };
}

const field =
  'h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-medical focus:ring-4 focus:ring-medical/15';

interface Props {
  draft: RxDraft;
  onChange: (draft: RxDraft) => void;
  /** Rx-only medicines the prescription must cover. */
  drugs: Medicine[];
  catalog: Medicine[];
}

export function RxForm({ draft, onChange, drugs, catalog }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const set = (patch: Partial<RxDraft>) => onChange({ ...draft, ...patch });

  const pick = async (file: File | undefined) => {
    if (!file) return;
    try {
      set({ imageDataUrl: await readImageAsDataUrl(file) });
      setNote(null);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not read the image', 'error');
    }
  };

  const runOcr = async () => {
    if (!draft.imageDataUrl) return;
    setProgress(0);
    try {
      const text = await readPrescriptionText(draft.imageDataUrl, setProgress);
      const found = parseRxText(text, catalog);
      const patch: Partial<RxDraft> = {};
      if (found.doctorName) patch.doctorName = found.doctorName;
      if (found.registrationNo) patch.registrationNo = found.registrationNo;
      if (found.date) patch.date = found.date;
      if (found.patientName) patch.patientName = found.patientName;
      const qty = { ...draft.qty };
      for (const d of found.drugs) if (d.qty && d.medicineId in qty) qty[d.medicineId] = d.qty;
      onChange({ ...draft, ...patch, qty });
      const filled = Object.keys(patch).length;
      setNote(
        filled > 0
          ? `OCR suggested ${filled} field${filled > 1 ? 's' : ''}. Please check them. The pharmacist makes the final decision.`
          : 'OCR could not read this photo. Please type the details from the prescription.',
      );
    } catch {
      setNote('OCR is not available right now (it needs a one-time language download). Type the details instead.');
    } finally {
      setProgress(null);
    }
  };

  return (
    <div className="space-y-3 rounded-2xl bg-amber-50/60 p-3 ring-1 ring-amber-200">
      <div className="flex items-center gap-2 text-sm font-semibold text-amber-900">
        <FileText className="size-4" /> Prescription required
      </div>
      <p className="text-xs text-amber-800">
        Needed for: <b>{drugs.map((d) => d.brand).join(', ')}</b>. The pharmacist reviews it before your order is packed.
      </p>

      <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => void pick(e.target.files?.[0])} />
      {draft.imageDataUrl ? (
        <img src={draft.imageDataUrl} alt="Uploaded prescription" className="max-h-40 w-full rounded-xl object-cover ring-1 ring-slate-200" />
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => fileRef.current?.click()} className="flex h-9 items-center gap-1.5 rounded-xl bg-white px-3 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50">
          <Camera className="size-4" /> {draft.imageDataUrl ? 'Change photo' : 'Upload prescription photo'}
        </button>
        {draft.imageDataUrl && (
          <button type="button" disabled={progress !== null} onClick={() => void runOcr()} className="flex h-9 items-center gap-1.5 rounded-xl bg-white px-3 text-xs font-semibold text-medical-dark ring-1 ring-sky-200 hover:bg-sky-50">
            {progress !== null ? <Loader2 className="size-4 animate-spin" /> : <ScanText className="size-4" />}
            {progress !== null ? `Reading… ${Math.round(progress * 100)}%` : 'Read with OCR'}
          </button>
        )}
      </div>
      {note && <p className="rounded-lg bg-white px-3 py-2 text-xs text-slate-600 ring-1 ring-slate-200">{note}</p>}

      <div className="grid grid-cols-2 gap-2">
        <label className="col-span-2 text-xs font-medium text-slate-600">
          Doctor name
          <input className={field} value={draft.doctorName} onChange={(e) => set({ doctorName: e.target.value })} placeholder="Dr. Meera Rao" />
        </label>
        <label className="text-xs font-medium text-slate-600">
          Registration no.
          <input className={field} value={draft.registrationNo} onChange={(e) => set({ registrationNo: e.target.value })} placeholder="KMC-48213" />
        </label>
        <label className="text-xs font-medium text-slate-600">
          Date
          <input type="date" className={field} value={draft.date} onChange={(e) => set({ date: e.target.value })} />
        </label>
        <label className="col-span-2 text-xs font-medium text-slate-600">
          Patient name
          <input className={field} value={draft.patientName} onChange={(e) => set({ patientName: e.target.value })} />
        </label>
      </div>

      <div className="space-y-1.5">
        <p className="text-xs font-medium text-slate-600">Quantity the prescription covers</p>
        {drugs.map((d) => (
          <label key={d.id} className="flex items-center justify-between gap-3 text-sm">
            <span className="font-medium text-slate-800">{d.brand}</span>
            <input
              type="number"
              min={1}
              className={`${field} w-24 text-center`}
              value={draft.qty[d.id] ?? 1}
              onChange={(e) => set({ qty: { ...draft.qty, [d.id]: Math.max(1, Number(e.target.value) || 1) } })}
            />
          </label>
        ))}
      </div>
    </div>
  );
}

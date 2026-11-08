import type { ReactNode } from 'react';
import type { Medicine } from '../../../domain/types';

export const inputCls =
  'h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-medical focus:ring-4 focus:ring-medical/15';

export function Field({ label, children, className = '' }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={`block text-xs font-medium text-slate-600 ${className}`}>
      {label}
      <div className="mt-1">{children}</div>
    </label>
  );
}

/** The strip the customer is handing over: what it is, its batch, expiry and how many. */
export interface StripDraft {
  medicineId: string;
  batchNo: string;
  expiry: string;
  qty: number;
}

export const emptyStrip = (medicineId = ''): StripDraft => ({ medicineId, batchNo: '', expiry: '', qty: 1 });

interface StripFieldsProps {
  draft: StripDraft;
  onChange: (draft: StripDraft) => void;
  medicines: Medicine[];
  /** Latest date the expiry picker allows, as an ISO date. Used for expired medicines. */
  maxExpiry?: string;
}

export function StripFields({ draft, onChange, medicines, maxExpiry }: StripFieldsProps) {
  const set = (patch: Partial<StripDraft>) => onChange({ ...draft, ...patch });
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Medicine" className="sm:col-span-2">
        <select className={inputCls} value={draft.medicineId} onChange={(e) => set({ medicineId: e.target.value })}>
          <option value="">Choose a medicine…</option>
          {medicines.map((m) => (
            <option key={m.id} value={m.id}>
              {m.brand} · {m.packSize}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Batch number (printed on the strip)">
        <input className={inputCls} value={draft.batchNo} onChange={(e) => set({ batchNo: e.target.value })} placeholder="e.g. DL26K01" />
      </Field>
      <Field label="Expiry date">
        <input type="date" className={inputCls} value={draft.expiry} max={maxExpiry} onChange={(e) => set({ expiry: e.target.value })} />
      </Field>
      <Field label="Number of strips or bottles">
        <input type="number" min={1} className={inputCls} value={draft.qty} onChange={(e) => set({ qty: Math.max(1, Number(e.target.value) || 1) })} />
      </Field>
    </div>
  );
}

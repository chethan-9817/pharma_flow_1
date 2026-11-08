import { motion } from 'framer-motion';
import { Camera, CheckCircle2, ExternalLink, Keyboard, ListPlus, PackagePlus, ScanLine } from 'lucide-react';
import { useCallback, useRef, useState, type ComponentType, type FormEvent } from 'react';
import { parseScan } from '../../domain/rules/gs1';
import type { Batch, User } from '../../domain/types';
import { Badge, Button, Card, SectionTitle } from '../../components/ui';
import { report, toast } from '../../components/toast';
import { newId } from '../../lib/id';
import { BARCODE_PRESETS } from '../../seed/barcodes';
import { dispatch, useApp } from '../../store';
import { ScannerDialog } from './ScannerDialog';

/** The three ways to enter stock. All of them end at the same confirm step. */
export type AddMode = 'scan' | 'type' | 'pick';

const MODES: { id: AddMode; label: string; icon: ComponentType<{ className?: string }> }[] = [
  { id: 'scan', label: 'Scan barcode', icon: Camera },
  { id: 'type', label: 'Type barcode', icon: Keyboard },
  { id: 'pick', label: 'Choose medicine', icon: ListPlus },
];

interface Pending {
  medicineId: string;
  batchNo: string;
  expiry: string;
  qty: number;
  /** Where the medicine came from, and which fields the barcode already filled. */
  source: 'barcode' | 'manual';
  fromBarcode: { batch: boolean; expiry: boolean };
}

const input =
  'h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-medical focus:ring-4 focus:ring-medical/15';

interface Props {
  user: User;
  mode: AddMode;
  onModeChange: (mode: AddMode) => void;
}

export function AddInventory({ user, mode, onModeChange }: Props) {
  const app = useApp();
  const [cameraOpen, setCameraOpen] = useState(false);
  const [preset, setPreset] = useState(0);
  const [pending, setPending] = useState<Pending | null>(null);
  const [typed, setTyped] = useState('');
  const [typedError, setTypedError] = useState<string | null>(null);
  const typedRef = useRef<HTMLInputElement>(null);
  const storeId = user.storeId!;
  const catalog = Object.values(app.medicines).sort((a, b) => a.brand.localeCompare(b.brand));

  /** Turns raw barcode text into a form the chemist can confirm. Returns an error message, or null on success. */
  const load = useCallback(
    (text: string): string | null => {
      const parsed = parseScan(text);
      if (!parsed.ok) return `Could not read that barcode: ${parsed.error}`;
      const medicine = Object.values(app.medicines).find((m) => m.gtin === parsed.value.gtin);
      if (!medicine) return `Barcode ${parsed.value.gtin} is not in the catalog`;
      setPending({
        medicineId: medicine.id,
        batchNo: parsed.value.batch ?? '',
        expiry: parsed.value.expiry ?? '',
        qty: 50,
        source: 'barcode',
        fromBarcode: { batch: Boolean(parsed.value.batch), expiry: Boolean(parsed.value.expiry) },
      });
      toast(`Found ${medicine.brand}`);
      return null;
    },
    [app.medicines],
  );

  const onCameraScan = useCallback(
    (text: string) => {
      setCameraOpen(false);
      const error = load(text);
      if (error) toast(error, 'error');
    },
    [load],
  );

  const lookupTyped = (e: FormEvent) => {
    e.preventDefault();
    if (!typed.trim()) return setTypedError('Type the number printed under the barcode');
    const error = load(typed);
    setTypedError(error);
    if (!error) setTyped('');
  };

  /** Camera could not read the strip (or is missing): move the chemist to the typing field. */
  const switchToTyping = useCallback(() => {
    setCameraOpen(false);
    onModeChange('type');
    setTimeout(() => typedRef.current?.focus(), 200);
  }, [onModeChange]);

  const pickMedicine = (medicineId: string) => {
    if (!medicineId) return setPending(null);
    setPending({ medicineId, batchNo: '', expiry: '', qty: 50, source: 'manual', fromBarcode: { batch: false, expiry: false } });
  };

  const confirm = async () => {
    if (!pending) return;
    const batch: Batch = {
      id: newId('b'),
      storeId,
      medicineId: pending.medicineId,
      batchNo: pending.batchNo.trim(),
      expiry: pending.expiry,
      qty: pending.qty,
      status: 'IN_STOCK',
    };
    if (!batch.batchNo) return toast('Enter the batch number', 'error');
    if (!batch.expiry) return toast('Enter the expiry date', 'error');
    const medicine = app.medicines[batch.medicineId]!;
    if (report(await dispatch(user.id, { type: 'STOCK_INGESTED', batch }), `${medicine.brand} added: batch ${batch.batchNo}`)) {
      setPending(null);
    }
  };

  const medicine = pending ? app.medicines[pending.medicineId] : undefined;

  return (
    <Card id="add-inventory" className="scroll-mt-24 space-y-4">
      <SectionTitle
        action={
          <a href="/demo-barcodes" target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs font-medium text-medical hover:underline">
            Printable demo barcodes <ExternalLink className="size-3" />
          </a>
        }
      >
        <span className="flex items-center gap-2">
          <PackagePlus className="size-4" /> Add inventory
        </span>
      </SectionTitle>
      <p className="-mt-2 text-sm text-slate-500">Add a new batch to your shop. Choose how you want to enter it.</p>

      <div role="tablist" aria-label="How to add stock" className="grid grid-cols-3 gap-1 rounded-2xl bg-slate-100 p-1">
        {MODES.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            role="tab"
            aria-selected={mode === id}
            onClick={() => onModeChange(id)}
            className={`flex items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-xs font-semibold transition-all sm:text-sm ${
              mode === id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Icon className="size-4" />
            {label}
          </button>
        ))}
      </div>

      {mode === 'scan' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => setCameraOpen(true)}>
              <Camera className="size-4" /> Scan with camera
            </Button>
            <span className="text-xs text-slate-400">or use a preset</span>
            <select value={preset} onChange={(e) => setPreset(Number(e.target.value))} className={`${input} min-w-0 flex-1`} aria-label="Preset barcode">
              {BARCODE_PRESETS.map((p, i) => (
                <option key={p.code} value={i}>
                  {p.label}
                </option>
              ))}
            </select>
            <Button
              variant="ghost"
              onClick={() => {
                const error = load(BARCODE_PRESETS[preset]!.code);
                if (error) toast(error, 'error');
              }}
            >
              <ScanLine className="size-4" /> Use preset
            </Button>
          </div>
          <p className="font-mono text-xs text-slate-500">{BARCODE_PRESETS[preset]!.code}</p>
          <p className="text-xs text-slate-500">
            Camera not reading the strip?{' '}
            <button className="font-semibold text-medical hover:underline" onClick={() => switchToTyping()}>
              Type the barcode
            </button>{' '}
            or{' '}
            <button className="font-semibold text-medical hover:underline" onClick={() => onModeChange('pick')}>
              choose the medicine yourself
            </button>
            .
          </p>
        </div>
      )}

      {mode === 'type' && (
        <form onSubmit={lookupTyped} className="space-y-1.5 rounded-2xl bg-slate-50 p-3">
          <label htmlFor="typed-barcode" className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
            <Keyboard className="size-3.5" /> Can&apos;t scan? Type the barcode
          </label>
          <div className="flex gap-2">
            <input
              id="typed-barcode"
              ref={typedRef}
              value={typed}
              onChange={(e) => {
                setTyped(e.target.value);
                setTypedError(null);
              }}
              inputMode="text"
              autoComplete="off"
              placeholder="e.g. 8901234500011"
              aria-invalid={typedError ? true : undefined}
              className={`${input} font-mono`}
            />
            <Button type="submit" variant="ghost" className="shrink-0 whitespace-nowrap">
              Look up
            </Button>
          </div>
          {typedError ? (
            <p className="text-xs font-medium text-blood" role="alert">{typedError}</p>
          ) : (
            <p className="text-xs text-slate-500">
              Type the digits under the barcode, or a GS1 code like <span className="font-mono">(01)…(17)…(10)…</span> to fill batch and expiry too.
            </p>
          )}
        </form>
      )}

      {mode === 'pick' && (
        <div className="space-y-1.5 rounded-2xl bg-slate-50 p-3">
          <label htmlFor="pick-medicine" className="text-xs font-semibold text-slate-600">
            Medicine from the catalog
          </label>
          <select
            id="pick-medicine"
            value={pending?.source === 'manual' ? pending.medicineId : ''}
            onChange={(e) => pickMedicine(e.target.value)}
            className={input}
          >
            <option value="">Choose a medicine…</option>
            {catalog.map((m) => (
              <option key={m.id} value={m.id}>
                {m.brand} · {m.salt.length > 38 ? `${m.salt.slice(0, 38)}…` : m.salt} · ₹{m.mrp}
              </option>
            ))}
          </select>
          <p className="text-xs text-slate-500">No barcode needed. After you choose, type the batch number and expiry printed on the strip.</p>
        </div>
      )}

      {pending && medicine && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3 rounded-2xl bg-sky-50/70 p-4 ring-1 ring-sky-100">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-semibold text-slate-900">{medicine.brand}</p>
              <p className="text-xs text-slate-500">{medicine.salt} · {medicine.packSize} · MRP ₹{medicine.mrp}</p>
            </div>
            <Badge tone={medicine.schedule === 'OTC' ? 'green' : 'red'}>{medicine.schedule === 'OTC' ? 'OTC' : `Schedule ${medicine.schedule}`}</Badge>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-xs font-medium text-slate-600">
              Batch {pending.fromBarcode.batch && <span className="text-eco-dark">· from barcode</span>}
              <input className={input} value={pending.batchNo} onChange={(e) => setPending({ ...pending, batchNo: e.target.value })} placeholder="e.g. DL27A01" />
            </label>
            <label className="text-xs font-medium text-slate-600">
              Expiry {pending.fromBarcode.expiry && <span className="text-eco-dark">· from barcode</span>}
              <input type="date" className={input} value={pending.expiry} onChange={(e) => setPending({ ...pending, expiry: e.target.value })} />
            </label>
            <label className="text-xs font-medium text-slate-600">
              Quantity (strips)
              <input type="number" min={1} className={input} value={pending.qty} onChange={(e) => setPending({ ...pending, qty: Math.max(1, Number(e.target.value) || 1) })} />
            </label>
          </div>
          {!pending.fromBarcode.batch && (
            <p className="text-xs text-slate-500">
              {pending.source === 'barcode'
                ? 'This barcode only carries the product code. Type the batch and expiry from the strip.'
                : 'Type the batch number and expiry date printed on the strip.'}
            </p>
          )}
          <div className="flex gap-2">
            <Button variant="eco" onClick={() => void confirm()}>
              <CheckCircle2 className="size-4" /> Add to stock
            </Button>
            <Button variant="ghost" onClick={() => setPending(null)}>Discard</Button>
          </div>
        </motion.div>
      )}

      <ScannerDialog open={cameraOpen} onClose={() => setCameraOpen(false)} onScan={onCameraScan} onType={switchToTyping} />
    </Card>
  );
}

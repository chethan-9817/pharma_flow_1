import { create } from 'zustand';
import type { CartLine } from '../../domain/checkout';

export const lineKey = (l: CartLine) => l.batchId ?? l.medicineId;

interface CartState {
  lines: CartLine[];
  add(line: CartLine): void;
  setQty(key: string, qty: number): void;
  remove(key: string): void;
  clear(): void;
}

/** Cart lives in this tab only; it is not part of the shared event log. */
export const useCart = create<CartState>((set) => ({
  lines: [],
  add: (line) =>
    set((s) => {
      const existing = s.lines.find((l) => lineKey(l) === lineKey(line));
      if (!existing) return { lines: [...s.lines, line] };
      return { lines: s.lines.map((l) => (l === existing ? { ...l, qty: l.qty + line.qty } : l)) };
    }),
  setQty: (key, qty) => set((s) => ({ lines: s.lines.map((l) => (lineKey(l) === key ? { ...l, qty: Math.max(1, qty) } : l)) })),
  remove: (key) => set((s) => ({ lines: s.lines.filter((l) => lineKey(l) !== key) })),
  clear: () => set({ lines: [] }),
}));

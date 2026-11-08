import type { FundEntryKind } from '../rules/fund';
import type { AppState } from '../state';

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Adds money to the NGO fund. A zero amount, or one already recorded for the same source, changes nothing. */
export function creditFund(s: AppState, kind: FundEntryKind, amount: number, refId: string): AppState {
  const id = `fund-${kind}-${refId}`;
  if (amount <= 0 || s.ngoFund.entries.some((e) => e.id === id)) return s;
  return {
    ...s,
    ngoFund: {
      balance: round2(s.ngoFund.balance + amount),
      entries: [...s.ngoFund.entries, { id, kind, amount, refId, date: s.today }],
    },
  };
}

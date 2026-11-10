import { CalendarClock, ChevronsRight, RotateCcw, Stethoscope, Truck, Shield, User } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router-dom';
import { addDays, daysBetween } from '../domain/clock';
import { localeFor } from '../i18n';
import { DEMO_START } from '../seed';
import { dispatch, pharma, usePharma } from '../store';
import { LanguageSwitcher } from './LanguageSwitcher';
import { report, toast } from './toast';

export const PRESENTER_ID = 'u-admin';
const MAX_OFFSET = 730;

const ROLES = [
  { to: '/customer', key: 'customer', icon: User },
  { to: '/chemist', key: 'chemist', icon: Stethoscope },
  { to: '/rider', key: 'rider', icon: Truck },
  { to: '/admin', key: 'admin', icon: Shield },
] as const;

const JUMPS = [
  { key: 'nav.week', days: 7 },
  { key: 'nav.month', days: 30 },
  { key: 'nav.fiveMonths', days: 150 },
] as const;

export function PresenterBar() {
  const { t, i18n } = useTranslation();
  const today = usePharma((s) => s.app.today);
  const offset = daysBetween(DEMO_START, today);
  const [draft, setDraft] = useState(offset);
  useEffect(() => setDraft(offset), [offset]);

  const fmt = (iso: string) =>
    new Date(`${iso}T00:00:00Z`).toLocaleDateString(localeFor(i18n.language), { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

  const travel = async (offsetDays: number) => {
    if (offsetDays <= offset) return;
    report(await dispatch(PRESENTER_ID, { type: 'TIME_TRAVELLED', to: addDays(DEMO_START, offsetDays) }));
  };

  const reset = async () => {
    if (!window.confirm(t('nav.resetConfirm'))) return;
    try {
      await pharma.getState().reset();
      toast(t('nav.resetDone'));
    } catch (error) {
      // In server mode only a signed-in admin may reset, and the server may refuse.
      toast(error instanceof Error ? error.message : String(error), 'error');
    }
  };

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-lg bg-medical text-sm font-bold text-white">Rx</span>
          <span className="text-base font-semibold tracking-tight text-slate-900">PharmaFlow</span>
        </div>

        <nav className="flex gap-1 rounded-xl bg-slate-100 p-1" aria-label={t('nav.switchRole')}>
          {ROLES.map(({ to, key, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  isActive ? 'bg-white text-slate-900 shadow-card ring-1 ring-slate-200' : 'text-slate-500 hover:text-slate-800'
                }`
              }
            >
              <Icon className="size-4" />
              <span className="hidden sm:inline">{t(`nav.${key}`)}</span>
            </NavLink>
          ))}
          <NavLink
            to="/presenter"
            className={({ isActive }) =>
              `rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${isActive ? 'bg-white text-slate-900 shadow-card ring-1 ring-slate-200' : 'text-slate-500 hover:text-slate-800'}`
            }
          >
            {t('nav.all4')}
          </NavLink>
        </nav>

        <div className="flex min-w-[280px] flex-1 items-center gap-3">
          <CalendarClock className="size-4 shrink-0 text-expiry" />
          <div className="flex flex-col whitespace-nowrap leading-tight">
            <span className="text-sm font-semibold text-slate-900">{fmt(today)}</span>
            <span className="text-[11px] text-slate-500">{offset === 0 ? t('nav.startOfDemo') : t('nav.day', { n: offset })}</span>
          </div>
          <input
            type="range"
            min={offset}
            max={MAX_OFFSET}
            value={draft}
            onChange={(e) => setDraft(Number(e.target.value))}
            onPointerUp={() => void travel(draft)}
            onKeyUp={() => void travel(draft)}
            aria-label={t('nav.timeTravel')}
            className="h-1.5 min-w-24 flex-1 cursor-pointer accent-medical"
          />
          <div className="hidden gap-1 lg:flex">
            {JUMPS.map((j) => (
              <button
                key={j.key}
                onClick={() => void travel(offset + j.days)}
                className="flex h-8 items-center gap-0.5 whitespace-nowrap rounded-lg bg-white px-2 text-xs font-medium text-slate-600 ring-1 ring-slate-300 hover:bg-slate-50"
              >
                <ChevronsRight className="size-3" />
                {t(j.key)}
              </button>
            ))}
          </div>
        </div>

        <LanguageSwitcher />

        <button
          onClick={() => void reset()}
          className="flex h-9 items-center gap-1.5 rounded-lg bg-white px-3 text-sm font-medium text-slate-600 ring-1 ring-slate-300 hover:bg-rose-50 hover:text-rose-700 hover:ring-rose-200"
        >
          <RotateCcw className="size-4" />
          <span className="hidden md:inline">{t('nav.resetDemo')}</span>
        </button>
      </div>
    </header>
  );
}

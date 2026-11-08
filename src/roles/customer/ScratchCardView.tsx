import { Gift, Sparkles } from 'lucide-react';
import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { shouldReveal } from '../../domain/rules/rewards';
import type { ScratchCard } from '../../domain/types';
import { report } from '../../components/toast';
import { inr } from '../../components/ui';
import { celebrate } from '../../lib/confetti';
import { dispatch } from '../../store';

const W = 260;
const H = 130;
const BRUSH = 22;
/** Pixels skipped between samples when measuring how much has been scratched. */
const SAMPLE_STEP = 6;

/**
 * A real scratch card: a silver canvas over the reward. Scratching clears the canvas
 * (destination-out). Once more than 40% is clear (the rule in `rewards.ts`), the reward is
 * revealed through the event log and confetti plays. A button covers keyboard and tap users.
 */
export function ScratchCardView({ card, userId }: { card: ScratchCard; userId: string }) {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scratching = useRef(false);
  const moves = useRef(0);
  const [busy, setBusy] = useState(false);

  const rewardText = card.rewardCredit > 0 ? t('customer.scratch.walletReward', { amount: inr(card.rewardCredit) }) : t('customer.scratch.karma', { count: card.rewardKarma });

  // Paint the silver coating once per card.
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || card.revealed) return;
    ctx.globalCompositeOperation = 'source-over';
    const gradient = ctx.createLinearGradient(0, 0, W, H);
    gradient.addColorStop(0, '#cbd5e1');
    gradient.addColorStop(0.5, '#f1f5f9');
    gradient.addColorStop(1, '#94a3b8');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#64748b';
    ctx.font = '700 15px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SCRATCH HERE', W / 2, H / 2 + 5);
  }, [card.revealed, card.id]);

  const scratchedFraction = (): number => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return 0;
    const { data } = ctx.getImageData(0, 0, W, H);
    let cleared = 0;
    let total = 0;
    for (let y = 0; y < H; y += SAMPLE_STEP) {
      for (let x = 0; x < W; x += SAMPLE_STEP) {
        total += 1;
        if (data[(y * W + x) * 4 + 3]! < 40) cleared += 1;
      }
    }
    return cleared / total;
  };

  const reveal = async () => {
    if (busy || card.revealed) return;
    setBusy(true);
    const result = await dispatch(userId, { type: 'SCRATCH_CARD_REVEALED', cardId: card.id });
    if (report(result, t('customer.scratch.rewardAdded'))) void celebrate();
    else setBusy(false);
  };

  const scratchAt = (e: PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) * W) / rect.width;
    const y = ((e.clientY - rect.top) * H) / rect.height;
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(x, y, BRUSH, 0, Math.PI * 2);
    ctx.fill();
  };

  const finish = () => {
    scratching.current = false;
    if (shouldReveal(scratchedFraction())) void reveal();
  };

  return (
    <div className="space-y-2 text-center">
      <div className="relative mx-auto aspect-[2/1] w-full max-w-[260px] overflow-hidden rounded-2xl bg-gradient-to-br from-amber-50 to-emerald-50 ring-1 ring-slate-200">
        <div className="absolute inset-0 grid place-items-center" aria-hidden={!card.revealed}>
          <div>
            {card.revealed ? <Sparkles className="mx-auto size-7 text-expiry" /> : <Gift className="mx-auto size-7 text-eco" />}
            <p className="mt-1 text-base font-bold text-slate-900">{rewardText}</p>
          </div>
        </div>
        {!card.revealed && (
          <canvas
            ref={canvasRef}
            width={W}
            height={H}
            aria-label={t('customer.scratch.aria')}
            className="absolute inset-0 size-full cursor-pointer touch-none transition-opacity duration-300"
            style={{ opacity: busy ? 0 : 1 }}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              scratching.current = true;
              scratchAt(e);
            }}
            onPointerMove={(e) => {
              if (!scratching.current) return;
              scratchAt(e);
              moves.current += 1;
              if (moves.current % 10 === 0 && shouldReveal(scratchedFraction())) {
                scratching.current = false;
                void reveal();
              }
            }}
            onPointerUp={finish}
            onPointerCancel={finish}
          />
        )}
      </div>
      {card.revealed ? (
        <p className="text-xs text-slate-500">{t('customer.scratch.added')}</p>
      ) : (
        <button className="text-xs font-semibold text-medical hover:underline" onClick={() => void reveal()} disabled={busy}>
          {t('customer.scratch.reveal')}
        </button>
      )}
    </div>
  );
}

/** A short burst of confetti for rewards. Loaded on demand, and silent when the user prefers reduced motion. */
export async function celebrate(): Promise<void> {
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  const { default: confetti } = await import('canvas-confetti');
  const colors = ['#0284C7', '#10B981', '#F59E0B', '#E11D48'];
  void confetti({ particleCount: 90, spread: 70, origin: { y: 0.65 }, colors });
  setTimeout(() => void confetti({ particleCount: 50, angle: 60, spread: 55, origin: { x: 0, y: 0.7 }, colors }), 180);
  setTimeout(() => void confetti({ particleCount: 50, angle: 120, spread: 55, origin: { x: 1, y: 0.7 }, colors }), 180);
}

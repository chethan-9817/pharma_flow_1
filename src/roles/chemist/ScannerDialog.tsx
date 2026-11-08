import { AnimatePresence, motion } from 'framer-motion';
import { CameraOff, Loader2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { ScannerStartError, startScanner } from '../../lib/scanner';
import { Button } from '../../components/ui';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Called once with the raw text of the first barcode read. */
  onScan: (text: string) => void;
}

export function ScannerDialog({ open, onClose, onScan }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<'starting' | 'scanning' | 'error'>('starting');
  const [message, setMessage] = useState('');
  const handled = useRef(false);
  // Keep the latest callback without restarting the camera when the parent re-renders.
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  useEffect(() => {
    if (!open || !videoRef.current) return;
    let stop: (() => void) | undefined;
    let cancelled = false;
    handled.current = false;
    setStatus('starting');

    startScanner(videoRef.current, (text) => {
      if (handled.current) return;
      handled.current = true;
      onScanRef.current(text);
    })
      .then((s) => {
        if (cancelled) return s();
        stop = s;
        setStatus('scanning');
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setStatus('error');
        setMessage(e instanceof ScannerStartError ? e.message : 'The camera could not start.');
      });

    return () => {
      cancelled = true;
      stop?.();
    };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 grid place-items-center bg-slate-950/70 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-label="Scan a medicine barcode"
            className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl"
            initial={{ scale: 0.95, y: 12 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 12 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4">
              <div>
                <h2 className="font-bold text-slate-900">Scan a medicine strip</h2>
                <p className="text-xs text-slate-500">Hold the barcode inside the frame. GS1 codes fill batch and expiry.</p>
              </div>
              <button onClick={onClose} aria-label="Close scanner" className="grid size-9 place-items-center rounded-full hover:bg-slate-100">
                <X className="size-5" />
              </button>
            </div>

            <div className="relative aspect-[4/3] bg-slate-900">
              <video ref={videoRef} className="size-full object-cover" muted playsInline />
              {status === 'scanning' && (
                <div className="pointer-events-none absolute inset-8 rounded-2xl border-2 border-white/80">
                  <motion.div
                    className="absolute inset-x-0 h-0.5 bg-eco shadow-[0_0_12px_2px] shadow-eco"
                    animate={{ top: ['6%', '94%', '6%'] }}
                    transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
                  />
                </div>
              )}
              {status === 'starting' && (
                <div className="absolute inset-0 grid place-items-center text-white">
                  <Loader2 className="size-8 animate-spin" />
                </div>
              )}
              {status === 'error' && (
                <div className="absolute inset-0 grid place-items-center p-6 text-center text-white">
                  <div className="space-y-2">
                    <CameraOff className="mx-auto size-8 text-slate-400" />
                    <p className="text-sm">{message}</p>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end px-5 py-4">
              <Button variant="ghost" onClick={onClose}>
                {status === 'error' ? 'Use a preset barcode instead' : 'Cancel'}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

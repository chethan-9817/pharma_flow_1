import { BadgeCheck, ShieldX } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { useApp, usePharma } from '../store';
import { Card } from './ui';

const TITLES = {
  NGO_DONOR: 'NGO Donor Certificate',
  GREEN_CITIZEN: 'Green Citizen Certificate',
  BLOOD_DONOR: 'Blood Donor Certificate',
} as const;

/**
 * The page a certificate's QR code opens. It looks the code up in the shared event log.
 * In this demo that log lives in the browser, so a code can be checked on the same computer.
 */
export function VerifyPage() {
  const [params] = useSearchParams();
  const code = (params.get('code') ?? '').trim();
  const ready = usePharma((s) => s.ready);
  const app = useApp();

  if (!ready) return <div className="grid min-h-[60vh] place-items-center text-sm text-slate-500">Checking…</div>;

  const cert = code ? app.certificates.find((c) => c.verifyCode.toUpperCase() === code.toUpperCase()) : undefined;
  const holder = cert ? app.users[cert.userId]?.name : undefined;

  return (
    <div className="grid min-h-screen place-items-center bg-canvas p-4">
      <Card className="w-full max-w-md space-y-4 p-6 text-center">
        <p className="text-sm font-bold tracking-tight text-medical">PharmaFlow</p>
        {cert ? (
          <>
            <BadgeCheck className="mx-auto size-14 text-eco" />
            <h1 className="text-xl font-bold text-slate-900">Certificate is valid</h1>
            <dl className="space-y-2 rounded-2xl bg-slate-50 p-4 text-left text-sm">
              <div className="flex justify-between gap-4"><dt className="text-slate-500">Certificate</dt><dd className="font-semibold">{TITLES[cert.kind]}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-slate-500">Awarded to</dt><dd className="font-semibold">{holder ?? 'Unknown'}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-slate-500">Issued on</dt><dd className="font-semibold">{cert.issuedOn}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-slate-500">For</dt><dd className="text-right font-semibold">{cert.summary}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-slate-500">Code</dt><dd className="font-mono font-semibold">{cert.verifyCode}</dd></div>
            </dl>
          </>
        ) : (
          <>
            <ShieldX className="mx-auto size-14 text-blood" />
            <h1 className="text-xl font-bold text-slate-900">No certificate found</h1>
            <p className="text-sm text-slate-500">
              {code ? <>The code <span className="font-mono font-semibold">{code}</span> does not match any certificate.</> : 'Scan the QR code on a certificate to check it.'}
            </p>
          </>
        )}
        <p className="text-xs text-slate-400">Demo mode: codes are checked against the data stored in this browser.</p>
      </Card>
    </div>
  );
}

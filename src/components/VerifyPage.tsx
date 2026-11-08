import { BadgeCheck, ShieldX } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { checkCertificate, type CertificateCheck } from '../lib/serverAuth';
import { useApp, usePharma } from '../store';
import { SERVER_MODE } from '../store/server';
import { LanguageSwitcher } from './LanguageSwitcher';
import { Card } from './ui';

type View = CertificateCheck | { status: 'loading' };

/**
 * Is this certificate code real? In the demo build the answer comes from the data stored in this browser. In
 * server mode it comes from the server, so anyone who scans the QR code can check it without signing in.
 */
function useCertificateCheck(code: string): View {
  const ready = usePharma((s) => s.ready);
  const app = useApp();
  const [remote, setRemote] = useState<View>({ status: 'loading' });

  useEffect(() => {
    if (!SERVER_MODE || !code) return;
    let live = true;
    setRemote({ status: 'loading' });
    void checkCertificate(code).then((result) => live && setRemote(result));
    return () => {
      live = false;
    };
  }, [code]);

  if (SERVER_MODE) return code ? remote : { status: 'invalid' };
  if (!ready) return { status: 'loading' };
  const cert = code ? app.certificates.find((c) => c.verifyCode.toUpperCase() === code.toUpperCase()) : undefined;
  if (!cert) return { status: 'invalid' };
  return {
    status: 'valid',
    kind: cert.kind,
    holder: app.users[cert.userId]?.name ?? null,
    issuedOn: cert.issuedOn,
    summary: cert.summary,
    code: cert.verifyCode,
  };
}

/** The page a certificate's QR code opens. */
export function VerifyPage() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const code = (params.get('code') ?? '').trim();
  const view = useCertificateCheck(code);

  if (view.status === 'loading') return <div className="grid min-h-[60vh] place-items-center text-sm text-slate-500">{t('common.checking')}</div>;

  return (
    <div className="grid min-h-screen place-items-center bg-canvas p-4">
      <Card className="w-full max-w-md space-y-4 p-6 text-center">
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold tracking-tight text-medical">PharmaFlow</p>
          <LanguageSwitcher />
        </div>
        {view.status === 'valid' ? (
          <>
            <BadgeCheck className="mx-auto size-14 text-eco" />
            <h1 className="text-xl font-bold text-slate-900">{t('verify.valid')}</h1>
            <dl className="space-y-2 rounded-2xl bg-slate-50 p-4 text-left text-sm">
              <div className="flex justify-between gap-4"><dt className="text-slate-500">{t('verify.certificate')}</dt><dd className="font-semibold">{t(`verify.kinds.${view.kind}`)}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-slate-500">{t('verify.awardedTo')}</dt><dd className="font-semibold">{view.holder ?? t('verify.unknown')}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-slate-500">{t('verify.issuedOn')}</dt><dd className="font-semibold">{view.issuedOn}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-slate-500">{t('verify.for')}</dt><dd className="text-right font-semibold">{view.summary}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-slate-500">{t('verify.code')}</dt><dd className="font-mono font-semibold">{view.code}</dd></div>
            </dl>
          </>
        ) : view.status === 'unreachable' ? (
          <>
            <ShieldX className="mx-auto size-14 text-expiry" />
            <h1 className="text-xl font-bold text-slate-900">{t('verify.unreachable')}</h1>
          </>
        ) : (
          <>
            <ShieldX className="mx-auto size-14 text-blood" />
            <h1 className="text-xl font-bold text-slate-900">{t('verify.notFound')}</h1>
            <p className="text-sm text-slate-500">
              {code ? (
                <Trans i18nKey="verify.noMatch" values={{ code }} components={{ code: <span className="font-mono font-semibold" /> }} />
              ) : (
                t('verify.scan')
              )}
            </p>
          </>
        )}
        <p className="text-xs text-slate-400">{SERVER_MODE ? t('verify.serverNote') : t('verify.demoNote')}</p>
      </Card>
    </div>
  );
}

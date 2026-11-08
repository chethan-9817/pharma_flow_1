import { BadgeCheck, ShieldX } from 'lucide-react';
import { Trans, useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { useApp, usePharma } from '../store';
import { LanguageSwitcher } from './LanguageSwitcher';
import { Card } from './ui';

/**
 * The page a certificate's QR code opens. It looks the code up in the shared event log.
 * In this demo that log lives in the browser, so a code can be checked on the same computer.
 */
export function VerifyPage() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const code = (params.get('code') ?? '').trim();
  const ready = usePharma((s) => s.ready);
  const app = useApp();

  if (!ready) return <div className="grid min-h-[60vh] place-items-center text-sm text-slate-500">{t('common.checking')}</div>;

  const cert = code ? app.certificates.find((c) => c.verifyCode.toUpperCase() === code.toUpperCase()) : undefined;
  const holder = cert ? app.users[cert.userId]?.name : undefined;

  return (
    <div className="grid min-h-screen place-items-center bg-canvas p-4">
      <Card className="w-full max-w-md space-y-4 p-6 text-center">
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold tracking-tight text-medical">PharmaFlow</p>
          <LanguageSwitcher />
        </div>
        {cert ? (
          <>
            <BadgeCheck className="mx-auto size-14 text-eco" />
            <h1 className="text-xl font-bold text-slate-900">{t('verify.valid')}</h1>
            <dl className="space-y-2 rounded-2xl bg-slate-50 p-4 text-left text-sm">
              <div className="flex justify-between gap-4"><dt className="text-slate-500">{t('verify.certificate')}</dt><dd className="font-semibold">{t(`verify.kinds.${cert.kind}`)}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-slate-500">{t('verify.awardedTo')}</dt><dd className="font-semibold">{holder ?? t('verify.unknown')}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-slate-500">{t('verify.issuedOn')}</dt><dd className="font-semibold">{cert.issuedOn}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-slate-500">{t('verify.for')}</dt><dd className="text-right font-semibold">{cert.summary}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-slate-500">{t('verify.code')}</dt><dd className="font-mono font-semibold">{cert.verifyCode}</dd></div>
            </dl>
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
        <p className="text-xs text-slate-400">{t('verify.demoNote')}</p>
      </Card>
    </div>
  );
}

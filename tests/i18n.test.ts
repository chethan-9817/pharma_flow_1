import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import en from '../src/i18n/en.json';
import hi from '../src/i18n/hi.json';
import kn from '../src/i18n/kn.json';

type Tree = { [key: string]: string | Tree };

function flatten(tree: Tree, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') out[path] = value;
    else Object.assign(out, flatten(value, path));
  }
  return out;
}

const LANGS = { en: flatten(en as Tree), kn: flatten(kn as Tree), hi: flatten(hi as Tree) };
const EN = LANGS.en;

/** {{name}} placeholders and <b>/<code> tags, sorted, so two translations can be compared. */
const parts = (text: string) => [...text.matchAll(/\{\{\s*(\w+)\s*\}\}|<\/?(\w+)>/g)].map((m) => m[0].replace(/\s/g, '')).sort();

describe('translation files', () => {
  it.each(['kn', 'hi'] as const)('%s has exactly the same keys as English', (lang) => {
    expect(Object.keys(LANGS[lang]).sort()).toEqual(Object.keys(EN).sort());
  });

  it.each(['en', 'kn', 'hi'] as const)('%s has no empty text', (lang) => {
    const empty = Object.entries(LANGS[lang]).filter(([, v]) => v.trim() === '');
    expect(empty).toEqual([]);
  });

  it.each(['kn', 'hi'] as const)('%s keeps every {{placeholder}} and tag of the English text', (lang) => {
    const mismatched = Object.keys(EN).filter((key) => JSON.stringify(parts(EN[key]!)) !== JSON.stringify(parts(LANGS[lang][key] ?? '')));
    expect(mismatched).toEqual([]);
  });

  it.each(['en', 'kn', 'hi'] as const)('%s gives both plural forms wherever it gives one', (lang) => {
    const keys = Object.keys(LANGS[lang]);
    const lonely = keys.filter((k) => (k.endsWith('_one') && !keys.includes(k.replace(/_one$/, '_other'))) || (k.endsWith('_other') && !keys.includes(k.replace(/_other$/, '_one'))));
    expect(lonely).toEqual([]);
  });

  it('actually translates: Kannada and Hindi text differs from English and uses their own scripts', () => {
    expect(LANGS.kn['nav.customer']).toMatch(/[ಀ-೿]/);
    expect(LANGS.hi['nav.customer']).toMatch(/[ऀ-ॿ]/);
    const untranslated = (lang: 'kn' | 'hi') =>
      Object.keys(EN).filter((k) => LANGS[lang][k] === EN[k] && /[A-Za-z]{4,}/.test(EN[k]!) && !/^(PDF|OTC|OTP|Rx|GSTIN)/.test(EN[k]!));
    // A few strings are proper names or codes; anything else identical to English was probably missed.
    expect(untranslated('kn')).toEqual([]);
    expect(untranslated('hi')).toEqual([]);
  });
});

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === 'i18n' ? [] : sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

const SRC = join(__dirname, '..', 'src');
const FILES = sourceFiles(SRC).map((path) => readFileSync(path, 'utf8'));
const ROOTS = 'common|nav|gate|customer|chemist|rider|admin|verify|bulk|dealer|network';

/** Is `key` in the English file, either exactly or as a plural (`key_one`, `key_other`)? */
const exists = (key: string) => key in EN || `${key}_other` in EN;

describe('translation keys used by the screens', () => {
  const literal = new RegExp(`['"\`]((?:${ROOTS})\\.[A-Za-z0-9_.]+)['"\`]`, 'g');
  const dynamic = new RegExp(`\`((?:${ROOTS})\\.[A-Za-z0-9_.]*)\\$\\{`, 'g');
  const used = new Set<string>();
  const prefixes = new Set<string>();
  for (const text of FILES) {
    for (const m of text.matchAll(literal)) used.add(m[1]!);
    for (const m of text.matchAll(dynamic)) prefixes.add(m[1]!);
  }

  it('finds the keys the screens ask for', () => {
    expect(used.size).toBeGreaterThan(150);
  });

  it('only asks for keys that exist', () => {
    expect([...used].filter((k) => !exists(k)).sort()).toEqual([]);
  });

  it('only builds dynamic keys under a section that exists', () => {
    const missing = [...prefixes].filter((p) => !Object.keys(EN).some((k) => k.startsWith(p)));
    expect(missing).toEqual([]);
  });

  it('has no leftover keys that no screen uses', () => {
    const covered = (key: string) => {
      const base = key.replace(/_(one|other)$/, '');
      if (used.has(base)) return true;
      // A dynamic key such as `customer.orders.status.${status}` covers everything below that prefix. A prefix with
      // only a section name (for example `nav.`) covers just that section's direct children.
      return [...prefixes].some((p) => (p.split('.').length > 2 ? base.startsWith(p) : base.startsWith(p) && !base.slice(p.length).includes('.')));
    };
    expect(Object.keys(EN).filter((k) => !covered(k)).sort()).toEqual([]);
  });
});

describe('dynamic keys that the screens build from data', () => {
  const need = (keys: string[]) => keys.filter((k) => !exists(k));

  it('has a label for every order status, pickup state, sponsorship state and certificate kind', () => {
    expect(
      need([
        ...['PLACED', 'RX_APPROVED', 'PACKED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'].map((s) => `customer.orders.status.${s}`),
        ...['NGO_DONOR', 'GREEN_CITIZEN', 'BLOOD_DONOR'].map((k) => `customer.activity.certKinds.${k}`),
        ...['NGO_DONOR', 'GREEN_CITIZEN', 'BLOOD_DONOR'].map((k) => `verify.kinds.${k}`),
        ...['PLACED', 'DELIVERED', 'REFUNDED'].map((s) => `chemist.sponsored.status.${s}`),
        ...['DELIVERY', 'NGO_PICKUP', 'BIO_PICKUP'].map((k) => `rider.kind.${k}`),
        ...['safe', 'lockout', 'critical', 'expired'].map((b) => `chemist.${b}`),
        ...['customer', 'chemist', 'rider', 'admin', 'dealer'].flatMap((r) => [`nav.${r}`, `gate.${r}`]),
        ...['COLLECTING', 'OPEN', 'NEGOTIATED', 'AWARDED', 'DELIVERED', 'CANCELLED'].flatMap((s) => [`bulk.status.${s}`, `bulk.chemist.next.${s}`]),
        ...['APPROVED', 'PENDING_KYC', 'REJECTED'].map((k) => `network.kyc.${k}`),
        ...['overview', 'network', 'bulk'].map((tab) => `admin.tabs.${tab}`),
        ...['Inventory', 'Orders', 'Prescriptions', 'Pickups', 'Civic', 'Admin'].map((f) => `admin.charts.family.${f}`),
      ]),
    ).toEqual([]);
  });
});

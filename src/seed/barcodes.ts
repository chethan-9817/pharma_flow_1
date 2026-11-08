import { MEDICINES } from './medicines';

export interface BarcodePreset {
  label: string;
  /** GS1 element string in human-readable form. */
  code: string;
}

function gs1(medicineId: string, yymmdd: string, batch: string): string {
  const m = MEDICINES.find((x) => x.id === medicineId);
  if (!m) throw new Error(`Unknown medicine ${medicineId}`);
  return `(01)${m.gtin}(17)${yymmdd}(10)${batch}`;
}

/** Used by the chemist scanner when there is no camera. Expiry day 00 means end of month. */
export const BARCODE_PRESETS: BarcodePreset[] = [
  { label: 'Dolo 650 · batch DL27A01 · exp Nov 2027', code: gs1('med-dolo650', '271100', 'DL27A01') },
  { label: 'Augmentin 625 Duo · batch AU27B04 · exp Jun 2027', code: gs1('med-augmentin', '270600', 'AU27B04') },
  { label: 'Pan-D · batch PD27C11 · exp Aug 2027', code: gs1('med-pand', '270800', 'PD27C11') },
  { label: 'Okacet · batch OK27D20 · exp Jan 2027', code: gs1('med-okacet', '270100', 'OK27D20') },
  { label: 'Electral ORS · batch EL27E02 · exp Oct 2027', code: gs1('med-electral', '271000', 'EL27E02') },
  { label: 'Shelcal 500 · batch SH27F09 · exp Dec 2027', code: gs1('med-shelcal500', '271200', 'SH27F09') },
];

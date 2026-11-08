import { useSearchParams } from 'react-router-dom';

/**
 * True when a role page is shown inside one of the presenter's "All 4" panes (`?embed=1`).
 * Embedded panes keep the compact, phone-style layout so four of them fit side by side.
 * A role opened on its own (for example `/customer`) gets the wide laptop layout instead.
 */
export function useEmbedded(): boolean {
  const [params] = useSearchParams();
  return params.get('embed') === '1';
}

/**
 * Camera barcode scanning with ZXing. Reads QR, DataMatrix, Code 128 and EAN/UPC,
 * so it handles GS1 strips and plain retail barcodes. Loaded only when the chemist opens the scanner.
 * Needs a secure context: http://localhost works, a plain http LAN address does not.
 */
export type ScannerError = 'denied' | 'no-camera' | 'unsupported' | 'unknown';

export class ScannerStartError extends Error {
  constructor(public kind: ScannerError, message: string) {
    super(message);
  }
}

function classify(error: unknown): ScannerStartError {
  const name = error instanceof Error ? error.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return new ScannerStartError('denied', 'Camera permission was blocked. Allow the camera for this site and try again.');
  }
  if (name === 'NotFoundError' || name === 'OverconstrainedError') {
    return new ScannerStartError('no-camera', 'No camera was found on this device.');
  }
  return new ScannerStartError('unknown', error instanceof Error ? error.message : 'The camera could not start.');
}

/** Starts scanning into a <video> element. Returns a function that stops the camera. */
export async function startScanner(video: HTMLVideoElement, onText: (text: string) => void): Promise<() => void> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new ScannerStartError('unsupported', 'Camera access needs a secure page. Open the app at http://localhost:5173.');
  }
  const { BrowserMultiFormatReader } = await import('@zxing/browser');
  const reader = new BrowserMultiFormatReader(undefined, { delayBetweenScanAttempts: 120 });
  try {
    const controls = await reader.decodeFromVideoDevice(undefined, video, (result) => {
      if (result) onText(result.getText());
    });
    return () => controls.stop();
  } catch (error) {
    throw classify(error);
  }
}

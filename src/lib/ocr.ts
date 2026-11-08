/**
 * Prescription OCR with Tesseract.js, loaded only when the customer asks for it.
 * The first run downloads the English language data (about 10 MB); after that it is cached by the browser.
 * OCR only suggests values. The pharmacist always makes the final decision.
 */
export async function readPrescriptionText(image: string, onProgress?: (fraction: number) => void): Promise<string> {
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('eng', 1, {
    logger: (m: { status: string; progress: number }) => {
      if (m.status === 'recognizing text') onProgress?.(m.progress);
    },
  });
  try {
    const { data } = await worker.recognize(image);
    return data.text;
  } finally {
    await worker.terminate();
  }
}

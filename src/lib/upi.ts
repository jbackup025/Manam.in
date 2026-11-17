import QRCode from 'qrcode';

const ALPHANUM = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function randomChars(len: number): string {
  const arr = new Uint8Array(len);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => ALPHANUM[b % ALPHANUM.length]).join('');
}

export function generateMoiRef(): string {
  return randomChars(6);
}

export function generateRsvpRef(): string {
  return `MN-${randomChars(6)}`;
}

export function generateUnguessableId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const arr = new Uint8Array(24);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => chars[b % chars.length]).join('');
}

export function buildUpiQueryString(params: {
  upiId: string;
  payeeName: string;
  amountRupees: number;
  ref: string;
}): string {
  const amountStr = params.amountRupees.toFixed(
    Number.isInteger(params.amountRupees) ? 0 : 2
  );
  const note = `Moi ${params.ref}`;
  return [
    `pa=${encodeURIComponent(params.upiId.trim())}`,
    `pn=${encodeURIComponent(params.payeeName.trim())}`,
    `am=${encodeURIComponent(amountStr)}`,
    `cu=INR`,
    `tn=${encodeURIComponent(note)}`,
  ].join('&');
}

export function buildUpiLinks(params: {
  upiId: string;
  payeeName: string;
  amountRupees: number;
  ref: string;
}) {
  const query = buildUpiQueryString(params);
  return {
    upiUri: `upi://pay?${query}`,
    gpayUri: `tez://upi/pay?${query}`,
    phonepeUri: `phonepe://pay?${query}`,
    paytmUri: `paytmmp://pay?${query}`,
  };
}

export async function generateUpiQrDataUrl(upiUri: string): Promise<string> {
  return QRCode.toDataURL(upiUri, {
    width: 280,
    margin: 2,
    errorCorrectionLevel: 'M',
    color: {
      dark: '#1A1612',
      light: '#FFFFFF',
    },
  });
}

export function isMobileUserAgent(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

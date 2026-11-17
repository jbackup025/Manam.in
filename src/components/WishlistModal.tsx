import { useEffect, useMemo, useState } from 'react';
import { Check, Copy, ExternalLink, QrCode, Smartphone, X } from 'lucide-react';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { formatINR, PLATFORM_NAME } from '../lib/constants';
import { db } from '../lib/firebase';
import {
  buildUpiLinks,
  generateMoiRef,
  generateUnguessableId,
  generateUpiQrDataUrl,
  isMobileUserAgent,
} from '../lib/upi';
import { AssetImage } from './AssetImage';
import type { PublicSiteDoc } from '../types/wedding';

interface WishlistModalProps {
  slug: string;
  site: PublicSiteDoc;
  initialGuestName?: string;
  primaryColor: string;
  primaryBtnText: string;
  onClose: () => void;
}

const PRESET_RUPEES = [501, 1001, 2501, 5001];

export function WishlistModal({
  slug,
  site,
  initialGuestName = '',
  primaryColor,
  primaryBtnText,
  onClose,
}: WishlistModalProps) {
  const { wishlistConfig } = site;
  const p1Available = wishlistConfig.partner1.enabled && Boolean(wishlistConfig.partner1.upiId.trim());
  const p2Available = wishlistConfig.partner2.enabled && Boolean(wishlistConfig.partner2.upiId.trim());
  const bothAvailable = p1Available && p2Available;

  const defaultRecipient: 'partner1' | 'partner2' = p1Available ? 'partner1' : 'partner2';

  const [step, setStep] = useState<'details' | 'pay' | 'done'>('details');
  const [recipient, setRecipient] = useState<'partner1' | 'partner2'>(defaultRecipient);
  const [selectedPreset, setSelectedPreset] = useState<number | 'custom'>(1001);
  const [customRupees, setCustomRupees] = useState('');
  const [donorName, setDonorName] = useState(initialGuestName);
  const [message, setMessage] = useState('');
  const [showName, setShowName] = useState(true);
  const [refCode] = useState(() => generateMoiRef());
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [showStaticQr, setShowStaticQr] = useState(false);
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const isMobile = useMemo(() => isMobileUserAgent(), []);
  const activeBeneficiary =
    recipient === 'partner1' ? wishlistConfig.partner1 : wishlistConfig.partner2;

  const amountRupees = useMemo(() => {
    if (selectedPreset !== 'custom') return selectedPreset;
    const parsed = parseFloat(customRupees);
    return Number.isFinite(parsed) ? parsed : 0;
  }, [selectedPreset, customRupees]);

  const amountPaise = Math.round(amountRupees * 100);

  const upiLinks = useMemo(() => {
    if (!activeBeneficiary.upiId.trim() || amountPaise < 100) return null;
    return buildUpiLinks({
      upiId: activeBeneficiary.upiId,
      payeeName: activeBeneficiary.payeeName || activeBeneficiary.displayName,
      amountRupees: amountPaise / 100,
      ref: refCode,
    });
  }, [activeBeneficiary, amountPaise, refCode]);

  useEffect(() => {
    if (step !== 'pay' || !upiLinks) return;
    let active = true;
    generateUpiQrDataUrl(upiLinks.upiUri)
      .then((url) => {
        if (active) setQrDataUrl(url);
      })
      .catch(() => {
        if (active) setQrDataUrl('');
      });
    return () => {
      active = false;
    };
  }, [step, upiLinks]);

  function handleContinueToPay(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!p1Available && !p2Available) {
      setError('UPI beneficiary details have not been configured by the couple yet.');
      return;
    }
    if (!donorName.trim()) {
      setError('Please enter your name.');
      return;
    }
    if (amountPaise < 100 || amountPaise > 10000000) {
      setError('Amount must be between ₹1 and ₹1,00,000.');
      return;
    }
    if (
      selectedPreset === 'custom' &&
      !/^\d+(\.\d{1,2})?$/.test(customRupees.trim())
    ) {
      setError('Custom amount may have at most 2 decimal places.');
      return;
    }

    setStep('pay');
  }

  async function handleConfirmCompleted() {
    setError('');
    setSubmitting(true);
    try {
      const contribId = generateUnguessableId();
      await setDoc(doc(db, 'weddings', slug, 'contributions', contribId), {
        ref: refCode,
        recipient,
        amountPaise,
        donorName: donorName.trim().slice(0, 80),
        message: message.trim().slice(0, 500),
        showName,
        status: 'pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setStep('done');
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not save your contribution record. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="moi-modal-title"
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
    >
      <div className="bg-[#FAF7F2] text-[#1D1915] w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl border border-[#1D1915]/15 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1D1915]/10 sticky top-0 bg-[#FAF7F2] z-10">
          <h3
            id="moi-modal-title"
            className="text-xl font-semibold"
            style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
          >
            {wishlistConfig.title || 'Wishlist - Moi'}
          </h3>
          <button
            type="button"
            aria-label="Close Moi dialog"
            onClick={onClose}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-black/5 cursor-pointer"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <div className="p-6">
          {!p1Available && !p2Available ? (
            <div className="text-center py-6 space-y-3">
              <p className="text-base font-medium">UPI Moi is not configured yet</p>
              <p className="text-sm text-[#5E554B]">
                The couple has not added a UPI ID yet. Prefer to bless them in person? Traditional moi is always welcome.
              </p>
              <button
                type="button"
                onClick={onClose}
                className="min-h-[44px] px-5 py-2.5 rounded-lg text-sm font-medium cursor-pointer"
                style={{ backgroundColor: primaryColor, color: primaryBtnText }}
              >
                Close
              </button>
            </div>
          ) : step === 'details' ? (
            <form onSubmit={handleContinueToPay} className="space-y-5">
              {/* Choose Recipient */}
              {bothAvailable && (
                <div>
                  <span className="block text-sm font-medium mb-2">
                    Choose recipient
                  </span>
                  <div className="grid grid-cols-2 gap-3">
                    {(
                      [
                        { key: 'partner1' as const, cfg: wishlistConfig.partner1 },
                        { key: 'partner2' as const, cfg: wishlistConfig.partner2 },
                      ] as const
                    ).map(({ key, cfg }) => {
                      const active = recipient === key;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setRecipient(key)}
                          className="min-h-[48px] p-3 rounded-xl border text-left transition-colors cursor-pointer"
                          style={{
                            borderColor: active ? primaryColor : 'rgba(29,25,21,0.15)',
                            backgroundColor: active ? primaryColor : '#FFFFFF',
                            color: active ? primaryBtnText : '#1D1915',
                          }}
                        >
                          <div className="text-sm font-semibold">{cfg.displayName}</div>
                          {cfg.description && (
                            <div className="text-xs opacity-80 line-clamp-1 mt-0.5">
                              {cfg.description}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Amount selection */}
              <div>
                <span className="block text-sm font-medium mb-2">Select amount (INR)</span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-2.5">
                  {PRESET_RUPEES.map((amt) => {
                    const active = selectedPreset === amt;
                    return (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setSelectedPreset(amt)}
                        className="min-h-[44px] px-3 py-2 rounded-lg border text-sm font-medium tabular-nums cursor-pointer"
                        style={{
                          borderColor: active ? primaryColor : 'rgba(29,25,21,0.15)',
                          backgroundColor: active ? primaryColor : '#FFFFFF',
                          color: active ? primaryBtnText : '#1D1915',
                        }}
                      >
                        ₹{amt.toLocaleString('en-IN')}
                      </button>
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedPreset('custom')}
                  className="w-full min-h-[44px] px-3 py-2 rounded-lg border text-sm font-medium cursor-pointer text-left"
                  style={{
                    borderColor:
                      selectedPreset === 'custom' ? primaryColor : 'rgba(29,25,21,0.15)',
                    backgroundColor: '#FFFFFF',
                  }}
                >
                  {selectedPreset === 'custom' ? 'Custom amount (₹1 – ₹1,00,000)' : 'Enter a custom amount'}
                </button>

                {selectedPreset === 'custom' && (
                  <div className="mt-2.5">
                    <label htmlFor="moi-custom-amount" className="sr-only">
                      Custom amount in INR
                    </label>
                    <input
                      id="moi-custom-amount"
                      type="number"
                      min="1"
                      max="100000"
                      step="0.01"
                      required
                      value={customRupees}
                      onChange={(e) => setCustomRupees(e.target.value)}
                      placeholder="Enter amount (e.g., 1500)"
                      className="w-full min-h-[44px] px-3.5 rounded-lg border border-[#1D1915]/20 bg-white text-sm tabular-nums"
                    />
                  </div>
                )}
              </div>

              {/* Donor Name */}
              <div>
                <label htmlFor="moi-donor-name" className="block text-sm font-medium mb-1.5">
                  Your Name *
                </label>
                <input
                  id="moi-donor-name"
                  type="text"
                  required
                  maxLength={80}
                  value={donorName}
                  onChange={(e) => setDonorName(e.target.value)}
                  placeholder="e.g., Raghavan & Family"
                  className="w-full min-h-[44px] px-3.5 rounded-lg border border-[#1D1915]/20 bg-white text-sm"
                />
              </div>

              {/* Blessing */}
              <div>
                <label htmlFor="moi-blessing" className="block text-sm font-medium mb-1.5">
                  Blessing message (optional)
                </label>
                <textarea
                  id="moi-blessing"
                  rows={2}
                  maxLength={500}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Wishing you both a lifetime of happiness"
                  className="w-full p-3 rounded-lg border border-[#1D1915]/20 bg-white text-sm"
                />
              </div>

              {/* Visibility */}
              <label className="flex items-center gap-3 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={showName}
                  onChange={(e) => setShowName(e.target.checked)}
                  className="w-4 h-4"
                />
                <span>
                  Show my name publicly on the blessings wall (unchecked shows “A loved one”)
                </span>
              </label>

              {error && (
                <p role="alert" className="text-sm text-[#B91C1C]">
                  {error}
                </p>
              )}

              <button
                type="submit"
                className="w-full min-h-[44px] px-5 py-3 rounded-lg text-sm font-medium cursor-pointer"
                style={{ backgroundColor: primaryColor, color: primaryBtnText }}
              >
                Continue to UPI Payment
              </button>
            </form>
          ) : step === 'pay' && upiLinks ? (
            <div className="space-y-5">
              <div className="bg-white rounded-xl border border-[#1D1915]/12 p-4 text-center">
                <p className="text-xs uppercase tracking-wider text-[#5E554B] mb-1">
                  Paying to: {activeBeneficiary.payeeName || activeBeneficiary.displayName}
                </p>
                <p className="text-3xl font-semibold tabular-nums mb-2">
                  {formatINR(amountPaise)}
                </p>
                <p className="text-xs text-[#5E554B]">
                  Matching Reference Code:{' '}
                  <span className="font-mono font-semibold text-[#1D1915] bg-[#F2ECE1] px-2 py-0.5 rounded">
                    {refCode}
                  </span>
                </p>
              </div>

              {/* Mobile UPI app buttons */}
              {isMobile && (
                <div className="space-y-2.5">
                  <a
                    href={upiLinks.upiUri}
                    className="w-full min-h-[44px] px-4 py-3 rounded-lg text-sm font-medium flex items-center justify-center gap-2"
                    style={{ backgroundColor: primaryColor, color: primaryBtnText }}
                  >
                    <Smartphone className="w-4 h-4" aria-hidden="true" />
                    Pay with UPI
                  </a>
                  <div className="grid grid-cols-3 gap-2">
                    <a
                      href={upiLinks.gpayUri}
                      className="min-h-[44px] px-2 py-2 rounded-lg border border-[#1D1915]/15 bg-white text-xs font-medium flex items-center justify-center gap-1 hover:bg-[#F2ECE1]"
                    >
                      Google Pay
                      <ExternalLink className="w-3 h-3" aria-hidden="true" />
                    </a>
                    <a
                      href={upiLinks.phonepeUri}
                      className="min-h-[44px] px-2 py-2 rounded-lg border border-[#1D1915]/15 bg-white text-xs font-medium flex items-center justify-center gap-1 hover:bg-[#F2ECE1]"
                    >
                      PhonePe
                      <ExternalLink className="w-3 h-3" aria-hidden="true" />
                    </a>
                    <a
                      href={upiLinks.paytmUri}
                      className="min-h-[44px] px-2 py-2 rounded-lg border border-[#1D1915]/15 bg-white text-xs font-medium flex items-center justify-center gap-1 hover:bg-[#F2ECE1]"
                    >
                      Paytm
                      <ExternalLink className="w-3 h-3" aria-hidden="true" />
                    </a>
                  </div>
                </div>
              )}

              {/* Dynamic QR or Uploaded Static QR fallback */}
              <div className="bg-white rounded-xl border border-[#1D1915]/12 p-5 text-center">
                {showStaticQr && activeBeneficiary.qrAssetId ? (
                  <div className="w-56 h-56 mx-auto rounded-lg overflow-hidden border border-[#1D1915]/10">
                    <AssetImage
                      slug={slug}
                      assetId={activeBeneficiary.qrAssetId}
                      alt={`Static UPI QR for ${activeBeneficiary.displayName}`}
                      className="w-full h-full object-contain"
                    />
                  </div>
                ) : qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt={`UPI QR code for ${formatINR(amountPaise)} to ${activeBeneficiary.payeeName || activeBeneficiary.displayName}`}
                    className="w-56 h-56 mx-auto rounded-lg border border-[#1D1915]/10"
                  />
                ) : (
                  <div className="w-56 h-56 mx-auto rounded-lg bg-[#F2ECE1] flex items-center justify-center text-xs text-[#5E554B]">
                    Generating QR...
                  </div>
                )}

                <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(activeBeneficiary.upiId);
                      setCopiedUpi(true);
                      setTimeout(() => setCopiedUpi(false), 2500);
                    }}
                    className="min-h-[44px] px-4 py-2 rounded-lg border border-[#1D1915]/15 text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer hover:bg-[#FAF7F2]"
                  >
                    <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                    {copiedUpi ? 'Copied UPI ID' : `Copy UPI ID (${activeBeneficiary.upiId})`}
                  </button>

                  {activeBeneficiary.qrAssetId && (
                    <button
                      type="button"
                      onClick={() => setShowStaticQr((v) => !v)}
                      className="min-h-[44px] px-4 py-2 rounded-lg border border-[#1D1915]/15 text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer hover:bg-[#FAF7F2]"
                    >
                      <QrCode className="w-3.5 h-3.5" aria-hidden="true" />
                      {showStaticQr ? 'Use Dynamic QR' : 'Use Uploaded Static QR'}
                    </button>
                  )}
                </div>
              </div>

              {/* Simple Payment Instructions */}
              <ol className="text-xs text-[#5E554B] space-y-1.5 list-decimal list-inside bg-[#F2ECE1]/70 p-4 rounded-xl">
                <li>Scan the QR or open your preferred UPI app using the buttons above.</li>
                <li>Verify payee name and include note <span className="font-mono font-medium text-[#1D1915]">Moi {refCode}</span>.</li>
                <li>Once paid in your UPI app, tap “I’ve completed the payment” below so the couple can match your blessing.</li>
              </ol>

              {error && (
                <p role="alert" className="text-sm text-[#B91C1C]">
                  {error}
                </p>
              )}

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={() => setStep('details')}
                  className="min-h-[44px] px-4 py-2.5 rounded-lg border border-[#1D1915]/15 text-sm font-medium cursor-pointer"
                >
                  Back
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleConfirmCompleted}
                  className="flex-1 min-h-[44px] px-5 py-2.5 rounded-lg text-sm font-medium cursor-pointer disabled:opacity-50"
                  style={{ backgroundColor: primaryColor, color: primaryBtnText }}
                >
                  {submitting ? 'Recording...' : "I've completed the payment"}
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center space-y-5 py-2">
              <div
                className="w-12 h-12 rounded-full mx-auto flex items-center justify-center"
                style={{ backgroundColor: primaryColor, color: primaryBtnText }}
              >
                <Check className="w-6 h-6" aria-hidden="true" />
              </div>
              <div>
                <h4
                  className="text-2xl font-semibold mb-1.5"
                  style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
                >
                  Thank you for your blessing
                </h4>
                <p className="text-sm text-[#5E554B]">
                  {wishlistConfig.thankYouMessage}
                </p>
              </div>

              <div className="bg-white rounded-xl border border-[#1D1915]/12 p-4 text-sm space-y-1">
                <p>
                  Reference Code:{' '}
                  <span className="font-mono font-semibold">{refCode}</span>
                </p>
                <p className="text-xs text-[#5E554B]">
                  Your contribution is logged as pending until the couple matches {refCode} in their bank statement.
                </p>
              </div>

              <div className="text-xs text-[#5E554B] space-y-2 border-t border-[#1D1915]/10 pt-4">
                <p>
                  Contributions go directly to the couple’s UPI account. {PLATFORM_NAME} does not handle or hold any money.
                </p>
                <p>Prefer to bless us in person? Traditional moi is always welcome.</p>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="w-full min-h-[44px] px-5 py-2.5 rounded-lg text-sm font-medium cursor-pointer"
                style={{ backgroundColor: primaryColor, color: primaryBtnText }}
              >
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

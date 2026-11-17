import { useEffect, useState } from 'react';
import { Download, ExternalLink, QrCode, Share2 } from 'lucide-react';
import QRCode from 'qrcode';
import { CopyLinkButton } from '../CopyLinkButton';

interface InvitationShareCardProps {
  slug: string;
  coupleNames: string;
  publicUrl: string;
  whatsappShareUrl: string;
}

export function InvitationShareCard({
  slug,
  coupleNames,
  publicUrl,
  whatsappShareUrl,
}: InvitationShareCardProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [qrError, setQrError] = useState(false);

  useEffect(() => {
    if (!publicUrl) return;
    let active = true;
    setQrError(false);

    QRCode.toDataURL(publicUrl, {
      width: 512,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#1D1915',
        light: '#FFFFFF',
      },
    })
      .then((dataUrl) => {
        if (active) setQrDataUrl(dataUrl);
      })
      .catch(() => {
        if (active) setQrError(true);
      });

    return () => {
      active = false;
    };
  }, [publicUrl]);

  function handleDownloadQr() {
    if (!qrDataUrl) return;
    const link = document.createElement('a');
    link.href = qrDataUrl;
    link.download = `${slug}-wedding-qr.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <section className="bg-white border border-[#1D1915]/10 rounded-2xl p-6 grid md:grid-cols-12 gap-6 items-center">
      <div className="md:col-span-8 space-y-4">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-[#7C5821] font-medium mb-1">
            Share Invitation
          </p>
          <h2 className="text-xl font-semibold">
            Invitation Link &amp; Print-Ready QR Code
          </h2>
          <p className="text-sm text-[#5E554B] mt-1">
            Share your unique wedding URL directly on WhatsApp or download the QR code for printed invitations and welcome signage.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 p-3 rounded-xl bg-[#FAF7F2] border border-[#1D1915]/10">
          <span className="font-mono text-xs sm:text-sm text-[#1D1915] break-all flex-1">
            {publicUrl}
          </span>
          <CopyLinkButton
            url={publicUrl}
            label="Copy Link"
            copiedLabel="Copied!"
            className="bg-[#7C5821] text-[#FAF7F2] hover:bg-[#66471A]"
          />
        </div>

        <div className="flex flex-wrap gap-2.5">
          <a
            href={whatsappShareUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="min-h-[44px] px-4 py-2 rounded-lg bg-[#1E4D3B] text-white text-xs sm:text-sm font-medium inline-flex items-center gap-2"
          >
            <Share2 className="w-4 h-4" aria-hidden="true" />
            Share on WhatsApp
          </a>
          <button
            type="button"
            onClick={handleDownloadQr}
            disabled={!qrDataUrl}
            className="min-h-[44px] px-4 py-2 rounded-lg border border-[#1D1915]/15 bg-white text-xs sm:text-sm font-medium inline-flex items-center gap-2 hover:bg-[#FAF7F2] disabled:opacity-40 cursor-pointer"
          >
            <Download className="w-4 h-4" aria-hidden="true" />
            Download QR (PNG)
          </button>
          <a
            href={publicUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="min-h-[44px] px-4 py-2 rounded-lg border border-[#1D1915]/15 bg-white text-xs sm:text-sm font-medium inline-flex items-center gap-2 hover:bg-[#FAF7F2]"
          >
            Open Invitation
            <ExternalLink className="w-4 h-4" aria-hidden="true" />
          </a>
        </div>
      </div>

      <div className="md:col-span-4 flex flex-col items-center justify-center p-4 rounded-xl bg-[#FAF7F2] border border-[#1D1915]/10">
        {qrDataUrl ? (
          <img
            src={qrDataUrl}
            alt={`Scannable QR code for ${coupleNames} wedding invitation`}
            className="w-44 h-44 rounded-lg border border-[#1D1915]/10 bg-white p-1.5"
          />
        ) : (
          <div className="w-44 h-44 rounded-lg border border-[#1D1915]/10 bg-white flex flex-col items-center justify-center text-xs text-[#5E554B] gap-2">
            <QrCode className="w-6 h-6 opacity-60" aria-hidden="true" />
            <span>{qrError ? 'Could not generate QR' : 'Generating QR...'}</span>
          </div>
        )}
        <span className="text-xs text-[#5E554B] mt-2 font-mono">/{slug}</span>
      </div>
    </section>
  );
}

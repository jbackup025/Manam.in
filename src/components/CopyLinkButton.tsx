import { useState, type CSSProperties } from 'react';
import { Check, Copy } from 'lucide-react';
import { copyTextToClipboard } from '../lib/clipboard';

interface CopyLinkButtonProps {
  url: string;
  label?: string;
  copiedLabel?: string;
  className?: string;
  style?: CSSProperties;
}

export function CopyLinkButton({
  url,
  label = 'Copy Link',
  copiedLabel = 'Copied!',
  className = '',
  style,
}: CopyLinkButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    const ok = await copyTextToClipboard(url);
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2400);
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-live="polite"
      style={style}
      className={`min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${className}`}
    >
      {copied ? (
        <Check className="w-4 h-4 shrink-0" aria-hidden="true" />
      ) : (
        <Copy className="w-4 h-4 shrink-0" aria-hidden="true" />
      )}
      <span>{copied ? copiedLabel : label}</span>
    </button>
  );
}

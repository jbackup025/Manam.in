import { useEffect, useState } from 'react';
import { Image as ImageIcon } from 'lucide-react';
import { getWeddingAsset } from '../lib/assetStore';

interface AssetImageProps {
  slug: string;
  assetId?: string;
  fallbackUrl?: string;
  preloadedSrc?: string;
  alt: string;
  className?: string;
  loading?: 'lazy' | 'eager';
  fallbackLabel?: string;
}

export function AssetImage({
  slug,
  assetId,
  fallbackUrl,
  preloadedSrc,
  alt,
  className = 'w-full h-full object-cover',
  loading = 'lazy',
  fallbackLabel,
}: AssetImageProps) {
  const [src, setSrc] = useState<string>(preloadedSrc || fallbackUrl || '');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    setFailed(false);

    if (preloadedSrc) {
      setSrc(preloadedSrc);
      return;
    }

    if (assetId && slug) {
      getWeddingAsset(slug, assetId).then((asset) => {
        if (!active) return;
        if (asset?.dataUrl) {
          setSrc(asset.dataUrl);
        } else {
          setSrc(fallbackUrl || '');
        }
      });
    } else {
      setSrc(fallbackUrl || '');
    }

    return () => {
      active = false;
    };
  }, [slug, assetId, fallbackUrl, preloadedSrc]);

  if (!src || failed) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={`flex flex-col items-center justify-center bg-gradient-to-br from-[#F2ECE1] to-[#E6DCCB] text-[#7C5821]/70 p-4 text-center ${className}`}
      >
        <ImageIcon className="w-6 h-6 mb-1.5 opacity-60" aria-hidden="true" />
        {fallbackLabel && (
          <span className="text-xs font-medium tracking-wide opacity-80">{fallbackLabel}</span>
        )}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      loading={loading}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}

import { Gift, Heart } from 'lucide-react';
import { formatINR, PLATFORM_NAME } from '../lib/constants';
import type { BlessingDoc, PublicProgressDoc, PublicSiteDoc } from '../types/wedding';

interface WishlistSectionProps {
  site: PublicSiteDoc;
  progress: PublicProgressDoc | null;
  blessings: BlessingDoc[];
  primaryColor: string;
  accentColor: string;
  primaryBtnText: string;
  surfaceColor: string;
  borderColor: string;
  mutedColor: string;
  headingFont: string;
  onOpenContribute: () => void;
}

export function WishlistSection({
  site,
  progress,
  blessings,
  primaryColor,
  accentColor,
  primaryBtnText,
  surfaceColor,
  borderColor,
  mutedColor,
  headingFont,
  onOpenContribute,
}: WishlistSectionProps) {
  const { wishlistConfig } = site;
  const confirmedTotalPaise = progress?.confirmedTotalPaise || 0;
  const targetPaise = Math.max(100, wishlistConfig.targetPaise || 1000000);
  const pct = Math.min(100, Math.max(0, Math.round((confirmedTotalPaise / targetPaise) * 100)));

  return (
    <div className="space-y-10">
      <div
        className="rounded-2xl p-6 sm:p-10 border"
        style={{ backgroundColor: surfaceColor, borderColor }}
      >
        <div className="max-w-2xl mx-auto text-center">
          <h2
            className="text-3xl sm:text-4xl font-semibold mb-3"
            style={{ fontFamily: headingFont }}
          >
            {wishlistConfig.title || 'Wishlist - Moi'}
          </h2>
          <p className="text-sm sm:text-base leading-relaxed mb-7" style={{ color: mutedColor }}>
            {wishlistConfig.story}
          </p>

          {/* Progress Bar */}
          <div className="mb-7 text-left max-w-lg mx-auto">
            {wishlistConfig.showTargetPublicly ? (
              <div className="flex items-baseline justify-between text-sm mb-2">
                <span className="font-semibold tabular-nums">
                  {formatINR(confirmedTotalPaise)} confirmed
                </span>
                <span className="text-xs tabular-nums" style={{ color: mutedColor }}>
                  Goal: {formatINR(targetPaise)}
                </span>
              </div>
            ) : (
              <p className="text-sm font-medium text-center mb-2.5">
                Together we are getting closer
              </p>
            )}

            <div
              className="h-3 rounded-full overflow-hidden border"
              style={{ borderColor }}
              role="progressbar"
              aria-valuenow={wishlistConfig.showTargetPublicly ? pct : undefined}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: wishlistConfig.showTargetPublicly
                    ? `${Math.max(4, pct)}%`
                    : `${Math.max(18, pct)}%`,
                  background: `linear-gradient(90deg, ${primaryColor}, ${accentColor})`,
                }}
              />
            </div>
          </div>

          <button
            type="button"
            onClick={onOpenContribute}
            className="min-h-[44px] px-7 py-3 rounded-lg text-sm font-medium inline-flex items-center gap-2 cursor-pointer transition-opacity hover:opacity-90"
            style={{ backgroundColor: primaryColor, color: primaryBtnText }}
          >
            <Gift className="w-4 h-4" aria-hidden="true" />
            {wishlistConfig.buttonText || 'Send Moi Blessing'}
          </button>

          <p className="text-xs mt-5" style={{ color: mutedColor }}>
            Contributions go directly to the couple’s UPI account. {PLATFORM_NAME} does not handle or hold any money. Prefer to bless us in person? Traditional moi is always welcome.
          </p>
        </div>
      </div>

      {/* Approved Blessings Wall */}
      <div>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-2xl font-semibold" style={{ fontFamily: headingFont }}>
            Blessings Wall
          </h3>
          <span className="text-xs tabular-nums" style={{ color: mutedColor }}>
            {blessings.length} {blessings.length === 1 ? 'blessing' : 'blessings'}
          </span>
        </div>

        {blessings.length === 0 ? (
          <div
            className="rounded-xl p-8 border text-center text-sm"
            style={{ backgroundColor: surfaceColor, borderColor, color: mutedColor }}
          >
            Warm blessings from family and friends will appear here once approved by the couple.
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {blessings.map((b, idx) => (
              <article
                key={b.id || idx}
                className="rounded-xl p-5 border flex flex-col justify-between"
                style={{ backgroundColor: surfaceColor, borderColor }}
              >
                <p className="text-sm leading-relaxed mb-4">“{b.message}”</p>
                <div className="flex items-center gap-2 text-xs font-medium" style={{ color: mutedColor }}>
                  <Heart className="w-3.5 h-3.5 shrink-0" style={{ color: accentColor }} aria-hidden="true" />
                  <span>{b.displayName}</span>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

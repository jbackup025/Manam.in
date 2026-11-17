import { useEffect, useMemo, useState } from 'react';
import { CalendarPlus, Check, Copy, ExternalLink, MapPin, Phone } from 'lucide-react';
import { HEADING_FONTS } from '../lib/constants';
import {
  pickBorderColor,
  pickMutedText,
  pickReadableText,
  pickSurfaceColor,
} from '../lib/contrast';
import { downloadEventIcs } from '../lib/ics';
import type { BlessingDoc, PublicProgressDoc, PublicSiteDoc } from '../types/wedding';
import { AssetImage } from './AssetImage';
import { PublicFooter } from './PublicFooter';
import { RsvpFormSection } from './RsvpFormSection';
import { WishlistModal } from './WishlistModal';
import { WishlistSection } from './WishlistSection';

interface WeddingSiteRendererProps {
  slug: string;
  site: PublicSiteDoc;
  progress: PublicProgressDoc | null;
  blessings: BlessingDoc[];
  editRsvpId: string | null;
  previewMode?: boolean;
}

function getSpotifyEmbedUrl(url: string): string | null {
  if (!url) return null;
  try {
    const u = new URL(url.trim());
    if (!u.hostname.endsWith('spotify.com')) return null;
    if (u.pathname.startsWith('/embed/')) return u.toString();
    return `https://open.spotify.com/embed${u.pathname}`;
  } catch {
    return null;
  }
}

export function WeddingSiteRenderer({
  slug,
  site,
  progress,
  blessings,
  editRsvpId,
  previewMode = false,
}: WeddingSiteRendererProps) {
  const { couple, theme, sections } = site;
  const headingFontCss =
    HEADING_FONTS.find((f) => f.value === theme.headingFont)?.cssFamily ||
    "'Cormorant Garamond', Georgia, serif";

  const textColor = pickReadableText(theme.backgroundColor);
  const mutedColor = pickMutedText(theme.backgroundColor);
  const surfaceColor = pickSurfaceColor(theme.backgroundColor);
  const borderColor = pickBorderColor(theme.backgroundColor);
  const primaryBtnText = pickReadableText(theme.primaryColor);

  const [copiedLink, setCopiedLink] = useState(false);
  const [wishlistOpen, setWishlistOpen] = useState(false);
  const [prefilledGuestName, setPrefilledGuestName] = useState('');
  const [countdown, setCountdown] = useState<{
    days: number;
    hours: number;
    mins: number;
    passed: boolean;
  } | null>(null);

  useEffect(() => {
    if (!site.countdownEnabled || !couple.weddingDate) {
      setCountdown(null);
      return;
    }

    const compute = () => {
      const target = new Date(`${couple.weddingDate}T09:00:00+05:30`).getTime();
      const diff = target - Date.now();
      if (diff <= 0) {
        setCountdown({ days: 0, hours: 0, mins: 0, passed: true });
        return;
      }
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const mins = Math.floor((diff / (1000 * 60)) % 60);
      setCountdown({ days, hours, mins, passed: false });
    };

    compute();
    const timer = setInterval(compute, 30000);
    return () => clearInterval(timer);
  }, [site.countdownEnabled, couple.weddingDate]);

  const coupleNames = `${couple.partner1Name} & ${couple.partner2Name}`;
  const enabledNavSections = useMemo(
    () => sections.filter((s) => s.enabled).slice(0, 5),
    [sections]
  );

  const spotifyEmbed = getSpotifyEmbedUrl(site.spotifyUrl);

  const shareUrl =
    typeof window !== 'undefined' ? `${window.location.origin}/wedding/${slug}` : '';

  function handleVisitWishlistFromRsvp(guestName: string) {
    setPrefilledGuestName(guestName);
    const el = document.getElementById('section-wishlist');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
    setWishlistOpen(true);
  }

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ backgroundColor: theme.backgroundColor, color: textColor }}
    >
      {/* Top 3-Zone Header */}
      <header
        className="sticky top-0 z-30 border-b backdrop-blur-md"
        style={{ backgroundColor: `${theme.backgroundColor}EB`, borderColor }}
      >
        <div className="max-w-5xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between gap-8">
          <a
            href="#top"
            className="text-xl font-semibold tracking-tight whitespace-nowrap shrink-0"
            style={{ fontFamily: headingFontCss }}
          >
            {coupleNames}
          </a>

          <nav aria-label="Wedding sections" className="hidden md:flex items-center gap-6 text-sm" style={{ color: mutedColor }}>
            {enabledNavSections.map((sec) => (
              <a
                key={sec.id}
                href={`#section-${sec.id}`}
                className="hover:opacity-100 opacity-85 transition-opacity whitespace-nowrap shrink-0"
              >
                {sec.title}
              </a>
            ))}
          </nav>

          <div className="shrink-0">
            {site.rsvpConfig.enabled ? (
              <a
                href="#section-rsvp"
                className="min-h-[40px] inline-flex items-center px-4 py-2 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap shrink-0"
                style={{ backgroundColor: theme.primaryColor, color: primaryBtnText }}
              >
                {site.labels.rsvpNavLabel || 'RSVP'}
              </a>
            ) : site.wishlistConfig.enabled ? (
              <a
                href="#section-wishlist"
                className="min-h-[40px] inline-flex items-center px-4 py-2 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap shrink-0"
                style={{ backgroundColor: theme.primaryColor, color: primaryBtnText }}
              >
                {site.labels.wishlistNavLabel || 'Wishlist - Moi'}
              </a>
            ) : null}
          </div>
        </div>
      </header>

      <main id="top" className="flex-1">
        {/* Hero Section */}
        <section className="max-w-5xl mx-auto px-5 sm:px-8 pt-10 sm:pt-16 pb-12 sm:pb-16">
          <div className="text-center max-w-3xl mx-auto mb-10">
            {(couple.logoAssetId || previewMode) && couple.logoAssetId && (
              <div className="w-16 h-16 mx-auto mb-5 rounded-full overflow-hidden border" style={{ borderColor }}>
                <AssetImage
                  slug={slug}
                  assetId={couple.logoAssetId}
                  alt={`${coupleNames} monogram`}
                  loading="eager"
                  className="w-full h-full object-contain p-1"
                />
              </div>
            )}

            {couple.openingVerse && (
              <p className="text-xs sm:text-sm italic mb-3" style={{ color: mutedColor }}>
                {couple.openingVerse}
              </p>
            )}

            <h1
              className="text-4xl sm:text-6xl font-semibold tracking-tight leading-[1.08] mb-4"
              style={{ fontFamily: headingFontCss, textWrap: 'balance' }}
            >
              {couple.partner1Name} &amp; {couple.partner2Name}
            </h1>

            <div
              className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs sm:text-sm mb-5"
              style={{ color: mutedColor }}
            >
              <span>{couple.partner1Role}</span>
              <span aria-hidden="true">·</span>
              <span>{couple.partner2Role}</span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">{couple.weddingDate}</span>
              {couple.weddingTime && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="tabular-nums">{couple.weddingTime}</span>
                </>
              )}
            </div>

            {couple.heroTagline && (
              <p className="text-base sm:text-lg leading-relaxed max-w-2xl mx-auto mb-7" style={{ color: mutedColor }}>
                {couple.heroTagline}
              </p>
            )}

            {countdown && !countdown.passed && (
              <div className="inline-grid grid-cols-3 gap-6 sm:gap-10 py-3 px-6 rounded-xl border mb-7" style={{ backgroundColor: surfaceColor, borderColor }}>
                <div>
                  <div className="text-2xl sm:text-3xl font-semibold tabular-nums" style={{ fontFamily: headingFontCss }}>
                    {countdown.days}
                  </div>
                  <div className="text-xs" style={{ color: mutedColor }}>Days</div>
                </div>
                <div>
                  <div className="text-2xl sm:text-3xl font-semibold tabular-nums" style={{ fontFamily: headingFontCss }}>
                    {countdown.hours}
                  </div>
                  <div className="text-xs" style={{ color: mutedColor }}>Hours</div>
                </div>
                <div>
                  <div className="text-2xl sm:text-3xl font-semibold tabular-nums" style={{ fontFamily: headingFontCss }}>
                    {countdown.mins}
                  </div>
                  <div className="text-xs" style={{ color: mutedColor }}>Mins</div>
                </div>
              </div>
            )}

            {!previewMode && (
              <div className="flex flex-wrap items-center justify-center gap-3">
                {site.rsvpConfig.enabled && (
                  <a
                    href="#section-rsvp"
                    className="min-h-[44px] inline-flex items-center px-6 py-2.5 rounded-lg text-sm font-medium"
                    style={{ backgroundColor: theme.primaryColor, color: primaryBtnText }}
                  >
                    Confirm Attendance
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(shareUrl);
                    setCopiedLink(true);
                    setTimeout(() => setCopiedLink(false), 2500);
                  }}
                  className="min-h-[44px] inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border text-sm font-medium cursor-pointer"
                  style={{ borderColor, backgroundColor: surfaceColor }}
                >
                  {copiedLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copiedLink ? 'Invitation link copied' : site.labels.copyLinkText || 'Copy invitation link'}
                </button>
              </div>
            )}
          </div>

          {(couple.heroAssetId || couple.heroFallbackUrl) && (
            <div
              className="aspect-[16/9] w-full rounded-2xl overflow-hidden border"
              style={{ borderColor }}
            >
              <AssetImage
                slug={slug}
                assetId={couple.heroAssetId}
                fallbackUrl={couple.heroFallbackUrl}
                alt={`${coupleNames} wedding celebration`}
                loading="eager"
                className="w-full h-full object-cover"
              />
            </div>
          )}
        </section>

        {/* Ordered Customizable Sections */}
        <div className="max-w-5xl mx-auto px-5 sm:px-8 space-y-16 sm:space-y-24 pb-20">
          {sections
            .filter((s) => s.enabled)
            .map((sec) => {
              if (sec.id === 'story') {
                return (
                  <section key="story" id="section-story" className="grid md:grid-cols-12 gap-8 items-center">
                    <div className={site.story.imageAssetId || site.story.fallbackUrl ? 'md:col-span-7' : 'md:col-span-12'}>
                      <p className="text-xs uppercase tracking-[0.2em] mb-2" style={{ color: theme.accentColor }}>
                        {sec.title}
                      </p>
                      <h2 className="text-3xl sm:text-4xl font-semibold mb-4" style={{ fontFamily: headingFontCss }}>
                        {site.story.heading}
                      </h2>
                      <p className="text-base leading-relaxed whitespace-pre-line" style={{ color: mutedColor }}>
                        {site.story.body}
                      </p>
                    </div>
                    {(site.story.imageAssetId || site.story.fallbackUrl) && (
                      <div className="md:col-span-5 aspect-[3/4] rounded-2xl overflow-hidden border" style={{ borderColor }}>
                        <AssetImage
                          slug={slug}
                          assetId={site.story.imageAssetId}
                          fallbackUrl={site.story.fallbackUrl}
                          alt={site.story.heading}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                  </section>
                );
              }

              if (sec.id === 'events' && site.events.length > 0) {
                return (
                  <section key="events" id="section-events">
                    <div className="mb-8">
                      <p className="text-xs uppercase tracking-[0.2em] mb-2" style={{ color: theme.accentColor }}>
                        Schedule
                      </p>
                      <h2 className="text-3xl sm:text-4xl font-semibold" style={{ fontFamily: headingFontCss }}>
                        {sec.title}
                      </h2>
                    </div>

                    <div className="grid md:grid-cols-2 gap-6">
                      {site.events.map((ev) => (
                        <article
                          key={ev.id}
                          className="rounded-2xl overflow-hidden border flex flex-col"
                          style={{ backgroundColor: surfaceColor, borderColor }}
                        >
                          {(ev.photoAssetId || ev.fallbackUrl) && (
                            <div className="aspect-[16/10] w-full overflow-hidden border-b" style={{ borderColor }}>
                              <AssetImage
                                slug={slug}
                                assetId={ev.photoAssetId}
                                fallbackUrl={ev.fallbackUrl}
                                alt={ev.title}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          )}
                          <div className="p-6 flex-1 flex flex-col justify-between space-y-4">
                            <div>
                              <div className="text-xs tabular-nums mb-1.5" style={{ color: mutedColor }}>
                                {ev.date} · {ev.time}
                              </div>
                              <h3 className="text-2xl font-semibold mb-2" style={{ fontFamily: headingFontCss }}>
                                {ev.title}
                              </h3>
                              {ev.description && (
                                <p className="text-sm mb-3" style={{ color: mutedColor }}>
                                  {ev.description}
                                </p>
                              )}
                              <div className="text-sm space-y-1">
                                <p className="font-medium">{ev.venue}</p>
                                {ev.address && (
                                  <p className="text-xs" style={{ color: mutedColor }}>
                                    {ev.address}
                                  </p>
                                )}
                              </div>
                            </div>

                            <div className="flex flex-wrap gap-2.5 pt-2">
                              <button
                                type="button"
                                onClick={() => downloadEventIcs(ev, coupleNames)}
                                className="min-h-[40px] px-3.5 py-2 rounded-lg border text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer"
                                style={{ borderColor }}
                              >
                                <CalendarPlus className="w-3.5 h-3.5" aria-hidden="true" />
                                Add to Calendar
                              </button>
                              {ev.mapLink && (
                                <a
                                  href={ev.mapLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="min-h-[40px] px-3.5 py-2 rounded-lg border text-xs font-medium inline-flex items-center gap-1.5"
                                  style={{ borderColor }}
                                >
                                  <MapPin className="w-3.5 h-3.5" aria-hidden="true" />
                                  Open Map
                                  <ExternalLink className="w-3 h-3" aria-hidden="true" />
                                </a>
                              )}
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                  </section>
                );
              }

              if (sec.id === 'accommodations' && site.accommodations.length > 0) {
                return (
                  <section key="accommodations" id="section-accommodations">
                    <div className="mb-8">
                      <p className="text-xs uppercase tracking-[0.2em] mb-2" style={{ color: theme.accentColor }}>
                        Hospitality
                      </p>
                      <h2 className="text-3xl sm:text-4xl font-semibold" style={{ fontFamily: headingFontCss }}>
                        {sec.title}
                      </h2>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-5">
                      {site.accommodations.map((acc) => (
                        <article
                          key={acc.id}
                          className="rounded-xl p-6 border space-y-2.5"
                          style={{ backgroundColor: surfaceColor, borderColor }}
                        >
                          <h3 className="text-xl font-semibold" style={{ fontFamily: headingFontCss }}>
                            {acc.name}
                          </h3>
                          {acc.address && (
                            <p className="text-sm" style={{ color: mutedColor }}>
                              {acc.address}
                            </p>
                          )}
                          {acc.notes && (
                            <p className="text-xs leading-relaxed" style={{ color: mutedColor }}>
                              {acc.notes}
                            </p>
                          )}
                          <div className="flex flex-wrap gap-3 pt-2 text-xs font-medium">
                            {acc.phone && (
                              <a href={`tel:${acc.phone}`} className="inline-flex items-center gap-1 hover:underline">
                                <Phone className="w-3.5 h-3.5" aria-hidden="true" />
                                {acc.phone}
                              </a>
                            )}
                            {acc.mapLink && (
                              <a
                                href={acc.mapLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 hover:underline"
                              >
                                <MapPin className="w-3.5 h-3.5" aria-hidden="true" />
                                Directions
                              </a>
                            )}
                          </div>
                        </article>
                      ))}
                    </div>
                  </section>
                );
              }

              if (sec.id === 'gallery' && site.gallery.length > 0) {
                return (
                  <section key="gallery" id="section-gallery">
                    <div className="mb-8">
                      <p className="text-xs uppercase tracking-[0.2em] mb-2" style={{ color: theme.accentColor }}>
                        Gallery
                      </p>
                      <h2 className="text-3xl sm:text-4xl font-semibold" style={{ fontFamily: headingFontCss }}>
                        {sec.title}
                      </h2>
                    </div>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                      {site.gallery.map((item) => (
                        <figure
                          key={item.id}
                          className="rounded-xl overflow-hidden border"
                          style={{ backgroundColor: surfaceColor, borderColor }}
                        >
                          <div className="aspect-[4/3]">
                            <AssetImage
                              slug={slug}
                              assetId={item.assetId}
                              fallbackUrl={item.fallbackUrl}
                              alt={item.caption || 'Wedding gallery photograph'}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          {item.caption && (
                            <figcaption className="px-4 py-3 text-xs" style={{ color: mutedColor }}>
                              {item.caption}
                            </figcaption>
                          )}
                        </figure>
                      ))}
                    </div>
                  </section>
                );
              }

              if (sec.id === 'rsvp' && site.rsvpConfig.enabled) {
                return (
                  <section key="rsvp" id="section-rsvp">
                    <div className="mb-8 max-w-2xl">
                      <p className="text-xs uppercase tracking-[0.2em] mb-2" style={{ color: theme.accentColor }}>
                        Kindly Reply
                      </p>
                      <h2 className="text-3xl sm:text-4xl font-semibold mb-2" style={{ fontFamily: headingFontCss }}>
                        {sec.title}
                      </h2>
                      {site.rsvpConfig.deadline && (
                        <p className="text-sm" style={{ color: mutedColor }}>
                          Please respond by {site.rsvpConfig.deadline}.
                        </p>
                      )}
                    </div>
                    {previewMode ? (
                      <div
                        className="rounded-2xl p-8 border text-center text-sm"
                        style={{ backgroundColor: surfaceColor, borderColor, color: mutedColor }}
                      >
                        Interactive RSVP Form ({site.rsvpConfig.submitButtonText}) — Live preview active
                      </div>
                    ) : (
                      <RsvpFormSection
                        slug={slug}
                        site={site}
                        editRsvpId={editRsvpId}
                        primaryColor={theme.primaryColor}
                        primaryBtnText={primaryBtnText}
                        surfaceColor={surfaceColor}
                        borderColor={borderColor}
                        mutedColor={mutedColor}
                        headingFont={headingFontCss}
                        onVisitWishlist={
                          site.wishlistConfig.enabled ? handleVisitWishlistFromRsvp : undefined
                        }
                      />
                    )}
                  </section>
                );
              }

              if (sec.id === 'wishlist' && site.wishlistConfig.enabled) {
                return (
                  <section key="wishlist" id="section-wishlist">
                    <WishlistSection
                      site={site}
                      progress={progress}
                      blessings={blessings}
                      primaryColor={theme.primaryColor}
                      accentColor={theme.accentColor}
                      primaryBtnText={primaryBtnText}
                      surfaceColor={surfaceColor}
                      borderColor={borderColor}
                      mutedColor={mutedColor}
                      headingFont={headingFontCss}
                      onOpenContribute={() => {
                        if (!previewMode) setWishlistOpen(true);
                      }}
                    />
                  </section>
                );
              }

              if (sec.id === 'faq' && site.faq.length > 0) {
                return (
                  <section key="faq" id="section-faq">
                    <div className="mb-8">
                      <p className="text-xs uppercase tracking-[0.2em] mb-2" style={{ color: theme.accentColor }}>
                        Helpful Information
                      </p>
                      <h2 className="text-3xl sm:text-4xl font-semibold" style={{ fontFamily: headingFontCss }}>
                        {sec.title}
                      </h2>
                    </div>
                    <div className="divide-y border-t border-b" style={{ borderColor }}>
                      {site.faq.map((item) => (
                        <div key={item.id} className="py-5">
                          <h3 className="text-base font-semibold mb-1.5">{item.question}</h3>
                          <p className="text-sm leading-relaxed" style={{ color: mutedColor }}>
                            {item.answer}
                          </p>
                        </div>
                      ))}
                    </div>
                  </section>
                );
              }

              if (sec.id === 'spotify' && spotifyEmbed) {
                return (
                  <section key="spotify" id="section-spotify">
                    <div className="mb-6">
                      <h2 className="text-2xl sm:text-3xl font-semibold" style={{ fontFamily: headingFontCss }}>
                        {sec.title}
                      </h2>
                    </div>
                    <iframe
                      title="Wedding Spotify Playlist"
                      src={spotifyEmbed}
                      width="100%"
                      height="152"
                      allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                      loading="lazy"
                      className="rounded-xl border"
                      style={{ borderColor }}
                    />
                  </section>
                );
              }

              return null;
            })}

          {/* Couple Contact Card if configured */}
          {(couple.contactName || couple.contactPhone) && (
            <section className="rounded-xl p-6 border text-center" style={{ backgroundColor: surfaceColor, borderColor }}>
              <p className="text-xs uppercase tracking-[0.2em] mb-1.5" style={{ color: mutedColor }}>
                Questions or Assistance
              </p>
              <p className="text-sm font-medium">
                {couple.contactName}
                {couple.contactName && couple.contactPhone ? ' · ' : ''}
                {couple.contactPhone && (
                  <a href={`tel:${couple.contactPhone}`} className="underline">
                    {couple.contactPhone}
                  </a>
                )}
              </p>
            </section>
          )}
        </div>
      </main>

      <PublicFooter mutedColor={mutedColor} />

      {wishlistOpen && !previewMode && (
        <WishlistModal
          slug={slug}
          site={site}
          initialGuestName={prefilledGuestName}
          primaryColor={theme.primaryColor}
          primaryBtnText={primaryBtnText}
          onClose={() => setWishlistOpen(false)}
        />
      )}
    </div>
  );
}

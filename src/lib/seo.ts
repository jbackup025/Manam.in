import { PLATFORM_NAME } from './constants';

const DEFAULT_TITLE = `${PLATFORM_NAME} — Wedding Invitations, RSVP & Moi Wishlist`;
const DEFAULT_DESCRIPTION =
  'Private, customizable wedding invitations with guest RSVP management and direct UPI Moi wishlists. Built for Indian weddings by MANAM.in.';

function upsertMeta(attr: 'name' | 'property', key: string, content: string) {
  let el = document.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function upsertCanonical(href: string) {
  let el = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', 'canonical');
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

export interface WeddingMetaOptions {
  title: string;
  description: string;
  url?: string;
  hideFromSearchEngines?: boolean;
}

/**
 * Dynamically updates document title, meta description, Open Graph, Twitter,
 * canonical URL, and robots directives for individual wedding pages.
 */
export function updateWeddingDocumentMeta({
  title,
  description,
  url,
  hideFromSearchEngines = true,
}: WeddingMetaOptions): void {
  if (typeof document === 'undefined') return;

  const cleanTitle = title.trim() || DEFAULT_TITLE;
  const cleanDescription = description.trim() || DEFAULT_DESCRIPTION;
  const resolvedUrl = url || window.location.href;

  document.title = cleanTitle;
  upsertMeta('name', 'description', cleanDescription);
  upsertMeta('property', 'og:title', cleanTitle);
  upsertMeta('property', 'og:description', cleanDescription);
  upsertMeta('property', 'og:url', resolvedUrl);
  upsertMeta('name', 'twitter:title', cleanTitle);
  upsertMeta('name', 'twitter:description', cleanDescription);
  upsertMeta(
    'name',
    'robots',
    hideFromSearchEngines ? 'noindex, nofollow' : 'index, follow'
  );
  upsertCanonical(resolvedUrl);
}

/**
 * Restores platform default document metadata for non-wedding pages.
 */
export function resetPlatformDocumentMeta(
  title = DEFAULT_TITLE,
  description = DEFAULT_DESCRIPTION,
  robots = 'index, follow'
): void {
  updateWeddingDocumentMeta({
    title,
    description,
    hideFromSearchEngines: robots.includes('noindex'),
  });
}

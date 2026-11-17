import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import { isValidSlug, PLATFORM_NAME } from '../lib/constants';
import { db } from '../lib/firebase';
import type { BlessingDoc, PublicProgressDoc, PublicSiteDoc } from '../types/wedding';
import { PublicFooter } from '../components/PublicFooter';
import { WeddingSiteRenderer } from '../components/WeddingSiteRenderer';

function setMetaTag(name: string, content: string, isProperty = false) {
  const attr = isProperty ? 'property' : 'name';
  let el = document.querySelector(`meta[${attr}="${name}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, name);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

export function WeddingPublicPage() {
  const { slug = '' } = useParams();
  const [searchParams] = useSearchParams();
  const editRsvpId = searchParams.get('rsvp');

  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [site, setSite] = useState<PublicSiteDoc | null>(null);
  const [progress, setProgress] = useState<PublicProgressDoc | null>(null);
  const [blessings, setBlessings] = useState<BlessingDoc[]>([]);

  useEffect(() => {
    if (!isValidSlug(slug)) {
      setUnavailable(true);
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    setUnavailable(false);

    Promise.all([
      getDoc(doc(db, 'weddings', slug, 'public', 'site')),
      getDoc(doc(db, 'weddings', slug, 'public', 'progress')).catch(() => null),
    ])
      .then(([siteSnap, progressSnap]) => {
        if (!active) return;
        if (!siteSnap.exists()) {
          setUnavailable(true);
          return;
        }
        const siteData = siteSnap.data() as PublicSiteDoc;
        setSite(siteData);
        if (progressSnap && progressSnap.exists()) {
          setProgress(progressSnap.data() as PublicProgressDoc);
        } else {
          setProgress(null);
        }
      })
      .catch(() => {
        // Firestore returns permission-denied when status != ACTIVE or expired
        if (active) setUnavailable(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [slug]);

  useEffect(() => {
    if (!site || unavailable) return;

    const coupleNames = `${site.couple.partner1Name} & ${site.couple.partner2Name}`;
    const pageTitle = site.seo.customTitle || `${coupleNames} — ${PLATFORM_NAME}`;
    const pageDesc =
      site.seo.customDescription ||
      `Wedding invitation for ${coupleNames} on ${PLATFORM_NAME}.`;

    document.title = pageTitle;
    setMetaTag('description', pageDesc);
    setMetaTag('og:title', pageTitle, true);
    setMetaTag('og:description', pageDesc, true);
    setMetaTag(
      'robots',
      site.seo.hideFromSearchEngines ? 'noindex, nofollow' : 'index, follow'
    );

    const progressUnsub = onSnapshot(
      doc(db, 'weddings', slug, 'public', 'progress'),
      (snap) => {
        if (snap.exists()) {
          setProgress(snap.data() as PublicProgressDoc);
        }
      },
      () => {
        // Ignore if wedding becomes unavailable
      }
    );

    const blessingsQuery = query(
      collection(db, 'weddings', slug, 'blessings'),
      where('approved', '==', true),
      orderBy('createdAt', 'desc')
    );

    const blessingsUnsub = onSnapshot(
      blessingsQuery,
      (snap) => {
        setBlessings(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<BlessingDoc, 'id'>) }))
        );
      },
      () => {
        // Ignore if unindexed or unavailable
      }
    );

    return () => {
      progressUnsub();
      blessingsUnsub();
    };
  }, [slug, site, unavailable]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF7F2] text-[#1D1915] p-6 sm:p-12">
        <div className="max-w-4xl mx-auto space-y-6 animate-pulse">
          <div className="h-10 w-64 bg-[#1D1915]/10 rounded mx-auto" />
          <div className="h-6 w-96 max-w-full bg-[#1D1915]/10 rounded mx-auto" />
          <div className="aspect-[16/9] w-full bg-[#1D1915]/10 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (unavailable || !site) {
    return (
      <div className="min-h-screen bg-[#FAF7F2] text-[#1D1915] flex flex-col">
        <main className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white border border-[#1D1915]/12 rounded-2xl p-8 text-center">
            <p className="text-xs uppercase tracking-[0.2em] text-[#7C5821] font-medium mb-3">
              {PLATFORM_NAME}
            </p>
            <h1
              className="text-3xl font-semibold mb-3"
              style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
            >
              This invitation is not available
            </h1>
            <p className="text-sm text-[#5E554B] mb-6 leading-relaxed">
              This wedding site may have expired, concluded, or not yet been published by the couple.
            </p>
            <Link
              to="/"
              className="min-h-[44px] inline-flex items-center px-5 py-2.5 rounded-lg bg-[#7C5821] text-[#FAF7F2] text-sm font-medium hover:bg-[#66471A] transition-colors"
            >
              Return to {PLATFORM_NAME}
            </Link>
          </div>
        </main>
        <PublicFooter mutedColor="#5E554B" />
      </div>
    );
  }

  return (
    <WeddingSiteRenderer
      slug={slug}
      site={site}
      progress={progress}
      blessings={blessings}
      editRsvpId={editRsvpId}
    />
  );
}

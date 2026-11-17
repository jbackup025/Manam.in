import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Download,
  ExternalLink,
  Eye,
  Printer,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import {
  Timestamp,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { callAuthedApi } from '../lib/apiClient';
import { useAuth } from '../lib/authContext';
import { formatINR, isValidSlug, PLATFORM_NAME, SUPER_ADMIN_EMAIL } from '../lib/constants';
import {
  exportAllWeddingJson,
  exportContributionsToCsv,
  exportRsvpsToCsv,
  exportRsvpsToExcel,
} from '../lib/exportData';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import type {
  BlessingDoc,
  ContributionDoc,
  PublicProgressDoc,
  PublicSiteDoc,
  RsvpDoc,
  RsvpStatus,
  WeddingDoc,
} from '../types/wedding';

function getRsvpStatus(r: RsvpDoc): RsvpStatus {
  if (r.status === 'confirmed' || r.status === 'declined' || r.status === 'pending') {
    return r.status;
  }
  if (r.attending === 'no') return 'declined';
  if (r.accommodationNeeded && r.accommodationStatus === 'pending') return 'pending';
  return 'confirmed';
}
import { resetPlatformDocumentMeta } from '../lib/seo';
import { WeddingSiteRenderer } from '../components/WeddingSiteRenderer';
import { CopyLinkButton } from '../components/CopyLinkButton';
import { CustomizationEditor } from '../components/admin/CustomizationEditor';
import { InvitationShareCard } from '../components/admin/InvitationShareCard';

type AdminTab = 'overview' | 'rsvps' | 'accommodation' | 'wishlist' | 'customize';

export function CoupleAdminPage() {
  const { slug = '' } = useParams();
  const { user, authReady, signInWithGoogle, signOutNow } = useAuth();

  const [checkingRole, setCheckingRole] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [authError, setAuthError] = useState('');

  const [wedding, setWedding] = useState<WeddingDoc | null>(null);
  const [site, setSite] = useState<PublicSiteDoc | null>(null);
  const [draftSite, setDraftSite] = useState<PublicSiteDoc | null>(null);
  const [progress, setProgress] = useState<PublicProgressDoc | null>(null);
  const [rsvps, setRsvps] = useState<RsvpDoc[]>([]);
  const [contributions, setContributions] = useState<ContributionDoc[]>([]);
  const [blessings, setBlessings] = useState<BlessingDoc[]>([]);

  const [tab, setTab] = useState<AdminTab>('overview');
  const [showLivePreview, setShowLivePreview] = useState(false);
  const [savingState, setSavingState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Filters
  const [rsvpSearch, setRsvpSearch] = useState('');
  const [rsvpStatusFilter, setRsvpStatusFilter] = useState<'all' | RsvpStatus>('all');
  const [dietFilter, setDietFilter] = useState<'all' | 'veg' | 'non-veg'>('all');
  const [accomFilter, setAccomFilter] = useState<'all' | 'yes' | 'no'>('all');
  const [groupFilter, setGroupFilter] = useState<string>('all');
  const [groupByFamily, setGroupByFamily] = useState(false);
  const [editingRsvp, setEditingRsvp] = useState<RsvpDoc | null>(null);

  const [contribStatusFilter, setContribStatusFilter] = useState<'all' | 'pending' | 'confirmed' | 'reversed'>('all');
  const [contribRecipientFilter, setContribRecipientFilter] = useState<'all' | 'partner1' | 'partner2'>('all');
  const [busyContribId, setBusyContribId] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    resetPlatformDocumentMeta(
      `Manage /${slug} — ${PLATFORM_NAME}`,
      `Couple administration portal for ${slug} on ${PLATFORM_NAME}.`,
      'noindex, nofollow'
    );
    return () => {
      resetPlatformDocumentMeta();
    };
  }, [slug]);

  // Role enforcement on auth change
  useEffect(() => {
    if (!authReady) return;
    if (!user) {
      setCheckingRole(false);
      return;
    }

    if (!isValidSlug(slug)) {
      setAccessDenied(true);
      setCheckingRole(false);
      return;
    }

    const email = (user.email || '').trim().toLowerCase();
    if (!user.emailVerified || !email) {
      signOutNow();
      setAccessDenied(true);
      setCheckingRole(false);
      return;
    }

    if (email === SUPER_ADMIN_EMAIL) {
      setAccessDenied(false);
      setCheckingRole(false);
      return;
    }

    setCheckingRole(true);
    getDoc(doc(db, 'weddings', slug, 'admins', email))
      .then((snap) => {
        if (!snap.exists()) {
          signOutNow();
          setAccessDenied(true);
        } else {
          setAccessDenied(false);
        }
      })
      .catch(() => {
        signOutNow();
        setAccessDenied(true);
      })
      .finally(() => setCheckingRole(false));
  }, [authReady, user, slug]);

  // Subscribe to wedding collections once authorized
  useEffect(() => {
    if (!authReady || !user || accessDenied || checkingRole || !isValidSlug(slug)) return;

    const unsubs: (() => void)[] = [];

    unsubs.push(
      onSnapshot(
        doc(db, 'weddings', slug),
        (snap) => {
          if (snap.exists()) setWedding(snap.data() as WeddingDoc);
        },
        (err) => handleFirestoreError(err, OperationType.GET, `weddings/${slug}`)
      )
    );

    unsubs.push(
      onSnapshot(
        doc(db, 'weddings', slug, 'public', 'site'),
        (snap) => {
          if (snap.exists()) {
            const loaded = snap.data() as PublicSiteDoc;
            setSite(loaded);
            setDraftSite((prev) => prev || loaded);
          }
        },
        (err) => handleFirestoreError(err, OperationType.GET, `weddings/${slug}/public/site`)
      )
    );

    unsubs.push(
      onSnapshot(
        doc(db, 'weddings', slug, 'public', 'progress'),
        (snap) => {
          if (snap.exists()) setProgress(snap.data() as PublicProgressDoc);
        },
        () => {}
      )
    );

    unsubs.push(
      onSnapshot(
        query(collection(db, 'weddings', slug, 'rsvps'), orderBy('createdAt', 'desc')),
        (snap) => {
          setRsvps(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<RsvpDoc, 'id'>) })));
        },
        (err) => handleFirestoreError(err, OperationType.LIST, `weddings/${slug}/rsvps`)
      )
    );

    unsubs.push(
      onSnapshot(
        query(collection(db, 'weddings', slug, 'contributions'), orderBy('createdAt', 'desc')),
        (snap) => {
          setContributions(
            snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ContributionDoc, 'id'>) }))
          );
        },
        (err) => handleFirestoreError(err, OperationType.LIST, `weddings/${slug}/contributions`)
      )
    );

    unsubs.push(
      onSnapshot(
        query(collection(db, 'weddings', slug, 'blessings'), orderBy('createdAt', 'desc')),
        (snap) => {
          setBlessings(
            snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<BlessingDoc, 'id'>) }))
          );
        },
        (err) => handleFirestoreError(err, OperationType.LIST, `weddings/${slug}/blessings`)
      )
    );

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [authReady, user, accessDenied, checkingRole, slug]);

  async function saveDraftToFirestore(nextDraft: PublicSiteDoc) {
    setSavingState('saving');
    const path = `weddings/${slug}/public/site`;
    try {
      const deadlineTs = nextDraft.rsvpConfig.deadline
        ? Timestamp.fromDate(new Date(`${nextDraft.rsvpConfig.deadline}T23:59:59+05:30`))
        : null;

      await setDoc(doc(db, path), {
        ...nextDraft,
        rsvpDeadlineTs: deadlineTs,
        updatedAt: serverTimestamp(),
      });
      setSavingState('saved');
    } catch (err) {
      setSavingState('error');
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  }

  function handleDraftChange(next: PublicSiteDoc) {
    setDraftSite(next);
    setSavingState('idle');
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => {
      void saveDraftToFirestore(next);
    }, 1200);
  }

  async function handleGoogleSignIn() {
    setAuthError('');
    setAccessDenied(false);
    try {
      await signInWithGoogle();
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Sign-in failed');
    }
  }

  // Computed metrics
  const metrics = useMemo(() => {
    const attending = rsvps.filter((r) => r.attending === 'yes');
    const declined = rsvps.filter((r) => r.attending === 'no');
    let totalGuests = 0;
    let vegCount = 0;
    let nonVegCount = 0;
    let accomRequests = 0;
    let roomsRequired = 0;

    for (const r of attending) {
      totalGuests += r.guestCount || 0;
      for (const p of r.partyGuests || []) {
        if (p.diet === 'non-veg') nonVegCount += 1;
        else vegCount += 1;
      }
      if (r.accommodationNeeded) {
        accomRequests += 1;
        roomsRequired += r.roomsNeeded || 0;
      }
    }

    let p1Pending = 0;
    let p1Confirmed = 0;
    let p2Pending = 0;
    let p2Confirmed = 0;
    for (const c of contributions) {
      if (c.status === 'pending') {
        if (c.recipient === 'partner1') p1Pending += c.amountPaise;
        else p2Pending += c.amountPaise;
      } else if (c.status === 'confirmed') {
        if (c.recipient === 'partner1') p1Confirmed += c.amountPaise;
        else p2Confirmed += c.amountPaise;
      }
    }

    return {
      totalRsvps: rsvps.length,
      attendingCount: attending.length,
      declinedCount: declined.length,
      totalGuests,
      vegCount,
      nonVegCount,
      accomRequests,
      roomsRequired,
      blessingsCount: blessings.length,
      p1Pending,
      p1Confirmed,
      p2Pending,
      p2Confirmed,
    };
  }, [rsvps, contributions, blessings]);

  const rsvpStatusCounts = useMemo(() => {
    let confirmed = 0;
    let declined = 0;
    let pending = 0;
    for (const r of rsvps) {
      const s = getRsvpStatus(r);
      if (s === 'confirmed') confirmed += 1;
      else if (s === 'declined') declined += 1;
      else pending += 1;
    }
    return {
      all: rsvps.length,
      confirmed,
      declined,
      pending,
    };
  }, [rsvps]);

  const filteredRsvps = useMemo(() => {
    const q = rsvpSearch.trim().toLowerCase();
    return rsvps.filter((r) => {
      if (rsvpStatusFilter !== 'all' && getRsvpStatus(r) !== rsvpStatusFilter) return false;
      if (accomFilter === 'yes' && !r.accommodationNeeded) return false;
      if (accomFilter === 'no' && r.accommodationNeeded) return false;
      if (groupFilter !== 'all' && r.group !== groupFilter) return false;
      if (dietFilter !== 'all') {
        const hasDiet = (r.partyGuests || []).some((p) => p.diet === dietFilter);
        if (!hasDiet) return false;
      }
      if (q) {
        const hay = `${r.fullName} ${r.email} ${r.refCode} ${r.group}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rsvps, rsvpSearch, rsvpStatusFilter, dietFilter, accomFilter, groupFilter]);

  const filteredContribs = useMemo(() => {
    return contributions.filter((c) => {
      if (contribStatusFilter !== 'all' && c.status !== contribStatusFilter) return false;
      if (contribRecipientFilter !== 'all' && c.recipient !== contribRecipientFilter) return false;
      return true;
    });
  }, [contributions, contribStatusFilter, contribRecipientFilter]);

  async function handleContribAction(
    endpoint: '/api/contributions/confirm' | '/api/contributions/reverse' | '/api/contributions/delete',
    contributionId: string
  ) {
    setActionError('');
    setBusyContribId(contributionId);
    try {
      await callAuthedApi(endpoint, { slug, contributionId });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setBusyContribId(null);
    }
  }

  async function handleBlessingToggle(b: BlessingDoc) {
    if (!b.id) return;
    const path = `weddings/${slug}/blessings/${b.id}`;
    try {
      await updateDoc(doc(db, path), {
        approved: !b.approved,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  }

  async function handleDeleteRsvp(id: string) {
    const path = `weddings/${slug}/rsvps/${id}`;
    try {
      await deleteDoc(doc(db, path));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  }

  async function handleSaveRsvpEdit(r: RsvpDoc) {
    if (!r.id) return;
    const path = `weddings/${slug}/rsvps/${r.id}`;
    try {
      await updateDoc(doc(db, path), {
        attending: r.attending,
        status: getRsvpStatus(r),
        fullName: r.fullName,
        email: r.email,
        group: r.group,
        guestCount: r.guestCount,
        partyGuests: r.partyGuests,
        allergies: r.allergies,
        accommodationNeeded: r.accommodationNeeded,
        roomsNeeded: r.roomsNeeded,
        assignedRoom: r.assignedRoom,
        accommodationStatus: r.accommodationStatus,
        adminCheckInDate: r.adminCheckInDate,
        adminCheckOutDate: r.adminCheckOutDate,
        updatedAt: serverTimestamp(),
      });
      setEditingRsvp(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  }

  if (!authReady || checkingRole) {
    return (
      <div className="min-h-screen bg-[#FAF7F2] flex items-center justify-center p-6 text-sm text-[#5E554B]">
        Verifying couple admin session...
      </div>
    );
  }

  if (!user || accessDenied) {
    return (
      <div className="min-h-screen bg-[#FAF7F2] text-[#1D1915] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white border border-[#1D1915]/12 rounded-2xl p-8 text-center space-y-5">
          <p className="text-xs uppercase tracking-[0.2em] text-[#7C5821] font-medium">
            {PLATFORM_NAME} · Couple Portal
          </p>
          <h1
            className="text-3xl font-semibold"
            style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
          >
            Sign in to manage /{slug}
          </h1>
          {accessDenied && (
            <div role="alert" className="p-3 rounded-lg bg-[#FEE2E2] text-[#991B1B] text-sm font-medium">
              Access denied.
            </div>
          )}
          {authError && (
            <div role="alert" className="p-3 rounded-lg bg-[#FEE2E2] text-[#991B1B] text-xs">
              {authError}
            </div>
          )}
          <p className="text-sm text-[#5E554B]">
            Use the invited Google account assigned to this wedding.
          </p>
          <button
            type="button"
            onClick={handleGoogleSignIn}
            className="w-full min-h-[44px] px-5 py-2.5 rounded-lg bg-[#7C5821] text-[#FAF7F2] text-sm font-medium hover:bg-[#66471A] cursor-pointer"
          >
            Continue with Google
          </button>
          <Link to="/" className="block text-xs text-[#5E554B] underline">
            Return to {PLATFORM_NAME}
          </Link>
        </div>
      </div>
    );
  }

  const publicUrl = `${window.location.origin}/wedding/${slug}`;
  const whatsappShareUrl = `https://wa.me/?text=${encodeURIComponent(
    `We joyfully invite you to our wedding! View details, RSVP, and blessings here: ${publicUrl}`
  )}`;

  const p1Name = site?.wishlistConfig.partner1.displayName || 'Partner 1';
  const p2Name = site?.wishlistConfig.partner2.displayName || 'Partner 2';

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-[#1D1915]">
      {/* Header */}
      <header className="no-print border-b border-[#1D1915]/10 bg-white sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Link to="/" className="text-sm font-semibold text-[#7C5821] whitespace-nowrap">
              {PLATFORM_NAME}
            </Link>
            <span className="text-[#5E554B]">/</span>
            <span className="text-sm font-medium truncate">
              {wedding?.coupleNames || slug}
            </span>
            {wedding && (
              <span className="hidden sm:inline text-xs text-[#5E554B] font-mono">
                · {wedding.status}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <CopyLinkButton
              url={publicUrl}
              label="Copy Link"
              copiedLabel="Copied!"
              className="!min-h-[38px] !px-3 !py-1.5 !text-xs border border-[#1D1915]/15 bg-white hover:bg-[#FAF7F2]"
            />
            <a
              href={`/wedding/${slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-[38px] px-3 py-1.5 rounded-lg border border-[#1D1915]/15 text-xs font-medium inline-flex items-center gap-1.5"
            >
              Public Site <ExternalLink className="w-3.5 h-3.5" />
            </a>
            <button
              type="button"
              onClick={() => signOutNow()}
              className="min-h-[38px] px-3 py-1.5 rounded-lg border border-[#1D1915]/15 text-xs font-medium cursor-pointer"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* Main Nav Tabs */}
      <div className="no-print border-b border-[#1D1915]/10 bg-white/70">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex overflow-x-auto gap-2 py-2.5">
          {[
            { id: 'overview' as const, label: 'Overview' },
            { id: 'rsvps' as const, label: `RSVPs (${rsvps.length})` },
            { id: 'accommodation' as const, label: `Accommodation (${metrics.accomRequests})` },
            { id: 'wishlist' as const, label: `Wishlist & Blessings (${contributions.length})` },
            { id: 'customize' as const, label: 'Customize Site' },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`min-h-[40px] px-4 py-2 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap shrink-0 cursor-pointer ${
                tab === t.id
                  ? 'bg-[#7C5821] text-[#FAF7F2]'
                  : 'text-[#5E554B] hover:bg-[#F2ECE1]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {actionError && (
          <div role="alert" className="no-print mb-6 p-3.5 rounded-lg bg-[#FEE2E2] text-[#991B1B] text-sm">
            {actionError}
          </div>
        )}

        {/* OVERVIEW */}
        {tab === 'overview' && (
          <div className="space-y-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h1
                  className="text-3xl font-semibold"
                  style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
                >
                  Wedding Dashboard
                </h1>
                <p className="text-sm text-[#5E554B]">
                  Wedding date: {wedding?.weddingDate || '—'} · Signed in as {user.email}
                </p>
              </div>
              <div className="flex flex-wrap gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    exportRsvpsToCsv(slug, rsvps);
                    exportContributionsToCsv(slug, contributions, p1Name, p2Name);
                    exportAllWeddingJson(slug, { site, rsvps, contributions, blessings });
                  }}
                  className="min-h-[42px] px-4 py-2 rounded-lg bg-[#1D1915] text-[#FAF7F2] text-xs sm:text-sm font-medium inline-flex items-center gap-2 cursor-pointer"
                >
                  <Download className="w-4 h-4" /> Download all my data
                </button>
              </div>
            </div>

            <InvitationShareCard
              slug={slug}
              coupleNames={wedding?.coupleNames || slug}
              publicUrl={publicUrl}
              whatsappShareUrl={whatsappShareUrl}
            />

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'Total RSVPs', value: metrics.totalRsvps, sub: `${metrics.attendingCount} attending · ${metrics.declinedCount} declined` },
                { label: 'Total Guests', value: metrics.totalGuests, sub: `${metrics.vegCount} Veg · ${metrics.nonVegCount} Non-Veg` },
                { label: 'Accommodation', value: metrics.roomsRequired, sub: `${metrics.accomRequests} families requested rooms` },
                { label: 'Blessings Received', value: metrics.blessingsCount, sub: `${blessings.filter((b) => b.approved).length} approved on wall` },
              ].map((card) => (
                <div key={card.label} className="bg-white border border-[#1D1915]/10 rounded-xl p-5">
                  <p className="text-xs text-[#5E554B] mb-1">{card.label}</p>
                  <p className="text-3xl font-semibold tabular-nums mb-1">{card.value}</p>
                  <p className="text-xs text-[#5E554B] tabular-nums">{card.sub}</p>
                </div>
              ))}
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="bg-white border border-[#1D1915]/10 rounded-xl p-5">
                <p className="text-xs text-[#5E554B] mb-1">{p1Name} — Moi Totals</p>
                <p className="text-2xl font-semibold tabular-nums">{formatINR(metrics.p1Confirmed)} confirmed</p>
                <p className="text-xs text-[#5E554B] mt-1 tabular-nums">{formatINR(metrics.p1Pending)} pending reconciliation</p>
              </div>
              <div className="bg-white border border-[#1D1915]/10 rounded-xl p-5">
                <p className="text-xs text-[#5E554B] mb-1">{p2Name} — Moi Totals</p>
                <p className="text-2xl font-semibold tabular-nums">{formatINR(metrics.p2Confirmed)} confirmed</p>
                <p className="text-xs text-[#5E554B] mt-1 tabular-nums">{formatINR(metrics.p2Pending)} pending reconciliation</p>
              </div>
            </div>
          </div>
        )}

        {/* RSVPS TAB */}
        {tab === 'rsvps' && (
          <div className="space-y-5">
            <div className="no-print flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2 items-center">
                <input
                  type="search"
                  value={rsvpSearch}
                  onChange={(e) => setRsvpSearch(e.target.value)}
                  placeholder="Search name, email, ref..."
                  className="min-h-[40px] px-3 rounded-lg border border-[#1D1915]/15 bg-white text-sm"
                />
                <div
                  role="group"
                  aria-label="Filter RSVPs by status"
                  className="inline-flex flex-wrap rounded-lg border border-[#1D1915]/15 bg-white p-0.5 gap-0.5"
                >
                  {(
                    [
                      { id: 'all', label: `All (${rsvpStatusCounts.all})` },
                      { id: 'confirmed', label: `Confirmed (${rsvpStatusCounts.confirmed})` },
                      { id: 'declined', label: `Declined (${rsvpStatusCounts.declined})` },
                      { id: 'pending', label: `Pending (${rsvpStatusCounts.pending})` },
                    ] as const
                  ).map((opt) => {
                    const active = rsvpStatusFilter === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setRsvpStatusFilter(opt.id)}
                        className={`min-h-[34px] px-3 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                          active
                            ? 'bg-[#7C5821] text-white'
                            : 'text-[#5E554B] hover:text-[#1D1915] hover:bg-[#FAF7F2]'
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
                <select
                  value={dietFilter}
                  onChange={(e) => setDietFilter(e.target.value as 'all' | 'veg' | 'non-veg')}
                  className="min-h-[40px] px-2.5 rounded-lg border border-[#1D1915]/15 bg-white text-xs"
                >
                  <option value="all">All Diets</option>
                  <option value="veg">Has Veg</option>
                  <option value="non-veg">Has Non-Veg</option>
                </select>
                <select
                  value={accomFilter}
                  onChange={(e) => setAccomFilter(e.target.value as 'all' | 'yes' | 'no')}
                  className="min-h-[40px] px-2.5 rounded-lg border border-[#1D1915]/15 bg-white text-xs"
                >
                  <option value="all">All Stay</option>
                  <option value="yes">Needs Room</option>
                  <option value="no">No Room</option>
                </select>
                <select
                  value={groupFilter}
                  onChange={(e) => setGroupFilter(e.target.value)}
                  className="min-h-[40px] px-2.5 rounded-lg border border-[#1D1915]/15 bg-white text-xs"
                >
                  <option value="all">All Groups</option>
                  {(site?.rsvpConfig.groups || []).map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
                <label className="flex items-center gap-1.5 text-xs px-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={groupByFamily}
                    onChange={(e) => setGroupByFamily(e.target.checked)}
                  />
                  Group by family
                </label>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => exportRsvpsToCsv(slug, filteredRsvps)}
                  className="min-h-[40px] px-3 rounded-lg border border-[#1D1915]/15 bg-white text-xs font-medium cursor-pointer"
                >
                  CSV
                </button>
                <button
                  type="button"
                  onClick={() => exportRsvpsToExcel(slug, filteredRsvps)}
                  className="min-h-[40px] px-3 rounded-lg border border-[#1D1915]/15 bg-white text-xs font-medium cursor-pointer"
                >
                  Excel (.xlsx)
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="min-h-[40px] px-3 rounded-lg bg-[#1D1915] text-white text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" /> Print A4 List
                </button>
              </div>
            </div>

            <h2 className="hidden print:block text-xl font-semibold mb-4">
              {wedding?.coupleNames} — Guest RSVP List ({filteredRsvps.length})
            </h2>

            {filteredRsvps.length === 0 ? (
              <div className="bg-white border border-[#1D1915]/10 rounded-xl p-10 text-center text-sm text-[#5E554B]">
                No RSVPs match the current filters.
              </div>
            ) : (
              <div className="bg-white border border-[#1D1915]/10 rounded-xl overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-[#1D1915]/10 text-xs text-[#5E554B]">
                      <th className="py-3 px-4">Ref</th>
                      <th className="py-3 px-4">Name</th>
                      <th className="py-3 px-4">Group</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Party &amp; Diet</th>
                      <th className="py-3 px-4">Stay</th>
                      <th className="no-print py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1D1915]/10">
                    {[...filteredRsvps]
                      .sort((a, b) => (groupByFamily ? a.group.localeCompare(b.group) : 0))
                      .map((r) => (
                        <tr key={r.id} className="hover:bg-[#FAF7F2]/60">
                          <td className="py-3 px-4 font-mono text-xs tabular-nums">{r.refCode}</td>
                          <td className="py-3 px-4">
                            <div className="font-medium">{r.fullName}</div>
                            {r.email && <div className="text-xs text-[#5E554B]">{r.email}</div>}
                          </td>
                          <td className="py-3 px-4 text-xs">{r.group || '—'}</td>
                          <td className="py-3 px-4 text-xs font-medium">
                            {(() => {
                              const status = getRsvpStatus(r);
                              if (status === 'confirmed') {
                                return (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded bg-[#E6F4EA] text-[#1E4D3B]">
                                    Confirmed
                                  </span>
                                );
                              }
                              if (status === 'declined') {
                                return (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded bg-[#FEE2E2] text-[#991B1B]">
                                    Declined
                                  </span>
                                );
                              }
                              return (
                                <span className="inline-flex items-center px-2 py-0.5 rounded bg-[#FEF3C7] text-[#92400E]">
                                  Pending
                                </span>
                              );
                            })()}
                          </td>
                          <td className="py-3 px-4 text-xs">
                            <div className="tabular-nums font-medium">{r.guestCount} guests</div>
                            <div className="text-[#5E554B]">
                              {(r.partyGuests || [])
                                .map((g) => `${g.name} (${g.diet === 'veg' ? 'V' : 'NV'})`)
                                .join(', ')}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-xs">
                            {r.accommodationNeeded ? `${r.roomsNeeded} rm (${r.assignedRoom || 'Unassigned'})` : 'No'}
                          </td>
                          <td className="no-print py-3 px-4 text-right whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => setEditingRsvp(r)}
                              className="text-xs underline mr-3 cursor-pointer"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => r.id && handleDeleteRsvp(r.id)}
                              className="text-xs text-[#991B1B] underline cursor-pointer"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ACCOMMODATION TAB */}
        {tab === 'accommodation' && (
          <div className="space-y-5">
            <div className="no-print flex items-center justify-between">
              <h2 className="text-xl font-semibold">Room Allocation</h2>
              <button
                type="button"
                onClick={() => window.print()}
                className="min-h-[40px] px-4 py-2 rounded-lg bg-[#1D1915] text-white text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" /> Print Room List
              </button>
            </div>

            <div className="bg-white border border-[#1D1915]/10 rounded-xl overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm border-collapse">
                <thead>
                  <tr className="border-b border-[#1D1915]/10 text-xs text-[#5E554B]">
                    <th className="py-3 px-4">Guest</th>
                    <th className="py-3 px-4">Rooms</th>
                    <th className="py-3 px-4">Check-in</th>
                    <th className="py-3 px-4">Check-out</th>
                    <th className="py-3 px-4">Assigned Room</th>
                    <th className="py-3 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1D1915]/10">
                  {rsvps
                    .filter((r) => r.attending === 'yes' && r.accommodationNeeded)
                    .map((r) => (
                      <tr key={r.id}>
                        <td className="py-3 px-4">
                          <div className="font-medium">{r.fullName}</div>
                          <div className="text-xs text-[#5E554B]">{r.roomSharingNote || r.email || '—'}</div>
                        </td>
                        <td className="py-3 px-4 tabular-nums">{r.roomsNeeded}</td>
                        <td className="py-3 px-4">
                          <input
                            type="date"
                            value={r.adminCheckInDate || r.checkInDate}
                            onChange={(e) =>
                              r.id &&
                              updateDoc(doc(db, 'weddings', slug, 'rsvps', r.id), {
                                adminCheckInDate: e.target.value,
                                updatedAt: serverTimestamp(),
                              })
                            }
                            className="px-2 py-1 rounded border border-[#1D1915]/15 text-xs"
                          />
                        </td>
                        <td className="py-3 px-4">
                          <input
                            type="date"
                            value={r.adminCheckOutDate || r.checkOutDate}
                            onChange={(e) =>
                              r.id &&
                              updateDoc(doc(db, 'weddings', slug, 'rsvps', r.id), {
                                adminCheckOutDate: e.target.value,
                                updatedAt: serverTimestamp(),
                              })
                            }
                            className="px-2 py-1 rounded border border-[#1D1915]/15 text-xs"
                          />
                        </td>
                        <td className="py-3 px-4">
                          <input
                            type="text"
                            defaultValue={r.assignedRoom}
                            placeholder="e.g., Wing B - 204"
                            onBlur={(e) =>
                              r.id &&
                              updateDoc(doc(db, 'weddings', slug, 'rsvps', r.id), {
                                assignedRoom: e.target.value,
                                updatedAt: serverTimestamp(),
                              })
                            }
                            className="min-w-[140px] px-2.5 py-1.5 rounded border border-[#1D1915]/15 text-xs"
                          />
                        </td>
                        <td className="py-3 px-4">
                          <select
                            value={r.accommodationStatus}
                            onChange={(e) =>
                              r.id &&
                              updateDoc(doc(db, 'weddings', slug, 'rsvps', r.id), {
                                accommodationStatus: e.target.value,
                                updatedAt: serverTimestamp(),
                              })
                            }
                            className="px-2.5 py-1.5 rounded border border-[#1D1915]/15 text-xs"
                          >
                            <option value="pending">Pending</option>
                            <option value="confirmed">Confirmed</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* WISHLIST & BLESSINGS TAB */}
        {tab === 'wishlist' && (
          <div className="space-y-8">
            <div className="space-y-4">
              <div className="no-print flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-2">
                  <select
                    value={contribStatusFilter}
                    onChange={(e) =>
                      setContribStatusFilter(
                        e.target.value as 'all' | 'pending' | 'confirmed' | 'reversed'
                      )
                    }
                    className="min-h-[40px] px-3 rounded-lg border border-[#1D1915]/15 bg-white text-xs"
                  >
                    <option value="all">All Statuses</option>
                    <option value="pending">Pending</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="reversed">Reversed</option>
                  </select>
                  <select
                    value={contribRecipientFilter}
                    onChange={(e) =>
                      setContribRecipientFilter(
                        e.target.value as 'all' | 'partner1' | 'partner2'
                      )
                    }
                    className="min-h-[40px] px-3 rounded-lg border border-[#1D1915]/15 bg-white text-xs"
                  >
                    <option value="all">All Recipients</option>
                    <option value="partner1">{p1Name}</option>
                    <option value="partner2">{p2Name}</option>
                  </select>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => exportContributionsToCsv(slug, filteredContribs, p1Name, p2Name)}
                    className="min-h-[40px] px-3 rounded-lg border border-[#1D1915]/15 bg-white text-xs font-medium cursor-pointer"
                  >
                    Export CSV
                  </button>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="min-h-[40px] px-3 rounded-lg bg-[#1D1915] text-white text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" /> Printable Thank-You List
                  </button>
                </div>
              </div>

              <div className="bg-white border border-[#1D1915]/10 rounded-xl overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-[#1D1915]/10 text-xs text-[#5E554B]">
                      <th className="py-3 px-4">Ref</th>
                      <th className="py-3 px-4">Recipient</th>
                      <th className="py-3 px-4">Donor</th>
                      <th className="py-3 px-4">Amount</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="no-print py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1D1915]/10">
                    {filteredContribs.map((c) => {
                      const busy = busyContribId === c.id;
                      return (
                        <tr key={c.id}>
                          <td className="py-3 px-4 font-mono text-xs tabular-nums">{c.ref}</td>
                          <td className="py-3 px-4 text-xs">
                            {c.recipient === 'partner1' ? p1Name : p2Name}
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-medium">{c.donorName}</div>
                            {c.message && <div className="text-xs text-[#5E554B]">{c.message}</div>}
                          </td>
                          <td className="py-3 px-4 font-medium tabular-nums">
                            {formatINR(c.amountPaise)}
                          </td>
                          <td className="py-3 px-4 text-xs uppercase font-medium">{c.status}</td>
                          <td className="no-print py-3 px-4 text-right whitespace-nowrap space-x-2">
                            {c.status === 'pending' && c.id && (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => handleContribAction('/api/contributions/confirm', c.id!)}
                                className="px-2.5 py-1.5 rounded bg-[#1E4D3B] text-white text-xs cursor-pointer disabled:opacity-50"
                              >
                                Confirm
                              </button>
                            )}
                            {c.status === 'confirmed' && c.id && (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => handleContribAction('/api/contributions/reverse', c.id!)}
                                className="px-2.5 py-1.5 rounded border border-[#1D1915]/20 text-xs inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                              >
                                <RotateCcw className="w-3 h-3" /> Reverse
                              </button>
                            )}
                            {c.id && (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => handleContribAction('/api/contributions/delete', c.id!)}
                                className="px-2.5 py-1.5 rounded text-xs text-[#991B1B] hover:bg-[#FEE2E2] inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                              >
                                <Trash2 className="w-3 h-3" /> Delete
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Blessings Moderation */}
            <div className="no-print space-y-3">
              <h3 className="text-lg font-semibold">Blessings Wall Moderation</h3>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {blessings.map((b) => (
                  <div
                    key={b.id}
                    className="bg-white border border-[#1D1915]/10 rounded-xl p-4 flex flex-col justify-between gap-3"
                  >
                    <div>
                      <p className="text-sm mb-2">“{b.message}”</p>
                      <p className="text-xs text-[#5E554B]">
                        {b.displayName} · {b.source} · {b.approved ? 'Visible on site' : 'Hidden'}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleBlessingToggle(b)}
                        className="flex-1 min-h-[36px] rounded-lg border border-[#1D1915]/15 text-xs font-medium cursor-pointer"
                      >
                        {b.approved ? 'Hide' : 'Approve'}
                      </button>
                      <button
                        type="button"
                        onClick={() => b.id && deleteDoc(doc(db, 'weddings', slug, 'blessings', b.id))}
                        className="min-h-[36px] px-3 rounded-lg text-xs text-[#991B1B] border border-[#1D1915]/15 cursor-pointer"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* CUSTOMIZE TAB + LIVE PREVIEW */}
        {tab === 'customize' && draftSite && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Customize Wedding Site</h2>
              <button
                type="button"
                onClick={() => setShowLivePreview((v) => !v)}
                className="min-h-[40px] px-4 py-2 rounded-lg border border-[#1D1915]/15 bg-white text-xs font-medium inline-flex items-center gap-2 cursor-pointer"
              >
                <Eye className="w-4 h-4" />
                {showLivePreview ? 'Hide Live Preview' : 'Show Live Preview'}
              </button>
            </div>

            <div className={showLivePreview ? 'grid lg:grid-cols-12 gap-6 items-start' : ''}>
              <div className={showLivePreview ? 'lg:col-span-6' : ''}>
                <CustomizationEditor
                  slug={slug}
                  draft={draftSite}
                  onChange={handleDraftChange}
                  savingState={savingState}
                  onSaveNow={() => saveDraftToFirestore(draftSite)}
                />
              </div>

              {showLivePreview && (
                <div className="lg:col-span-6 border border-[#1D1915]/15 rounded-2xl overflow-hidden max-h-[82vh] overflow-y-auto sticky top-20">
                  <WeddingSiteRenderer
                    slug={slug}
                    site={draftSite}
                    progress={progress}
                    blessings={blessings.filter((b) => b.approved)}
                    editRsvpId={null}
                    previewMode
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Edit RSVP Modal */}
      {editingRsvp && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-semibold">Edit RSVP · {editingRsvp.refCode}</h3>
            <div className="space-y-3">
              <input
                type="text"
                value={editingRsvp.fullName}
                onChange={(e) => setEditingRsvp({ ...editingRsvp, fullName: e.target.value })}
                className="w-full min-h-[40px] px-3 rounded border border-[#1D1915]/15 text-sm"
              />
              <select
                value={getRsvpStatus(editingRsvp)}
                onChange={(e) => {
                  const nextStatus = e.target.value as RsvpStatus;
                  setEditingRsvp({
                    ...editingRsvp,
                    status: nextStatus,
                    attending: nextStatus === 'declined' ? 'no' : 'yes',
                  });
                }}
                className="w-full min-h-[40px] px-3 rounded border border-[#1D1915]/15 text-sm"
              >
                <option value="confirmed">Confirmed (Attending)</option>
                <option value="pending">Pending</option>
                <option value="declined">Declined</option>
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingRsvp(null)}
                className="min-h-[40px] px-4 rounded-lg border border-[#1D1915]/15 text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleSaveRsvpEdit(editingRsvp)}
                className="min-h-[40px] px-4 rounded-lg bg-[#7C5821] text-white text-xs font-medium cursor-pointer"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

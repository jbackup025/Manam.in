import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertOctagon,
  Check,
  Download,
  ExternalLink,
  Pencil,
  Plus,
  ShieldAlert,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react';
import {
  Timestamp,
  collection,
  deleteDoc,
  doc,
  getCountFromServer,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { callAuthedApi } from '../lib/apiClient';
import { useAuth } from '../lib/authContext';
import {
  isValidSlug,
  MAX_ADMINS_PER_WEDDING,
  PLATFORM_NAME,
  SUPER_ADMIN_EMAIL,
  THEME_PRESETS,
  type ThemePresetId,
} from '../lib/constants';
import { buildInitialPublicSite } from '../lib/defaultSite';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { seedStagingDemoWedding } from '../lib/seedDemo';
import type {
  AuditLogDoc,
  PlatformAuditLogDoc,
  WeddingAdminDoc,
  WeddingDoc,
  WeddingStatus,
} from '../types/wedding';

interface WeddingWithCounts extends WeddingDoc {
  rsvpCount: number;
  contributionCount: number;
}

function isGracePassed(w: WeddingDoc): boolean {
  if (w.readyForErase) return true;
  if (!w.weddingDate) return false;
  const dt = new Date(`${w.weddingDate}T00:00:00Z`);
  dt.setUTCDate(dt.getUTCDate() + (w.graceDays || 30));
  return Date.now() >= dt.getTime();
}

export function SuperAdminPage() {
  const { user, authReady, signInWithGoogle, signOutNow } = useAuth();
  const [accessDenied, setAccessDenied] = useState(false);
  const [authError, setAuthError] = useState('');

  const [weddings, setWeddings] = useState<WeddingWithCounts[]>([]);
  const [platformLogs, setPlatformLogs] = useState<PlatformAuditLogDoc[]>([]);
  const [loadingList, setLoadingList] = useState(true);

  // Create Wedding form
  const [showCreate, setShowCreate] = useState(false);
  const [newSlug, setNewSlug] = useState('');
  const [slugStatus, setSlugStatus] = useState<
    'idle' | 'checking' | 'available' | 'taken' | 'reserved' | 'invalid'
  >('idle');
  const [p1Name, setP1Name] = useState('');
  const [p2Name, setP2Name] = useState('');
  const [weddingDate, setWeddingDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [graceDays, setGraceDays] = useState(30);
  const [adminEmailsInput, setAdminEmailsInput] = useState('');
  const [themePreset, setThemePreset] = useState<ThemePresetId>('classic-gold');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  // Manage drawer / modal
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [selectedAdmins, setSelectedAdmins] = useState<WeddingAdminDoc[]>([]);
  const [selectedAuditLogs, setSelectedAuditLogs] = useState<AuditLogDoc[]>([]);
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [manageError, setManageError] = useState('');

  // Erase & Reset modal
  const [eraseTarget, setEraseTarget] = useState<WeddingWithCounts | null>(null);
  const [eraseConfirmInput, setEraseConfirmInput] = useState('');
  const [erasing, setErasing] = useState(false);
  const [eraseResult, setEraseResult] = useState<string>('');
  const [eraseError, setEraseError] = useState<string>('');
  const [seedingDemo, setSeedingDemo] = useState(false);
  const [editingCoupleSlug, setEditingCoupleSlug] = useState<string | null>(null);
  const [editingCoupleValue, setEditingCoupleValue] = useState('');
  const [savingCouple, setSavingCouple] = useState(false);

  const isAuthorizedSuper =
    Boolean(user) &&
    Boolean(user?.emailVerified) &&
    (user?.email || '').trim().toLowerCase() === SUPER_ADMIN_EMAIL;

  const isProdDomain =
    typeof window !== 'undefined' && window.location.hostname === 'manam.in';

  useEffect(() => {
    if (!authReady) return;
    if (!user) return;
    const email = (user.email || '').trim().toLowerCase();
    if (!user.emailVerified || email !== SUPER_ADMIN_EMAIL) {
      signOutNow();
      setAccessDenied(true);
    } else {
      setAccessDenied(false);
    }
  }, [authReady, user]);

  // Live weddings list & platform audit logs
  useEffect(() => {
    if (!isAuthorizedSuper) return;

    const unsubWeddings = onSnapshot(
      query(collection(db, 'weddings'), orderBy('createdAt', 'desc')),
      async (snap) => {
        const docs = snap.docs.map((d) => d.data() as WeddingDoc);
        const enriched = await Promise.all(
          docs.map(async (w) => {
            try {
              const [rCount, cCount] = await Promise.all([
                getCountFromServer(collection(db, 'weddings', w.slug, 'rsvps')),
                getCountFromServer(collection(db, 'weddings', w.slug, 'contributions')),
              ]);
              return {
                ...w,
                rsvpCount: rCount.data().count,
                contributionCount: cCount.data().count,
              };
            } catch {
              return { ...w, rsvpCount: 0, contributionCount: 0 };
            }
          })
        );
        setWeddings(enriched);
        setLoadingList(false);
      },
      (err) => {
        setLoadingList(false);
        handleFirestoreError(err, OperationType.LIST, 'weddings');
      }
    );

    const unsubLogs = onSnapshot(
      query(collection(db, 'platformAuditLog'), orderBy('timestamp', 'desc')),
      (snap) => {
        setPlatformLogs(
          snap.docs
            .slice(0, 25)
            .map((d) => ({ id: d.id, ...(d.data() as Omit<PlatformAuditLogDoc, 'id'>) }))
        );
      },
      () => {}
    );

    return () => {
      unsubWeddings();
      unsubLogs();
    };
  }, [isAuthorizedSuper]);

  // Live slug availability check (checks weddings + reservedSlugs)
  useEffect(() => {
    const cleaned = newSlug.trim().toLowerCase();
    if (!cleaned) {
      setSlugStatus('idle');
      return;
    }
    if (!isValidSlug(cleaned)) {
      setSlugStatus('invalid');
      return;
    }

    let active = true;
    setSlugStatus('checking');
    const timer = setTimeout(async () => {
      try {
        const [wSnap, rSnap] = await Promise.all([
          getDoc(doc(db, 'weddings', cleaned)),
          getDoc(doc(db, 'reservedSlugs', cleaned)),
        ]);
        if (!active) return;
        if (rSnap.exists()) setSlugStatus('reserved');
        else if (wSnap.exists()) setSlugStatus('taken');
        else setSlugStatus('available');
      } catch {
        if (active) setSlugStatus('invalid');
      }
    }, 300);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [newSlug]);

  // Load selected wedding admins & audit logs
  useEffect(() => {
    if (!selectedSlug || !isAuthorizedSuper) return;

    const unsubAdmins = onSnapshot(
      collection(db, 'weddings', selectedSlug, 'admins'),
      (snap) => {
        setSelectedAdmins(snap.docs.map((d) => d.data() as WeddingAdminDoc));
      }
    );

    const unsubAudit = onSnapshot(
      query(collection(db, 'weddings', selectedSlug, 'auditLogs'), orderBy('timestamp', 'desc')),
      (snap) => {
        setSelectedAuditLogs(
          snap.docs.slice(0, 30).map((d) => ({ id: d.id, ...(d.data() as Omit<AuditLogDoc, 'id'>) }))
        );
      }
    );

    return () => {
      unsubAdmins();
      unsubAudit();
    };
  }, [selectedSlug, isAuthorizedSuper]);

  const platformStats = useMemo(() => {
    return {
      totalWeddings: weddings.length,
      activeWeddings: weddings.filter((w) => w.status === 'ACTIVE').length,
      readyToErase: weddings.filter((w) => isGracePassed(w)).length,
      totalRsvps: weddings.reduce((acc, w) => acc + w.rsvpCount, 0),
      totalContributions: weddings.reduce((acc, w) => acc + w.contributionCount, 0),
    };
  }, [weddings]);

  async function handleCreateWedding(e: React.FormEvent) {
    e.preventDefault();
    setCreateError('');
    const slug = newSlug.trim().toLowerCase();

    if (!isValidSlug(slug) || slugStatus !== 'available') {
      setCreateError('Please choose an available valid slug (3–40 lowercase letters, digits, hyphens).');
      return;
    }

    const emails = adminEmailsInput
      .split(/[\s,;]+/)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);

    if (emails.length > MAX_ADMINS_PER_WEDDING) {
      setCreateError(`Maximum ${MAX_ADMINS_PER_WEDDING} couple admin emails allowed per wedding.`);
      return;
    }

    for (const em of emails) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
        setCreateError(`Invalid email address: ${em}`);
        return;
      }
    }

    setCreating(true);
    try {
      const coupleNames = `${p1Name.trim()} & ${p2Name.trim()}`;
      const expiresTs = Timestamp.fromDate(new Date(`${expiryDate}T23:59:59+05:30`));

      const batch = writeBatch(db);
      batch.set(doc(db, 'weddings', slug), {
        slug,
        status: 'ACTIVE',
        coupleNames,
        weddingDate,
        expiresAt: expiresTs,
        graceDays: Number(graceDays) || 30,
        readyForErase: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      for (const em of emails) {
        batch.set(doc(db, 'weddings', slug, 'admins', em), {
          email: em,
          addedBy: SUPER_ADMIN_EMAIL,
          addedAt: serverTimestamp(),
        });
      }

      const initialSite = buildInitialPublicSite({
        partner1Name: p1Name.trim(),
        partner2Name: p2Name.trim(),
        weddingDate,
        themePresetId: themePreset,
      });

      batch.set(doc(db, 'weddings', slug, 'public', 'site'), {
        ...initialSite,
        updatedAt: serverTimestamp(),
      });

      await batch.commit();

      callAuthedApi('/api/super/log', {
        action: 'WEDDING_CREATED',
        targetSlug: slug,
      }).catch(() => {});

      setShowCreate(false);
      setNewSlug('');
      setP1Name('');
      setP2Name('');
      setAdminEmailsInput('');
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create wedding');
    } finally {
      setCreating(false);
    }
  }

  async function handleStatusChange(slug: string, status: WeddingStatus) {
    setManageError('');
    try {
      await updateDoc(doc(db, 'weddings', slug), {
        status,
        updatedAt: serverTimestamp(),
      });
      callAuthedApi('/api/super/log', {
        action: 'WEDDING_STATUS_CHANGED',
        targetSlug: slug,
      }).catch(() => {});
    } catch (err) {
      setManageError(err instanceof Error ? err.message : 'Failed to update status');
    }
  }

  async function handleRenameCouple(slug: string) {
    setManageError('');
    const nextNames = editingCoupleValue.trim();
    if (nextNames.length < 1 || nextNames.length > 120) {
      setManageError('Couple names must be between 1 and 120 characters.');
      return;
    }
    setSavingCouple(true);
    try {
      await updateDoc(doc(db, 'weddings', slug), {
        coupleNames: nextNames,
        updatedAt: serverTimestamp(),
      });
      setEditingCoupleSlug(null);
      setEditingCoupleValue('');
    } catch (err) {
      setManageError(err instanceof Error ? err.message : 'Failed to rename couple');
    } finally {
      setSavingCouple(false);
    }
  }

  async function handleExpiryUpdate(slug: string, ymd: string) {
    if (!ymd) return;
    try {
      await updateDoc(doc(db, 'weddings', slug), {
        expiresAt: Timestamp.fromDate(new Date(`${ymd}T23:59:59+05:30`)),
        updatedAt: serverTimestamp(),
      });
      callAuthedApi('/api/super/log', {
        action: 'WEDDING_EXPIRY_UPDATED',
        targetSlug: slug,
      }).catch(() => {});
    } catch (err) {
      setManageError(err instanceof Error ? err.message : 'Failed to update expiry');
    }
  }

  async function handleAddAdmin(slug: string) {
    setManageError('');
    const email = newAdminEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setManageError('Enter a valid email address.');
      return;
    }
    if (selectedAdmins.length >= MAX_ADMINS_PER_WEDDING) {
      setManageError(`Limit of ${MAX_ADMINS_PER_WEDDING} admins per wedding reached.`);
      return;
    }
    try {
      await setDoc(doc(db, 'weddings', slug, 'admins', email), {
        email,
        addedBy: SUPER_ADMIN_EMAIL,
        addedAt: serverTimestamp(),
      });
      setNewAdminEmail('');
      callAuthedApi('/api/super/log', {
        action: 'WEDDING_ADMIN_UPDATED',
        targetSlug: slug,
      }).catch(() => {});
    } catch (err) {
      setManageError(err instanceof Error ? err.message : 'Could not add admin');
    }
  }

  async function handleRevokeAdmin(slug: string, email: string) {
    try {
      await deleteDoc(doc(db, 'weddings', slug, 'admins', email));
      callAuthedApi('/api/super/log', {
        action: 'WEDDING_ADMIN_UPDATED',
        targetSlug: slug,
      }).catch(() => {});
    } catch (err) {
      setManageError(err instanceof Error ? err.message : 'Could not revoke admin');
    }
  }

  async function handleExportWedding(slug: string) {
    setManageError('');
    try {
      const json = await callAuthedApi('/api/super/export-wedding', { slug });
      const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${slug}-full-export.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setManageError(err instanceof Error ? err.message : 'Export failed (requires server admin credentials)');
    }
  }

  async function handleEraseWedding() {
    if (!eraseTarget) return;
    setErasing(true);
    setEraseResult('');
    setEraseError('');
    try {
      const res = await callAuthedApi<{
        ok: boolean;
        deletedDocs: number;
        remainingCount: number;
      }>(
        '/api/super/erase-wedding',
        {
          slug: eraseTarget.slug,
          confirmSlug: eraseConfirmInput.trim().toLowerCase(),
        },
        { forceRefreshToken: true }
      );
      setEraseResult(
        `Erased ${res.deletedDocs} documents. Remaining: ${res.remainingCount}. Slug "${eraseTarget.slug}" is now permanently reserved.`
      );
      if (selectedSlug === eraseTarget.slug) setSelectedSlug(null);
    } catch (err) {
      setEraseError(err instanceof Error ? err.message : 'Erase failed');
    } finally {
      setErasing(false);
    }
  }

  if (!authReady) {
    return (
      <div className="min-h-screen bg-[#FAF7F2] flex items-center justify-center text-sm text-[#5E554B]">
        Checking session...
      </div>
    );
  }

  if (!isAuthorizedSuper) {
    return (
      <div className="min-h-screen bg-[#FAF7F2] text-[#1D1915] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white border border-[#1D1915]/12 rounded-2xl p-8 text-center space-y-5">
          <p className="text-xs uppercase tracking-[0.2em] text-[#7C5821] font-medium">
            {PLATFORM_NAME} · Platform Console
          </p>
          <h1
            className="text-3xl font-semibold"
            style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
          >
            Super Admin Sign-In
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
          <button
            type="button"
            onClick={async () => {
              setAuthError('');
              setAccessDenied(false);
              try {
                await signInWithGoogle();
              } catch (err) {
                setAuthError(err instanceof Error ? err.message : 'Sign-in failed');
              }
            }}
            className="w-full min-h-[44px] px-5 py-2.5 rounded-lg bg-[#7C5821] text-[#FAF7F2] text-sm font-medium hover:bg-[#66471A] cursor-pointer"
          >
            Sign in with Google
          </button>
          <Link to="/" className="block text-xs text-[#5E554B] underline">
            Return to {PLATFORM_NAME}
          </Link>
        </div>
      </div>
    );
  }

  const selectedWedding = weddings.find((w) => w.slug === selectedSlug) || null;
  const demoExists = weddings.some((w) => w.slug === 'demo');

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-[#1D1915]">
      <header className="border-b border-[#1D1915]/10 bg-white sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link to="/" className="text-base font-semibold text-[#7C5821]">
              {PLATFORM_NAME}
            </Link>
            <span className="text-[#5E554B]">/</span>
            <span className="text-sm font-medium">Super Admin</span>
          </div>

          <div className="flex items-center gap-2.5">
            {!isProdDomain && !demoExists && (
              <button
                type="button"
                disabled={seedingDemo}
                onClick={async () => {
                  setSeedingDemo(true);
                  try {
                    await seedStagingDemoWedding(SUPER_ADMIN_EMAIL);
                  } catch (err) {
                    setManageError(err instanceof Error ? err.message : 'Seed failed');
                  } finally {
                    setSeedingDemo(false);
                  }
                }}
                className="min-h-[38px] px-3 py-1.5 rounded-lg border border-[#1D1915]/15 text-xs font-medium cursor-pointer"
              >
                {seedingDemo ? 'Seeding demo...' : 'Seed Staging Demo'}
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="min-h-[38px] px-4 py-1.5 rounded-lg bg-[#7C5821] text-[#FAF7F2] text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" /> New Wedding
            </button>
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

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {manageError && (
          <div role="alert" className="p-3.5 rounded-lg bg-[#FEE2E2] text-[#991B1B] text-sm">
            {manageError}
          </div>
        )}

        {/* Platform Counts Only */}
        <section className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {[
            { label: 'Total Weddings', value: platformStats.totalWeddings },
            { label: 'Active Weddings', value: platformStats.activeWeddings },
            { label: 'Ready for Erase', value: platformStats.readyToErase },
            { label: 'Total RSVPs', value: platformStats.totalRsvps },
            { label: 'Total Moi Logs', value: platformStats.totalContributions },
          ].map((stat) => (
            <div key={stat.label} className="bg-white border border-[#1D1915]/10 rounded-xl p-5">
              <p className="text-xs text-[#5E554B] mb-1">{stat.label}</p>
              <p className="text-3xl font-semibold tabular-nums">{stat.value}</p>
            </div>
          ))}
        </section>

        {/* Weddings Table */}
        <section className="bg-white border border-[#1D1915]/10 rounded-xl overflow-x-auto">
          <div className="px-5 py-4 border-b border-[#1D1915]/10 flex items-center justify-between">
            <h2 className="text-lg font-semibold">All Weddings</h2>
          </div>
          {loadingList ? (
            <div className="p-8 text-sm text-[#5E554B]">Loading weddings...</div>
          ) : weddings.length === 0 ? (
            <div className="p-10 text-center text-sm text-[#5E554B]">
              No weddings created yet. Click “New Wedding” to provision your first couple site.
            </div>
          ) : (
            <table className="w-full text-left text-xs sm:text-sm border-collapse">
              <thead>
                <tr className="border-b border-[#1D1915]/10 text-xs text-[#5E554B]">
                  <th className="py-3 px-4">Slug</th>
                  <th className="py-3 px-4">Couple</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Expires</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Counts</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1D1915]/10">
                {weddings.map((w) => {
                  const readyErase = isGracePassed(w);
                  const expStr = w.expiresAt?.toDate
                    ? w.expiresAt.toDate().toISOString().slice(0, 10)
                    : '—';
                  return (
                    <tr key={w.slug} className="hover:bg-[#FAF7F2]/60">
                      <td className="py-3 px-4 font-mono text-xs">{w.slug}</td>
                      <td className="py-3 px-4 font-medium">
                        {editingCoupleSlug === w.slug ? (
                          <form
                            onSubmit={(e) => {
                              e.preventDefault();
                              handleRenameCouple(w.slug);
                            }}
                            className="flex items-center gap-1.5"
                          >
                            <input
                              type="text"
                              value={editingCoupleValue}
                              onChange={(e) => setEditingCoupleValue(e.target.value)}
                              maxLength={120}
                              required
                              autoFocus
                              aria-label={`Couple names for ${w.slug}`}
                              className="px-2 py-1 rounded border border-[#1D1915]/20 text-xs sm:text-sm bg-white w-44"
                            />
                            <button
                              type="submit"
                              disabled={savingCouple}
                              aria-label="Save couple names"
                              className="p-1 rounded border border-[#1D1915]/15 hover:bg-[#FAF7F2] disabled:opacity-40 cursor-pointer"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingCoupleSlug(null);
                                setEditingCoupleValue('');
                              }}
                              aria-label="Cancel rename"
                              className="p-1 rounded border border-[#1D1915]/15 hover:bg-[#FAF7F2] cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </form>
                        ) : (
                          <div className="inline-flex items-center gap-2">
                            <span>{w.coupleNames}</span>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingCoupleSlug(w.slug);
                                setEditingCoupleValue(w.coupleNames);
                              }}
                              aria-label={`Rename ${w.coupleNames}`}
                              title="Rename couple"
                              className="p-1 rounded text-[#5E554B] hover:text-[#1D1915] hover:bg-[#FAF7F2] cursor-pointer"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 tabular-nums text-xs">{w.weddingDate}</td>
                      <td className="py-3 px-4 tabular-nums text-xs">{expStr}</td>
                      <td className="py-3 px-4 text-xs">
                        <span className="font-semibold">{w.status}</span>
                        {readyErase && (
                          <span className="ml-2 text-[#991B1B] font-medium">
                            · Ready for erase
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-xs tabular-nums text-[#5E554B]">
                        {w.rsvpCount} RSVPs · {w.contributionCount} Moi
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap space-x-2">
                        <button
                          type="button"
                          onClick={() => setSelectedSlug(w.slug)}
                          className="px-2.5 py-1.5 rounded border border-[#1D1915]/15 text-xs font-medium cursor-pointer"
                        >
                          Manage
                        </button>
                        <a
                          href={`/wedding/${w.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2.5 py-1.5 rounded border border-[#1D1915]/15 text-xs inline-flex items-center gap-1"
                        >
                          Site <ExternalLink className="w-3 h-3" />
                        </a>
                        <a
                          href={`/wedding/${w.slug}/admin`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2.5 py-1.5 rounded border border-[#1D1915]/15 text-xs inline-flex items-center gap-1"
                        >
                          Admin
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>

        {/* Selected Wedding Management Panel */}
        {selectedWedding && (
          <section className="bg-white border border-[#1D1915]/12 rounded-2xl p-6 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#1D1915]/10 pb-4">
              <div>
                <h3 className="text-xl font-semibold">
                  Manage: {selectedWedding.coupleNames} ({selectedWedding.slug})
                </h3>
                <p className="text-xs text-[#5E554B]">
                  Wedding {selectedWedding.weddingDate} · Grace {selectedWedding.graceDays} days
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleExportWedding(selectedWedding.slug)}
                  className="min-h-[38px] px-3.5 rounded-lg border border-[#1D1915]/15 text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" /> Export JSON
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEraseTarget(selectedWedding);
                    setEraseConfirmInput('');
                    setEraseResult('');
                    setEraseError('');
                  }}
                  className="min-h-[38px] px-3.5 rounded-lg bg-[#991B1B] text-white text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Erase &amp; Reset
                </button>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Lifecycle & Expiry */}
              <div className="space-y-4">
                <h4 className="text-sm font-semibold">Status &amp; Expiry</h4>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium mb-1">Status</label>
                    <select
                      value={selectedWedding.status}
                      onChange={(e) =>
                        handleStatusChange(
                          selectedWedding.slug,
                          e.target.value as WeddingStatus
                        )
                      }
                      className="w-full min-h-[40px] px-3 rounded-lg border border-[#1D1915]/15 text-sm"
                    >
                      <option value="DRAFT">DRAFT</option>
                      <option value="ACTIVE">ACTIVE</option>
                      <option value="COMPLETED">COMPLETED</option>
                      <option value="SUSPENDED">SUSPENDED</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Expiry Date</label>
                    <input
                      type="date"
                      defaultValue={
                        selectedWedding.expiresAt?.toDate
                          ? selectedWedding.expiresAt.toDate().toISOString().slice(0, 10)
                          : ''
                      }
                      onBlur={(e) => handleExpiryUpdate(selectedWedding.slug, e.target.value)}
                      className="w-full min-h-[40px] px-3 rounded-lg border border-[#1D1915]/15 text-sm"
                    />
                  </div>
                </div>

                {/* Couple Admins */}
                <div className="pt-2 space-y-2.5">
                  <h4 className="text-sm font-semibold">
                    Couple Admins ({selectedAdmins.length} / {MAX_ADMINS_PER_WEDDING})
                  </h4>
                  <div className="space-y-2">
                    {selectedAdmins.map((adm) => (
                      <div
                        key={adm.email}
                        className="flex items-center justify-between px-3 py-2 rounded-lg border border-[#1D1915]/10 text-xs"
                      >
                        <span className="font-mono">{adm.email}</span>
                        <button
                          type="button"
                          onClick={() => handleRevokeAdmin(selectedWedding.slug, adm.email)}
                          className="text-[#991B1B] underline cursor-pointer"
                        >
                          Revoke
                        </button>
                      </div>
                    ))}
                  </div>
                  {selectedAdmins.length < MAX_ADMINS_PER_WEDDING && (
                    <div className="flex gap-2">
                      <input
                        type="email"
                        value={newAdminEmail}
                        onChange={(e) => setNewAdminEmail(e.target.value)}
                        placeholder="couple@gmail.com"
                        className="flex-1 min-h-[38px] px-3 rounded-lg border border-[#1D1915]/15 text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => handleAddAdmin(selectedWedding.slug)}
                        className="min-h-[38px] px-3 rounded-lg bg-[#1D1915] text-white text-xs font-medium inline-flex items-center gap-1 cursor-pointer"
                      >
                        <UserPlus className="w-3.5 h-3.5" /> Invite
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Per-Wedding Audit Logs */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold">Wedding Audit Log (Non-PII)</h4>
                {selectedAuditLogs.length === 0 ? (
                  <p className="text-xs text-[#5E554B]">No audit events recorded yet.</p>
                ) : (
                  <div className="max-h-60 overflow-y-auto divide-y divide-[#1D1915]/10 border border-[#1D1915]/10 rounded-lg">
                    {selectedAuditLogs.map((log) => (
                      <div key={log.id} className="px-3 py-2 text-xs flex justify-between gap-2">
                        <div>
                          <span className="font-mono font-medium">{log.action}</span>
                          <span className="text-[#5E554B]"> · {log.actorEmail}</span>
                        </div>
                        <span className="font-mono text-[#5E554B]">{log.targetId.slice(0, 10)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {/* Platform Audit Log */}
        <section className="bg-white border border-[#1D1915]/10 rounded-xl p-5 space-y-3">
          <h2 className="text-base font-semibold">Platform Audit Log (Non-Personal)</h2>
          {platformLogs.length === 0 ? (
            <p className="text-xs text-[#5E554B]">No platform events recorded yet.</p>
          ) : (
            <div className="divide-y divide-[#1D1915]/10">
              {platformLogs.map((l) => (
                <div key={l.id} className="py-2 text-xs flex flex-wrap justify-between gap-2">
                  <span>
                    <span className="font-mono font-medium">{l.action}</span> · target{' '}
                    <span className="font-mono">{l.targetSlug}</span>
                  </span>
                  <span className="text-[#5E554B]">{l.actorEmail}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* Create Wedding Modal */}
      {showCreate && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
        >
          <form
            onSubmit={handleCreateWedding}
            className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 max-h-[92vh] overflow-y-auto"
          >
            <h3 className="text-xl font-semibold">Create New Wedding</h3>

            <div>
              <label className="block text-xs font-medium mb-1">Wedding Slug *</label>
              <input
                type="text"
                required
                value={newSlug}
                onChange={(e) => setNewSlug(e.target.value.toLowerCase())}
                placeholder="e.g., meera-arjun-2026"
                className="w-full min-h-[40px] px-3 rounded-lg border border-[#1D1915]/15 text-sm font-mono"
              />
              <p className="text-xs mt-1 text-[#5E554B]">
                {slugStatus === 'checking' && 'Checking availability...'}
                {slugStatus === 'available' && 'Slug is available.'}
                {slugStatus === 'taken' && 'This slug is already in use.'}
                {slugStatus === 'reserved' && 'This slug was previously erased and is permanently reserved.'}
                {slugStatus === 'invalid' && 'Must be 3–40 lowercase letters, digits, or hyphens (excluding reserved words).'}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1">Partner 1 Name *</label>
                <input
                  type="text"
                  required
                  value={p1Name}
                  onChange={(e) => setP1Name(e.target.value)}
                  className="w-full min-h-[40px] px-3 rounded-lg border border-[#1D1915]/15 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Partner 2 Name *</label>
                <input
                  type="text"
                  required
                  value={p2Name}
                  onChange={(e) => setP2Name(e.target.value)}
                  className="w-full min-h-[40px] px-3 rounded-lg border border-[#1D1915]/15 text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1">Wedding Date *</label>
                <input
                  type="date"
                  required
                  value={weddingDate}
                  onChange={(e) => setWeddingDate(e.target.value)}
                  className="w-full min-h-[40px] px-3 rounded-lg border border-[#1D1915]/15 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Expiry Date *</label>
                <input
                  type="date"
                  required
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  className="w-full min-h-[40px] px-3 rounded-lg border border-[#1D1915]/15 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Grace Days</label>
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={graceDays}
                  onChange={(e) => setGraceDays(Number(e.target.value) || 30)}
                  className="w-full min-h-[40px] px-3 rounded-lg border border-[#1D1915]/15 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium mb-1">
                Invited Couple Admin Google Emails (max {MAX_ADMINS_PER_WEDDING}, comma-separated)
              </label>
              <input
                type="text"
                value={adminEmailsInput}
                onChange={(e) => setAdminEmailsInput(e.target.value)}
                placeholder="partner1@gmail.com, partner2@gmail.com"
                className="w-full min-h-[40px] px-3 rounded-lg border border-[#1D1915]/15 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1">Starting Theme</label>
              <select
                value={themePreset}
                onChange={(e) => setThemePreset(e.target.value as ThemePresetId)}
                className="w-full min-h-[40px] px-3 rounded-lg border border-[#1D1915]/15 text-sm"
              >
                {THEME_PRESETS.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            {createError && (
              <p role="alert" className="text-xs text-[#991B1B]">
                {createError}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="min-h-[40px] px-4 rounded-lg border border-[#1D1915]/15 text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creating || slugStatus !== 'available'}
                className="min-h-[40px] px-5 rounded-lg bg-[#7C5821] text-white text-xs font-medium disabled:opacity-50 cursor-pointer"
              >
                {creating ? 'Creating...' : 'Create Wedding'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Erase & Reset Modal */}
      {eraseTarget && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center gap-2 text-[#991B1B]">
              <AlertOctagon className="w-5 h-5" />
              <h3 className="text-lg font-semibold">Erase &amp; Reset: {eraseTarget.slug}</h3>
            </div>

            <div className="text-xs text-[#5E554B] space-y-2 bg-[#FAF7F2] p-4 rounded-xl border border-[#1D1915]/10">
              <p className="font-medium text-[#1D1915]">
                This server action permanently deletes:
              </p>
              <ul className="list-disc list-inside space-y-1">
                <li>{eraseTarget.rsvpCount} guest RSVPs and room assignments</li>
                <li>{eraseTarget.contributionCount} contribution logs and all blessings</li>
                <li>All uploaded images, customization data, admin allowlists, and audit logs</li>
              </ul>
              <p className="pt-1">
                <strong>Retention note:</strong> Only a non-personal slug tombstone in{' '}
                <code className="font-mono">reservedSlugs</code> and a non-personal{' '}
                <code className="font-mono">platformAuditLog</code> entry remain. Standard cloud backups expire automatically per Google Cloud policy.
              </p>
            </div>

            <button
              type="button"
              onClick={() => handleExportWedding(eraseTarget.slug)}
              className="w-full min-h-[40px] px-4 rounded-lg border border-[#1D1915]/20 text-xs font-medium inline-flex items-center justify-center gap-2 cursor-pointer"
            >
              <Download className="w-4 h-4" /> Download JSON Backup First
            </button>

            <div>
              <label className="block text-xs font-medium mb-1">
                Type <span className="font-mono font-semibold">{eraseTarget.slug}</span> to confirm permanent erasure
              </label>
              <input
                type="text"
                value={eraseConfirmInput}
                onChange={(e) => setEraseConfirmInput(e.target.value)}
                placeholder={eraseTarget.slug}
                className="w-full min-h-[40px] px-3 rounded-lg border border-[#1D1915]/20 text-sm font-mono"
              />
            </div>

            {eraseError && (
              <div role="alert" className="p-3 rounded-lg bg-[#FEE2E2] text-xs text-[#991B1B]">
                {eraseError}
              </div>
            )}

            {eraseResult && (
              <div className="p-3 rounded-lg bg-[#F2ECE1] text-xs text-[#1D1915]">
                {eraseResult}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEraseTarget(null)}
                className="min-h-[40px] px-4 rounded-lg border border-[#1D1915]/15 text-xs cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                disabled={erasing || eraseConfirmInput.trim().toLowerCase() !== eraseTarget.slug}
                onClick={handleEraseWedding}
                className="min-h-[40px] px-4 rounded-lg bg-[#991B1B] text-white text-xs font-medium inline-flex items-center gap-1.5 disabled:opacity-40 cursor-pointer"
              >
                <ShieldAlert className="w-4 h-4" />
                {erasing ? 'Erasing...' : 'Permanently Erase Wedding'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

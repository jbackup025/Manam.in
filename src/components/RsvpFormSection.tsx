import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Copy, Gift, Pencil } from 'lucide-react';
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { generateRsvpRef, generateUnguessableId } from '../lib/upi';
import type { PartyGuest, PublicSiteDoc, RsvpDoc } from '../types/wedding';

interface RsvpFormSectionProps {
  slug: string;
  site: PublicSiteDoc;
  editRsvpId: string | null;
  primaryColor: string;
  primaryBtnText: string;
  surfaceColor: string;
  borderColor: string;
  mutedColor: string;
  headingFont: string;
  onVisitWishlist?: (guestName: string) => void;
}

interface SessionRsvpRecord {
  rsvpId: string;
  refCode: string;
  fullNameNormalized: string;
  mobileNormalized: string;
}

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '').slice(-10);
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

function getSessionRsvps(slug: string): SessionRsvpRecord[] {
  try {
    const raw = sessionStorage.getItem(`manam_rsvp_${slug}`);
    return raw ? (JSON.parse(raw) as SessionRsvpRecord[]) : [];
  } catch {
    return [];
  }
}

function saveSessionRsvp(slug: string, rec: SessionRsvpRecord) {
  try {
    const existing = getSessionRsvps(slug).filter((r) => r.rsvpId !== rec.rsvpId);
    sessionStorage.setItem(`manam_rsvp_${slug}`, JSON.stringify([rec, ...existing].slice(0, 10)));
  } catch {
    // Ignore sessionStorage restrictions
  }
}

export function RsvpFormSection({
  slug,
  site,
  editRsvpId,
  primaryColor,
  primaryBtnText,
  surfaceColor,
  borderColor,
  mutedColor,
  headingFont,
  onVisitWishlist,
}: RsvpFormSectionProps) {
  const rsvpConfig = site.rsvpConfig;
  const maxGuests = Math.max(1, Math.min(20, rsvpConfig.maxGuests || 10));
  const maxRooms = Math.max(1, Math.min(10, rsvpConfig.maxRooms || 4));

  const [attending, setAttending] = useState<'yes' | 'no'>('yes');
  const [fullName, setFullName] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [group, setGroup] = useState(rsvpConfig.groups[0] || '');
  const [guestCount, setGuestCount] = useState(1);
  const [partyGuests, setPartyGuests] = useState<PartyGuest[]>([{ name: '', diet: 'veg' }]);
  const [allergies, setAllergies] = useState('');
  const [accommodationNeeded, setAccommodationNeeded] = useState(false);
  const [roomsNeeded, setRoomsNeeded] = useState(1);
  const [checkInDate, setCheckInDate] = useState('');
  const [checkOutDate, setCheckOutDate] = useState('');
  const [roomSharingNote, setRoomSharingNote] = useState('');
  const [customAnswers, setCustomAnswers] = useState<Record<string, string>>({});
  const [blessingMessage, setBlessingMessage] = useState('');
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [honeypot, setHoneypot] = useState('');

  const [loadingExisting, setLoadingExisting] = useState(false);
  const [activeEditId, setActiveEditId] = useState<string | null>(editRsvpId);
  const [activeRefCode, setActiveRefCode] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [submittedResult, setSubmittedResult] = useState<{
    rsvpId: string;
    refCode: string;
    guestName: string;
  } | null>(null);
  const [duplicateMatch, setDuplicateMatch] = useState<SessionRsvpRecord | null>(null);
  const [copiedEditLink, setCopiedEditLink] = useState(false);
  const lastSubmitAt = useRef<number>(0);

  const deadlinePassed = (() => {
    if (!rsvpConfig.deadline) return false;
    const endOfDay = new Date(`${rsvpConfig.deadline}T23:59:59+05:30`);
    return Date.now() > endOfDay.getTime();
  })();

  useEffect(() => {
    setActiveEditId(editRsvpId);
    if (!editRsvpId) return;

    let active = true;
    setLoadingExisting(true);
    setError('');
    getDoc(doc(db, 'weddings', slug, 'rsvps', editRsvpId))
      .then((snap) => {
        if (!active) return;
        if (!snap.exists()) {
          setError('Could not find this RSVP record. Please check your private edit link.');
          return;
        }
        const data = snap.data() as RsvpDoc;
        setAttending(data.attending);
        setFullName(data.fullName);
        setMobile(data.mobile);
        setEmail(data.email || '');
        setGroup(data.group || '');
        setGuestCount(data.guestCount || 1);
        setPartyGuests(
          data.partyGuests?.length
            ? data.partyGuests
            : [{ name: data.fullName, diet: 'veg' }]
        );
        setAllergies(data.allergies || '');
        setAccommodationNeeded(Boolean(data.accommodationNeeded));
        setRoomsNeeded(data.roomsNeeded || 1);
        setCheckInDate(data.checkInDate || '');
        setCheckOutDate(data.checkOutDate || '');
        setRoomSharingNote(data.roomSharingNote || '');
        setCustomAnswers(data.customAnswers || {});
        setBlessingMessage(data.blessingMessage || '');
        setConsentAccepted(Boolean(data.consentAccepted));
        setActiveRefCode(data.refCode);
        setSubmittedResult(null);
      })
      .catch(() => {
        if (active) setError('Unable to load your RSVP right now.');
      })
      .finally(() => {
        if (active) setLoadingExisting(false);
      });

    return () => {
      active = false;
    };
  }, [slug, editRsvpId]);

  useEffect(() => {
    setPartyGuests((prev) => {
      const next: PartyGuest[] = [];
      for (let i = 0; i < guestCount; i++) {
        next.push(
          prev[i] || {
            name: i === 0 ? fullName : '',
            diet: 'veg',
          }
        );
      }
      return next;
    });
  }, [guestCount]);

  useEffect(() => {
    if (activeEditId) {
      setDuplicateMatch(null);
      return;
    }
    const nName = normalizeName(fullName);
    const nPhone = normalizePhone(mobile);
    if (!nName || nPhone.length < 6) {
      setDuplicateMatch(null);
      return;
    }
    const found = getSessionRsvps(slug).find(
      (r) => r.fullNameNormalized === nName && r.mobileNormalized === nPhone
    );
    setDuplicateMatch(found || null);
  }, [slug, fullName, mobile, activeEditId]);

  function loadDuplicateIntoEditor(rec: SessionRsvpRecord) {
    setActiveEditId(rec.rsvpId);
    const nextUrl = `${window.location.pathname}?rsvp=${rec.rsvpId}`;
    window.history.replaceState({}, '', nextUrl);
    setLoadingExisting(true);
    getDoc(doc(db, 'weddings', slug, 'rsvps', rec.rsvpId))
      .then((snap) => {
        if (snap.exists()) {
          const data = snap.data() as RsvpDoc;
          setAttending(data.attending);
          setFullName(data.fullName);
          setMobile(data.mobile);
          setEmail(data.email || '');
          setGroup(data.group || '');
          setGuestCount(data.guestCount || 1);
          setPartyGuests(data.partyGuests || [{ name: data.fullName, diet: 'veg' }]);
          setAllergies(data.allergies || '');
          setAccommodationNeeded(Boolean(data.accommodationNeeded));
          setRoomsNeeded(data.roomsNeeded || 1);
          setCheckInDate(data.checkInDate || '');
          setCheckOutDate(data.checkOutDate || '');
          setRoomSharingNote(data.roomSharingNote || '');
          setCustomAnswers(data.customAnswers || {});
          setBlessingMessage(data.blessingMessage || '');
          setConsentAccepted(true);
          setActiveRefCode(data.refCode);
        }
      })
      .finally(() => setLoadingExisting(false));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    // Honeypot check
    if (honeypot.trim().length > 0) {
      return;
    }

    if (deadlinePassed) {
      setError('The RSVP deadline has passed. Please contact the couple directly.');
      return;
    }

    // 10-second client throttle
    const now = Date.now();
    if (now - lastSubmitAt.current < 10000) {
      setError('Please wait a few seconds before submitting again.');
      return;
    }

    if (!fullName.trim()) {
      setError('Please enter your full name.');
      return;
    }
    if (mobile.trim().length < 6) {
      setError('Please enter a valid mobile number.');
      return;
    }
    if (rsvpConfig.fields.email.visible && rsvpConfig.fields.email.required && !email.trim()) {
      setError('Please enter your email address.');
      return;
    }
    if (rsvpConfig.fields.group.visible && rsvpConfig.fields.group.required && !group.trim()) {
      setError('Please select a family or group.');
      return;
    }
    for (const q of rsvpConfig.customQuestions.slice(0, 5)) {
      if (q.required && !(customAnswers[q.id] || '').trim()) {
        setError(`Please answer: ${q.label}`);
        return;
      }
    }
    if (!consentAccepted) {
      setError('Please accept the privacy consent checkbox to continue.');
      return;
    }

    const sanitizedParty =
      attending === 'yes'
        ? partyGuests.slice(0, guestCount).map((g, idx) => ({
            name: (g.name || (idx === 0 ? fullName : `Guest ${idx + 1}`)).trim().slice(0, 80),
            diet: g.diet === 'non-veg' ? ('non-veg' as const) : ('veg' as const),
          }))
        : [{ name: fullName.trim().slice(0, 80), diet: 'veg' as const }];

    const sanitizedCustom: Record<string, string> = {};
    for (const q of rsvpConfig.customQuestions.slice(0, 5)) {
      const val = (customAnswers[q.id] || '').trim().slice(0, 200);
      if (val) sanitizedCustom[q.id] = val;
    }

    setSubmitting(true);
    lastSubmitAt.current = now;

    try {
      if (activeEditId) {
        await updateDoc(doc(db, 'weddings', slug, 'rsvps', activeEditId), {
          attending,
          fullName: fullName.trim().slice(0, 100),
          mobile: mobile.trim().slice(0, 20),
          email: email.trim().slice(0, 120),
          group: group.trim().slice(0, 60),
          guestCount: attending === 'yes' ? guestCount : 1,
          partyGuests: sanitizedParty,
          allergies: allergies.trim().slice(0, 300),
          accommodationNeeded: attending === 'yes' && accommodationNeeded,
          roomsNeeded: attending === 'yes' && accommodationNeeded ? roomsNeeded : 0,
          checkInDate: attending === 'yes' && accommodationNeeded ? checkInDate.slice(0, 20) : '',
          checkOutDate: attending === 'yes' && accommodationNeeded ? checkOutDate.slice(0, 20) : '',
          roomSharingNote:
            attending === 'yes' && accommodationNeeded ? roomSharingNote.trim().slice(0, 300) : '',
          customAnswers: sanitizedCustom,
          blessingMessage: blessingMessage.trim().slice(0, 500),
          updatedAt: serverTimestamp(),
        });

        saveSessionRsvp(slug, {
          rsvpId: activeEditId,
          refCode: activeRefCode,
          fullNameNormalized: normalizeName(fullName),
          mobileNormalized: normalizePhone(mobile),
        });

        setSubmittedResult({
          rsvpId: activeEditId,
          refCode: activeRefCode,
          guestName: fullName.trim(),
        });
      } else {
        const newRsvpId = generateUnguessableId();
        const refCode = generateRsvpRef();

        await setDoc(doc(db, 'weddings', slug, 'rsvps', newRsvpId), {
          refCode,
          attending,
          fullName: fullName.trim().slice(0, 100),
          mobile: mobile.trim().slice(0, 20),
          email: email.trim().slice(0, 120),
          group: group.trim().slice(0, 60),
          guestCount: attending === 'yes' ? guestCount : 1,
          partyGuests: sanitizedParty,
          allergies: allergies.trim().slice(0, 300),
          accommodationNeeded: attending === 'yes' && accommodationNeeded,
          roomsNeeded: attending === 'yes' && accommodationNeeded ? roomsNeeded : 0,
          checkInDate: attending === 'yes' && accommodationNeeded ? checkInDate.slice(0, 20) : '',
          checkOutDate: attending === 'yes' && accommodationNeeded ? checkOutDate.slice(0, 20) : '',
          roomSharingNote:
            attending === 'yes' && accommodationNeeded ? roomSharingNote.trim().slice(0, 300) : '',
          customAnswers: sanitizedCustom,
          blessingMessage: blessingMessage.trim().slice(0, 500),
          consentAccepted: true,
          assignedRoom: '',
          accommodationStatus: 'pending',
          adminCheckInDate: '',
          adminCheckOutDate: '',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        const trimmedBlessing = blessingMessage.trim();
        if (trimmedBlessing.length > 0) {
          const blessingId = generateUnguessableId();
          await setDoc(doc(db, 'weddings', slug, 'blessings', blessingId), {
            displayName: fullName.trim().slice(0, 80),
            message: trimmedBlessing.slice(0, 500),
            approved: false,
            source: 'rsvp',
            sourceId: newRsvpId,
            createdAt: serverTimestamp(),
          });
        }

        saveSessionRsvp(slug, {
          rsvpId: newRsvpId,
          refCode,
          fullNameNormalized: normalizeName(fullName),
          mobileNormalized: normalizePhone(mobile),
        });

        setActiveEditId(newRsvpId);
        setActiveRefCode(refCode);
        setSubmittedResult({
          rsvpId: newRsvpId,
          refCode,
          guestName: fullName.trim(),
        });
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not submit your RSVP. Please check your details and try again.'
      );
    } finally {
      setSubmitting(false);
    }
  }

  const editUrl = submittedResult
    ? `${window.location.origin}/wedding/${slug}?rsvp=${submittedResult.rsvpId}#rsvp`
    : '';

  if (loadingExisting) {
    return (
      <div
        className="rounded-xl p-8 border animate-pulse"
        style={{ backgroundColor: surfaceColor, borderColor }}
      >
        <div className="h-6 w-48 bg-current/10 rounded mb-4" />
        <div className="h-4 w-full bg-current/10 rounded mb-3" />
        <div className="h-4 w-2/3 bg-current/10 rounded" />
      </div>
    );
  }

  if (submittedResult) {
    return (
      <div
        className="rounded-2xl p-6 sm:p-10 border"
        style={{ backgroundColor: surfaceColor, borderColor }}
      >
        <div className="max-w-xl mx-auto text-center">
          <div
            className="w-12 h-12 rounded-full mx-auto mb-4 flex items-center justify-center"
            style={{ backgroundColor: primaryColor, color: primaryBtnText }}
          >
            <Check className="w-6 h-6" aria-hidden="true" />
          </div>
          <h3
            className="text-2xl sm:text-3xl font-semibold mb-2"
            style={{ fontFamily: headingFont }}
          >
            {rsvpConfig.thankYouHeading || 'Thank you for responding'}
          </h3>
          <p className="text-sm sm:text-base mb-6" style={{ color: mutedColor }}>
            {rsvpConfig.thankYouMessage}
          </p>

          <div
            className="rounded-xl p-4 border mb-6 text-left"
            style={{ borderColor }}
          >
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <span className="text-xs uppercase tracking-wider" style={{ color: mutedColor }}>
                RSVP Reference
              </span>
              <span className="font-mono text-base font-semibold tabular-nums">
                {submittedResult.refCode}
              </span>
            </div>
            <p className="text-xs break-all mb-3" style={{ color: mutedColor }}>
              Private edit link: <span className="font-mono">{editUrl}</span>
            </p>
            <div className="flex flex-wrap gap-2.5">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(editUrl);
                  setCopiedEditLink(true);
                  setTimeout(() => setCopiedEditLink(false), 2500);
                }}
                className="min-h-[44px] px-4 py-2 rounded-lg border text-xs sm:text-sm font-medium inline-flex items-center gap-2 cursor-pointer"
                style={{ borderColor }}
              >
                <Copy className="w-4 h-4" aria-hidden="true" />
                {copiedEditLink ? 'Copied edit link' : 'Copy edit link'}
              </button>
              {!deadlinePassed && (
                <button
                  type="button"
                  onClick={() => setSubmittedResult(null)}
                  className="min-h-[44px] px-4 py-2 rounded-lg border text-xs sm:text-sm font-medium inline-flex items-center gap-2 cursor-pointer"
                  style={{ borderColor }}
                >
                  <Pencil className="w-4 h-4" aria-hidden="true" />
                  Edit my RSVP
                </button>
              )}
            </div>
          </div>

          {site.wishlistConfig.enabled && onVisitWishlist && (
            <button
              type="button"
              onClick={() => onVisitWishlist(submittedResult.guestName)}
              className="min-h-[44px] px-6 py-3 rounded-lg text-sm font-medium inline-flex items-center gap-2 cursor-pointer transition-opacity hover:opacity-90"
              style={{ backgroundColor: primaryColor, color: primaryBtnText }}
            >
              <Gift className="w-4 h-4" aria-hidden="true" />
              Visit our Wishlist
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl p-6 sm:p-10 border space-y-6"
      style={{ backgroundColor: surfaceColor, borderColor }}
    >
      {deadlinePassed && (
        <div
          role="status"
          className="p-4 rounded-xl border text-sm"
          style={{ borderColor }}
        >
          RSVPs closed on {rsvpConfig.deadline}. Please reach out to the couple directly for changes.
        </div>
      )}

      {activeEditId && (
        <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b" style={{ borderColor }}>
          <span className="text-sm font-medium">
            Editing RSVP · <span className="font-mono">{activeRefCode}</span>
          </span>
          <button
            type="button"
            onClick={() => {
              setActiveEditId(null);
              setActiveRefCode('');
              window.history.replaceState({}, '', window.location.pathname + '#rsvp');
            }}
            className="text-xs underline cursor-pointer"
            style={{ color: mutedColor }}
          >
            Submit a separate RSVP instead
          </button>
        </div>
      )}

      {/* Duplicate detection warning */}
      {duplicateMatch && !activeEditId && (
        <div
          role="alert"
          className="p-4 rounded-xl border text-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3"
          style={{ borderColor: primaryColor }}
        >
          <div>
            <p className="font-medium">
              An RSVP with this name and mobile number was already submitted ({duplicateMatch.refCode}).
            </p>
            <p className="text-xs mt-0.5" style={{ color: mutedColor }}>
              You can update your existing response instead of creating a duplicate.
            </p>
          </div>
          <button
            type="button"
            onClick={() => loadDuplicateIntoEditor(duplicateMatch)}
            className="min-h-[44px] px-4 py-2 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer"
            style={{ backgroundColor: primaryColor, color: primaryBtnText }}
          >
            Edit existing RSVP
          </button>
        </div>
      )}

      {/* Honeypot */}
      <div className="hidden" aria-hidden="true">
        <label htmlFor="rsvp-company-website">Leave blank</label>
        <input
          id="rsvp-company-website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
        />
      </div>

      {/* Attending toggle */}
      <div>
        <span className="block text-sm font-medium mb-2.5">Will you be attending?</span>
        <div className="grid grid-cols-2 gap-3">
          {[
            { value: 'yes' as const, label: 'Joyfully Accepts' },
            { value: 'no' as const, label: 'Regretfully Declines' },
          ].map((opt) => {
            const selected = attending === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                disabled={deadlinePassed}
                onClick={() => setAttending(opt.value)}
                className="min-h-[44px] px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors cursor-pointer"
                style={{
                  borderColor: selected ? primaryColor : borderColor,
                  backgroundColor: selected ? primaryColor : 'transparent',
                  color: selected ? primaryBtnText : 'inherit',
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Primary Contact Fields */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="rsvp-fullname" className="block text-sm font-medium mb-1.5">
            Full Name *
          </label>
          <input
            id="rsvp-fullname"
            type="text"
            required
            maxLength={100}
            disabled={deadlinePassed}
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="e.g., Priya Natarajan"
            className="w-full min-h-[44px] px-3.5 rounded-lg border bg-transparent text-sm outline-none focus:ring-2"
            style={{ borderColor }}
          />
        </div>

        <div>
          <label htmlFor="rsvp-mobile" className="block text-sm font-medium mb-1.5">
            Mobile Number *
          </label>
          <input
            id="rsvp-mobile"
            type="tel"
            required
            maxLength={20}
            disabled={deadlinePassed}
            value={mobile}
            onChange={(e) => setMobile(e.target.value)}
            placeholder="e.g., +91 98400 12345"
            className="w-full min-h-[44px] px-3.5 rounded-lg border bg-transparent text-sm outline-none focus:ring-2"
            style={{ borderColor }}
          />
        </div>

        {rsvpConfig.fields.email.visible && (
          <div>
            <label htmlFor="rsvp-email" className="block text-sm font-medium mb-1.5">
              {rsvpConfig.fields.email.label || 'Email'}
              {rsvpConfig.fields.email.required ? ' *' : ''}
            </label>
            <input
              id="rsvp-email"
              type="email"
              maxLength={120}
              required={rsvpConfig.fields.email.required}
              disabled={deadlinePassed}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Optional"
              className="w-full min-h-[44px] px-3.5 rounded-lg border bg-transparent text-sm outline-none focus:ring-2"
              style={{ borderColor }}
            />
          </div>
        )}

        {rsvpConfig.fields.group.visible && (
          <div>
            <label htmlFor="rsvp-group" className="block text-sm font-medium mb-1.5">
              {rsvpConfig.fields.group.label || 'Family or Group'}
              {rsvpConfig.fields.group.required ? ' *' : ''}
            </label>
            <select
              id="rsvp-group"
              required={rsvpConfig.fields.group.required}
              disabled={deadlinePassed}
              value={group}
              onChange={(e) => setGroup(e.target.value)}
              className="w-full min-h-[44px] px-3.5 rounded-lg border bg-transparent text-sm outline-none focus:ring-2"
              style={{ borderColor }}
            >
              {rsvpConfig.groups.map((g) => (
                <option key={g} value={g} className="text-[#1D1915] bg-white">
                  {g}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Attending-only sections */}
      {attending === 'yes' && (
        <>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="rsvp-guest-count" className="block text-sm font-medium mb-1.5">
                Number of Guests (1–{maxGuests})
              </label>
              <select
                id="rsvp-guest-count"
                disabled={deadlinePassed}
                value={guestCount}
                onChange={(e) => setGuestCount(Number(e.target.value))}
                className="w-full min-h-[44px] px-3.5 rounded-lg border bg-transparent text-sm outline-none"
                style={{ borderColor }}
              >
                {Array.from({ length: maxGuests }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n} className="text-[#1D1915] bg-white">
                    {n} {n === 1 ? 'Guest' : 'Guests'}
                  </option>
                ))}
              </select>
            </div>

            {rsvpConfig.fields.allergies.visible && (
              <div>
                <label htmlFor="rsvp-allergies" className="block text-sm font-medium mb-1.5">
                  {rsvpConfig.fields.allergies.label || 'Allergies or dietary notes'}
                  {rsvpConfig.fields.allergies.required ? ' *' : ''}
                </label>
                <input
                  id="rsvp-allergies"
                  type="text"
                  maxLength={300}
                  required={rsvpConfig.fields.allergies.required}
                  disabled={deadlinePassed}
                  value={allergies}
                  onChange={(e) => setAllergies(e.target.value)}
                  placeholder="Jain, nut allergy, etc."
                  className="w-full min-h-[44px] px-3.5 rounded-lg border bg-transparent text-sm outline-none"
                  style={{ borderColor }}
                />
              </div>
            )}
          </div>

          {/* Individual Party Guests */}
          <div className="space-y-3">
            <p className="text-sm font-medium">Guest Details &amp; Meal Preference</p>
            <div className="space-y-2.5">
              {partyGuests.map((guest, idx) => (
                <div
                  key={idx}
                  className="grid sm:grid-cols-12 gap-2.5 items-center p-3 rounded-lg border"
                  style={{ borderColor }}
                >
                  <div className="sm:col-span-7">
                    <label className="sr-only" htmlFor={`party-guest-${idx}`}>
                      Guest {idx + 1} name
                    </label>
                    <input
                      id={`party-guest-${idx}`}
                      type="text"
                      maxLength={80}
                      disabled={deadlinePassed}
                      value={guest.name}
                      onChange={(e) => {
                        const val = e.target.value;
                        setPartyGuests((prev) =>
                          prev.map((item, i) => (i === idx ? { ...item, name: val } : item))
                        );
                      }}
                      placeholder={`Guest ${idx + 1} full name`}
                      className="w-full min-h-[40px] px-3 rounded border bg-transparent text-sm outline-none"
                      style={{ borderColor }}
                    />
                  </div>
                  <div className="sm:col-span-5 flex gap-2">
                    {(['veg', 'non-veg'] as const).map((diet) => {
                      const active = guest.diet === diet;
                      return (
                        <button
                          key={diet}
                          type="button"
                          disabled={deadlinePassed}
                          onClick={() =>
                            setPartyGuests((prev) =>
                              prev.map((item, i) => (i === idx ? { ...item, diet } : item))
                            )
                          }
                          className="flex-1 min-h-[40px] px-3 rounded border text-xs font-medium cursor-pointer transition-colors"
                          style={{
                            borderColor: active ? primaryColor : borderColor,
                            backgroundColor: active ? primaryColor : 'transparent',
                            color: active ? primaryBtnText : 'inherit',
                          }}
                        >
                          {diet === 'veg' ? 'Veg' : 'Non-Veg'}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Accommodation */}
          {rsvpConfig.fields.accommodation.visible && (
            <div className="pt-2 border-t space-y-4" style={{ borderColor }}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-sm font-medium">
                  {rsvpConfig.fields.accommodation.label || 'Do you need accommodation?'}
                </span>
                <div className="flex gap-2">
                  {[
                    { label: 'No', val: false },
                    { label: 'Yes', val: true },
                  ].map((opt) => (
                    <button
                      key={String(opt.val)}
                      type="button"
                      disabled={deadlinePassed}
                      onClick={() => setAccommodationNeeded(opt.val)}
                      className="min-h-[40px] px-4 rounded-lg border text-xs font-medium cursor-pointer"
                      style={{
                        borderColor: accommodationNeeded === opt.val ? primaryColor : borderColor,
                        backgroundColor: accommodationNeeded === opt.val ? primaryColor : 'transparent',
                        color: accommodationNeeded === opt.val ? primaryBtnText : 'inherit',
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {accommodationNeeded && (
                <div className="grid sm:grid-cols-3 gap-4">
                  <div>
                    <label htmlFor="rsvp-rooms" className="block text-xs font-medium mb-1">
                      Rooms needed (1–{maxRooms})
                    </label>
                    <select
                      id="rsvp-rooms"
                      disabled={deadlinePassed}
                      value={roomsNeeded}
                      onChange={(e) => setRoomsNeeded(Number(e.target.value))}
                      className="w-full min-h-[44px] px-3 rounded-lg border bg-transparent text-sm"
                      style={{ borderColor }}
                    >
                      {Array.from({ length: maxRooms }, (_, i) => i + 1).map((r) => (
                        <option key={r} value={r} className="text-[#1D1915] bg-white">
                          {r} {r === 1 ? 'Room' : 'Rooms'}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="rsvp-checkin" className="block text-xs font-medium mb-1">
                      Check-in Date
                    </label>
                    <input
                      id="rsvp-checkin"
                      type="date"
                      disabled={deadlinePassed}
                      value={checkInDate}
                      onChange={(e) => setCheckInDate(e.target.value)}
                      className="w-full min-h-[44px] px-3 rounded-lg border bg-transparent text-sm"
                      style={{ borderColor }}
                    />
                  </div>
                  <div>
                    <label htmlFor="rsvp-checkout" className="block text-xs font-medium mb-1">
                      Check-out Date
                    </label>
                    <input
                      id="rsvp-checkout"
                      type="date"
                      disabled={deadlinePassed}
                      value={checkOutDate}
                      onChange={(e) => setCheckOutDate(e.target.value)}
                      className="w-full min-h-[44px] px-3 rounded-lg border bg-transparent text-sm"
                      style={{ borderColor }}
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <label htmlFor="rsvp-room-note" className="block text-xs font-medium mb-1">
                      Room-sharing or accessibility note
                    </label>
                    <input
                      id="rsvp-room-note"
                      type="text"
                      maxLength={300}
                      disabled={deadlinePassed}
                      value={roomSharingNote}
                      onChange={(e) => setRoomSharingNote(e.target.value)}
                      placeholder="Ground floor preferred, sharing with Uncle's family, etc."
                      className="w-full min-h-[44px] px-3.5 rounded-lg border bg-transparent text-sm"
                      style={{ borderColor }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Custom Questions (up to 5) */}
      {rsvpConfig.customQuestions.slice(0, 5).map((q) => (
        <div key={q.id}>
          <label htmlFor={`custom-q-${q.id}`} className="block text-sm font-medium mb-1.5">
            {q.label}
            {q.required ? ' *' : ''}
          </label>
          {q.type === 'choice' && q.options.length > 0 ? (
            <select
              id={`custom-q-${q.id}`}
              required={q.required}
              disabled={deadlinePassed}
              value={customAnswers[q.id] || ''}
              onChange={(e) =>
                setCustomAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))
              }
              className="w-full min-h-[44px] px-3.5 rounded-lg border bg-transparent text-sm"
              style={{ borderColor }}
            >
              <option value="" className="text-[#1D1915] bg-white">
                Select an option
              </option>
              {q.options.map((opt) => (
                <option key={opt} value={opt} className="text-[#1D1915] bg-white">
                  {opt}
                </option>
              ))}
            </select>
          ) : (
            <input
              id={`custom-q-${q.id}`}
              type="text"
              maxLength={200}
              required={q.required}
              disabled={deadlinePassed}
              value={customAnswers[q.id] || ''}
              onChange={(e) =>
                setCustomAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))
              }
              className="w-full min-h-[44px] px-3.5 rounded-lg border bg-transparent text-sm"
              style={{ borderColor }}
            />
          )}
        </div>
      ))}

      {/* Blessing message */}
      {rsvpConfig.fields.blessing.visible && (
        <div>
          <label htmlFor="rsvp-blessing" className="block text-sm font-medium mb-1.5">
            {rsvpConfig.fields.blessing.label || 'A blessing or note for the couple'}
            {rsvpConfig.fields.blessing.required ? ' *' : ''}
          </label>
          <textarea
            id="rsvp-blessing"
            rows={3}
            maxLength={500}
            required={rsvpConfig.fields.blessing.required}
            disabled={deadlinePassed}
            value={blessingMessage}
            onChange={(e) => setBlessingMessage(e.target.value)}
            placeholder="Share a warm wish for the couple (reviewed before appearing on the blessings wall)"
            className="w-full p-3.5 rounded-lg border bg-transparent text-sm outline-none"
            style={{ borderColor }}
          />
        </div>
      )}

      {/* Privacy Consent */}
      <label className="flex items-start gap-3 text-xs sm:text-sm cursor-pointer">
        <input
          type="checkbox"
          required
          disabled={deadlinePassed}
          checked={consentAccepted}
          onChange={(e) => setConsentAccepted(e.target.checked)}
          className="mt-1 w-4 h-4 shrink-0"
        />
        <span style={{ color: mutedColor }}>
          I agree that my details are used only to organise this wedding and are deleted after the event.{' '}
          <Link to="/privacy" className="underline" style={{ color: primaryColor }}>
            Privacy Policy
          </Link>
        </span>
      </label>

      {error && (
        <p role="alert" className="text-sm text-[#B91C1C]">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting || deadlinePassed}
        className="w-full sm:w-auto min-h-[44px] px-7 py-3 rounded-lg text-sm font-medium cursor-pointer transition-opacity disabled:opacity-50"
        style={{ backgroundColor: primaryColor, color: primaryBtnText }}
      >
        {submitting
          ? 'Saving RSVP...'
          : activeEditId
            ? 'Save RSVP Changes'
            : rsvpConfig.submitButtonText || 'Confirm RSVP'}
      </button>
    </form>
  );
}

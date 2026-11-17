import { Link } from 'react-router-dom';
import { PLATFORM_DOMAIN, PLATFORM_NAME } from '../lib/constants';
import { PublicFooter } from '../components/PublicFooter';

function LegalShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#FAF7F2] text-[#1D1915] flex flex-col">
      <header className="border-b border-[#1D1915]/10 bg-[#FAF7F2]">
        <div className="max-w-4xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between gap-6">
          <Link
            to="/"
            className="text-xl font-semibold tracking-tight whitespace-nowrap shrink-0"
            style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
          >
            {PLATFORM_NAME}
          </Link>
          <nav className="flex items-center gap-6 text-sm text-[#5E554B]">
            <Link to="/privacy" className="hover:text-[#1D1915]">
              Privacy
            </Link>
            <Link to="/terms" className="hover:text-[#1D1915]">
              Terms
            </Link>
            <Link to="/" className="hover:text-[#1D1915]">
              Home
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-3xl mx-auto w-full px-5 sm:px-8 py-12 sm:py-16">
        <p className="text-xs uppercase tracking-[0.2em] text-[#7C5821] font-medium mb-2">
          {PLATFORM_NAME} · {PLATFORM_DOMAIN}
        </p>
        <h1
          className="text-3xl sm:text-4xl font-semibold text-[#1D1915] mb-3"
          style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
        >
          {title}
        </h1>
        <p className="text-sm text-[#5E554B] mb-10 pb-6 border-b border-[#1D1915]/10">
          {subtitle}
        </p>
        <div className="space-y-8 text-sm sm:text-base text-[#2D2722] leading-relaxed">
          {children}
        </div>
      </main>

      <PublicFooter mutedColor="#5E554B" />
    </div>
  );
}

export function PrivacyPage() {
  return (
    <LegalShell
      title="Privacy Policy"
      subtitle="Data minimization, guest consent, and post-wedding erasure on MANAM.in."
    >
      <section>
        <h2 className="text-lg font-semibold mb-2">1. What We Collect</h2>
        <p className="text-[#5E554B]">
          {PLATFORM_NAME} collects only the minimum information required for a couple to organize their wedding: guest RSVP details (name, mobile number, optional email, family group, guest count, dietary preferences, accommodation needs, and optional custom question responses), Moi contribution records (selected recipient, amount in INR, donor name, reference code, and optional blessing), and admin sign-in identifiers (verified Google email addresses for authorized couple admins and the platform owner).
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-2">2. Why It Is Collected &amp; Who Can See It</h2>
        <p className="text-[#5E554B]">
          Guest details are used strictly to manage event seating, catering, room allocation, and thank-you acknowledgements for that specific wedding. Only the couple’s invited Google admin accounts (maximum 3 per wedding) and the {PLATFORM_NAME} platform administrator (solely for technical support, lifecycle management, and erasure) can access private RSVP and contribution lists. Guests cannot browse other guests’ submissions. Approved blessings appear on the wedding wall using either the guest’s chosen name or “A loved one”, and never display gift amounts or recipients.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-2">3. Zero Trackers, Cookies, or Analytics</h2>
        <p className="text-[#5E554B]">
          {PLATFORM_NAME} does not use third-party advertising trackers, behavioral analytics, or tracking cookies. Personal information is never placed in URLs, with the sole exception of the random unguessable RSVP edit identifier generated when a guest chooses to save their private edit link. By default, wedding sites instruct search engines not to index pages (<code className="font-mono text-xs">noindex</code>).
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-2">4. Post-Wedding Erasure &amp; Retention Exceptions</h2>
        <p className="text-[#5E554B]">
          After a wedding date passes, the site is marked completed and enters a configured grace period (default 30 days) so the couple can export their guest list, room assignments, and thank-you ledger. Once the platform administrator triggers Erase &amp; Reset, all RSVPs, contributions, blessings, uploaded images, customization documents, admin allowlists, and wedding audit logs are permanently deleted from Cloud Firestore.
        </p>
        <p className="text-[#5E554B] mt-3">
          <strong>Retention exceptions:</strong> Two non-personal records remain: (a) a slug tombstone in <code className="font-mono text-xs">reservedSlugs</code> containing only the erasure timestamp so the wedding URL can never be reused by someone else, and (b) a non-personal entry in <code className="font-mono text-xs">platformAuditLog</code> recording that the slug was erased. In addition, standard cloud infrastructure backups managed by Google Cloud / Firestore expire automatically on their built-in retention schedule and cannot be purged instantaneously per document.
        </p>
      </section>
    </LegalShell>
  );
}

export function TermsPage() {
  return (
    <LegalShell
      title="Terms of Service"
      subtitle="Platform scope, couple responsibilities, and direct UPI Moi transfers on MANAM.in."
    >
      <section>
        <h2 className="text-lg font-semibold mb-2">1. Role of {PLATFORM_NAME}</h2>
        <p className="text-[#5E554B]">
          {PLATFORM_NAME} ({PLATFORM_DOMAIN}) provides customizable wedding invitation websites, guest RSVP management tools, and static/dynamic UPI QR display utilities for invited couples. {PLATFORM_NAME} is a software platform only and is not an event organizer, payment aggregator, escrow service, or financial intermediary.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-2">2. Direct UPI Moi &amp; No Payment Processing</h2>
        <p className="text-[#5E554B]">
          {PLATFORM_NAME} never collects, holds, processes, or settles money. All Moi contributions occur directly between the guest’s UPI application and the couple’s configured UPI beneficiary account. Clicking “I’ve completed the payment” records a guest’s self-reported intent only; the couple must independently verify receipt in their bank or UPI statement before confirming a contribution.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-2">3. Couple Responsibilities</h2>
        <p className="text-[#5E554B]">
          Couples are solely responsible for the accuracy of their event schedules, venue links, accommodation notes, uploaded photographs, and UPI beneficiary IDs/QR images, as well as exporting their wedding records before their scheduled expiry and erasure window.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-2">4. Availability &amp; Suspension</h2>
        <p className="text-[#5E554B]">
          The platform administrator may suspend or deactivate a wedding site at any time for abuse, expired validity, or upon couple request.
        </p>
      </section>
    </LegalShell>
  );
}

export function NotFoundPage() {
  return (
    <div className="min-h-screen bg-[#FAF7F2] text-[#1D1915] flex flex-col">
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center">
          <p className="text-xs uppercase tracking-[0.2em] text-[#7C5821] font-medium mb-3">
            404 · Page Not Found
          </p>
          <h1
            className="text-4xl font-semibold mb-3"
            style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
          >
            This page does not exist
          </h1>
          <p className="text-sm text-[#5E554B] mb-8">
            Please double-check your wedding invitation link or return to {PLATFORM_NAME}.
          </p>
          <Link
            to="/"
            className="min-h-[44px] inline-flex items-center px-6 py-2.5 rounded-lg bg-[#7C5821] text-[#FAF7F2] text-sm font-medium hover:bg-[#66471A] transition-colors"
          >
            Return to {PLATFORM_NAME}
          </Link>
        </div>
      </div>
      <PublicFooter mutedColor="#5E554B" />
    </div>
  );
}

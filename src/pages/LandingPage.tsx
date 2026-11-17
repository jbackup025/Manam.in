import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, CalendarCheck, HeartHandshake, ShieldCheck } from 'lucide-react';
import { PLATFORM_NAME } from '../lib/constants';
import { PublicFooter } from '../components/PublicFooter';

export function LandingPage() {
  const [slugInput, setSlugInput] = useState('');
  const [slugError, setSlugError] = useState('');
  const navigate = useNavigate();

  function handleOpenWedding(e: React.FormEvent) {
    e.preventDefault();
    const cleaned = slugInput.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
    if (cleaned.length < 3) {
      setSlugError('Enter a valid invitation code (at least 3 characters).');
      return;
    }
    setSlugError('');
    navigate(`/wedding/${cleaned}`);
  }

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-[#1D1915] flex flex-col">
      {/* 3-Zone Top Bar */}
      <header className="border-b border-[#1D1915]/10 bg-[#FAF7F2]/95 sticky top-0 z-30 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between gap-8">
          <Link
            to="/"
            className="text-xl sm:text-2xl font-semibold tracking-tight whitespace-nowrap shrink-0"
            style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
          >
            {PLATFORM_NAME}
          </Link>

          <nav aria-label="Primary navigation" className="hidden md:flex items-center gap-7 text-sm text-[#5E554B]">
            <a href="#features" className="hover:text-[#1D1915] transition-colors whitespace-nowrap shrink-0">
              Features
            </a>
            <a href="#how-it-works" className="hover:text-[#1D1915] transition-colors whitespace-nowrap shrink-0">
              How Moi Works
            </a>
            <Link to="/privacy" className="hover:text-[#1D1915] transition-colors whitespace-nowrap shrink-0">
              Privacy
            </Link>
            <Link to="/terms" className="hover:text-[#1D1915] transition-colors whitespace-nowrap shrink-0">
              Terms
            </Link>
          </nav>

          <div className="shrink-0">
            <Link
              to="/super"
              className="min-h-[40px] inline-flex items-center px-4 py-2 rounded-lg bg-[#7C5821] text-[#FAF7F2] text-xs sm:text-sm font-medium hover:bg-[#66471A] transition-colors whitespace-nowrap shrink-0"
            >
              Platform Admin
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero Split */}
        <section className="max-w-6xl mx-auto px-5 sm:px-8 py-12 sm:py-20 grid lg:grid-cols-12 gap-10 lg:gap-12 items-stretch">
          <div className="lg:col-span-6 flex flex-col justify-center">
            <p className="text-xs uppercase tracking-[0.2em] text-[#7C5821] font-medium mb-4">
              Private Wedding Websites · Zero Commission
            </p>
            <h1
              className="text-4xl sm:text-5xl lg:text-[3.5rem] font-semibold leading-[1.08] tracking-tight text-[#1D1915] mb-6"
              style={{
                fontFamily: "'Cormorant Garamond', Georgia, serif",
                textWrap: 'balance',
              }}
            >
              Thoughtful wedding invitations, RSVP planning, and direct UPI Moi.
            </h1>
            <p className="text-base sm:text-lg text-[#5E554B] leading-relaxed mb-8 max-w-xl">
              Each couple receives an isolated, customizable site for guests to confirm attendance, coordinate rooms, and send traditional moi directly to the couple’s own UPI account. After the celebration, all wedding data is completely erased.
            </p>

            {/* Open existing invitation */}
            <form onSubmit={handleOpenWedding} className="max-w-md">
              <label htmlFor="invitation-slug" className="block text-xs font-medium text-[#5E554B] mb-2">
                Have an invitation link code?
              </label>
              <div className="flex flex-col sm:flex-row gap-2.5">
                <div className="flex-1 flex items-center bg-white border border-[#1D1915]/15 rounded-lg px-3.5 min-h-[44px] focus-within:border-[#7C5821]">
                  <span className="text-xs text-[#5E554B] select-none mr-1">manam.in/wedding/</span>
                  <input
                    id="invitation-slug"
                    type="text"
                    value={slugInput}
                    onChange={(e) => {
                      setSlugInput(e.target.value);
                      if (slugError) setSlugError('');
                    }}
                    placeholder="demo"
                    className="w-full bg-transparent text-sm text-[#1D1915] outline-none"
                  />
                </div>
                <button
                  type="submit"
                  className="min-h-[44px] px-5 py-2.5 rounded-lg bg-[#1D1915] text-[#FAF7F2] text-sm font-medium hover:bg-[#332C26] transition-colors inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Open Invitation
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
              {slugError && (
                <p className="mt-2 text-xs text-[#9E2A2B]" role="alert">
                  {slugError}
                </p>
              )}
            </form>

            <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-[#5E554B]">
              <span>INR &amp; UPI native</span>
              <span aria-hidden="true">·</span>
              <span>No platform fees</span>
              <span aria-hidden="true">·</span>
              <span>No trackers or ads</span>
              <span aria-hidden="true">·</span>
              <Link to="/wedding/demo" className="text-[#7C5821] font-medium hover:underline">
                View staging demo invitation
              </Link>
            </div>
          </div>

          <div className="lg:col-span-6">
            <div className="h-full min-h-[300px] sm:min-h-[420px] rounded-2xl overflow-hidden border border-[#1D1915]/10 bg-[#EFE9DE]">
              <img
                src="/src/assets/images/hero_manam_wedding_1794917673015.jpg"
                alt="Sunlit heritage courtyard prepared for an intimate Indian wedding ceremony"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </section>

        {/* Core Capabilities */}
        <section id="features" className="border-t border-[#1D1915]/10 bg-[#F4EFE6]/60 py-16 sm:py-20">
          <div className="max-w-6xl mx-auto px-5 sm:px-8">
            <div className="max-w-2xl mb-12">
              <p className="text-xs uppercase tracking-[0.2em] text-[#7C5821] font-medium mb-2">
                Built for Indian Weddings
              </p>
              <h2
                className="text-3xl sm:text-4xl font-semibold text-[#1D1915]"
                style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
              >
                Everything families need before, during, and after the ceremony.
              </h2>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              <article className="bg-white border border-[#1D1915]/10 rounded-xl p-7">
                <CalendarCheck className="w-6 h-6 text-[#7C5821] mb-4" aria-hidden="true" />
                <h3 className="text-lg font-semibold mb-2">01. Party RSVP &amp; Room Planning</h3>
                <p className="text-sm text-[#5E554B] leading-relaxed">
                  Guests RSVP without creating an account, specify Veg or Non-Veg preferences per family member, request rooms, and receive a private edit link before your deadline.
                </p>
              </article>

              <article className="bg-white border border-[#1D1915]/10 rounded-xl p-7">
                <HeartHandshake className="w-6 h-6 text-[#7C5821] mb-4" aria-hidden="true" />
                <h3 className="text-lg font-semibold mb-2">02. Direct UPI Moi Wishlist</h3>
                <p className="text-sm text-[#5E554B] leading-relaxed">
                  Guests choose a beneficiary, scan a dynamic INR QR code or tap GPay, PhonePe, or Paytm with a 6-character matching code. {PLATFORM_NAME} never touches or holds money.
                </p>
              </article>

              <article className="bg-white border border-[#1D1915]/10 rounded-xl p-7">
                <ShieldCheck className="w-6 h-6 text-[#7C5821] mb-4" aria-hidden="true" />
                <h3 className="text-lg font-semibold mb-2">03. Complete Post-Wedding Erasure</h3>
                <p className="text-sm text-[#5E554B] leading-relaxed">
                  Download your entire guest list, room sheet, and thank-you ledger in CSV, Excel, or JSON. Once the grace period ends, all personal wedding records are permanently erased.
                </p>
              </article>
            </div>
          </div>
        </section>

        {/* How Moi Works */}
        <section id="how-it-works" className="max-w-6xl mx-auto px-5 sm:px-8 py-16 sm:py-20">
          <div className="grid lg:grid-cols-12 gap-10 items-start">
            <div className="lg:col-span-5">
              <p className="text-xs uppercase tracking-[0.2em] text-[#7C5821] font-medium mb-2">
                Transparency First
              </p>
              <h2
                className="text-3xl sm:text-4xl font-semibold text-[#1D1915] mb-4"
                style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
              >
                How direct UPI Moi reconciliation works
              </h2>
              <p className="text-sm sm:text-base text-[#5E554B] leading-relaxed">
                No payment gateways, no escrow, and no transaction fees. Every rupee goes straight from your guest’s bank app to your chosen UPI ID.
              </p>
            </div>

            <div className="lg:col-span-7 divide-y divide-[#1D1915]/10 border-t border-b border-[#1D1915]/10">
              <div className="py-5 flex gap-4">
                <span className="font-mono text-sm text-[#7C5821] tabular-nums pt-0.5">01</span>
                <div>
                  <h3 className="text-base font-semibold mb-1">Guest selects recipient &amp; amount</h3>
                  <p className="text-sm text-[#5E554B]">
                    A unique 6-character code (for example, <span className="font-mono">Moi 8K4P2M</span>) is embedded in the UPI payment note.
                  </p>
                </div>
              </div>
              <div className="py-5 flex gap-4">
                <span className="font-mono text-sm text-[#7C5821] tabular-nums pt-0.5">02</span>
                <div>
                  <h3 className="text-base font-semibold mb-1">Payment settles directly in the couple’s bank</h3>
                  <p className="text-sm text-[#5E554B]">
                    Guests confirm submission, which logs a pending record and optional blessing message for your review.
                  </p>
                </div>
              </div>
              <div className="py-5 flex gap-4">
                <span className="font-mono text-sm text-[#7C5821] tabular-nums pt-0.5">03</span>
                <div>
                  <h3 className="text-base font-semibold mb-1">Couple confirms against bank statement</h3>
                  <p className="text-sm text-[#5E554B]">
                    Matching the reference code in your admin portal atomically updates the server-verified progress total and lets you approve the blessing for your wall.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <PublicFooter mutedColor="#5E554B" />
    </div>
  );
}

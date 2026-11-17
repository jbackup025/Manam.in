import { Link } from 'react-router-dom';
import { PLATFORM_DOMAIN, PLATFORM_NAME } from '../lib/constants';

export function PublicFooter({ mutedColor }: { mutedColor?: string }) {
  return (
    <footer
      className="no-print border-t border-current/10 py-10 px-6 text-sm"
      style={mutedColor ? { color: mutedColor } : undefined}
    >
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-xs sm:text-sm">
          <Link to="/" className="font-semibold tracking-wide hover:underline">
            {PLATFORM_NAME}
          </Link>
          <span aria-hidden="true">·</span>
          <span>{PLATFORM_DOMAIN}</span>
          <span aria-hidden="true">·</span>
          <span>Zero-commission wedding invitations</span>
        </div>
        <nav aria-label="Legal navigation" className="flex items-center gap-6 text-xs sm:text-sm">
          <Link to="/privacy" className="hover:underline min-h-[44px] inline-flex items-center">
            Privacy Policy
          </Link>
          <Link to="/terms" className="hover:underline min-h-[44px] inline-flex items-center">
            Terms of Service
          </Link>
        </nav>
      </div>
    </footer>
  );
}

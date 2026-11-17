import { WifiOff } from 'lucide-react';
import { useAuth } from '../lib/authContext';

export function OfflineBanner() {
  const { isOnline } = useAuth();
  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="no-print bg-[#1D1915] text-[#FAF7F2] px-4 py-2.5 text-center text-xs sm:text-sm flex items-center justify-center gap-2"
    >
      <WifiOff className="w-4 h-4 shrink-0 text-[#E5CFA0]" aria-hidden="true" />
      <span>You appear to be offline. Changes will not save until your connection returns.</span>
    </div>
  );
}

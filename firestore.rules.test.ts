/**
 * Phase 0 Dirty Dozen & Multi-Tenant Security Rule Verification Blueprint
 * Run against Firebase Local Emulator Suite (@firebase/rules-unit-testing)
 * when verifying rules locally before production deploy.
 */
export interface RuleTestCase {
  id: string;
  description: string;
  expected: 'ALLOW' | 'PERMISSION_DENIED';
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  path: string;
  auth: { email: string; email_verified: boolean } | null;
}

export const DIRTY_DOZEN_CASES: RuleTestCase[] = [
  {
    id: 'DD-01',
    description: 'Shadow field injection (isVip: true) on RSVP create',
    expected: 'PERMISSION_DENIED',
    operation: 'create',
    path: 'weddings/demo/rsvps/unguessable12345678',
    auth: null,
  },
  {
    id: 'DD-02',
    description: 'Spoofed unverified super admin email reading /weddings',
    expected: 'PERMISSION_DENIED',
    operation: 'list',
    path: 'weddings',
    auth: { email: 'jbackup025@gmail.com', email_verified: false },
  },
  {
    id: 'DD-03',
    description: 'Client write to public/progress total',
    expected: 'PERMISSION_DENIED',
    operation: 'update',
    path: 'weddings/demo/public/progress',
    auth: { email: 'couple@example.com', email_verified: true },
  },
  {
    id: 'DD-04',
    description: 'Direct browser confirmation of a contribution',
    expected: 'PERMISSION_DENIED',
    operation: 'update',
    path: 'weddings/demo/contributions/contrib123',
    auth: { email: 'couple@example.com', email_verified: true },
  },
  {
    id: 'DD-05',
    description: 'Unauthenticated guest attempting to list RSVPs',
    expected: 'PERMISSION_DENIED',
    operation: 'list',
    path: 'weddings/demo/rsvps',
    auth: null,
  },
  {
    id: 'DD-06',
    description: 'Guest reading unapproved blessing',
    expected: 'PERMISSION_DENIED',
    operation: 'get',
    path: 'weddings/demo/blessings/hiddenBlessing1',
    auth: null,
  },
  {
    id: 'DD-07',
    description: 'Guest writing RSVP to SUSPENDED or expired wedding',
    expected: 'PERMISSION_DENIED',
    operation: 'create',
    path: 'weddings/suspended-wedding/rsvps/unguessable12345678',
    auth: null,
  },
  {
    id: 'DD-08',
    description: 'Couple admin trying to change wedding status or add another admin',
    expected: 'PERMISSION_DENIED',
    operation: 'update',
    path: 'weddings/demo',
    auth: { email: 'couple@example.com', email_verified: true },
  },
  {
    id: 'DD-09',
    description: 'Cross-tenant admin of wedding-a reading wedding-b RSVPs',
    expected: 'PERMISSION_DENIED',
    operation: 'list',
    path: 'weddings/wedding-b/rsvps',
    auth: { email: 'admin-of-a@example.com', email_verified: true },
  },
  {
    id: 'DD-10',
    description: 'Guest creating RSVP with short predictable ID (<16 chars)',
    expected: 'PERMISSION_DENIED',
    operation: 'create',
    path: 'weddings/demo/rsvps/123',
    auth: null,
  },
  {
    id: 'DD-11',
    description: 'Couple admin uploading oversized >100KB logo asset',
    expected: 'PERMISSION_DENIED',
    operation: 'create',
    path: 'weddings/demo/assets/logo_1',
    auth: { email: 'couple@example.com', email_verified: true },
  },
  {
    id: 'DD-12',
    description: 'Guest submitting out-of-range contribution (>Rs 1,00,000) or confirmed status',
    expected: 'PERMISSION_DENIED',
    operation: 'create',
    path: 'weddings/demo/contributions/contrib999',
    auth: null,
  },
];

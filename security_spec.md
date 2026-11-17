# MANAM.in Security Specification (Phase 0)

## 1. Data Invariants
1. **Super Admin Exclusivity**: Only `jbackup025@gmail.com` with `email_verified == true` may read/write root `weddings/{slug}` lifecycle fields, manage `admins`, read `reservedSlugs` or `platformAuditLog`, or invoke `/api/super/*`.
2. **Tenant Isolation**: A couple admin in `weddings/{slugA}/admins/{email}` can never read or mutate `weddings/{slugB}` or any of its subcollections.
3. **Lifecycle & Expiry Gate**: Public reads (`public/site`, `public/progress`, `assets`, approved `blessings`) and public writes (`rsvps`, `contributions`, pending `rsvp` `blessings`) fail with `PERMISSION_DENIED` whenever `status != 'ACTIVE'` or `expiresAt <= request.time`.
4. **Server-Authoritative Totals**: `weddings/{slug}/public/progress`, `contributions` status/amount updates, `auditLogs`, `platformAuditLog`, and `reservedSlugs` are strictly non-writable from the browser (`allow write: if false`).
5. **PII Isolation**: Guests can never `list` `rsvps`, `contributions`, or `auditLogs`, and can only `get` or `update` their own RSVP via its unguessable >= 16-char ID while ACTIVE and before the RSVP deadline.
6. **Immutability & Anti-Shadow-Write**: Every create/update validates `keys().hasAll(...) && keys().hasOnly(...)`, strict types, `.size()` bounds, and server timestamps (`request.time`).

## 2. The "Dirty Dozen" Adversarial Payloads (Must All Return PERMISSION_DENIED)
1. **Shadow Field Injection on RSVP**: Guest creates RSVP with extra field `{ ..., isVip: true }`.
2. **Spoofed Unverified Super Admin**: Request claims `email == 'jbackup025@gmail.com'` with `email_verified == false`.
3. **Client Tampering with Progress**: Guest or couple admin attempts `setDoc` on `weddings/{slug}/public/progress` with `{ confirmedTotalPaise: 99999900 }`.
4. **Direct Contribution Confirmation**: Couple admin or guest attempts `updateDoc` on `weddings/{slug}/contributions/{id}` setting `{ status: 'confirmed' }`.
5. **Public List of RSVPs**: Guest calls `getDocs(collection(db, 'weddings/{slug}/rsvps'))`.
6. **Public Read of Unapproved Blessing**: Guest queries `blessings` with `where('approved', '==', false)` or calls `getDoc` on an unapproved blessing.
7. **Expired/Suspended Wedding Write**: Guest creates an RSVP or contribution on a wedding whose `status == 'SUSPENDED'` or `expiresAt < request.time`.
8. **Couple Admin Privilege Escalation**: Couple admin updates `weddings/{slug}` to change `status: 'ACTIVE'` or `expiresAt`, or writes to `weddings/{slug}/admins/{attacker}`.
9. **Cross-Tenant Admin Read**: Admin of `wedding-a` attempts `getDocs` on `weddings/wedding-b/rsvps`.
10. **Short / Predictable RSVP ID**: Guest attempts `setDoc` on `weddings/{slug}/rsvps/1` (length < 16).
11. **Oversized Asset / Denial-of-Wallet**: Couple admin uploads a logo asset > 100 KB (`bytes > 102400` or `dataUrl.size() > 140000`) or invalid `kind`.
12. **Client-Forged Timestamp / Out-of-Range Contribution**: Guest creates a contribution with `amountPaise: 999999999` (> ₹1,00,000) or `status: 'confirmed'` or forged `createdAt`.

# Short URL Codes

## Overview

Replace full UUIDs in URLs with 8-character lowercase alphanumeric codes (a-z, 0-9). A `short_codes` lookup table maps codes to UUIDs, so the database schema stays entirely UUID-based. All URL-facing routes get shorter, cleaner URLs — especially voter URLs printed as QR codes.

**Before:** `/vote/a1b2c3d4-e5f6-7890-abcd-ef1234567890/f9e8d7c6-b5a4-3210-fedc-ba0987654321`
**After:** `/vote/xk9mr2pq/yt3nb7wz`

## Design Decisions

**8-char case-insensitive alphanumeric** (36^8 ≈ 2.8 trillion combinations). Case-insensitive avoids issues with printed URLs, SMS normalization, and manual entry. Stored and displayed as lowercase.

**Separate lookup table** rather than adding columns to existing tables. Voter short codes must exist before the voter record does (created at QR generation time, voter record created lazily on first visit). A single table also keeps the pattern consistent across all ID types.

**Table design:**
```sql
short_codes (
  code TEXT PRIMARY KEY,              -- 8-char a-z0-9
  target_type TEXT NOT NULL,          -- 'event', 'voter', 'manage', 'brewer'
  target_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
)
INDEX ON (target_type, target_id)     -- reverse lookup: "what's the code for this event?"
```

**target_id meanings by type:**
- `event` → `events.id` (used in `/vote/`, `/results/`, `/admin/events/`)
- `voter` → voter UUID (used in `/vote/`, may not yet exist in `voters` table)
- `manage` → `events.id` (used in `/manage/`, replaces manage_token lookup)
- `brewer` → `beers.id` (used in `/feedback/`, skips brewer_tokens indirection)

**No backward compatibility.** Pre-production; existing QR cards can be reprinted.

**Short code creation points:**
- Event creation → generate `event` + `manage` codes (admin page)
- Beer creation → generate `brewer` code (manage page server action + admin beer subscription)
- QR generation → batch generate `voter` codes (admin page)

## Files to Modify

**New files:**
- `src/lib/short-codes.ts` — generate/resolve utility
- `supabase/migrations/NNN_short_codes.sql` — table, RLS, grants, backfill

**Route renames (folder + all files inside):**
- `src/routes/vote/[event_id]/[voter_uuid]/` → `src/routes/vote/[event_code]/[voter_code]/`
- `src/routes/manage/[manage_token]/` → `src/routes/manage/[code]/`
- `src/routes/feedback/[brewer_token]/` → `src/routes/feedback/[code]/`
- `src/routes/results/[event_id]/` → `src/routes/results/[code]/`
- `src/routes/admin/events/[id]/` → `src/routes/admin/events/[code]/`

**Modified files:**
- `src/routes/vote/[event_code]/[voter_code]/+page.server.ts` — resolve codes to UUIDs
- `src/routes/vote/[event_code]/[voter_code]/+page.svelte` — update results redirect URL
- `src/routes/manage/[code]/+page.server.ts` — resolve code to event_id, create brewer short code on beer add
- `src/routes/feedback/[code]/+page.server.ts` — resolve code to beer_id
- `src/routes/results/[code]/+page.server.ts` — resolve code to event_id
- `src/routes/admin/events/[code]/+page.server.ts` — resolve code, load short codes for display
- `src/routes/admin/events/[code]/+page.svelte` — use short codes in URL construction (manage, feedback, results, voter URLs)
- `src/routes/admin/+page.svelte` — use event short codes in links
- `src/routes/admin/+page.server.ts` — load event short codes, create codes on event creation
- `src/lib/types.ts` — add ShortCode type
- `src/lib/database.types.ts` — add short_codes table type

## Tasks

### Task 1: Create short_codes table and utility functions
- **What**: Migration SQL + `$lib/short-codes.ts`
- **Migration**: Create table, index, RLS (public SELECT, anon+authenticated INSERT), grants
- **Utility**: `generateShortCode()` (8-char a-z0-9 via `crypto.getRandomValues`), `resolveShortCode(supabase, code, targetType)` helper
- **Backfill**: Generate codes for all existing events (type `event` + `manage`) and beers (type `brewer`). Use a Postgres function for in-SQL generation.
- **Types**: Add `ShortCode` type to `types.ts`, add table to `database.types.ts`
- **Acceptance criteria**: Table exists, backfill populates codes for existing data, utility functions work

### Task 2: Update event creation and admin event list
- **What**: When admin creates an event, also insert `event` + `manage` short codes. Admin event list links use short codes.
- **Files**: `src/routes/admin/+page.server.ts`, `src/routes/admin/+page.svelte`
- **Acceptance criteria**: New events get short codes. Event list links use `/admin/events/{code}`.

### Task 3: Update admin event detail route
- **What**: Rename `[id]` → `[code]`, resolve short code in loader, load all relevant short codes (event, manage, brewer) for URL display.
- **Files**: `src/routes/admin/events/[code]/+page.server.ts`, `src/routes/admin/events/[code]/+page.svelte`
- **Acceptance criteria**: Admin event detail page works via short code URL. Manage URL, feedback URLs, results URL, and test voter URL all display with short codes.

### Task 4: Update QR generation to use short codes
- **What**: Generate voter short codes alongside UUIDs, batch-insert into `short_codes` table, build QR URLs with short codes for both event and voter segments.
- **Files**: `src/routes/admin/events/[code]/+page.svelte` (QR generation functions)
- **Acceptance criteria**: Generated QR codes encode URLs like `/vote/{event_code}/{voter_code}`. Short codes stored in DB.

### Task 5: Update voter route
- **What**: Rename `[event_id]/[voter_uuid]` → `[event_code]/[voter_code]`, resolve both codes in loader, redirect to results using event short code.
- **Files**: `src/routes/vote/[event_code]/[voter_code]/+page.server.ts`, `+page.svelte`
- **Acceptance criteria**: Voter page loads via short code URL. Results redirect uses event short code.

### Task 6: Update manage, feedback, and results routes
- **What**: Rename route folders, resolve short codes in loaders.
- **Files**:
  - `src/routes/manage/[code]/+page.server.ts` — resolve manage code → event_id. On beer add, create brewer short code.
  - `src/routes/feedback/[code]/+page.server.ts` — resolve brewer code → beer_id (skip brewer_tokens lookup)
  - `src/routes/results/[code]/+page.server.ts` — resolve event code → event_id
- **Acceptance criteria**: All three routes work via short code URLs. New beers get brewer short codes.

### Task 7: Update documentation
- **What**: Update CLAUDE.md route table and any references to URL structure.
- **Acceptance criteria**: Docs reflect new URL patterns.

## Open Questions

1. **manage_token column**: After this change, `events.manage_token` is no longer used for URLs. It could be dropped in a future cleanup migration, but leaving it for now avoids a breaking schema change.
2. **brewer_tokens table**: Similarly, the brewer_tokens indirection is bypassed (short code → beer_id directly). The table and trigger still exist but the URL no longer routes through them. Future cleanup candidate.

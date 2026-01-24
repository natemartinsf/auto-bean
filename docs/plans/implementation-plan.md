# People's Choice Beer Voting - Implementation Plan

## Overview

A SvelteKit + Supabase app for homebrew competition voting. Voters get QR cards with unique UUIDs, allocate points across beers (configurable per event, default 5), and results are revealed live at the awards ceremony.

## Design Decisions

### Styling

Tailwind CSS, no component library. The UI is simple (forms, lists, buttons) and doesn't warrant the overhead of DaisyUI or similar. Mobile-first with large touch targets for the voter interface.

### UI Development Approach

**Look and Feel**: Defined collaboratively before building UI components. Goal: fun, easy to use, not obviously "AI-generated". Color scheme, typography, and visual style locked in before implementation.

### Authentication & Authorization

- **Voters**: UUID-in-URL authentication (`/vote/[event_id]/[voter_uuid]`). No login required. Voter records created lazily on first page load.
- **Tap Volunteers**: Event-scoped manage token in URL (`/manage/[manage_token]`). Can add beers but not access admin functions.
- **Admins**: Supabase email/password auth. `admins` table tracks authorized users. First admin seeded via Supabase dashboard, subsequent admins invited from UI.

### Route Structure

| Route | Purpose | Auth |
|-------|---------|------|
| `/vote/[event_id]/[voter_uuid]` | Voter point allocation | UUID in URL |
| `/manage/[manage_token]` | Tap volunteer beer entry | Token in URL |
| `/admin` | Event/beer management, QR generation | Supabase session |
| `/results/[event_id]` | Public leaderboard (when revealed) | None |
| `/feedback/[brewer_token]` | Brewer's feedback view | Token in URL |
| `/login` | Admin authentication | None |

### Real-time Strategy

- **Beer list (voters)**: Supabase subscription - new beers appear without refresh
- **Results reveal**: Supabase subscription on `events.reveal_stage` - staged ceremony with admin-controlled timing
- **Admin vote totals**: Polling every 10 seconds - simpler than aggregating subscriptions

### Brewer Tokens

Auto-created when a beer is added. Admin sees all brewer feedback URLs in the admin interface and distributes manually post-event.

### QR Code Generation

Built into admin UI. Admin enters count, system generates voter UUIDs, outputs printable HTML sheet (12 cards/page). Replaces the CLI script.

### Staged Results Reveal

Admin controls the awards ceremony timing manually with sequential button clicks:
- **Stage 0**: Hidden (voting active)
- **Stage 1**: Ceremony started (voters redirected, summary displayed: # beers, # voters, total points)
- **Stage 2**: 3rd place revealed
- **Stage 3**: 2nd place revealed
- **Stage 4**: 1st place revealed with confetti

This replaces the original `results_visible` boolean toggle. The staged approach lets the admin build suspense during the live ceremony rather than revealing everything at once. Reset returns to stage 0 (no backwards stepping through stages).

## Database Schema

```sql
-- Events
events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  date DATE,
  max_points INTEGER DEFAULT 5,
  reveal_stage INTEGER DEFAULT 0,  -- 0=hidden, 1=ceremony, 2=3rd, 3=2nd, 4=1st
  manage_token UUID UNIQUE DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW()
)

-- Voters (created lazily from QR code URLs)
voters (
  id UUID PRIMARY KEY,  -- From QR code, not auto-generated
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
)

-- Beers
beers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  brewer TEXT NOT NULL,
  style TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
)

-- Votes
votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  voter_id UUID REFERENCES voters(id) ON DELETE CASCADE,
  beer_id UUID REFERENCES beers(id) ON DELETE CASCADE,
  points INTEGER CHECK (points >= 0),  -- Upper bound enforced in app (event.max_points)
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(voter_id, beer_id)
)

-- Feedback
feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  voter_id UUID REFERENCES voters(id) ON DELETE CASCADE,
  beer_id UUID REFERENCES beers(id) ON DELETE CASCADE,
  notes TEXT,
  share_with_brewer BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(voter_id, beer_id)
)

-- Brewer feedback tokens (auto-created with each beer)
brewer_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  beer_id UUID REFERENCES beers(id) ON DELETE CASCADE UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
)

-- Admin users
admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
)

-- Event-admin assignments (admins only see assigned events)
event_admins (
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  admin_id UUID REFERENCES admins(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (event_id, admin_id)
)
```

## File Structure

```
src/
├── lib/
│   ├── supabase.ts              # Client initialization
│   ├── types.ts                 # TypeScript types
│   └── components/
│       ├── BeerCard.svelte      # Beer display with vote controls
│       ├── PointPicker.svelte   # Point selector (0 to max_points)
│       ├── Leaderboard.svelte   # Results display
│       └── AddBeerForm.svelte   # Beer entry form
├── routes/
│   ├── +layout.svelte
│   ├── +page.svelte             # Landing/redirect
│   ├── login/
│   │   └── +page.svelte
│   ├── vote/
│   │   └── [event_id]/
│   │       └── [voter_uuid]/
│   │           ├── +page.svelte
│   │           └── +page.server.ts
│   ├── manage/
│   │   └── [manage_token]/
│   │       ├── +page.svelte
│   │       └── +page.server.ts
│   ├── admin/
│   │   ├── +layout.svelte       # Auth guard
│   │   ├── +layout.server.ts
│   │   ├── +page.svelte         # Event list
│   │   └── [event_id]/
│   │       └── +page.svelte     # Event detail/management
│   ├── results/
│   │   └── [event_id]/
│   │       └── +page.svelte
│   └── feedback/
│       └── [brewer_token]/
│           └── +page.svelte
```

---

## Tasks

### Phase 1: Foundation

#### Task 1.1: Supabase Project Setup ✅
- **What**: Create Supabase project, configure auth settings, create all database tables with RLS policies
- **Acceptance criteria**:
  - All tables exist with correct schema (including event_admins junction table)
  - RLS enabled: voters can only read/write their own votes, admins can only access assigned events (via event_admins), public can read beers/events
  - Auth configured for email/password signup

#### Task 1.2: SvelteKit Project Scaffolding ✅
- **What**: Initialize SvelteKit project with TypeScript, install dependencies, configure Supabase client, set up git/GitHub
- **Acceptance criteria**:
  - `npm run dev` starts successfully
  - Tailwind CSS installed and configured
  - Supabase client initialized in `src/lib/supabase.ts`
  - TypeScript types defined in `src/lib/types.ts` matching schema
  - Basic `+layout.svelte` with minimal styling
  - Environment variables configured (`.env.example` provided)
  - Git initialized with `.gitignore` (node_modules, .env, .svelte-kit, etc.)
  - GitHub repo created and initial commit pushed

#### Task 1.3: Vercel Deployment Setup ✅
- **What**: Connect GitHub repo to Vercel, configure environment variables
- **Acceptance criteria**:
  - Vercel project created and linked to GitHub repo
  - Environment variables configured (Supabase URL, anon key)
  - Auto-deploy on push to main branch
  - Production URL accessible (even if just showing default SvelteKit page)

#### Task 1.4: Define Look and Feel ✅
- **What**: Collaboratively define visual style before building UI
- **Acceptance criteria**:
  - Color palette chosen (primary, secondary, accent, backgrounds, text)
  - Typography selected (font family, size scale)
  - Visual style defined (fun, approachable, not "AI-looking")
  - Example elements mocked up (buttons, cards, inputs)
  - Design tokens documented in Tailwind config or CSS variables

### Phase 2: Admin Authentication

#### Task 2.1: Login Page ✅
- **What**: Create `/login` route with email/password form, handle Supabase auth
- **Acceptance criteria**:
  - Login form with email/password fields
  - Error display for invalid credentials
  - Redirects to `/admin` on success
  - "Sign up" link for new admin registration

#### Task 2.2: Admin Layout with Auth Guard ✅
- **What**: Create `/admin/+layout.server.ts` that checks session and admin status
- **Acceptance criteria**:
  - Unauthenticated users redirected to `/login`
  - Authenticated non-admins see "not authorized" message
  - Admin layout includes logout button
  - Session persists across page reloads

#### Task 2.3: Admin Management ✅
- **What**: UI for managing who can log into the system (global admin list)
- **Acceptance criteria**:
  - List of all admins in system
  - "Add Admin" form (email input)
  - New admin record created in `admins` table
  - Remove button for each admin (except self)
  - Cannot remove self (prevents lockout)
  - Note: Event-specific access managed in Task 3.2

#### Task 2.4: Auth Callback & Password Setup - Added, Not Started
- **What**: Create `/auth/callback` route to handle email invitation and password reset flows
- **Priority**: Non-blocking — existing admin account works for testing. Complete before production use with multiple admins.
- **Acceptance criteria**:
  - Route exchanges URL hash tokens for session via `supabase.auth.exchangeCodeForSession()`
  - Detects flow type (invitation vs password reset) from session state
  - Shows password form with confirmation field
  - Password validation (minimum length, match confirmation)
  - On submit: calls `supabase.auth.updateUser({ password })`
  - Success redirects to `/admin`
  - Error states handled (expired link, invalid token, etc.)
  - Login page includes "Forgot password?" link
  - Forgot password flow: sends reset email via `supabase.auth.resetPasswordForEmail()`
- **Configuration note**: Redirect URLs configured in Supabase dashboard (Auth → URL Configuration).

### Phase 3: Event Management

#### Task 3.1: Event List & Creation ✅
- **What**: Admin home page showing assigned events, form to create new event
- **Acceptance criteria**:
  - List of events admin is assigned to (filtered by event_admins)
  - Shows name, date, max points, status (results visible?)
  - "Create Event" form (name required; date optional; max_points with default 5)
  - Creator auto-assigned to new event
  - Click event to navigate to detail page
  - Delete event button with confirmation (only if assigned)

#### Task 3.2: Event Detail Page ✅
- **What**: Admin view for managing a single event
- **Acceptance criteria**:
  - Shows event name, date, manage URL (copyable)
  - Lists all beers for this event
  - Delete beer button with confirmation
  - "Reveal Results" toggle
  - Link to results page
  - List of admins assigned to this event
  - Add/remove admins from event (select from existing admins)
  - Cannot remove self if only assigned admin

### Phase 4: Beer Management

#### Task 4.1: Manage Page (Tap Volunteers) ✅
- **What**: `/manage/[manage_token]` route for adding beers
- **Acceptance criteria**:
  - Validates manage_token, shows error if invalid
  - "Add Beer" form (name, brewer required; style optional)
  - Beer list for this event (read-only, no delete)
  - Auto-creates `brewer_token` record when beer added
  - Real-time updates when other volunteers add beers

#### Task 4.2: Brewer Feedback URLs in Admin ✅
- **What**: Display brewer feedback URLs in admin event detail
- **Acceptance criteria**:
  - Each beer shows its feedback URL
  - Copy button for each URL
  - URLs grouped by brewer if multiple beers from same brewer

### Phase 5: Voter Experience

#### Task 5.1: Voter Page - Basic Display ✅
- **What**: `/vote/[event_id]/[voter_uuid]` shows beer list
- **Acceptance criteria**:
  - Validates event_id exists
  - Creates voter record via upsert on load
  - Displays all beers for the event
  - Shows voting UI while `reveal_stage = 0`

#### Task 5.2: Point Allocation Component ✅
- **What**: `PointPicker.svelte` for selecting points
- **Acceptance criteria**:
  - Takes `max` prop (from event.max_points)
  - Visual picker (buttons or slider) for 0 to max
  - Current selection highlighted
  - Disabled state for when total points reached
  - Emits change event with new value

#### Task 5.3: Vote Persistence ✅
- **What**: Save votes to database, load existing votes on page load
- **Acceptance criteria**:
  - Votes saved on change (upsert to votes table)
  - Existing votes loaded and displayed on page load
  - Header shows "X of {max_points} points used" (reads from event)
  - Cannot allocate more than event's max_points total (UI prevents it)
  - Server-side validation rejects votes exceeding max_points (sums voter's points for event, rejects if over)
  - Returns clear error message if validation fails

#### Task 5.4: Feedback Form ✅
- **What**: Notes field and "share with brewer" checkbox per beer
- **Acceptance criteria**:
  - Text area for notes (optional)
  - Checkbox for "share with brewer"
  - Saves to feedback table on change
  - Loads existing feedback on page load

#### Task 5.5: Real-time Beer List ✅
- **What**: Subscribe to beer additions so new beers appear live
- **Acceptance criteria**:
  - New beers added by tap volunteers appear without refresh
  - No duplicate subscriptions on navigation

### Phase 6: Results & Reveal

#### Task 6.1: Database Migration - Staged Reveal ✅
- **What**: Replace `results_visible` boolean with `reveal_stage` integer
- **Acceptance criteria**:
  - Migration adds `reveal_stage INTEGER DEFAULT 0` to events table
  - Stage values: 0=hidden, 1=ceremony (summary), 2=3rd place, 3=2nd place, 4=1st place
  - Migration sets `reveal_stage = 4` for any events where `results_visible = true` (preserve existing state)
  - Migration drops `results_visible` column
  - TypeScript types updated (`Event.reveal_stage: number` replaces `results_visible: boolean`)

#### Task 6.2: Admin Staged Reveal UI ✅
- **What**: Replace results toggle with sequential ceremony buttons
- **Acceptance criteria**:
  - Shows current stage status (Hidden / Ceremony / 3rd Revealed / 2nd Revealed / 1st Revealed)
  - Single button advances to next stage with sequential text:
    - Stage 0: "Start Ceremony" → advances to 1
    - Stage 1: "Reveal 3rd Place" → advances to 2
    - Stage 2: "Reveal 2nd Place" → advances to 3
    - Stage 3: "Reveal 1st Place" → advances to 4
    - Stage 4: button disabled or hidden (ceremony complete)
  - "Reset" button appears when stage > 0, returns to stage 0 with confirmation
  - Updates database in real-time

#### Task 6.3: Results Page with Staged Display ✅
- **What**: `/results/[event_id]` showing staged leaderboard controlled by admin
- **Acceptance criteria**:
  - Stage 0: Shows "Results not yet revealed" (or redirects to event page)
  - Stage 1+: Shows ceremony summary (number of beers, number of voters, total points cast)
  - Stage 2+: 3rd place revealed with entrance animation
  - Stage 3+: 2nd place revealed with entrance animation
  - Stage 4: 1st place revealed with confetti (canvas-confetti or similar)
  - Rest of rankings (4th place onward) shown after 1st place reveal
  - Shows beer name, brewer, total points, number of voters
  - Large text, styled for projection/big screen viewing
  - Subscribes to `reveal_stage` changes for real-time updates

#### Task 6.4: Voter Redirect on Ceremony Start ✅
- **What**: Voter page subscribes to `reveal_stage`, redirects when ceremony starts
- **Acceptance criteria**:
  - Voter page shows voting UI while `reveal_stage = 0`
  - When admin advances to stage 1+, voter page redirects to `/results/[event_id]`
  - Redirect is immediate (real-time subscription)
  - All connected voters redirect simultaneously

#### Task 6.5: Admin Live Vote Totals ✅
- **What**: Admin event detail shows current vote totals
- **Acceptance criteria**:
  - Per-beer: total points, number of voters who rated
  - Refreshes via polling (10-second interval)
  - Manual refresh button

### Phase 7: QR Code Generation

#### Task 7.1: QR Generation UI
- **What**: Admin can generate voter QR codes for an event
- **Acceptance criteria**:
  - "Generate QR Codes" button on event detail page
  - Input for count (default 100)
  - Generates UUIDs client-side
  - Outputs printable HTML (opens in new tab or downloads)
  - 12 cards per page, 3x4 grid, dashed borders
  - Each card: QR code, card number, scan instructions

#### Task 7.2: Customize QR Card Design (Future)
- **What**: Enhance QR code cards with more customization
- **Ideas**:
  - Add event name/logo to cards
  - Custom colors/branding options
  - Add logo to QR code center (qr-code-styling supports this)
  - Different card layouts

#### Task 7.3: Remove CLI Script
- **What**: Delete `scripts/generate-voter-qrcodes.js`, update docs
- **Acceptance criteria**:
  - Script removed
  - README/CLAUDE.md updated to reference admin UI instead

### Phase 8: Brewer Feedback View

#### Task 8.1: Feedback Page
- **What**: `/feedback/[brewer_token]` shows feedback for that beer
- **Acceptance criteria**:
  - Validates brewer_token, shows error if invalid
  - Shows beer name, brewer, style
  - Lists all feedback where share_with_brewer is true
  - Feedback is anonymous (no voter info shown)
  - Graceful empty state if no feedback shared
  - Real-time subscription: new feedback appears live as voters submit

---

## Open Questions

1. **First admin bootstrap**: Need to manually insert first admin record via Supabase dashboard after first user signs up. Document this in README.

2. **Event archival**: No archive/soft-delete for events currently. If needed, add `archived` boolean later.

3. **Duplicate brewer handling**: If same brewer has multiple beers, they get multiple feedback URLs. Could consolidate in future, but keeping simple for now.

# People's Choice Beer Voting App

## Project Overview

A lightweight voting application for the Bay Area Mashers homebrew competition finals party. Attendees vote for their favorite beers on tap using a simple point allocation system, with results revealed live at the awards ceremony.

## Core Concept

Replaces the traditional "bean voting" system (5 beans per person, drop in bags) with a digital equivalent. Each voter gets 5 points to allocate across any beers they've tried. Points can be concentrated on one favorite or spread across multiple beers.

## Technical Stack

| Component | Technology |
|-----------|------------|
| Frontend | SvelteKit |
| Hosting | Vercel |
| Backend/Database | Supabase (PostgreSQL) |
| Real-time | Supabase Subscriptions |

## Authentication Model

**Voters:** UUID-based URL authentication (no login required)
- Pre-generate ~100 unique voter URLs
- Each URL contains an unguessable UUID
- Votes stored server-side, persist across page reloads
- Security through obscurity is sufficient for this low-stakes, short-duration event

**Admin:** Supabase session authentication with Row Level Security
- Proper login for beer management
- RLS policies protect admin functions
- Can view aggregate vote totals in real-time

## Data Model

### Tables

**events**
- `id` (UUID, primary key)
- `name` (text, required)
- `date` (date, optional)
- `results_visible` (boolean, default false)
- `created_at` (timestamp)

**voters**
- `id` (UUID, primary key)
- `event_id` (UUID, foreign key)
- `created_at` (timestamp)

**beers**
- `id` (UUID, primary key)
- `event_id` (UUID, foreign key)
- `name` (text, required)
- `brewer` (text, required)
- `style` (text, optional)
- `created_at` (timestamp)

**votes**
- `id` (UUID, primary key)
- `voter_id` (UUID, foreign key)
- `beer_id` (UUID, foreign key)
- `points` (integer, 0-5)
- `updated_at` (timestamp)

**feedback**
- `id` (UUID, primary key)
- `voter_id` (UUID, foreign key)
- `beer_id` (UUID, foreign key)
- `notes` (text)
- `share_with_brewer` (boolean, default false)
- `created_at` (timestamp)

## User Interface

### Voter View

Simple list of all available beers, each with:
- Beer name and brewer (style if provided)
- Point allocation picker (0-5)
- Optional notes text area
- "Share feedback with brewer" checkbox

Header displays:
- Running total of points allocated (e.g., "3 of 5 points used")
- Warning if trying to exceed 5 points

### Beer Management View

Accessed via magic URL generated from the admin page (shareable with tap volunteers):
- Scoped to a specific event
- Quick "Add Beer" button with minimal form (name + brewer required, style optional)
- List of current beers for that event

### Admin View

Session-authenticated access:

**Event Management:**
- List of all events
- Add new event (name, optional date)
- Delete event (with confirmation)
- Select event to manage

**Selected Event Functions:**
- Delete beer option (with confirmation)
- Generate beer management URL for this event
- Live vote totals per beer
- Number of voters who rated each beer
- "Reveal Results" button to switch all voter views to leaderboard
- Generate QR codes for this event

### Results View

When admin triggers results reveal:
- All voter clients receive real-time update
- View switches to leaderboard showing final rankings
- Dramatic reveal for awards ceremony

## QR Code Distribution

- Pre-generate 100 unique voter URLs
- Print QR codes on individual cards
- Hand out cards at event check-in
- Each card = one voter's persistent session

Example URL format: `https://yourapp.vercel.app/vote/{event_id}/{voter_uuid}`

### Generation Approach: Lazy Creation

UUIDs are generated offline without database connection. Voter records are created on first page load using upsert:

```javascript
// In SvelteKit load function
const { data: voter } = await supabase
  .from('voters')
  .upsert({ id: params.voter_uuid, event_id: params.event_id })
  .select()
  .single()
```

### QR Code Generator Script

See `generate-voter-qrcodes.js` - a standalone Node.js script that:

**Usage:**
```bash
npm install qrcode uuid
node generate-voter-qrcodes.js 100 https://beervote.vercel.app {event_id}
```

**Output:**
- `./qrcodes/voter-cards.html` - Printable sheet (12 cards per page, fits letter size)
- `./qrcodes/voter-urls.csv` - Reference list of all URLs
- `./qrcodes/individual/*.png` - Individual QR code images

**Card Layout:**
- 3 columns × 4 rows per page
- Includes club branding, card number, and scan instructions
- Dashed borders for easy cutting

## Brewer Feedback Feature

After the event:
- Generate unique URL per brewer
- Shows all feedback marked "share with brewer"
- Anonymous feedback (no voter identification)
- Provides valuable recipe/brewing insights

## Implementation Notes

**Vote Aggregation:**
- For ~100 voters, frontend aggregation is sufficient
- Could add a database view for cleaner queries if desired

**Real-time Updates:**
- Supabase subscriptions for beer list changes (new beers added)
- Subscription on `results_visible` flag for simultaneous reveal
- Polling acceptable as fallback

**Mobile-First Design:**
- Primary use case is phone browsers
- Large touch targets for point allocation
- Simple, fast interactions

## Weekend Build Scope

**Day 1:**
- Supabase project setup and schema
- SvelteKit project scaffolding
- Voter view with point allocation
- Basic beer list display

**Day 2:**
- Admin authentication and beer management
- QR code generation script
- Results view and reveal functionality
- Feedback feature (if time permits)

## Future Enhancements (Post-MVP)

- Beer style categories/filtering
- Historical competition data
- Photo upload for beers
- Integration with club member database

# People's Choice Beer Voting

A simple voting app for homebrew competition finals parties. Attendees scan a QR code to vote for their favorite beers on tap using a point allocation system.

## How It Works

**For Voters:**
1. Pick up a QR card at check-in
2. Scan to open your personal voting page
3. Allocate points across beers you've tried (configurable per event, default 5)
4. Update anytime throughout the party
5. Optionally leave feedback for brewers

**For Organizers:**
1. Create an event in the admin panel
2. Generate and print QR cards
3. Add beers as they go on tap (or give tap volunteers a management link)
4. Hit "Reveal Results" for the awards ceremony

## Tech Stack

- **Frontend:** SvelteKit + Tailwind CSS on Vercel
- **Backend:** Supabase (PostgreSQL + real-time)
- **Auth:** UUID-based URLs for voters, Supabase email/password for admin

## Getting Started

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env.local
# Add your Supabase credentials

# Run locally
npm run dev
```

## Database Setup

### 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Wait for the project to initialize

### 2. Run the Migration

1. Open the Supabase SQL Editor (Database → SQL Editor)
2. Copy the contents of `supabase/migrations/001_initial_schema.sql`
3. Run the query

### 3. Enable Email/Password Auth

1. Go to Authentication → Providers
2. Ensure Email provider is enabled
3. Disable "Confirm email" for easier local development (optional)

### 4. Seed the First Admin

The first admin must be created manually:

1. **Sign up** using the app's login page (creates a user in `auth.users`)
2. **Find your user ID** in Supabase: Authentication → Users → click your user → copy the UID
3. **Insert admin record** in SQL Editor:

```sql
INSERT INTO admins (user_id, email)
VALUES ('your-user-uuid-here', 'your@email.com');
```

After this, you can add more admins through the admin UI.

## Generating QR Codes

QR codes are generated from the admin interface. Select an event, click "Generate QR Codes", enter a count, and download the printable HTML sheet.

## TypeScript Types

Database types are auto-generated from the Supabase schema. After making schema changes:

```bash
# One-time setup (if not already done)
npx supabase login
npx supabase link --project-ref <your-project-ref>

# Regenerate types after schema changes
npm run gen:types
```

The project ref is the subdomain from your Supabase URL (e.g., `abcd1234` from `https://abcd1234.supabase.co`).

## Storage Setup (Event Logos)

Event logos are stored in Supabase Storage. Create the bucket and policies manually:

### 1. Create Storage Bucket

1. Go to Supabase Dashboard → Storage
2. Click "New bucket"
3. Name: `event-logos`
4. Public bucket: **Yes** (logos need public read access)
5. Click "Create bucket"

### 2. Configure Storage Policies

In the bucket settings, add these RLS policies:

**Public Read (SELECT):**
```sql
-- Policy name: "Public read access"
-- Target: SELECT
-- Check expression:
true
```

**Authenticated Upload (INSERT):**
```sql
-- Policy name: "Authenticated users can upload"
-- Target: INSERT
-- Check expression:
(auth.role() = 'authenticated')
```

**Authenticated Delete (DELETE):**
```sql
-- Policy name: "Authenticated users can delete"
-- Target: DELETE
-- Check expression:
(auth.role() = 'authenticated')
```

Note: The admin check is handled at the application level (only admins can access the upload UI).

## Documentation

- `project-spec.md` - Original project specification
- `docs/plans/implementation-plan.md` - Implementation plan and design decisions

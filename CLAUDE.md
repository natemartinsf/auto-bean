# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

People's Choice Beer Voting - a SvelteKit app for homebrew competition voting. Voters get QR cards with unique UUIDs, allocate points across beers (configurable per event), and results are revealed live at the awards ceremony.

## Tech Stack

- **Frontend:** SvelteKit + Tailwind CSS on Vercel
- **Backend:** Supabase (PostgreSQL + real-time subscriptions)
- **Auth:** UUID-based URLs for voters (no login), Supabase email/password for admin

## Development Commands

```bash
npm install          # Install dependencies
npm run dev          # Run dev server (typically localhost:5173)
npm run build        # Build for production
npm run preview      # Preview production build
```

### QR Code Generation

QR codes are generated from the admin UI (no CLI script). Admin selects event, enters count, downloads printable HTML sheet.

## Architecture

### Database Schema (Supabase)

- **events**: id, name, date, max_points, results_visible, manage_token
- **voters**: id (UUID from QR), event_id
- **beers**: id, event_id, name, brewer, style
- **votes**: voter_id, beer_id, points
- **feedback**: voter_id, beer_id, notes, share_with_brewer
- **brewer_tokens**: id (UUID for URL), beer_id
- **admins**: id, user_id, email
- **event_admins**: event_id, admin_id (admins only see assigned events)

### Key Routes (SvelteKit)

- `/vote/[event_id]/[voter_uuid]` - Voter's point allocation interface
- `/admin` - Session-authenticated event/beer management
- `/manage/[manage_token]` - Magic URL for tap volunteers to add beers
- `/results/[event_id]` - Leaderboard (revealed by admin)
- `/feedback/[brewer_token]` - Brewer's feedback view (real-time)

### Auth Model

Voters use UUID-in-URL authentication. No login flow - voter records are created lazily on first page load via upsert:

```javascript
await supabase.from('voters').upsert({ id: voter_uuid, event_id }).select().single()
```

Admin uses Supabase session auth with RLS policies.

### Real-time Features

- Beer list updates via Supabase subscriptions
- Results reveal triggered by admin toggling `results_visible` flag (redirects all voters to results page)
- Brewer feedback page updates live as voters submit feedback
- Admin vote totals use polling (10s interval)

## Design Notes

- Mobile-first (primary use is phone browsers)
- Large touch targets for point allocation
- Tailwind CSS for styling (no component library)
- ~100 voters expected - frontend aggregation is sufficient
- Results reveal has staggered animation (3rd → 2nd → 1st) with confetti

## Documentation

MCP servers are configured in `.mcp.json` for live documentation access:
- **svelte** - Official SvelteKit docs and code analysis (use `mcp-cli tools svelte` to see available tools)
- **tailwind** - Tailwind CSS utilities, docs, and CSS-to-Tailwind conversion

Manual reference:
- SvelteKit: https://svelte.dev/docs/kit
- Tailwind CSS: https://tailwindcss.com/docs

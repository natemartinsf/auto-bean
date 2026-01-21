-- People's Choice Beer Voting - Initial Schema
-- Run this migration in Supabase SQL Editor to set up the database
--
-- SECURITY NOTE: UUID-Based Voter Authentication
-- ============================================================================
-- Voters are identified by UUID in the URL (e.g., /vote/[event_id]/[voter_uuid]).
-- This is "URL-as-auth" - anyone with the URL can vote as that voter.
--
-- Tradeoff: RLS cannot verify voter ownership since voters aren't authenticated.
-- The votes and feedback tables use permissive policies (USING true) because:
--   1. The voter_id is an unguessable UUID from a physical QR card
--   2. ~100 voters per event makes brute-force impractical
--   3. This is a casual homebrew competition, not a high-stakes election
--
-- The app layer validates that voter_id matches the URL parameter, but this
-- is defense-in-depth, not the primary security boundary. The UUID secrecy is.
--
-- If stronger guarantees are needed, consider: session tokens, signed JWTs,
-- or requiring voters to "claim" their card with a PIN.

-- ============================================================================
-- TABLES
-- ============================================================================

-- Events
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  date DATE,
  max_points INTEGER DEFAULT 5,
  results_visible BOOLEAN DEFAULT FALSE,
  manage_token UUID UNIQUE DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Voters (created lazily from QR code URLs)
CREATE TABLE voters (
  id UUID PRIMARY KEY,  -- From QR code, not auto-generated
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Beers
CREATE TABLE beers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  brewer TEXT NOT NULL,
  style TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Votes
CREATE TABLE votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  voter_id UUID REFERENCES voters(id) ON DELETE CASCADE,
  beer_id UUID REFERENCES beers(id) ON DELETE CASCADE,
  points INTEGER CHECK (points >= 0),  -- Upper bound enforced in app (event.max_points)
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(voter_id, beer_id)
);

-- Feedback
CREATE TABLE feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  voter_id UUID REFERENCES voters(id) ON DELETE CASCADE,
  beer_id UUID REFERENCES beers(id) ON DELETE CASCADE,
  notes TEXT,
  share_with_brewer BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(voter_id, beer_id)
);

-- Brewer feedback tokens (auto-created with each beer via trigger)
CREATE TABLE brewer_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  beer_id UUID REFERENCES beers(id) ON DELETE CASCADE UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Admin users
CREATE TABLE admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Event-admin assignments (admins only see assigned events)
CREATE TABLE event_admins (
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  admin_id UUID REFERENCES admins(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (event_id, admin_id)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX idx_voters_event_id ON voters(event_id);
CREATE INDEX idx_beers_event_id ON beers(event_id);
CREATE INDEX idx_votes_voter_id ON votes(voter_id);
CREATE INDEX idx_votes_beer_id ON votes(beer_id);
CREATE INDEX idx_feedback_voter_id ON feedback(voter_id);
CREATE INDEX idx_feedback_beer_id ON feedback(beer_id);
CREATE INDEX idx_brewer_tokens_beer_id ON brewer_tokens(beer_id);
CREATE INDEX idx_event_admins_admin_id ON event_admins(admin_id);
CREATE INDEX idx_event_admins_event_id ON event_admins(event_id);

-- ============================================================================
-- TRIGGER: Auto-create brewer_token when beer is inserted
-- ============================================================================

CREATE OR REPLACE FUNCTION create_brewer_token()
RETURNS TRIGGER
SECURITY DEFINER  -- Required: allows trigger to insert into brewer_tokens when public users insert beers
SET search_path = ''  -- Security: prevent search_path hijacking in SECURITY DEFINER functions
AS $$
BEGIN
  INSERT INTO public.brewer_tokens (beer_id)
  VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_create_brewer_token
  AFTER INSERT ON beers
  FOR EACH ROW
  EXECUTE FUNCTION create_brewer_token();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE voters ENABLE ROW LEVEL SECURITY;
ALTER TABLE beers ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE brewer_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_admins ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS POLICIES: events
-- ============================================================================

-- Public can read events (needed for voter pages)
CREATE POLICY "events_select_public"
  ON events FOR SELECT
  TO public
  USING (true);

-- Admins can insert events (any authenticated admin)
CREATE POLICY "events_insert_admin"
  ON events FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

-- Admins can update/delete only events they're assigned to
CREATE POLICY "events_update_admin"
  ON events FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM event_admins ea
      JOIN admins a ON ea.admin_id = a.id
      WHERE ea.event_id = events.id AND a.user_id = (select auth.uid())
    )
  );

CREATE POLICY "events_delete_admin"
  ON events FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM event_admins ea
      JOIN admins a ON ea.admin_id = a.id
      WHERE ea.event_id = events.id AND a.user_id = (select auth.uid())
    )
  );

-- ============================================================================
-- RLS POLICIES: voters
-- ============================================================================

-- Public can insert voters (lazy creation from QR URL)
CREATE POLICY "voters_insert_public"
  ON voters FOR INSERT
  TO public
  WITH CHECK (true);

-- Public can select voters (needed for upsert to work)
CREATE POLICY "voters_select_public"
  ON voters FOR SELECT
  TO public
  USING (true);

-- ============================================================================
-- RLS POLICIES: beers
-- ============================================================================

-- Public can read beers (voter pages need this)
CREATE POLICY "beers_select_public"
  ON beers FOR SELECT
  TO public
  USING (true);

-- Anyone can insert beers (tap volunteers use manage_token URL, no auth)
-- The manage_token validation happens in the app layer
CREATE POLICY "beers_insert_public"
  ON beers FOR INSERT
  TO public
  WITH CHECK (true);

-- Admins can update/delete beers for events they're assigned to
CREATE POLICY "beers_update_admin"
  ON beers FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM event_admins ea
      JOIN admins a ON ea.admin_id = a.id
      WHERE ea.event_id = beers.event_id AND a.user_id = (select auth.uid())
    )
  );

CREATE POLICY "beers_delete_admin"
  ON beers FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM event_admins ea
      JOIN admins a ON ea.admin_id = a.id
      WHERE ea.event_id = beers.event_id AND a.user_id = (select auth.uid())
    )
  );

-- ============================================================================
-- RLS POLICIES: votes
-- ============================================================================
-- See SECURITY NOTE at top of file re: UUID-based voter auth tradeoffs.
-- App layer validates voter_id matches URL param; RLS permits based on UUID secrecy.

CREATE POLICY "votes_select_own"
  ON votes FOR SELECT
  TO public
  USING (true);

CREATE POLICY "votes_insert_own"
  ON votes FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "votes_update_own"
  ON votes FOR UPDATE
  TO public
  USING (true);

-- Note: No separate admin SELECT policy needed - public read covers admins too

-- ============================================================================
-- RLS POLICIES: feedback
-- ============================================================================
-- See SECURITY NOTE at top of file re: UUID-based voter auth tradeoffs.
-- App layer validates voter_id matches URL param; RLS permits based on UUID secrecy.

CREATE POLICY "feedback_select_own"
  ON feedback FOR SELECT
  TO public
  USING (true);

CREATE POLICY "feedback_insert_public"
  ON feedback FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "feedback_update_own"
  ON feedback FOR UPDATE
  TO public
  USING (true);

-- ============================================================================
-- RLS POLICIES: brewer_tokens
-- ============================================================================

-- Public can read brewer_tokens (for feedback page validation)
-- Note: No separate admin SELECT policy needed - public read covers admins too
CREATE POLICY "brewer_tokens_select_public"
  ON brewer_tokens FOR SELECT
  TO public
  USING (true);

-- Insert handled by trigger (runs as definer)
-- No direct insert policy needed

-- ============================================================================
-- HELPER FUNCTION: Check if current user is an admin (bypasses RLS)
-- ============================================================================
-- Used in RLS policies on the admins table to avoid infinite recursion.
-- SECURITY DEFINER runs as the function owner, bypassing RLS checks.

CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.admins WHERE user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- RLS POLICIES: admins
-- ============================================================================

-- Users can see their own admin record (to check if they're an admin)
-- Admins can see all records (for admin management UI)
-- Uses is_admin() helper to avoid infinite recursion on the "see all" check
CREATE POLICY "admins_select"
  ON admins FOR SELECT
  TO authenticated
  USING (
    user_id = (select auth.uid())
    OR is_admin()
  );

-- Admins can insert new admins
CREATE POLICY "admins_insert_admin"
  ON admins FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

-- Admins can delete other admins (cannot delete self)
CREATE POLICY "admins_delete_admin"
  ON admins FOR DELETE
  TO authenticated
  USING (
    is_admin()
    AND user_id != (select auth.uid())  -- Prevent self-deletion
  );

-- ============================================================================
-- RLS POLICIES: event_admins
-- ============================================================================

-- Admins can see all event_admin assignments (needed for admin management UI)
CREATE POLICY "event_admins_select_admin"
  ON event_admins FOR SELECT
  TO authenticated
  USING (is_admin());

-- Admins can insert event_admin assignments (for assigning admins to events)
CREATE POLICY "event_admins_insert_admin"
  ON event_admins FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

-- Admins can delete event_admin assignments
CREATE POLICY "event_admins_delete_admin"
  ON event_admins FOR DELETE
  TO authenticated
  USING (is_admin());

-- ============================================================================
-- GRANTS
-- ============================================================================
-- RLS policies control which rows are visible, but GRANT controls table access.
-- Both 'anon' (unauthenticated) and 'authenticated' roles need explicit grants.

-- Anonymous access (voters, tap volunteers, public pages)
GRANT SELECT ON events TO anon;                      -- Voter/manage pages read event info
GRANT SELECT, INSERT ON voters TO anon;             -- Lazy voter creation via upsert
GRANT SELECT, INSERT ON voters TO authenticated;    -- Admins testing voter flow
GRANT SELECT, INSERT ON beers TO anon;              -- Voters read, tap volunteers insert
GRANT SELECT, INSERT, UPDATE ON votes TO anon;      -- Voters create/update votes
GRANT SELECT, INSERT, UPDATE ON feedback TO anon;   -- Voters create/update feedback
GRANT SELECT ON brewer_tokens TO anon;              -- Feedback page validation
GRANT SELECT ON brewer_tokens TO authenticated;     -- Admin event detail page

-- Authenticated access (admins)
GRANT SELECT, INSERT, UPDATE, DELETE ON events TO authenticated;
GRANT SELECT, INSERT, DELETE ON beers TO authenticated;
GRANT SELECT ON admins TO authenticated;
GRANT INSERT ON admins TO authenticated;
GRANT DELETE ON admins TO authenticated;
GRANT SELECT ON event_admins TO authenticated;
GRANT INSERT ON event_admins TO authenticated;
GRANT DELETE ON event_admins TO authenticated;

-- ============================================================================
-- ENABLE REALTIME
-- ============================================================================

-- Enable realtime for tables that need live updates
ALTER PUBLICATION supabase_realtime ADD TABLE beers;
ALTER PUBLICATION supabase_realtime ADD TABLE events;
ALTER PUBLICATION supabase_realtime ADD TABLE feedback;

-- Vote validation: Ensure total points per voter doesn't exceed event max_points
-- This trigger runs before INSERT or UPDATE on the votes table

CREATE OR REPLACE FUNCTION validate_vote_total()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_event_id UUID;
  v_max_points INTEGER;
  v_current_total INTEGER;
  v_new_total INTEGER;
BEGIN
  -- Get the event_id for this beer
  SELECT event_id INTO v_event_id
  FROM public.beers
  WHERE id = NEW.beer_id;

  -- Get the max_points for this event
  SELECT max_points INTO v_max_points
  FROM public.events
  WHERE id = v_event_id;

  -- Calculate current total for this voter (excluding the beer being updated)
  SELECT COALESCE(SUM(points), 0) INTO v_current_total
  FROM public.votes v
  JOIN public.beers b ON v.beer_id = b.id
  WHERE v.voter_id = NEW.voter_id
    AND b.event_id = v_event_id
    AND v.beer_id != NEW.beer_id;

  -- Calculate new total
  v_new_total := v_current_total + NEW.points;

  -- Reject if over limit
  IF v_new_total > v_max_points THEN
    RAISE EXCEPTION 'Vote rejected: total points (%) would exceed maximum allowed (%) for this event', v_new_total, v_max_points;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_validate_vote_total
  BEFORE INSERT OR UPDATE ON votes
  FOR EACH ROW
  EXECUTE FUNCTION validate_vote_total();

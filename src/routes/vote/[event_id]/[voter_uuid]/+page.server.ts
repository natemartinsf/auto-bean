import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import type { Event, Beer, Voter } from '$lib/types';

export const load: PageServerLoad = async ({ locals, params }) => {
	const eventId = params.event_id;
	const voterUuid = params.voter_uuid;

	// Validate event exists
	const { data: event, error: eventError } = await locals.supabase
		.from('events')
		.select('*')
		.eq('id', eventId)
		.single();

	if (eventError || !event) {
		throw error(404, 'Event not found');
	}

	// If results are visible, redirect to results page
	if (event.results_visible) {
		throw redirect(303, `/results/${eventId}`);
	}

	// Upsert voter record (creates if doesn't exist)
	const { data: voter, error: voterError } = await locals.supabase
		.from('voters')
		.upsert({ id: voterUuid, event_id: eventId })
		.select()
		.single();

	if (voterError) {
		console.error('Error upserting voter:', voterError);
		throw error(500, 'Failed to register voter');
	}

	// Get beers for this event
	const { data: beers, error: beersError } = await locals.supabase
		.from('beers')
		.select('*')
		.eq('event_id', eventId)
		.order('created_at', { ascending: true });

	if (beersError) {
		console.error('Error fetching beers:', beersError);
	}

	return {
		event: event as Event,
		voter: voter as Voter,
		beers: (beers || []) as Beer[]
	};
};

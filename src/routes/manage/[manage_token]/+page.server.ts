import { fail, error } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import type { Event, Beer } from '$lib/types';

export const load: PageServerLoad = async ({ locals, params }) => {
	const manageToken = params.manage_token;

	// Validate manage_token and get event
	const { data: event, error: eventError } = await locals.supabase
		.from('events')
		.select('*')
		.eq('manage_token', manageToken)
		.single();

	if (eventError || !event) {
		throw error(404, 'Invalid manage link. Please check the URL and try again.');
	}

	// Get beers for this event
	const { data: beers, error: beersError } = await locals.supabase
		.from('beers')
		.select('*')
		.eq('event_id', event.id)
		.order('created_at', { ascending: true });

	if (beersError) {
		console.error('Error fetching beers:', beersError);
	}

	return {
		event: event as Event,
		beers: (beers || []) as Beer[]
	};
};

export const actions: Actions = {
	addBeer: async ({ request, locals, params }) => {
		const manageToken = params.manage_token;

		// Validate manage_token and get event
		const { data: event, error: eventError } = await locals.supabase
			.from('events')
			.select('id')
			.eq('manage_token', manageToken)
			.single();

		if (eventError || !event) {
			return fail(403, { error: 'Invalid manage link' });
		}

		const formData = await request.formData();
		const name = formData.get('name')?.toString().trim();
		const brewer = formData.get('brewer')?.toString().trim();
		const style = formData.get('style')?.toString().trim() || null;

		if (!name) {
			return fail(400, { error: 'Beer name is required' });
		}

		if (!brewer) {
			return fail(400, { error: 'Brewer name is required' });
		}

		// Insert beer (brewer_token auto-created by database trigger)
		const { error: insertError } = await locals.supabase.from('beers').insert({
			event_id: event.id,
			name,
			brewer,
			style
		});

		if (insertError) {
			console.error('Error adding beer:', insertError);
			return fail(500, { error: 'Failed to add beer' });
		}

		return { success: true };
	}
};

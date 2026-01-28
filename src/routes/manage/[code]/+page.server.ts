import { fail, error } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import type { Event, Beer } from '$lib/types';
import { resolveShortCode, generateUniqueShortCode } from '$lib/short-codes';

export const load: PageServerLoad = async ({ locals, params }) => {
	const eventId = await resolveShortCode(locals.supabase, params.code, 'manage');

	if (!eventId) {
		throw error(404, 'Invalid manage link. Please check the URL and try again.');
	}

	// Get event
	const { data: event, error: eventError } = await locals.supabase
		.from('events')
		.select('*')
		.eq('id', eventId)
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
		const eventId = await resolveShortCode(locals.supabase, params.code, 'manage');

		if (!eventId) {
			return fail(403, { error: 'Invalid manage link' });
		}

		const formData = await request.formData();
		const name = formData.get('name')?.toString().trim();
		const brewer = formData.get('brewer')?.toString().trim() || null;
		const style = formData.get('style')?.toString().trim() || null;

		if (!name) {
			return fail(400, { error: 'Beer name is required' });
		}

		// Insert beer (brewer_token auto-created by database trigger)
		const { data: newBeer, error: insertError } = await locals.supabase
			.from('beers')
			.insert({
				event_id: eventId,
				name,
				brewer,
				style
			})
			.select('id')
			.single();

		if (insertError || !newBeer) {
			console.error('Error adding beer:', insertError);
			return fail(500, { error: 'Failed to add beer' });
		}

		// Create brewer short code for the new beer
		const brewerCode = await generateUniqueShortCode(locals.supabase);
		const { error: codeError } = await locals.supabase.from('short_codes').insert({
			code: brewerCode,
			target_type: 'brewer',
			target_id: newBeer.id
		});

		if (codeError) {
			console.error('Error creating brewer short code:', codeError);
		}

		return { success: true };
	}
};

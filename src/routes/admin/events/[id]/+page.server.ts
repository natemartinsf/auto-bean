import { fail, redirect, error } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import type { Event, Beer, Admin } from '$lib/types';

export const load: PageServerLoad = async ({ parent, locals, params }) => {
	const parentData = await parent();

	if (!parentData.isAdmin) {
		throw redirect(303, '/admin');
	}

	const eventId = params.id;
	const currentAdminId = parentData.admin.id;

	// Verify admin is assigned to this event
	const { data: assignment, error: assignmentError } = await locals.supabase
		.from('event_admins')
		.select('event_id')
		.eq('event_id', eventId)
		.eq('admin_id', currentAdminId)
		.single();

	if (assignmentError || !assignment) {
		throw error(403, 'You are not assigned to this event');
	}

	// Get event details
	const { data: event, error: eventError } = await locals.supabase
		.from('events')
		.select('*')
		.eq('id', eventId)
		.single();

	if (eventError || !event) {
		throw error(404, 'Event not found');
	}

	// Get beers for this event with their brewer tokens
	const { data: beers, error: beersError } = await locals.supabase
		.from('beers')
		.select('*, brewer_tokens(id)')
		.eq('event_id', eventId)
		.order('created_at', { ascending: true });

	if (beersError) {
		console.error('Error fetching beers:', beersError);
	}

	// Get vote totals for each beer
	const beerIds = (beers || []).map((b) => b.id);
	let voteTotals: Record<string, { totalPoints: number; voterCount: number }> = {};

	if (beerIds.length > 0) {
		const { data: voteData, error: voteError } = await locals.supabase
			.from('votes')
			.select('beer_id, points, voter_id')
			.in('beer_id', beerIds);

		if (voteError) {
			console.error('Error fetching vote totals:', voteError);
		} else if (voteData) {
			// Aggregate votes by beer_id
			for (const vote of voteData) {
				if (!voteTotals[vote.beer_id]) {
					voteTotals[vote.beer_id] = { totalPoints: 0, voterCount: 0 };
				}
				voteTotals[vote.beer_id].totalPoints += vote.points;
			}
			// Count distinct voters per beer
			const votersByBeer: Record<string, Set<string>> = {};
			for (const vote of voteData) {
				if (!votersByBeer[vote.beer_id]) {
					votersByBeer[vote.beer_id] = new Set();
				}
				votersByBeer[vote.beer_id].add(vote.voter_id);
			}
			for (const beerId of Object.keys(votersByBeer)) {
				if (voteTotals[beerId]) {
					voteTotals[beerId].voterCount = votersByBeer[beerId].size;
				}
			}
		}
	}

	// Get admins assigned to this event (with their info)
	const { data: eventAdmins, error: eventAdminsError } = await locals.supabase
		.from('event_admins')
		.select('admin_id, admins(id, email)')
		.eq('event_id', eventId);

	if (eventAdminsError) {
		console.error('Error fetching event admins:', eventAdminsError);
	}

	// Get all admins (for the add admin dropdown)
	const { data: allAdmins, error: allAdminsError } = await locals.supabase
		.from('admins')
		.select('id, email')
		.order('email', { ascending: true });

	if (allAdminsError) {
		console.error('Error fetching all admins:', allAdminsError);
	}

	// Extract assigned admin info
	const assignedAdmins = (eventAdmins || [])
		.map((ea) => ea.admins as { id: string; email: string })
		.filter(Boolean);

	return {
		event: event as Event,
		beers: (beers || []) as Beer[],
		assignedAdmins,
		allAdmins: (allAdmins || []) as Pick<Admin, 'id' | 'email'>[],
		currentAdminId,
		voteTotals
	};
};

export const actions: Actions = {
	advanceStage: async ({ locals, params }) => {
		const { user } = await locals.safeGetSession();
		if (!user) {
			return fail(403, { action: 'advanceStage', error: 'Not authorized' });
		}

		const eventId = params.id;

		// Verify user is admin and assigned to this event
		const { data: currentAdmin } = await locals.supabase
			.from('admins')
			.select('id')
			.eq('user_id', user.id)
			.single();

		if (!currentAdmin) {
			return fail(403, { action: 'advanceStage', error: 'Not authorized' });
		}

		const { data: assignment } = await locals.supabase
			.from('event_admins')
			.select('event_id')
			.eq('event_id', eventId)
			.eq('admin_id', currentAdmin.id)
			.single();

		if (!assignment) {
			return fail(403, { action: 'advanceStage', error: 'You are not assigned to this event' });
		}

		// Get current stage
		const { data: event, error: eventError } = await locals.supabase
			.from('events')
			.select('reveal_stage')
			.eq('id', eventId)
			.single();

		if (eventError || !event) {
			return fail(500, { action: 'advanceStage', error: 'Failed to get event' });
		}

		// Don't advance past stage 4
		if (event.reveal_stage >= 4) {
			return fail(400, { action: 'advanceStage', error: 'Ceremony already complete' });
		}

		const { error } = await locals.supabase
			.from('events')
			.update({ reveal_stage: event.reveal_stage + 1 })
			.eq('id', eventId);

		if (error) {
			console.error('Error advancing reveal stage:', error);
			return fail(500, { action: 'advanceStage', error: 'Failed to advance reveal stage' });
		}

		return { success: true };
	},

	resetStage: async ({ locals, params }) => {
		const { user } = await locals.safeGetSession();
		if (!user) {
			return fail(403, { action: 'resetStage', error: 'Not authorized' });
		}

		const eventId = params.id;

		// Verify user is admin and assigned to this event
		const { data: currentAdmin } = await locals.supabase
			.from('admins')
			.select('id')
			.eq('user_id', user.id)
			.single();

		if (!currentAdmin) {
			return fail(403, { action: 'resetStage', error: 'Not authorized' });
		}

		const { data: assignment } = await locals.supabase
			.from('event_admins')
			.select('event_id')
			.eq('event_id', eventId)
			.eq('admin_id', currentAdmin.id)
			.single();

		if (!assignment) {
			return fail(403, { action: 'resetStage', error: 'You are not assigned to this event' });
		}

		const { error } = await locals.supabase
			.from('events')
			.update({ reveal_stage: 0 })
			.eq('id', eventId);

		if (error) {
			console.error('Error resetting reveal stage:', error);
			return fail(500, { action: 'resetStage', error: 'Failed to reset reveal stage' });
		}

		return { success: true };
	},

	deleteBeer: async ({ request, locals, params }) => {
		const { user } = await locals.safeGetSession();
		if (!user) {
			return fail(403, { action: 'deleteBeer', error: 'Not authorized' });
		}

		const eventId = params.id;

		// Verify user is admin and assigned to this event
		const { data: currentAdmin } = await locals.supabase
			.from('admins')
			.select('id')
			.eq('user_id', user.id)
			.single();

		if (!currentAdmin) {
			return fail(403, { action: 'deleteBeer', error: 'Not authorized' });
		}

		const { data: assignment } = await locals.supabase
			.from('event_admins')
			.select('event_id')
			.eq('event_id', eventId)
			.eq('admin_id', currentAdmin.id)
			.single();

		if (!assignment) {
			return fail(403, { action: 'deleteBeer', error: 'You are not assigned to this event' });
		}

		const formData = await request.formData();
		const beerId = formData.get('beerId')?.toString();

		if (!beerId) {
			return fail(400, { action: 'deleteBeer', error: 'Beer ID is required' });
		}

		// Verify beer belongs to this event
		const { data: beer } = await locals.supabase
			.from('beers')
			.select('id')
			.eq('id', beerId)
			.eq('event_id', eventId)
			.single();

		if (!beer) {
			return fail(404, { action: 'deleteBeer', error: 'Beer not found' });
		}

		const { error } = await locals.supabase.from('beers').delete().eq('id', beerId);

		if (error) {
			console.error('Error deleting beer:', error);
			return fail(500, { action: 'deleteBeer', error: 'Failed to delete beer' });
		}

		return { beerDeleted: true };
	},

	addEventAdmin: async ({ request, locals, params }) => {
		const { user } = await locals.safeGetSession();
		if (!user) {
			return fail(403, { action: 'addEventAdmin', error: 'Not authorized' });
		}

		const eventId = params.id;

		// Verify user is admin and assigned to this event
		const { data: currentAdmin } = await locals.supabase
			.from('admins')
			.select('id')
			.eq('user_id', user.id)
			.single();

		if (!currentAdmin) {
			return fail(403, { action: 'addEventAdmin', error: 'Not authorized' });
		}

		const { data: assignment } = await locals.supabase
			.from('event_admins')
			.select('event_id')
			.eq('event_id', eventId)
			.eq('admin_id', currentAdmin.id)
			.single();

		if (!assignment) {
			return fail(403, { action: 'addEventAdmin', error: 'You are not assigned to this event' });
		}

		const formData = await request.formData();
		const adminId = formData.get('adminId')?.toString();

		if (!adminId) {
			return fail(400, { action: 'addEventAdmin', error: 'Admin ID is required' });
		}

		// Check if already assigned
		const { data: existing } = await locals.supabase
			.from('event_admins')
			.select('event_id')
			.eq('event_id', eventId)
			.eq('admin_id', adminId)
			.single();

		if (existing) {
			return fail(400, { action: 'addEventAdmin', error: 'Admin is already assigned to this event' });
		}

		const { error } = await locals.supabase.from('event_admins').insert({
			event_id: eventId,
			admin_id: adminId
		});

		if (error) {
			console.error('Error adding event admin:', error);
			return fail(500, { action: 'addEventAdmin', error: 'Failed to add admin to event' });
		}

		return { adminAdded: true };
	},

	removeEventAdmin: async ({ request, locals, params }) => {
		const { user } = await locals.safeGetSession();
		if (!user) {
			return fail(403, { action: 'removeEventAdmin', error: 'Not authorized' });
		}

		const eventId = params.id;

		// Verify user is admin and assigned to this event
		const { data: currentAdmin } = await locals.supabase
			.from('admins')
			.select('id')
			.eq('user_id', user.id)
			.single();

		if (!currentAdmin) {
			return fail(403, { action: 'removeEventAdmin', error: 'Not authorized' });
		}

		const { data: assignment } = await locals.supabase
			.from('event_admins')
			.select('event_id')
			.eq('event_id', eventId)
			.eq('admin_id', currentAdmin.id)
			.single();

		if (!assignment) {
			return fail(403, { action: 'removeEventAdmin', error: 'You are not assigned to this event' });
		}

		const formData = await request.formData();
		const adminId = formData.get('adminId')?.toString();

		if (!adminId) {
			return fail(400, { action: 'removeEventAdmin', error: 'Admin ID is required' });
		}

		// Check if trying to remove self
		if (adminId === currentAdmin.id) {
			// Count how many admins are assigned
			const { count } = await locals.supabase
				.from('event_admins')
				.select('*', { count: 'exact', head: true })
				.eq('event_id', eventId);

			if (count === 1) {
				return fail(400, { action: 'removeEventAdmin', error: 'Cannot remove yourself as the only admin' });
			}
		}

		const { error } = await locals.supabase
			.from('event_admins')
			.delete()
			.eq('event_id', eventId)
			.eq('admin_id', adminId);

		if (error) {
			console.error('Error removing event admin:', error);
			return fail(500, { action: 'removeEventAdmin', error: 'Failed to remove admin from event' });
		}

		// If admin removed themselves, redirect to admin home
		if (adminId === currentAdmin.id) {
			throw redirect(303, '/admin');
		}

		return { adminRemoved: true };
	}
};

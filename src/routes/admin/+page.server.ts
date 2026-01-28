import { fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import type { Event } from '$lib/types';
import { generateShortCode } from '$lib/short-codes';

export const load: PageServerLoad = async ({ parent, locals, url }) => {
	const parentData = await parent();

	if (!parentData.isAdmin) {
		throw redirect(303, '/admin');
	}

	const viewAll = parentData.isSuper && url.searchParams.get('view') === 'all';

	// Query events by organization (or all events for super admin "all" tab)
	// When viewing all, also fetch org names
	const selectFields = viewAll ? '*, organizations(name)' : '*';
	let query = locals.supabase
		.from('events')
		.select(selectFields)
		.order('created_at', { ascending: false });

	if (!viewAll) {
		query = query.eq('organization_id', parentData.admin.organization_id);
	}

	const { data: eventsData, error } = await query;

	if (error) {
		console.error('Error fetching events:', error);
		return { events: [] as Event[], eventCodeMap: {} as Record<string, string>, viewAll, orgNameMap: {} as Record<string, string>, error: error.message };
	}

	const events = (eventsData ?? []) as Event[];

	// Build org name map for "All Events" view
	const orgNameMap: Record<string, string> = {};
	if (viewAll && eventsData) {
		for (const e of eventsData) {
			const org = (e as Record<string, unknown>).organizations as { name: string } | null;
			if (org && e.organization_id) {
				orgNameMap[e.organization_id as string] = org.name;
			}
		}
	}

	// Load event-type short codes for linking
	const eventIds = events.map(e => e.id);
	const eventCodeMap: Record<string, string> = {};

	if (eventIds.length > 0) {
		const { data: codes } = await locals.supabase
			.from('short_codes')
			.select('code, target_id')
			.eq('target_type', 'event')
			.in('target_id', eventIds);

		if (codes) {
			for (const c of codes) {
				eventCodeMap[c.target_id] = c.code;
			}
		}
	}

	return {
		events,
		eventCodeMap,
		viewAll,
		orgNameMap
	};
};

export const actions: Actions = {
	create: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) {
			return fail(403, { error: 'Not authorized' });
		}

		// Verify user is admin and get their admin id + org
		const { data: currentAdmin } = await locals.supabase
			.from('admins')
			.select('id, organization_id')
			.eq('user_id', user.id)
			.single();

		if (!currentAdmin) {
			return fail(403, { error: 'Not authorized' });
		}

		const formData = await request.formData();
		const name = formData.get('name')?.toString().trim();
		const date = formData.get('date')?.toString() || null;
		const maxPointsStr = formData.get('max_points')?.toString();
		const maxPoints = maxPointsStr ? parseInt(maxPointsStr, 10) : 5;

		if (!name) {
			return fail(400, { error: 'Event name is required' });
		}

		if (isNaN(maxPoints) || maxPoints < 1) {
			return fail(400, { error: 'Max points must be a positive number' });
		}

		// Create the event scoped to the admin's organization
		const { data: event, error: eventError } = await locals.supabase
			.from('events')
			.insert({
				name,
				date: date || null,
				max_points: maxPoints,
				organization_id: currentAdmin.organization_id
			})
			.select()
			.single();

		if (eventError) {
			console.error('Error creating event:', eventError);
			return fail(500, { error: 'Failed to create event' });
		}

		// Generate short codes for the event (event + manage types)
		const eventCode = await generateShortCode(locals.supabase);
		const manageCode = await generateShortCode(locals.supabase);
		const { error: codeError } = await locals.supabase
			.from('short_codes')
			.insert([
				{ code: eventCode, target_type: 'event', target_id: event.id },
				{ code: manageCode, target_type: 'manage', target_id: event.id }
			]);

		if (codeError) {
			console.error('Error creating short codes:', codeError);
			// Non-fatal: event exists but codes failed. Log and continue.
		}

		return { success: true, eventId: event.id };
	},

	delete: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) {
			return fail(403, { error: 'Not authorized' });
		}

		// Verify user is admin and get their admin id + org
		const { data: currentAdmin } = await locals.supabase
			.from('admins')
			.select('id, is_super, organization_id')
			.eq('user_id', user.id)
			.single();

		if (!currentAdmin) {
			return fail(403, { error: 'Not authorized' });
		}

		const formData = await request.formData();
		const eventId = formData.get('eventId')?.toString();

		if (!eventId) {
			return fail(400, { error: 'Event ID is required' });
		}

		// Verify admin's org matches the event's org (or is super admin)
		const { data: event } = await locals.supabase
			.from('events')
			.select('organization_id')
			.eq('id', eventId)
			.single();

		if (!event) {
			return fail(404, { error: 'Event not found' });
		}

		if (event.organization_id !== currentAdmin.organization_id && !currentAdmin.is_super) {
			return fail(403, { error: 'You do not have access to this event' });
		}

		// Delete the event (CASCADE will handle related records)
		const { error } = await locals.supabase
			.from('events')
			.delete()
			.eq('id', eventId);

		if (error) {
			console.error('Error deleting event:', error);
			return fail(500, { error: 'Failed to delete event' });
		}

		return { deleted: true };
	}
};

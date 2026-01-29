import { fail, redirect, error } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import type { Event, Beer } from '$lib/types';
import { generateShortCode, resolveShortCode } from '$lib/short-codes';

export const load: PageServerLoad = async ({ parent, locals, params }) => {
	const parentData = await parent();

	if (!parentData.isAdmin) {
		throw redirect(303, '/admin');
	}

	const eventId = await resolveShortCode(locals.supabase, params.code, 'event');
	if (!eventId) {
		throw error(404, 'Event not found');
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

	// Verify admin's org matches the event's org (or is super admin)
	if (event.organization_id !== parentData.admin.organization_id && !parentData.isSuper) {
		throw error(403, 'You do not have access to this event');
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
				if (!vote.beer_id || vote.points === null) continue;
				if (!voteTotals[vote.beer_id]) {
					voteTotals[vote.beer_id] = { totalPoints: 0, voterCount: 0 };
				}
				voteTotals[vote.beer_id].totalPoints += vote.points;
			}
			// Count distinct voters per beer
			const votersByBeer: Record<string, Set<string>> = {};
			for (const vote of voteData) {
				if (!vote.beer_id || !vote.voter_id) continue;
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

	// Load short codes for URL display
	const { data: manageCodeRow } = await locals.supabase
		.from('short_codes')
		.select('code')
		.eq('target_type', 'manage')
		.eq('target_id', eventId)
		.single();

	const brewerCodeMap: Record<string, string> = {};
	if (beerIds.length > 0) {
		const { data: brewerCodes } = await locals.supabase
			.from('short_codes')
			.select('code, target_id')
			.eq('target_type', 'brewer')
			.in('target_id', beerIds);

		if (brewerCodes) {
			for (const c of brewerCodes) {
				brewerCodeMap[c.target_id] = c.code;
			}
		}
	}

	return {
		event: event as Event,
		beers: (beers || []) as Beer[],
		voteTotals,
		eventCode: params.code,
		manageCode: manageCodeRow?.code ?? null,
		brewerCodeMap
	};
};

export const actions: Actions = {
	toggleBlindTasting: async ({ request, locals, params }) => {
		const { user } = await locals.safeGetSession();
		if (!user) {
			return fail(403, { action: 'toggleBlindTasting', error: 'Not authorized' });
		}

		const eventId = await resolveShortCode(locals.supabase, params.code, 'event');
		if (!eventId) throw error(404, 'Event not found');

		// Verify user is admin with org access to this event
		const { data: currentAdmin } = await locals.supabase
			.from('admins')
			.select('id, is_super, organization_id')
			.eq('user_id', user.id)
			.single();

		if (!currentAdmin) {
			return fail(403, { action: 'toggleBlindTasting', error: 'Not authorized' });
		}

		const { data: evt } = await locals.supabase
			.from('events')
			.select('organization_id')
			.eq('id', eventId)
			.single();

		if (!evt || (evt.organization_id !== currentAdmin.organization_id && !currentAdmin.is_super)) {
			return fail(403, { action: 'toggleBlindTasting', error: 'You do not have access to this event' });
		}

		const formData = await request.formData();
		const enabled = formData.get('enabled') === 'on';

		const { error } = await locals.supabase
			.from('events')
			.update({ blind_tasting: enabled })
			.eq('id', eventId);

		if (error) {
			console.error('Error toggling blind tasting:', error);
			return fail(500, { action: 'toggleBlindTasting', error: 'Failed to update blind tasting setting' });
		}

		return { success: true };
	},

	advanceStage: async ({ locals, params }) => {
		const { user } = await locals.safeGetSession();
		if (!user) {
			return fail(403, { action: 'advanceStage', error: 'Not authorized' });
		}

		const eventId = await resolveShortCode(locals.supabase, params.code, 'event');
		if (!eventId) throw error(404, 'Event not found');

		// Verify user is admin with org access to this event
		const { data: currentAdmin } = await locals.supabase
			.from('admins')
			.select('id, is_super, organization_id')
			.eq('user_id', user.id)
			.single();

		if (!currentAdmin) {
			return fail(403, { action: 'advanceStage', error: 'Not authorized' });
		}

		const { data: evt } = await locals.supabase
			.from('events')
			.select('organization_id')
			.eq('id', eventId)
			.single();

		if (!evt || (evt.organization_id !== currentAdmin.organization_id && !currentAdmin.is_super)) {
			return fail(403, { action: 'advanceStage', error: 'You do not have access to this event' });
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

		const currentStage = event.reveal_stage ?? 0;

		// Don't advance past stage 4
		if (currentStage >= 4) {
			return fail(400, { action: 'advanceStage', error: 'Ceremony already complete' });
		}

		const { error } = await locals.supabase
			.from('events')
			.update({ reveal_stage: currentStage + 1 })
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

		const eventId = await resolveShortCode(locals.supabase, params.code, 'event');
		if (!eventId) throw error(404, 'Event not found');

		// Verify user is admin with org access to this event
		const { data: currentAdmin } = await locals.supabase
			.from('admins')
			.select('id, is_super, organization_id')
			.eq('user_id', user.id)
			.single();

		if (!currentAdmin) {
			return fail(403, { action: 'resetStage', error: 'Not authorized' });
		}

		const { data: evt } = await locals.supabase
			.from('events')
			.select('organization_id')
			.eq('id', eventId)
			.single();

		if (!evt || (evt.organization_id !== currentAdmin.organization_id && !currentAdmin.is_super)) {
			return fail(403, { action: 'resetStage', error: 'You do not have access to this event' });
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

		const eventId = await resolveShortCode(locals.supabase, params.code, 'event');
		if (!eventId) throw error(404, 'Event not found');

		// Verify user is admin with org access to this event
		const { data: currentAdmin } = await locals.supabase
			.from('admins')
			.select('id, is_super, organization_id')
			.eq('user_id', user.id)
			.single();

		if (!currentAdmin) {
			return fail(403, { action: 'deleteBeer', error: 'Not authorized' });
		}

		const { data: evt } = await locals.supabase
			.from('events')
			.select('organization_id')
			.eq('id', eventId)
			.single();

		if (!evt || (evt.organization_id !== currentAdmin.organization_id && !currentAdmin.is_super)) {
			return fail(403, { action: 'deleteBeer', error: 'You do not have access to this event' });
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

	uploadLogo: async ({ request, locals, params }) => {
		const { user } = await locals.safeGetSession();
		if (!user) {
			return fail(403, { action: 'uploadLogo', error: 'Not authorized' });
		}

		const eventId = await resolveShortCode(locals.supabase, params.code, 'event');
		if (!eventId) throw error(404, 'Event not found');

		// Verify user is admin with org access to this event
		const { data: currentAdmin } = await locals.supabase
			.from('admins')
			.select('id, is_super, organization_id')
			.eq('user_id', user.id)
			.single();

		if (!currentAdmin) {
			return fail(403, { action: 'uploadLogo', error: 'Not authorized' });
		}

		const { data: evt } = await locals.supabase
			.from('events')
			.select('organization_id')
			.eq('id', eventId)
			.single();

		if (!evt || (evt.organization_id !== currentAdmin.organization_id && !currentAdmin.is_super)) {
			return fail(403, { action: 'uploadLogo', error: 'You do not have access to this event' });
		}

		const formData = await request.formData();
		const file = formData.get('logo') as File | null;

		if (!file || file.size === 0) {
			return fail(400, { action: 'uploadLogo', error: 'No file provided' });
		}

		// Validate file type
		const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml'];
		if (!allowedTypes.includes(file.type)) {
			return fail(400, { action: 'uploadLogo', error: 'Invalid file type. Use PNG, JPG, or SVG.' });
		}

		// Validate file size (500KB limit)
		const maxSize = 500 * 1024;
		if (file.size > maxSize) {
			return fail(400, { action: 'uploadLogo', error: 'File too large. Maximum size is 500KB.' });
		}

		// Generate a unique filename
		const ext = file.name.split('.').pop() || 'png';
		const filename = `${eventId}-${Date.now()}.${ext}`;

		// Upload to Supabase Storage
		const { error: uploadError } = await locals.supabase.storage
			.from('event-logos')
			.upload(filename, file, {
				cacheControl: '3600',
				upsert: false
			});

		if (uploadError) {
			console.error('Error uploading logo:', uploadError);
			return fail(500, { action: 'uploadLogo', error: 'Failed to upload logo' });
		}

		// Get public URL
		const { data: urlData } = locals.supabase.storage.from('event-logos').getPublicUrl(filename);

		// Delete old logo if exists
		const { data: event } = await locals.supabase
			.from('events')
			.select('logo_url')
			.eq('id', eventId)
			.single();

		if (event?.logo_url) {
			// Extract filename from old URL
			const oldFilename = event.logo_url.split('/').pop();
			if (oldFilename) {
				await locals.supabase.storage.from('event-logos').remove([oldFilename]);
			}
		}

		// Update event with new logo URL
		const { error: updateError } = await locals.supabase
			.from('events')
			.update({ logo_url: urlData.publicUrl })
			.eq('id', eventId);

		if (updateError) {
			console.error('Error updating event logo_url:', updateError);
			// Try to clean up the uploaded file
			await locals.supabase.storage.from('event-logos').remove([filename]);
			return fail(500, { action: 'uploadLogo', error: 'Failed to save logo URL' });
		}

		return { logoUploaded: true };
	},

	removeLogo: async ({ locals, params }) => {
		const { user } = await locals.safeGetSession();
		if (!user) {
			return fail(403, { action: 'removeLogo', error: 'Not authorized' });
		}

		const eventId = await resolveShortCode(locals.supabase, params.code, 'event');
		if (!eventId) throw error(404, 'Event not found');

		// Verify user is admin with org access to this event
		const { data: currentAdmin } = await locals.supabase
			.from('admins')
			.select('id, is_super, organization_id')
			.eq('user_id', user.id)
			.single();

		if (!currentAdmin) {
			return fail(403, { action: 'removeLogo', error: 'Not authorized' });
		}

		const { data: evt } = await locals.supabase
			.from('events')
			.select('organization_id')
			.eq('id', eventId)
			.single();

		if (!evt || (evt.organization_id !== currentAdmin.organization_id && !currentAdmin.is_super)) {
			return fail(403, { action: 'removeLogo', error: 'You do not have access to this event' });
		}

		// Get current logo URL
		const { data: event } = await locals.supabase
			.from('events')
			.select('logo_url')
			.eq('id', eventId)
			.single();

		if (!event?.logo_url) {
			return fail(400, { action: 'removeLogo', error: 'No logo to remove' });
		}

		// Extract filename from URL
		const filename = event.logo_url.split('/').pop();
		if (filename) {
			await locals.supabase.storage.from('event-logos').remove([filename]);
		}

		// Clear logo_url in database
		const { error: updateError } = await locals.supabase
			.from('events')
			.update({ logo_url: null })
			.eq('id', eventId);

		if (updateError) {
			console.error('Error removing logo_url:', updateError);
			return fail(500, { action: 'removeLogo', error: 'Failed to remove logo' });
		}

		return { logoRemoved: true };
	},

	generateTestVoter: async ({ locals, params }) => {
		const { user } = await locals.safeGetSession();
		if (!user) {
			return fail(403, { action: 'generateTestVoter', error: 'Not authorized' });
		}

		if (!locals.supabaseAdmin) {
			return fail(500, { action: 'generateTestVoter', error: 'Server configuration error' });
		}

		const eventId = await resolveShortCode(locals.supabase, params.code, 'event');
		if (!eventId) throw error(404, 'Event not found');

		// Verify user is admin with org access to this event
		const { data: currentAdmin } = await locals.supabase
			.from('admins')
			.select('id, is_super, organization_id')
			.eq('user_id', user.id)
			.single();

		if (!currentAdmin) {
			return fail(403, { action: 'generateTestVoter', error: 'Not authorized' });
		}

		const { data: evt } = await locals.supabase
			.from('events')
			.select('organization_id')
			.eq('id', eventId)
			.single();

		if (!evt || (evt.organization_id !== currentAdmin.organization_id && !currentAdmin.is_super)) {
			return fail(403, { action: 'generateTestVoter', error: 'You do not have access to this event' });
		}

		const voterUuid = crypto.randomUUID();
		const voterCode = await generateShortCode(locals.supabase);

		const { error: codeError } = await locals.supabaseAdmin
			.from('short_codes')
			.insert({ code: voterCode, target_type: 'voter', target_id: voterUuid });

		if (codeError) {
			console.error('Error creating test voter short code:', codeError);
			return fail(500, { action: 'generateTestVoter', error: 'Failed to generate test voter' });
		}

		return { testVoterCode: voterCode };
	},

	generateQRCodes: async ({ request, locals, params }) => {
		const { user } = await locals.safeGetSession();
		if (!user) {
			return fail(403, { action: 'generateQRCodes', error: 'Not authorized' });
		}

		if (!locals.supabaseAdmin) {
			return fail(500, { action: 'generateQRCodes', error: 'Server configuration error' });
		}

		const eventId = await resolveShortCode(locals.supabase, params.code, 'event');
		if (!eventId) throw error(404, 'Event not found');

		// Verify user is admin with org access to this event
		const { data: currentAdmin } = await locals.supabase
			.from('admins')
			.select('id, is_super, organization_id')
			.eq('user_id', user.id)
			.single();

		if (!currentAdmin) {
			return fail(403, { action: 'generateQRCodes', error: 'Not authorized' });
		}

		const { data: evt } = await locals.supabase
			.from('events')
			.select('organization_id')
			.eq('id', eventId)
			.single();

		if (!evt || (evt.organization_id !== currentAdmin.organization_id && !currentAdmin.is_super)) {
			return fail(403, { action: 'generateQRCodes', error: 'You do not have access to this event' });
		}

		const formData = await request.formData();
		const countStr = formData.get('count')?.toString();
		const count = parseInt(countStr || '0', 10);

		if (count < 1 || count > 500) {
			return fail(400, { action: 'generateQRCodes', error: 'Count must be between 1 and 500' });
		}

		// Generate voter UUIDs and short codes
		const voters: { uuid: string; code: string }[] = [];
		for (let i = 0; i < count; i++) {
			voters.push({
				uuid: crypto.randomUUID(),
				code: await generateShortCode(locals.supabase)
			});
		}

		// Batch-insert short codes using service role (bypasses RLS)
		const shortCodeRows = voters.map((v) => ({
			code: v.code,
			target_type: 'voter' as const,
			target_id: v.uuid
		}));

		const { error: insertError } = await locals.supabaseAdmin
			.from('short_codes')
			.insert(shortCodeRows);

		if (insertError) {
			console.error('Error inserting voter short codes:', insertError);
			return fail(500, { action: 'generateQRCodes', error: 'Failed to save voter codes' });
		}

		return { voterCodes: voters.map((v) => v.code) };
	}
};

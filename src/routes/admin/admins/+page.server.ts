import { fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import type { Admin, AccessRequest, Organization } from '$lib/types';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Find or invite a user by email, returning their user ID.
 * Uses the service-role client to call admin auth APIs.
 */
async function findOrInviteUser(
	supabaseAdmin: SupabaseClient,
	email: string
): Promise<{ userId: string; invited: boolean } | { error: string }> {
	const { data: userData } = await supabaseAdmin.auth.admin.listUsers();
	const existingUser = userData?.users.find((u) => u.email?.toLowerCase() === email);

	if (existingUser) {
		return { userId: existingUser.id, invited: false };
	}

	const { data: inviteData, error: inviteError } =
		await supabaseAdmin.auth.admin.inviteUserByEmail(email);

	if (inviteError) {
		console.error('Error inviting user:', inviteError);
		return { error: `Failed to invite user: ${inviteError.message}` };
	}

	return { userId: inviteData.user.id, invited: true };
}

export const load: PageServerLoad = async ({ parent, locals }) => {
	const parentData = await parent();

	if (!parentData.isAdmin || !parentData.isSuper) {
		throw redirect(303, '/admin');
	}

	// Belt-and-suspenders: RLS also enforces org scoping, but filter app-side too
	const adminsQuery = locals.supabase
		.from('admins')
		.select('*, organizations(name)')
		.order('created_at', { ascending: true });

	if (!parentData.isSuper) {
		adminsQuery.eq('organization_id', parentData.admin.organization_id);
	}

	const [adminsResult, requestsResult, orgsResult] = await Promise.all([
		adminsQuery,
		locals.supabase
			.from('access_requests')
			.select('*')
			.order('created_at', { ascending: false }),
		locals.supabase
			.from('organizations')
			.select('*')
			.order('name', { ascending: true })
	]);

	if (adminsResult.error) {
		console.error('Error fetching admins:', adminsResult.error);
	}
	if (requestsResult.error) {
		console.error('Error fetching access requests:', requestsResult.error);
	}
	if (orgsResult.error) {
		console.error('Error fetching organizations:', orgsResult.error);
	}

	// Attach org name to each admin for display
	const admins = (adminsResult.data ?? []).map((a) => ({
		...a,
		organization_name: (a.organizations as unknown as { name: string })?.name ?? ''
	}));

	return {
		admins: admins as (Admin & { organization_name: string })[],
		accessRequests: (requestsResult.data ?? []) as AccessRequest[],
		organizations: (orgsResult.data ?? []) as Organization[]
	};
};

export const actions: Actions = {
	add: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) {
			return fail(403, { error: 'Not authorized' });
		}

		// Verify user is super admin
		const { data: currentAdmin } = await locals.supabase
			.from('admins')
			.select('id, is_super')
			.eq('user_id', user.id)
			.single();

		if (!currentAdmin?.is_super) {
			return fail(403, { error: 'Not authorized' });
		}

		const formData = await request.formData();
		const email = formData.get('email')?.toString().trim().toLowerCase();
		const organizationId = formData.get('organizationId')?.toString();

		if (!email) {
			return fail(400, { error: 'Email is required' });
		}

		if (!organizationId) {
			return fail(400, { error: 'Organization is required' });
		}

		// Check if already an admin
		const { data: existingAdmin } = await locals.supabase
			.from('admins')
			.select('id')
			.eq('email', email)
			.single();

		if (existingAdmin) {
			return fail(400, { error: 'This email is already an admin' });
		}

		const supabaseAdmin = locals.supabaseAdmin;
		if (!supabaseAdmin) {
			return fail(500, { error: 'Admin operations not available. Service role not configured.' });
		}

		const result = await findOrInviteUser(supabaseAdmin, email);
		if ('error' in result) {
			return fail(500, { error: result.error });
		}

		// Create admin record (use authenticated client - RLS allows admins to insert)
		const { error: insertError } = await locals.supabase
			.from('admins')
			.insert({ user_id: result.userId, email, organization_id: organizationId });

		if (insertError) {
			console.error('Error creating admin:', insertError);
			if (insertError.code === '23505') {
				return fail(400, { error: 'This user is already an admin' });
			}
			return fail(500, { error: 'Failed to add admin' });
		}

		return { success: true, invited: result.invited };
	},

	approveRequest: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(403, { approveError: 'Not authorized' });

		const { data: currentAdmin } = await locals.supabase
			.from('admins')
			.select('id, is_super')
			.eq('user_id', user.id)
			.single();

		if (!currentAdmin?.is_super) return fail(403, { approveError: 'Not authorized' });

		const supabaseAdmin = locals.supabaseAdmin;
		if (!supabaseAdmin) {
			return fail(500, { approveError: 'Admin operations not available. Service role not configured.' });
		}

		const formData = await request.formData();
		const requestId = formData.get('requestId')?.toString();
		if (!requestId) return fail(400, { approveError: 'Request ID is required' });

		const organizationId = formData.get('organizationId')?.toString();
		const newOrgName = formData.get('newOrgName')?.toString().trim();

		if (!organizationId && !newOrgName) {
			return fail(400, { approveError: 'Organization is required', approveRequestId: requestId });
		}

		// Fetch the access request
		const { data: accessRequest, error: fetchError } = await locals.supabase
			.from('access_requests')
			.select('*')
			.eq('id', requestId)
			.single();

		if (fetchError || !accessRequest) {
			console.error('Error fetching access request:', fetchError);
			return fail(500, { approveError: 'Failed to fetch access request', approveRequestId: requestId });
		}

		// Resolve organization ID
		let orgId = organizationId;
		if (!orgId && newOrgName) {
			const { data: newOrg, error: orgError } = await locals.supabase
				.from('organizations')
				.insert({ name: newOrgName })
				.select('id')
				.single();

			if (orgError) {
				console.error('Error creating organization:', orgError);
				const msg = orgError.code === '23505'
					? 'An organization with that name already exists'
					: 'Failed to create organization';
				return fail(orgError.code === '23505' ? 400 : 500, { approveError: msg, approveRequestId: requestId });
			}
			orgId = newOrg.id;
		}

		// Find or invite the user
		const email = accessRequest.email.toLowerCase();
		const result = await findOrInviteUser(supabaseAdmin, email);
		if ('error' in result) {
			return fail(500, { approveError: result.error, approveRequestId: requestId });
		}

		// Create admin record
		const { error: insertError } = await locals.supabase
			.from('admins')
			.insert({ user_id: result.userId, email, organization_id: orgId });

		if (insertError) {
			console.error('Error creating admin:', insertError);
			const msg = insertError.code === '23505'
				? 'This user is already an admin'
				: 'Failed to create admin record';
			return fail(insertError.code === '23505' ? 400 : 500, { approveError: msg, approveRequestId: requestId });
		}

		// Mark request as approved
		const { error: updateError } = await locals.supabase
			.from('access_requests')
			.update({ status: 'approved' })
			.eq('id', requestId);

		if (updateError) {
			console.error('Error approving request:', updateError);
			return fail(500, { approveError: 'Admin created but failed to update request status', approveRequestId: requestId });
		}

		return { approveSuccess: true };
	},

	dismissRequest: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) return fail(403, { error: 'Not authorized' });

		const { data: currentAdmin } = await locals.supabase
			.from('admins')
			.select('id, is_super')
			.eq('user_id', user.id)
			.single();

		if (!currentAdmin?.is_super) return fail(403, { error: 'Not authorized' });

		const formData = await request.formData();
		const requestId = formData.get('requestId')?.toString();
		if (!requestId) return fail(400, { error: 'Request ID is required' });

		const { error } = await locals.supabase
			.from('access_requests')
			.update({ status: 'dismissed' })
			.eq('id', requestId);

		if (error) {
			console.error('Error dismissing request:', error);
			return fail(500, { error: 'Failed to dismiss request' });
		}

		return { success: true };
	},

	remove: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) {
			return fail(403, { error: 'Not authorized' });
		}

		// Verify user is super admin and get their admin id
		const { data: currentAdmin } = await locals.supabase
			.from('admins')
			.select('id, is_super')
			.eq('user_id', user.id)
			.single();

		if (!currentAdmin?.is_super) {
			return fail(403, { error: 'Not authorized' });
		}

		const formData = await request.formData();
		const adminId = formData.get('adminId')?.toString();

		if (!adminId) {
			return fail(400, { error: 'Admin ID is required' });
		}

		// Prevent removing self
		if (adminId === currentAdmin.id) {
			return fail(400, { error: 'You cannot remove yourself' });
		}

		const { error } = await locals.supabase
			.from('admins')
			.delete()
			.eq('id', adminId);

		if (error) {
			console.error('Error removing admin:', error);
			return fail(500, { error: 'Failed to remove admin' });
		}

		return { success: true };
	},

	changeOrg: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) {
			return fail(403, { changeOrgError: 'Not authorized' });
		}

		const { data: currentAdmin } = await locals.supabase
			.from('admins')
			.select('id, is_super')
			.eq('user_id', user.id)
			.single();

		if (!currentAdmin?.is_super) {
			return fail(403, { changeOrgError: 'Not authorized' });
		}

		const formData = await request.formData();
		const adminId = formData.get('adminId')?.toString();
		const organizationId = formData.get('organizationId')?.toString();

		if (!adminId) {
			return fail(400, { changeOrgError: 'Admin ID is required' });
		}

		if (!organizationId) {
			return fail(400, { changeOrgError: 'Organization is required' });
		}

		// Verify org exists
		const { data: orgExists } = await locals.supabase
			.from('organizations')
			.select('id')
			.eq('id', organizationId)
			.single();

		if (!orgExists) {
			return fail(400, { changeOrgError: 'Organization not found' });
		}

		const { error } = await locals.supabase
			.from('admins')
			.update({ organization_id: organizationId })
			.eq('id', adminId);

		if (error) {
			console.error('Error changing admin organization:', error);
			return fail(500, { changeOrgError: 'Failed to change organization' });
		}

		return { changeOrgSuccess: true };
	},

	createOrg: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) {
			return fail(403, { error: 'Not authorized' });
		}

		const { data: currentAdmin } = await locals.supabase
			.from('admins')
			.select('id, is_super')
			.eq('user_id', user.id)
			.single();

		if (!currentAdmin?.is_super) {
			return fail(403, { error: 'Not authorized' });
		}

		const formData = await request.formData();
		const name = formData.get('orgName')?.toString().trim();

		if (!name) {
			return fail(400, { orgError: 'Organization name is required' });
		}

		const { error } = await locals.supabase
			.from('organizations')
			.insert({ name });

		if (error) {
			console.error('Error creating organization:', error);
			if (error.code === '23505') {
				return fail(400, { orgError: 'An organization with that name already exists' });
			}
			return fail(500, { orgError: 'Failed to create organization' });
		}

		return { orgCreated: true };
	},

	deleteOrg: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) {
			return fail(403, { deleteOrgError: 'Not authorized' });
		}

		const { data: currentAdmin } = await locals.supabase
			.from('admins')
			.select('id, is_super')
			.eq('user_id', user.id)
			.single();

		if (!currentAdmin?.is_super) {
			return fail(403, { deleteOrgError: 'Not authorized' });
		}

		const formData = await request.formData();
		const organizationId = formData.get('organizationId')?.toString();

		if (!organizationId) {
			return fail(400, { deleteOrgError: 'Organization ID is required' });
		}

		// Check if org has events (FK constraint ON DELETE RESTRICT)
		const { count: eventCount } = await locals.supabase
			.from('events')
			.select('id', { count: 'exact', head: true })
			.eq('organization_id', organizationId);

		if (eventCount && eventCount > 0) {
			return fail(400, { deleteOrgError: 'Cannot delete organization with existing events' });
		}

		// Check if any admins are assigned to this org
		const { count } = await locals.supabase
			.from('admins')
			.select('id', { count: 'exact', head: true })
			.eq('organization_id', organizationId);

		if (count && count > 0) {
			return fail(400, { deleteOrgError: 'Cannot delete organization with assigned admins' });
		}

		const { error } = await locals.supabase
			.from('organizations')
			.delete()
			.eq('id', organizationId);

		if (error) {
			console.error('Error deleting organization:', error);
			// Handle FK violation (race condition: admin/event added between check and delete)
			const msg = error.code === '23503'
				? 'Cannot delete organization: it has assigned admins or events'
				: 'Failed to delete organization';
			return fail(error.code === '23503' ? 400 : 500, { deleteOrgError: msg });
		}

		return { orgDeleted: true };
	}
};

import { fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import type { Admin, AccessRequest, Organization } from '$lib/types';

export const load: PageServerLoad = async ({ parent, locals }) => {
	const parentData = await parent();

	if (!parentData.isAdmin || !parentData.isSuper) {
		throw redirect(303, '/admin');
	}

	const [adminsResult, requestsResult, orgsResult] = await Promise.all([
		locals.supabase
			.from('admins')
			.select('*, organizations(name)')
			.order('created_at', { ascending: true }),
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

		// Check if user already exists in auth.users
		const { data: userData } = await supabaseAdmin.auth.admin.listUsers();
		const existingUser = userData?.users.find(u => u.email?.toLowerCase() === email);

		let userId: string;

		if (existingUser) {
			// User exists, just add them as admin
			userId = existingUser.id;
		} else {
			// Invite new user
			// Note: redirectTo is NOT passed here. The invite email template
			// handles routing directly via token_hash to /auth/callback.
			// See Supabase Dashboard → Auth → Email Templates → "Invite user".
			const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email);

			if (inviteError) {
				console.error('Error inviting user:', inviteError);
				return fail(500, { error: `Failed to invite user: ${inviteError.message}` });
			}

			userId = inviteData.user.id;
		}

		// Create admin record (use authenticated client - RLS allows admins to insert)
		const { error: insertError } = await locals.supabase
			.from('admins')
			.insert({ user_id: userId, email, organization_id: organizationId });

		if (insertError) {
			console.error('Error creating admin:', insertError);
			if (insertError.code === '23505') {
				return fail(400, { error: 'This user is already an admin' });
			}
			return fail(500, { error: 'Failed to add admin' });
		}

		return { success: true, invited: !existingUser };
	},

	approveRequest: async ({ request, locals }) => {
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
			.update({ status: 'approved' })
			.eq('id', requestId);

		if (error) {
			console.error('Error approving request:', error);
			return fail(500, { error: 'Failed to approve request' });
		}

		return { success: true };
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
	}
};

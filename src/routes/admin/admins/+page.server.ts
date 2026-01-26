import { fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import type { Admin } from '$lib/types';

export const load: PageServerLoad = async ({ parent, locals }) => {
	const parentData = await parent();

	if (!parentData.isAdmin) {
		throw redirect(303, '/admin');
	}

	const { data: admins, error } = await locals.supabase
		.from('admins')
		.select('*')
		.order('created_at', { ascending: true });

	if (error) {
		console.error('Error fetching admins:', error);
		return { admins: [] as Admin[] };
	}

	return {
		admins: admins as Admin[]
	};
};

export const actions: Actions = {
	add: async ({ request, locals, url }) => {
		const { user } = await locals.safeGetSession();
		if (!user) {
			return fail(403, { error: 'Not authorized' });
		}

		// Verify user is admin
		const { data: currentAdmin } = await locals.supabase
			.from('admins')
			.select('id')
			.eq('user_id', user.id)
			.single();

		if (!currentAdmin) {
			return fail(403, { error: 'Not authorized' });
		}

		const formData = await request.formData();
		const email = formData.get('email')?.toString().trim().toLowerCase();

		if (!email) {
			return fail(400, { error: 'Email is required' });
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
			const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
				redirectTo: `${url.origin}/auth/callback?next=set-password`
			});

			if (inviteError) {
				console.error('Error inviting user:', inviteError);
				return fail(500, { error: `Failed to invite user: ${inviteError.message}` });
			}

			userId = inviteData.user.id;
		}

		// Create admin record (use authenticated client - RLS allows admins to insert)
		const { error: insertError } = await locals.supabase
			.from('admins')
			.insert({ user_id: userId, email });

		if (insertError) {
			console.error('Error creating admin:', insertError);
			if (insertError.code === '23505') {
				return fail(400, { error: 'This user is already an admin' });
			}
			return fail(500, { error: 'Failed to add admin' });
		}

		return { success: true, invited: !existingUser };
	},

	remove: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) {
			return fail(403, { error: 'Not authorized' });
		}

		// Verify user is admin and get their admin id
		const { data: currentAdmin } = await locals.supabase
			.from('admins')
			.select('id')
			.eq('user_id', user.id)
			.single();

		if (!currentAdmin) {
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
	}
};

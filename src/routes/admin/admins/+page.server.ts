import { fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import type { Admin } from '$lib/types';

export const load: PageServerLoad = async ({ parent, locals }) => {
	const parentData = await parent();

	if (!parentData.isAdmin) {
		return { admins: [] as Admin[] };
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
	add: async ({ request, locals, parent }) => {
		const parentData = await parent();
		if (!parentData.isAdmin) {
			return fail(403, { error: 'Not authorized' });
		}

		const formData = await request.formData();
		const email = formData.get('email')?.toString().trim().toLowerCase();

		if (!email) {
			return fail(400, { error: 'Email is required' });
		}

		// Look up user in auth.users by email
		// We need to use the service role for this, but we don't have it client-side
		// Instead, we'll use a different approach: check if user exists via admin API
		// Actually, the supabase client here is the SSR client which uses the user's session
		// We need to query auth.users which requires admin privileges

		// Alternative approach: Try to find if this email is already an admin
		const { data: existingAdmin } = await locals.supabase
			.from('admins')
			.select('id')
			.eq('email', email)
			.single();

		if (existingAdmin) {
			return fail(400, { error: 'This email is already an admin' });
		}

		// We can't query auth.users directly from the client
		// The user needs to sign up first, then be added as admin
		// Let's check if we can use supabase.auth.admin (requires service role)

		// For now, we'll use a workaround: the admin enters the email,
		// and we create the admin record. If the user_id doesn't exist,
		// we'll need to handle that.

		// Actually, looking at the schema: admins.user_id references auth.users(id)
		// So we MUST have a valid user_id. We need service role access.

		// Let's try using the supabase admin client if available
		const supabaseAdmin = locals.supabaseAdmin;
		if (!supabaseAdmin) {
			return fail(500, { error: 'Admin operations not available. Service role not configured.' });
		}

		// List users and find by email
		const { data: userData, error: userError } = await supabaseAdmin.auth.admin.listUsers();

		if (userError) {
			console.error('Error listing users:', userError);
			return fail(500, { error: 'Failed to look up user' });
		}

		const user = userData.users.find(u => u.email?.toLowerCase() === email);

		if (!user) {
			return fail(400, { error: 'No user found with this email. They must sign up first.' });
		}

		// Create admin record
		const { error: insertError } = await locals.supabase
			.from('admins')
			.insert({ user_id: user.id, email: user.email! });

		if (insertError) {
			console.error('Error creating admin:', insertError);
			if (insertError.code === '23505') {
				return fail(400, { error: 'This user is already an admin' });
			}
			return fail(500, { error: 'Failed to add admin' });
		}

		return { success: true };
	},

	remove: async ({ request, locals, parent }) => {
		const parentData = await parent();
		if (!parentData.isAdmin) {
			return fail(403, { error: 'Not authorized' });
		}

		const formData = await request.formData();
		const adminId = formData.get('adminId')?.toString();

		if (!adminId) {
			return fail(400, { error: 'Admin ID is required' });
		}

		// Prevent removing self
		if (adminId === parentData.admin?.id) {
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

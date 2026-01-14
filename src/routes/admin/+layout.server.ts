import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

interface AdminInfo {
	id: string;
	email: string;
}

export const load: LayoutServerLoad = async ({ locals }) => {
	const { session, user } = await locals.safeGetSession();

	if (!session || !user) {
		throw redirect(303, '/login');
	}

	// Check if user is in the admins table
	const { data: admin, error } = await locals.supabase
		.from('admins')
		.select('id, email')
		.eq('user_id', user.id)
		.single();

	if (error || !admin) {
		return {
			session,
			user,
			admin: null as AdminInfo | null,
			isAdmin: false as const
		};
	}

	return {
		session,
		user,
		admin: admin as AdminInfo,
		isAdmin: true as const
	};
};

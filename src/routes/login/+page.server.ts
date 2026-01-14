import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const { session, user } = await locals.safeGetSession();

	if (session && user) {
		// Check if user is an admin
		const { data: admin } = await locals.supabase
			.from('admins')
			.select('id')
			.eq('user_id', user.id)
			.single();

		if (admin) {
			throw redirect(303, '/admin');
		}
	}

	return {};
};

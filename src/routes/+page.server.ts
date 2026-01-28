import { fail } from '@sveltejs/kit';
import type { Actions } from './$types';

export const actions: Actions = {
	requestAccess: async ({ request, locals }) => {
		const formData = await request.formData();
		const name = formData.get('name')?.toString().trim();
		const email = formData.get('email')?.toString().trim();
		const club_name = formData.get('club_name')?.toString().trim();
		const message = formData.get('message')?.toString().trim() || null;

		if (!name || !email || !club_name) {
			return fail(400, {
				error: 'Name, email, and club name are required.',
				name,
				email,
				club_name,
				message
			});
		}

		// Basic email format check
		if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
			return fail(400, {
				error: 'Please enter a valid email address.',
				name,
				email,
				club_name,
				message
			});
		}

		const { error } = await locals.supabase.from('access_requests').insert({
			name,
			email,
			club_name,
			message
		});

		if (error) {
			console.error('Failed to insert access request:', error);
			return fail(500, {
				error: 'Something went wrong. Please try again.',
				name,
				email,
				club_name,
				message
			});
		}

		return { success: true };
	}
};

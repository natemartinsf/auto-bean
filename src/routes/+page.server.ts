import { fail } from '@sveltejs/kit';
import type { Actions } from './$types';

export const actions: Actions = {
	requestAccess: async ({ request, locals }) => {
		const formData = await request.formData();
		const name = formData.get('name')?.toString().trim();
		const email = formData.get('email')?.toString().trim();
		const club_name = formData.get('club_name')?.toString().trim();
		const message = formData.get('message')?.toString().trim() || null;

		// Honeypot — bots fill hidden fields, humans don't
		const website = formData.get('website')?.toString();
		if (website) {
			return { success: true };
		}

		if (!name || !email || !club_name) {
			return fail(400, { error: 'Name, email, and club name are required.' });
		}

		if (name.length > 200 || email.length > 320 || club_name.length > 200) {
			return fail(400, { error: 'One or more fields exceed the maximum length.' });
		}

		if (message && message.length > 2000) {
			return fail(400, { error: 'Message must be under 2000 characters.' });
		}

		if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
			return fail(400, { error: 'Please enter a valid email address.' });
		}

		const { error } = await locals.supabase.from('access_requests').insert({
			name,
			email,
			club_name,
			message
		});

		if (error) {
			console.error('Failed to insert access request:', error);
			return fail(500, { error: 'Something went wrong. Please try again.' });
		}

		return { success: true };
	}
};

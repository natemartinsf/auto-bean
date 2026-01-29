import { fail } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
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

		// Timing check — bots submit too fast
		const loadTime = parseInt(formData.get('loadTime')?.toString() || '0');
		const submitTime = Date.now();
		if (submitTime - loadTime < 3000) {
			return { success: true }; // Silent success for bots
		}

		// Trivia check — brewing knowledge gate
		const trivia = formData.get('trivia')?.toString();
		if (trivia?.toLowerCase() !== 'yeast') {
			return { success: true }; // Silent success - don't reveal defense
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

		// Best-effort email notification — don't block form submission
		if (env.RESEND_API_KEY && env.NOTIFY_EMAIL) {
			try {
				const body = [
					`New PintPoll access request from ${name} (${email}) at ${club_name}.`,
					message ? `\nMessage:\n${message}` : ''
				].join('');

				const res = await fetch('https://api.resend.com/emails', {
					method: 'POST',
					headers: {
						Authorization: `Bearer ${env.RESEND_API_KEY}`,
						'Content-Type': 'application/json'
					},
					body: JSON.stringify({
						from: 'PintPoll <noreply@pintpoll.com>',
						to: env.NOTIFY_EMAIL,
						subject: `Access request from ${name} (${club_name})`,
						text: body
					})
				});
				if (!res.ok) {
					console.error('Resend API error:', res.status, await res.text());
				}
			} catch (err) {
				console.error('Failed to send notification email:', err);
			}
		}

		return { success: true };
	}
};

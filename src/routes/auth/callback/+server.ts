import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals }) => {
	const code = url.searchParams.get('code');

	if (code) {
		await locals.supabase.auth.exchangeCodeForSession(code);
	}

	// We encode the post-auth destination in the redirectTo URL
	const next = url.searchParams.get('next');

	if (next === 'set-password') {
		throw redirect(303, '/auth/set-password');
	}

	throw redirect(303, '/admin');
};

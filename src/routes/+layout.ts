import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import { createBrowserClient } from '@supabase/ssr';
import type { LayoutLoad } from './$types';
import type { Database } from '$lib/types';

export const load: LayoutLoad = async ({ data, depends, fetch }) => {
	depends('supabase:auth');

	// Wrap SvelteKit's fetch to silently ignore AbortError during hydration.
	// These errors are harmless but noisy - the requests get retried automatically.
	const wrappedFetch: typeof fetch = (input, init) => {
		return fetch(input, init).catch((err) => {
			if (err instanceof Error && err.name === 'AbortError') {
				// Return a response that will be ignored - Supabase retries on failure
				return new Response(null, { status: 408 });
			}
			throw err;
		});
	};

	const supabase = createBrowserClient<Database>(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
		global: {
			fetch: wrappedFetch
		}
	});

	// Always use the validated session from +layout.server.ts
	// The server validates via getUser() in safeGetSession
	const session = data.session;

	return {
		supabase,
		session,
		user: data.user
	};
};

import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import { createBrowserClient } from '@supabase/ssr';
import type { LayoutLoad } from './$types';
import type { Database } from '$lib/types';

export const load: LayoutLoad = async ({ data, depends }) => {
	depends('supabase:auth');

	// Don't pass SvelteKit's fetch - it uses AbortController that can cancel
	// requests during hydration. Native browser fetch works fine for the client.
	const supabase = createBrowserClient<Database>(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY);

	// Always use the validated session from +layout.server.ts
	// The server validates via getUser() in safeGetSession
	const session = data.session;

	return {
		supabase,
		session,
		user: data.user
	};
};

<script lang="ts">
	import { supabase } from '$lib/supabase';

	let { data, children } = $props();

	async function handleLogout() {
		await supabase.auth.signOut();
		// Hard redirect to ensure server clears the auth cookies
		window.location.href = '/login';
	}
</script>

{#if !data.isAdmin}
	<div class="min-h-screen flex items-center justify-center p-4">
		<div class="card text-center max-w-md">
			<h1 class="heading mb-4">Not Authorized</h1>
			<p class="text-muted mb-6">
				You're signed in as {data.user?.email}, but this account doesn't have admin access.
			</p>
			<div class="flex gap-3 justify-center">
				<button class="btn-secondary" onclick={handleLogout}>Sign out</button>
			</div>
		</div>
	</div>
{:else}
	<div class="min-h-screen">
		<header class="border-b border-brown-200 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
			<div class="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
				<a href="/admin" class="text-lg font-bold text-brown-900 no-underline hover:text-brown-700">
					Admin
				</a>
				<div class="flex items-center gap-4">
					<span class="text-sm text-muted">{data.admin?.email}</span>
					<button class="btn-ghost text-sm py-2" onclick={handleLogout}>Logout</button>
				</div>
			</div>
		</header>

		<main class="max-w-4xl mx-auto px-4 py-6">
			{@render children()}
		</main>
	</div>
{/if}

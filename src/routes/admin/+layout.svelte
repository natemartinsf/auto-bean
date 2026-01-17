<script lang="ts">
	let { data, children } = $props();
</script>

{#if !data.isAdmin}
	<div class="min-h-screen flex items-center justify-center p-4">
		<div class="card text-center max-w-md">
			<h1 class="heading mb-4">Not Authorized</h1>
			<p class="text-muted mb-6">
				You're signed in as {data.user?.email}, but this account doesn't have admin access.
			</p>
			<form method="POST" action="/logout" class="flex justify-center">
				<button type="submit" class="btn-secondary">Sign out</button>
			</form>
		</div>
	</div>
{:else}
	<div class="min-h-screen">
		<header class="border-b border-brown-200 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
			<div class="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
				<nav class="flex items-center gap-6">
					<a href="/admin" class="text-lg font-bold text-brown-900 no-underline hover:text-brown-700">
						Admin
					</a>
					<a href="/admin/admins" class="text-sm text-brown-600 no-underline hover:text-brown-900">
						Manage Admins
					</a>
				</nav>
				<div class="flex items-center gap-4">
					<span class="text-sm text-muted">{data.admin?.email}</span>
					<form method="POST" action="/logout">
						<button type="submit" class="btn-ghost text-sm py-2">Logout</button>
					</form>
				</div>
			</div>
		</header>

		<main class="max-w-4xl mx-auto px-4 py-6">
			{@render children()}
		</main>
	</div>
{/if}

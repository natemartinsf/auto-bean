<script lang="ts">
	import { enhance } from '$app/forms';

	let { data, form } = $props();

	let email = $state('');
	let isSubmitting = $state(false);
</script>

<svelte:head>
	<title>Manage Admins - People's Choice Beer Voting</title>
</svelte:head>

<div class="space-y-8">
	<div>
		<h1 class="heading mb-2">Manage Admins</h1>
		<p class="text-muted">Add or remove users who can access the admin interface.</p>
	</div>

	<!-- Add Admin Form -->
	<div class="card">
		<h2 class="text-lg font-semibold text-brown-900 mb-4">Add Admin</h2>
		<form
			method="POST"
			action="?/add"
			use:enhance={() => {
				isSubmitting = true;
				return async ({ update }) => {
					await update();
					isSubmitting = false;
					if (form?.success) {
						email = '';
					}
				};
			}}
			class="flex gap-3"
		>
			<input
				type="email"
				name="email"
				bind:value={email}
				placeholder="user@example.com"
				required
				class="input flex-1"
			/>
			<button type="submit" disabled={isSubmitting} class="btn-primary whitespace-nowrap">
				{isSubmitting ? 'Adding...' : 'Add Admin'}
			</button>
		</form>
		{#if form?.error}
			<p class="text-red-600 text-sm mt-2">{form.error}</p>
		{/if}
		<p class="text-muted text-sm mt-3">
			The user must have already signed up before they can be added as an admin.
		</p>
	</div>

	<!-- Admin List -->
	<div class="card">
		<h2 class="text-lg font-semibold text-brown-900 mb-4">Current Admins</h2>
		{#if data.admins.length === 0}
			<p class="text-muted">No admins found.</p>
		{:else}
			<ul class="divide-y divide-brown-100">
				{#each data.admins as admin}
					{@const isSelf = admin.id === data.admin?.id}
					<li class="py-3 flex items-center justify-between">
						<div>
							<span class="text-brown-900">{admin.email}</span>
							{#if isSelf}
								<span class="text-xs text-muted ml-2">(you)</span>
							{/if}
						</div>
						{#if !isSelf}
							<form
								method="POST"
								action="?/remove"
								use:enhance={() => {
									if (!confirm(`Remove ${admin.email} as admin?`)) {
										return () => {};
									}
									return async ({ update }) => {
										await update();
									};
								}}
							>
								<input type="hidden" name="adminId" value={admin.id} />
								<button type="submit" class="btn-ghost text-red-600 hover:text-red-700 text-sm">
									Remove
								</button>
							</form>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}
	</div>
</div>

<script lang="ts">
	import { enhance } from '$app/forms';

	let { data, form } = $props();

	let email = $state('');
	let selectedOrgId = $state('');
	let isSubmitting = $state(false);
	let showResolved = $state(false);
	let orgName = $state('');
	let isCreatingOrg = $state(false);

	const pendingRequests = $derived(
		data.accessRequests.filter((r) => r.status === 'pending')
	);
	const resolvedRequests = $derived(
		data.accessRequests.filter((r) => r.status !== 'pending')
	);
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
						selectedOrgId = '';
					}
				};
			}}
			class="space-y-3"
		>
			<div class="flex gap-3">
				<input
					type="email"
					name="email"
					bind:value={email}
					placeholder="user@example.com"
					required
					class="input flex-1"
				/>
				<select name="organizationId" bind:value={selectedOrgId} required class="input">
					<option value="">Select org...</option>
					{#each data.organizations as org}
						<option value={org.id}>{org.name}</option>
					{/each}
				</select>
				<button type="submit" disabled={isSubmitting} class="btn-primary whitespace-nowrap">
					{isSubmitting ? 'Adding...' : 'Add Admin'}
				</button>
			</div>
		</form>
		{#if form?.error}
			<p class="text-red-600 text-sm mt-2">{form.error}</p>
		{:else if form?.success}
			<p class="text-green-600 text-sm mt-2">
				{form.invited ? 'Invite sent! They can log in after setting their password.' : 'Admin added.'}
			</p>
		{/if}
		<p class="text-muted text-sm mt-3">
			If the user doesn't have an account, they'll receive an invite email.
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
							{#if admin.organization_name}
								<span class="text-xs text-brown-500 ml-2">{admin.organization_name}</span>
							{/if}
							{#if isSelf}
								<span class="text-xs text-muted ml-1">(you)</span>
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

	<!-- Organizations -->
	<div class="card">
		<h2 class="text-lg font-semibold text-brown-900 mb-4">Organizations</h2>

		{#if data.organizations.length === 0}
			<p class="text-muted">No organizations yet.</p>
		{:else}
			<ul class="divide-y divide-brown-100 mb-4">
				{#each data.organizations as org}
					{@const adminCount = data.admins.filter(a => a.organization_id === org.id).length}
					<li class="py-3 flex items-center justify-between">
						<span class="text-brown-900">{org.name}</span>
						<span class="text-sm text-muted">{adminCount} admin{adminCount === 1 ? '' : 's'}</span>
					</li>
				{/each}
			</ul>
		{/if}

		<form
			method="POST"
			action="?/createOrg"
			use:enhance={() => {
				isCreatingOrg = true;
				return async ({ update }) => {
					await update();
					isCreatingOrg = false;
					if (form?.orgCreated) {
						orgName = '';
					}
				};
			}}
			class="flex gap-3"
		>
			<input
				type="text"
				name="orgName"
				bind:value={orgName}
				placeholder="Organization name"
				required
				class="input flex-1"
			/>
			<button type="submit" disabled={isCreatingOrg} class="btn-primary whitespace-nowrap">
				{isCreatingOrg ? 'Creating...' : 'Create Org'}
			</button>
		</form>
		{#if form?.orgError}
			<p class="text-red-600 text-sm mt-2">{form.orgError}</p>
		{:else if form?.orgCreated}
			<p class="text-green-600 text-sm mt-2">Organization created.</p>
		{/if}
	</div>

	<!-- Access Requests -->
	<div class="card">
		<h2 class="text-lg font-semibold text-brown-900 mb-4">Access Requests</h2>

		{#if pendingRequests.length === 0}
			<p class="text-muted">No pending requests.</p>
		{:else}
			<ul class="divide-y divide-brown-100">
				{#each pendingRequests as req}
					<li class="py-4">
						<div class="flex items-start justify-between gap-4">
							<div class="min-w-0 flex-1">
								<p class="font-medium text-brown-900">{req.name}</p>
								<p class="text-sm text-brown-700">{req.email}</p>
								<p class="text-sm text-muted">{req.club_name}</p>
								{#if req.message}
									<p class="text-sm text-brown-600 mt-1 italic">"{req.message}"</p>
								{/if}
								<p class="text-xs text-muted mt-1">
									{new Date(req.created_at ?? '').toLocaleDateString('en-US', {
										month: 'short',
										day: 'numeric',
										year: 'numeric'
									})}
								</p>
							</div>
							<div class="flex gap-2 shrink-0">
								<form method="POST" action="?/approveRequest" use:enhance>
									<input type="hidden" name="requestId" value={req.id} />
									<button type="submit" class="btn-primary text-sm px-3 py-1">Approve</button>
								</form>
								<form method="POST" action="?/dismissRequest" use:enhance>
									<input type="hidden" name="requestId" value={req.id} />
									<button type="submit" class="btn-ghost text-brown-500 hover:text-brown-700 text-sm">
										Dismiss
									</button>
								</form>
							</div>
						</div>
					</li>
				{/each}
			</ul>
		{/if}

		{#if resolvedRequests.length > 0}
			<div class="mt-4 pt-4 border-t border-brown-100">
				<button
					type="button"
					class="text-sm text-muted hover:text-brown-700 transition-colors"
					onclick={() => (showResolved = !showResolved)}
				>
					{showResolved ? 'Hide' : 'Show'} resolved ({resolvedRequests.length})
				</button>

				{#if showResolved}
					<ul class="divide-y divide-brown-100 mt-3">
						{#each resolvedRequests as req}
							<li class="py-3 opacity-60">
								<div class="flex items-start justify-between gap-4">
									<div class="min-w-0 flex-1">
										<p class="font-medium text-brown-900">{req.name}</p>
										<p class="text-sm text-brown-700">{req.email}</p>
										<p class="text-sm text-muted">{req.club_name}</p>
										{#if req.message}
											<p class="text-sm text-brown-600 mt-1 italic">"{req.message}"</p>
										{/if}
										<p class="text-xs text-muted mt-1">
											{new Date(req.created_at ?? '').toLocaleDateString('en-US', {
												month: 'short',
												day: 'numeric',
												year: 'numeric'
											})}
										</p>
									</div>
									<span
										class="text-xs font-medium px-2 py-1 rounded-full shrink-0 {req.status === 'approved'
											? 'bg-green-100 text-green-700'
											: 'bg-brown-100 text-brown-500'}"
									>
										{req.status}
									</span>
								</div>
							</li>
						{/each}
					</ul>
				{/if}
			</div>
		{/if}
	</div>
</div>

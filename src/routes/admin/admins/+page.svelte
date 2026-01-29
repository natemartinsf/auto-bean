<script lang="ts">
	import { enhance } from '$app/forms';

	let { data, form } = $props();

	let email = $state('');
	let selectedOrgId = $state('');
	let isSubmitting = $state(false);
	let showResolved = $state(false);
	let orgName = $state('');
	let isCreatingOrg = $state(false);

	// Approve flow state: which request is being approved, and org selection
	let approvingRequestId = $state<string | null>(null);
	let approveOrgChoice = $state<'existing' | 'new'>('new');
	let approveOrgId = $state('');
	let approveNewOrgName = $state('');
	let isApproving = $state(false);

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
					class="input flex-1 !w-auto min-w-0"
				/>
				<select name="organizationId" bind:value={selectedOrgId} required class="input !w-auto shrink-0">
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
					<li class="py-3 flex items-center justify-between gap-3">
						<div class="flex items-center gap-2 min-w-0 flex-1">
							<span class="text-brown-900 truncate">{admin.email}</span>
							{#if isSelf}
								<span class="text-xs text-muted shrink-0">(you)</span>
							{/if}
						</div>
						<div class="flex items-center gap-2 shrink-0">
							<form
								method="POST"
								action="?/changeOrg"
								use:enhance={() => {
									return async ({ update }) => {
										await update();
									};
								}}
							>
								<input type="hidden" name="adminId" value={admin.id} />
								<select
									name="organizationId"
									class="input !py-1 !text-xs"
									value={admin.organization_id}
									onchange={(e) => e.currentTarget.form?.requestSubmit()}
								>
									{#each data.organizations as org}
										<option value={org.id}>{org.name}</option>
									{/each}
								</select>
							</form>
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
						</div>
					</li>
				{/each}
			</ul>
		{/if}
		{#if form?.changeOrgError}
			<p class="text-red-600 text-sm mt-2">{form.changeOrgError}</p>
		{:else if form?.changeOrgSuccess}
			<p class="text-green-600 text-sm mt-2">Organization updated.</p>
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
					{@const isExpanded = approvingRequestId === req.id}
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
							{#if !isExpanded}
								<div class="flex gap-2 shrink-0">
									<button
										type="button"
										class="btn-primary text-sm px-3 py-1"
										onclick={() => {
											approvingRequestId = req.id;
											approveOrgChoice = 'new';
											approveOrgId = '';
											approveNewOrgName = req.club_name;
										}}
									>Approve</button>
									<form method="POST" action="?/dismissRequest" use:enhance>
										<input type="hidden" name="requestId" value={req.id} />
										<button type="submit" class="btn-ghost text-brown-500 hover:text-brown-700 text-sm">
											Dismiss
										</button>
									</form>
								</div>
							{:else}
								<button
									type="button"
									class="btn-ghost text-brown-500 hover:text-brown-700 text-sm shrink-0"
									onclick={() => { approvingRequestId = null; }}
								>Cancel</button>
							{/if}
						</div>

						{#if isExpanded}
							<form
								method="POST"
								action="?/approveRequest"
								use:enhance={() => {
									isApproving = true;
									return async ({ update }) => {
										await update();
										isApproving = false;
										if (form?.approveSuccess) {
											approvingRequestId = null;
										}
									};
								}}
								class="mt-4 p-4 bg-brown-50 rounded-lg space-y-3"
							>
								<input type="hidden" name="requestId" value={req.id} />
								<p class="text-sm font-medium text-brown-900">Assign organization</p>

								<div class="flex gap-4">
									<label class="flex items-center gap-1.5 text-sm text-brown-700 cursor-pointer">
										<input type="radio" bind:group={approveOrgChoice} value="new" class="accent-amber-700" />
										Create new
									</label>
									<label class="flex items-center gap-1.5 text-sm text-brown-700 cursor-pointer">
										<input type="radio" bind:group={approveOrgChoice} value="existing" class="accent-amber-700" />
										Use existing
									</label>
								</div>

								{#if approveOrgChoice === 'new'}
									<input
										type="text"
										name="newOrgName"
										bind:value={approveNewOrgName}
										placeholder="Organization name"
										required
										class="input w-full"
									/>
								{:else}
									<select name="organizationId" bind:value={approveOrgId} required class="input w-full">
										<option value="">Select organization...</option>
										{#each data.organizations as org}
											<option value={org.id}>{org.name}</option>
										{/each}
									</select>
								{/if}

								{#if form?.approveError && form?.approveRequestId === req.id}
									<p class="text-red-600 text-sm">{form.approveError}</p>
								{/if}

								<button type="submit" disabled={isApproving} class="btn-primary text-sm">
									{isApproving ? 'Approving...' : 'Confirm & Invite'}
								</button>
							</form>
						{/if}
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

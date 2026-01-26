<script lang="ts">
	import { enhance } from '$app/forms';

	let { data, form } = $props();

	let name = $state('');
	let date = $state('');
	let maxPoints = $state('5');
	let isSubmitting = $state(false);
</script>

<svelte:head>
	<title>Admin - People's Choice Beer Voting</title>
</svelte:head>

<div class="space-y-8">
	<div>
		<h1 class="heading mb-2">Events</h1>
		<p class="text-muted">Manage your beer voting events.</p>
	</div>

	<!-- Create Event Form -->
	<div class="card">
		<h2 class="text-lg font-semibold text-brown-900 mb-4">Create Event</h2>
		<form
			method="POST"
			action="?/create"
			use:enhance={() => {
				isSubmitting = true;
				return async ({ update }) => {
					await update();
					isSubmitting = false;
					if (form?.success) {
						name = '';
						date = '';
						maxPoints = '5';
					}
				};
			}}
			class="space-y-4"
		>
			<div>
				<label for="name" class="block text-sm font-medium text-brown-700 mb-1">
					Event Name <span class="text-red-500">*</span>
				</label>
				<input
					type="text"
					id="name"
					name="name"
					bind:value={name}
					placeholder="Summer Homebrew Competition"
					required
					class="input w-full"
				/>
			</div>

			<div class="grid grid-cols-2 gap-4">
				<div>
					<label for="date" class="block text-sm font-medium text-brown-700 mb-1">
						Date <span class="text-muted text-xs">(optional)</span>
					</label>
					<input
						type="date"
						id="date"
						name="date"
						bind:value={date}
						class="input w-full"
						class:input-date-empty={!date}
					/>
				</div>

				<div>
					<label for="max_points" class="block text-sm font-medium text-brown-700 mb-1">
						Max Points <span class="text-muted text-xs">(default: 5)</span>
					</label>
					<input
						type="number"
						id="max_points"
						name="max_points"
						bind:value={maxPoints}
						min="1"
						max="100"
						class="input w-full"
					/>
				</div>
			</div>

			<button type="submit" disabled={isSubmitting} class="btn-primary">
				{isSubmitting ? 'Creating...' : 'Create Event'}
			</button>
		</form>
		{#if form?.error}
			<p class="text-red-600 text-sm mt-3">{form.error}</p>
		{:else if form?.success}
			<p class="text-green-600 text-sm mt-3">Event created!</p>
		{/if}
	</div>

	<!-- Event List -->
	<div>
		<h2 class="text-lg font-semibold text-brown-900 mb-4">Your Events</h2>
		{#if data.error}
			<p class="text-red-600">Failed to load events: {data.error}</p>
		{:else if data.events.length === 0}
			<div class="card">
				<p class="text-muted">No events yet. Create your first event above.</p>
			</div>
		{:else}
			<div class="space-y-3">
				{#each data.events as event}
					<div class="card-interactive flex items-center justify-between">
						<a href="/admin/events/{data.eventCodeMap[event.id] ?? event.id}" class="flex-1 no-underline">
							<h3 class="font-medium text-brown-900">
								{event.name}
							</h3>
							<div class="text-sm text-muted mt-1 space-x-3">
								{#if event.date}
									<span>{new Date(event.date).toLocaleDateString()}</span>
								{/if}
								<span>{event.max_points} points max</span>
								{#if (event.reveal_stage ?? 0) > 0}
									<span class="text-green-600">
										{#if event.reveal_stage === 1}Ceremony started
										{:else if event.reveal_stage === 2}3rd revealed
										{:else if event.reveal_stage === 3}2nd revealed
										{:else if event.reveal_stage === 4}Results revealed
										{/if}
									</span>
								{/if}
							</div>
						</a>
						<form
							method="POST"
							action="?/delete"
							use:enhance={() => {
								if (!confirm(`Delete "${event.name}"? This will also delete all beers, votes, and feedback for this event.`)) {
									return () => {};
								}
								return async ({ update }) => {
									await update();
								};
							}}
						>
							<input type="hidden" name="eventId" value={event.id} />
							<button type="submit" class="btn-ghost text-red-600 hover:text-red-700 text-sm ml-4">
								Delete
							</button>
						</form>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>

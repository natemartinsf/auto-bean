<script lang="ts">
	import { enhance } from '$app/forms';
	import { onMount } from 'svelte';
	import type { Beer } from '$lib/types';

	let { data, form } = $props();

	let name = $state('');
	let brewer = $state('');
	let style = $state('');
	let isSubmitting = $state(false);
	let beers = $state<Beer[]>(data.beers);

	// Real-time subscription for beer updates
	onMount(() => {
		const channel = data.supabase
			.channel('beers-changes')
			.on(
				'postgres_changes',
				{
					event: 'INSERT',
					schema: 'public',
					table: 'beers',
					filter: `event_id=eq.${data.event.id}`
				},
				(payload) => {
					const newBeer = payload.new as Beer;
					// Only add if not already in list (avoid duplicates from own submission)
					if (!beers.some((b) => b.id === newBeer.id)) {
						beers = [...beers, newBeer];
					}
				}
			)
			.subscribe();

		return () => {
			data.supabase.removeChannel(channel);
		};
	});
</script>

<svelte:head>
	<title>Add Beers - {data.event.name}</title>
</svelte:head>

<div class="min-h-screen">
	<header class="border-b border-brown-200 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
		<div class="max-w-2xl mx-auto px-4 py-4">
			<h1 class="text-xl font-bold text-brown-900">{data.event.name}</h1>
			<p class="text-sm text-muted">Tap Volunteer - Add beers as they're tapped</p>
		</div>
	</header>

	<main class="max-w-2xl mx-auto px-4 py-6 space-y-6">
		<!-- Add Beer Form -->
		<div class="card">
			<h2 class="text-lg font-semibold text-brown-900 mb-4">Add Beer</h2>
			<form
				method="POST"
				action="?/addBeer"
				use:enhance={() => {
					isSubmitting = true;
					return async ({ update, result }) => {
						await update();
						isSubmitting = false;
						if (result.type === 'success') {
							// Reset form - beer will appear via real-time subscription
							name = '';
							brewer = '';
							style = '';
						}
					};
				}}
				class="space-y-4"
			>
				<div>
					<label for="name" class="block text-sm font-medium text-brown-700 mb-1">
						Beer Name <span class="text-red-500">*</span>
					</label>
					<input
						type="text"
						id="name"
						name="name"
						bind:value={name}
						placeholder="Hoppy McHopface IPA"
						required
						class="input w-full"
					/>
				</div>

				<div>
					<label for="brewer" class="block text-sm font-medium text-brown-700 mb-1">
						Brewer <span class="text-red-500">*</span>
					</label>
					<input
						type="text"
						id="brewer"
						name="brewer"
						bind:value={brewer}
						placeholder="John Smith"
						required
						class="input w-full"
					/>
				</div>

				<div>
					<label for="style" class="block text-sm font-medium text-brown-700 mb-1">
						Style <span class="text-muted text-xs">(optional)</span>
					</label>
					<input
						type="text"
						id="style"
						name="style"
						bind:value={style}
						placeholder="West Coast IPA"
						class="input w-full"
					/>
				</div>

				<button type="submit" disabled={isSubmitting} class="btn-primary w-full">
					{isSubmitting ? 'Adding...' : 'Add Beer'}
				</button>
			</form>
			{#if form?.error}
				<p class="text-red-600 text-sm mt-3">{form.error}</p>
			{:else if form?.success}
				<p class="text-green-600 text-sm mt-3">Beer added!</p>
			{/if}
		</div>

		<!-- Beer List -->
		<div class="card">
			<h2 class="text-lg font-semibold text-brown-900 mb-4">
				Beers on Tap ({beers.length})
			</h2>
			{#if beers.length === 0}
				<p class="text-muted">No beers added yet. Add the first one above!</p>
			{:else}
				<ul class="divide-y divide-brown-100">
					{#each beers as beer (beer.id)}
						<li class="py-3">
							<div class="font-medium text-brown-900">{beer.name}</div>
							<div class="text-sm text-muted">
								by {beer.brewer}
								{#if beer.style}
									<span class="mx-1">·</span>
									{beer.style}
								{/if}
							</div>
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	</main>
</div>

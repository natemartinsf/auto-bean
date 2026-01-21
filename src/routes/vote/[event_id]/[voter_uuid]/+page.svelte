<script lang="ts">
	import { onMount } from 'svelte';
	import type { Beer } from '$lib/types';

	let { data } = $props();

	let beers = $state<Beer[]>(data.beers);

	// Real-time subscription for beer updates
	onMount(() => {
		const channel = data.supabase
			.channel('voter-beers')
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
					if (!beers.some((b) => b.id === newBeer.id)) {
						beers = [...beers, newBeer];
					}
				}
			)
			.on(
				'postgres_changes',
				{
					event: 'DELETE',
					schema: 'public',
					table: 'beers'
				},
				(payload) => {
					const deletedId = payload.old.id;
					beers = beers.filter((b) => b.id !== deletedId);
				}
			)
			.subscribe();

		return () => {
			data.supabase.removeChannel(channel);
		};
	});
</script>

<svelte:head>
	<title>Vote - {data.event.name}</title>
</svelte:head>

<div class="min-h-screen">
	<header class="border-b border-brown-200 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
		<div class="max-w-2xl mx-auto px-4 py-4">
			<h1 class="text-xl font-bold text-brown-900">{data.event.name}</h1>
			<p class="text-sm text-muted">
				Allocate up to {data.event.max_points} points across your favorite beers
			</p>
		</div>
	</header>

	<main class="max-w-2xl mx-auto px-4 py-6">
		{#if beers.length === 0}
			<div class="card text-center py-8">
				<p class="text-muted">No beers have been added yet.</p>
				<p class="text-sm text-muted mt-2">Check back soon!</p>
			</div>
		{:else}
			<div class="space-y-4">
				{#each beers as beer (beer.id)}
					<div class="card">
						<div class="font-medium text-brown-900 text-lg">{beer.name}</div>
						<div class="text-sm text-muted">
							by {beer.brewer}
							{#if beer.style}
								<span class="mx-1">·</span>
								{beer.style}
							{/if}
						</div>
						<!-- Point allocation UI will be added in Task 5.2/5.3 -->
					</div>
				{/each}
			</div>
		{/if}
	</main>
</div>

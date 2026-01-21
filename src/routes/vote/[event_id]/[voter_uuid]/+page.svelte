<script lang="ts">
	import { onMount } from 'svelte';
	import type { Beer, Vote } from '$lib/types';
	import PointPicker from '$lib/components/PointPicker.svelte';

	let { data } = $props();

	// Initialize beers from server data
	let beers = $state<Beer[]>([]);

	// Votes keyed by beer_id
	let votesByBeer = $state<Record<string, number>>({});

	// Error state for failed saves
	let saveError = $state<string | null>(null);

	// Sync from server data (runs once on mount, and if data.beers changes)
	$effect(() => {
		beers = [...data.beers];
	});

	// Initialize votes from server data
	$effect(() => {
		const votesMap: Record<string, number> = {};
		for (const vote of data.votes) {
			votesMap[vote.beer_id] = vote.points;
		}
		votesByBeer = votesMap;
	});

	// Calculate total points used
	const totalUsed = $derived(
		Object.values(votesByBeer).reduce((sum, points) => sum + points, 0)
	);

	// Calculate maxSelectable for a beer: current value + remaining points
	function getMaxSelectable(beerId: string): number {
		const currentValue = votesByBeer[beerId] ?? 0;
		const remaining = data.event.max_points - totalUsed;
		return currentValue + remaining;
	}

	// Handle vote change
	async function handleVoteChange(beerId: string, newPoints: number) {
		const oldPoints = votesByBeer[beerId] ?? 0;

		// Optimistically update UI
		votesByBeer[beerId] = newPoints;
		saveError = null;

		// Upsert to database
		const { error } = await data.supabase.from('votes').upsert(
			{
				voter_id: data.voter.id,
				beer_id: beerId,
				points: newPoints,
				updated_at: new Date().toISOString()
			},
			{
				onConflict: 'voter_id,beer_id'
			}
		);

		if (error) {
			// Revert on failure
			votesByBeer[beerId] = oldPoints;

			// Check if it's a validation error (total points exceeded)
			if (error.message?.includes('would exceed maximum')) {
				saveError = `You've used all ${data.event.max_points} points. Remove points from another beer first.`;
			} else {
				saveError = 'Failed to save vote. Please try again.';
			}
			console.error('Error saving vote:', error);
		}
	}

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
					// Also remove any votes for deleted beers
					if (deletedId in votesByBeer) {
						const { [deletedId]: _, ...rest } = votesByBeer;
						votesByBeer = rest;
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
	<title>Vote - {data.event.name}</title>
</svelte:head>

<div class="min-h-screen">
	<header class="border-b border-brown-200 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
		<div class="max-w-2xl mx-auto px-4 py-4">
			<h1 class="text-xl font-bold text-brown-900">{data.event.name}</h1>
			<p class="text-sm text-muted">
				{totalUsed} of {data.event.max_points} points used
			</p>
		</div>
	</header>

	<main class="max-w-2xl mx-auto px-4 py-6">
		{#if saveError}
			<div class="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
				{saveError}
			</div>
		{/if}

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
						<div class="text-sm text-muted mb-3">
							by {beer.brewer}
							{#if beer.style}
								<span class="mx-1">·</span>
								{beer.style}
							{/if}
						</div>
						<PointPicker
							max={data.event.max_points}
							value={votesByBeer[beer.id] ?? 0}
							maxSelectable={getMaxSelectable(beer.id)}
							onchange={(points) => handleVoteChange(beer.id, points)}
						/>
					</div>
				{/each}
			</div>
		{/if}
	</main>
</div>

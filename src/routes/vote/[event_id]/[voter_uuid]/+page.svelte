<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import type { Beer, Vote, Feedback } from '$lib/types';
	import PointPicker from '$lib/components/PointPicker.svelte';

	let { data } = $props();

	// Initialize beers from server data
	let beers = $state<Beer[]>([]);

	// Votes keyed by beer_id
	let votesByBeer = $state<Record<string, number>>({});

	// Feedback keyed by beer_id
	let feedbackByBeer = $state<Record<string, { notes: string; shareWithBrewer: boolean }>>({});

	// Track which beer cards have expanded feedback forms
	let expandedFeedback = $state<Record<string, boolean>>({});

	// Error state for failed saves
	let saveError = $state<string | null>(null);

	// Track if a save is in progress (prevents race conditions from rapid clicks)
	let saving = $state(false);

	// Track feedback saves separately (don't block votes)
	let savingFeedback = $state<Record<string, boolean>>({});

	// Sync from server data (runs once on mount, and if data.beers changes)
	$effect(() => {
		beers = [...data.beers];
	});

	// Initialize votes from server data
	$effect(() => {
		const votesMap: Record<string, number> = {};
		for (const vote of data.votes) {
			if (vote.beer_id && vote.points !== null) {
				votesMap[vote.beer_id] = vote.points;
			}
		}
		votesByBeer = votesMap;
	});

	// Initialize feedback from server data
	$effect(() => {
		const feedbackMap: Record<string, { notes: string; shareWithBrewer: boolean }> = {};
		const expandedMap: Record<string, boolean> = {};
		for (const fb of data.feedback) {
			if (!fb.beer_id) continue;
			feedbackMap[fb.beer_id] = {
				notes: fb.notes || '',
				shareWithBrewer: fb.share_with_brewer ?? false
			};
			// Auto-expand if feedback exists
			if (fb.notes || fb.share_with_brewer) {
				expandedMap[fb.beer_id] = true;
			}
		}
		feedbackByBeer = feedbackMap;
		expandedFeedback = expandedMap;
	});

	// Calculate total points used
	const totalUsed = $derived(
		Object.values(votesByBeer).reduce((sum, points) => sum + points, 0)
	);

	// Calculate maxSelectable for a beer: current value + remaining points
	function getMaxSelectable(beerId: string): number {
		const currentValue = votesByBeer[beerId] ?? 0;
		const maxPoints = data.event.max_points ?? 5;
		const remaining = maxPoints - totalUsed;
		return currentValue + remaining;
	}

	// Handle vote change
	async function handleVoteChange(beerId: string, newPoints: number) {
		if (saving) return; // Prevent concurrent saves

		const oldPoints = votesByBeer[beerId] ?? 0;

		// Optimistically update UI and lock during save
		votesByBeer[beerId] = newPoints;
		saveError = null;
		saving = true;

		try {
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
				// Ignore AbortError - this happens when rapid clicks cause request cancellation.
				// The optimistic UI update is still valid since a subsequent request will succeed.
				if (error.message?.includes('AbortError') || error.name === 'AbortError') {
					return;
				}

				// Revert on failure
				votesByBeer[beerId] = oldPoints;

				// Check error code for structured detection (P0002 = VOTE_LIMIT_EXCEEDED)
				if (error.code === 'P0002') {
					saveError = `You've used all ${data.event.max_points ?? 5} points. Remove points from another beer first.`;
				} else {
					saveError = 'Failed to save vote. Please try again.';
				}
				console.error('Error saving vote:', error);
			}
		} catch (err) {
			// Catch AbortError thrown as exception (different Supabase versions handle this differently)
			if (err instanceof Error && (err.name === 'AbortError' || err.message?.includes('aborted'))) {
				return;
			}
			// Revert on unexpected error
			votesByBeer[beerId] = oldPoints;
			saveError = 'Failed to save vote. Please try again.';
			console.error('Error saving vote:', err);
		} finally {
			saving = false;
		}
	}

	// Toggle feedback form visibility
	function toggleFeedback(beerId: string) {
		expandedFeedback[beerId] = !expandedFeedback[beerId];
	}

	// Get feedback for a beer (with defaults)
	function getFeedback(beerId: string): { notes: string; shareWithBrewer: boolean } {
		return feedbackByBeer[beerId] || { notes: '', shareWithBrewer: false };
	}

	// Save feedback to database
	async function saveFeedback(beerId: string) {
		if (savingFeedback[beerId]) return;

		const fb = getFeedback(beerId);
		savingFeedback[beerId] = true;

		try {
			const { error } = await data.supabase.from('feedback').upsert(
				{
					voter_id: data.voter.id,
					beer_id: beerId,
					notes: fb.notes || null,
					share_with_brewer: fb.shareWithBrewer
				},
				{
					onConflict: 'voter_id,beer_id'
				}
			);

			if (error) {
				console.error('Error saving feedback:', error);
				saveError = 'Failed to save feedback. Please try again.';
			}
		} finally {
			savingFeedback[beerId] = false;
		}
	}

	// Handle notes change (update local state, save on blur)
	function handleNotesChange(beerId: string, value: string) {
		const current = feedbackByBeer[beerId] || { notes: '', shareWithBrewer: false };
		feedbackByBeer[beerId] = { ...current, notes: value };
	}

	// Handle checkbox change (update local state and save immediately)
	async function handleShareChange(beerId: string, checked: boolean) {
		const current = feedbackByBeer[beerId] || { notes: '', shareWithBrewer: false };
		feedbackByBeer[beerId] = { ...current, shareWithBrewer: checked };
		await saveFeedback(beerId);
	}

	// Real-time subscriptions
	onMount(() => {
		// Subscribe to beer changes
		const beersChannel = data.supabase
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

		// Subscribe to event changes (for ceremony start)
		const eventChannel = data.supabase
			.channel('voter-event')
			.on(
				'postgres_changes',
				{
					event: 'UPDATE',
					schema: 'public',
					table: 'events',
					filter: `id=eq.${data.event.id}`
				},
				(payload) => {
					const updated = payload.new as { reveal_stage: number };
					if (updated.reveal_stage > 0) {
						goto(`/results/${data.event.id}`);
					}
				}
			)
			.subscribe();

		return () => {
			data.supabase.removeChannel(beersChannel);
			data.supabase.removeChannel(eventChannel);
		};
	});
</script>

<svelte:head>
	<title>Vote - {data.event.name}</title>
</svelte:head>

<div class="min-h-screen">
	<header class="border-b border-brown-200 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
		<div class="max-w-2xl mx-auto px-4 py-4">
			<div class="flex items-center gap-3">
				{#if data.event.logo_url}
					<img
						src={data.event.logo_url}
						alt="{data.event.name} logo"
						class="h-10 w-auto object-contain"
					/>
				{/if}
				<div>
					<h1 class="text-xl font-bold text-brown-900">{data.event.name}</h1>
					<p class="text-sm text-muted">
						{totalUsed} of {data.event.max_points ?? 5} points used
					</p>
				</div>
			</div>
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
							{#if beer.brewer && !data.event.blind_tasting}
								by {beer.brewer}
								{#if beer.style}
									<span class="mx-1">·</span>
								{/if}
							{/if}
							{#if beer.style}
								{beer.style}
							{/if}
						</div>
						<PointPicker
							max={data.event.max_points ?? 5}
							value={votesByBeer[beer.id] ?? 0}
							maxSelectable={getMaxSelectable(beer.id)}
							disabled={saving}
							onchange={(points) => handleVoteChange(beer.id, points)}
						/>

						<!-- Feedback toggle -->
						<button
							type="button"
							class="mt-3 text-sm text-amber-700 hover:text-amber-800 flex items-center gap-1"
							onclick={() => toggleFeedback(beer.id)}
						>
							{#if expandedFeedback[beer.id]}
								<span class="text-xs">▼</span> Hide feedback
							{:else}
								<span class="text-xs">▶</span> Add feedback
							{/if}
						</button>

						<!-- Expanded feedback form -->
						{#if expandedFeedback[beer.id]}
							<div class="mt-3 pt-3 border-t border-brown-100">
								<textarea
									class="w-full px-3 py-2 text-sm border border-brown-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-none"
									rows="2"
									placeholder="What did you think of this beer?"
									value={getFeedback(beer.id).notes}
									oninput={(e) => handleNotesChange(beer.id, e.currentTarget.value)}
									onblur={() => saveFeedback(beer.id)}
								></textarea>
								<label class="flex items-center gap-2 mt-2 text-sm text-brown-700 cursor-pointer">
									<input
										type="checkbox"
										class="w-4 h-4 rounded border-brown-300 text-amber-600 focus:ring-amber-500"
										checked={getFeedback(beer.id).shareWithBrewer}
										onchange={(e) => handleShareChange(beer.id, e.currentTarget.checked)}
									/>
									Share with brewer
								</label>
							</div>
						{/if}
					</div>
				{/each}
			</div>
		{/if}
	</main>
</div>

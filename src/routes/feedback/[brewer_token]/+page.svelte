<script lang="ts">
	import { onMount } from 'svelte';
	import type { Feedback } from '$lib/types';

	let { data } = $props();

	type FeedbackItem = Pick<Feedback, 'id' | 'notes' | 'created_at'>;
	let feedback = $state<FeedbackItem[]>([]);

	// Sync state with props when data changes
	$effect(() => {
		feedback = data.feedback;
	});

	// Real-time subscription for new feedback
	onMount(() => {
		const channel = data.supabase
			.channel('feedback-changes')
			.on(
				'postgres_changes',
				{
					event: 'INSERT',
					schema: 'public',
					table: 'feedback',
					filter: `beer_id=eq.${data.beer.id}`
				},
				(payload) => {
					const newFeedback = payload.new as Feedback;
					// Only add if share_with_brewer is true and not already in list
					if (newFeedback.share_with_brewer && !feedback.some((f) => f.id === newFeedback.id)) {
						feedback = [
							{ id: newFeedback.id, notes: newFeedback.notes, created_at: newFeedback.created_at },
							...feedback
						];
					}
				}
			)
			.on(
				'postgres_changes',
				{
					event: 'UPDATE',
					schema: 'public',
					table: 'feedback',
					filter: `beer_id=eq.${data.beer.id}`
				},
				(payload) => {
					const updated = payload.new as Feedback;
					if (updated.share_with_brewer) {
						// Add or update in list
						const exists = feedback.some((f) => f.id === updated.id);
						if (exists) {
							feedback = feedback.map((f) =>
								f.id === updated.id
									? { id: updated.id, notes: updated.notes, created_at: updated.created_at }
									: f
							);
						} else {
							feedback = [
								{ id: updated.id, notes: updated.notes, created_at: updated.created_at },
								...feedback
							];
						}
					} else {
						// Remove from list if share_with_brewer was turned off
						feedback = feedback.filter((f) => f.id !== updated.id);
					}
				}
			)
			.on(
				'postgres_changes',
				{
					event: 'DELETE',
					schema: 'public',
					table: 'feedback'
				},
				(payload) => {
					const deletedId = payload.old.id;
					feedback = feedback.filter((f) => f.id !== deletedId);
				}
			)
			.subscribe();

		return () => {
			data.supabase.removeChannel(channel);
		};
	});

	function formatDate(dateString: string | null): string {
		if (!dateString) return '';
		const date = new Date(dateString);
		return date.toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			hour: 'numeric',
			minute: '2-digit'
		});
	}
</script>

<svelte:head>
	<title>Feedback - {data.beer.name}</title>
</svelte:head>

<div class="min-h-screen">
	<header class="border-b border-brown-200 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
		<div class="max-w-2xl mx-auto px-4 py-4">
			<h1 class="text-xl font-bold text-brown-900">{data.beer.name}</h1>
			<p class="text-sm text-muted">
				by {data.beer.brewer}
				{#if data.beer.style}
					<span class="mx-1">·</span>
					{data.beer.style}
				{/if}
			</p>
		</div>
	</header>

	<main class="max-w-2xl mx-auto px-4 py-6">
		<div class="card">
			<h2 class="text-lg font-semibold text-brown-900 mb-4">
				Voter Feedback
				{#if feedback.length > 0}
					<span class="text-muted font-normal">({feedback.length})</span>
				{/if}
			</h2>

			{#if feedback.length === 0}
				<div class="text-center py-8">
					<p class="text-muted">No feedback shared yet.</p>
					<p class="text-sm text-muted mt-1">
						Feedback will appear here as voters choose to share their notes with you.
					</p>
				</div>
			{:else}
				<ul class="space-y-4">
					{#each feedback as item (item.id)}
						<li class="border-l-2 border-amber-400 pl-4 py-1">
							{#if item.notes}
								<p class="text-brown-800 whitespace-pre-wrap">{item.notes}</p>
							{:else}
								<p class="text-muted italic">No notes provided</p>
							{/if}
							<p class="text-xs text-muted mt-1">{formatDate(item.created_at)}</p>
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	</main>
</div>

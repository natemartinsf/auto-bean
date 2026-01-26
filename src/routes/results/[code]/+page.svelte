<script lang="ts">
	import { onMount } from 'svelte';
	import type { Beer } from '$lib/types';
	import confetti from 'canvas-confetti';

	interface RankedBeer extends Beer {
		totalPoints: number;
		voterCount: number;
		rank: number;
	}

	let { data } = $props();

	// Track current reveal stage (synced from server data initially, then real-time updates)
	let revealStage = $state(0);

	// Sync state with props when data changes
	$effect(() => {
		revealStage = data.event.reveal_stage ?? 0;
	});

	// Track which places have been "revealed" with animation
	// This prevents re-animating when returning to page
	let animatedPlaces = $state<Set<number>>(new Set());

	// Confetti fired flag
	let confettiFired = $state(false);

	// Group beers by score tier for podium reveal (handles ties)
	// We reveal by "podium position" (3rd, 2nd, 1st) not literal rank numbers
	const scoreTiers = $derived.by(() => {
		// Get unique scores in descending order
		const uniqueScores = [...new Set(data.rankedBeers.map((b: RankedBeer) => b.totalPoints))].sort(
			(a, b) => b - a
		);

		// Map each tier to its beers
		return uniqueScores.map((score, index) => ({
			position: index + 1, // 1st, 2nd, 3rd, etc.
			score,
			beers: data.rankedBeers.filter((b: RankedBeer) => b.totalPoints === score)
		}));
	});

	// Get podium tiers (top 3 positions for staged reveal)
	const firstPlace = $derived(scoreTiers.find((t) => t.position === 1)?.beers || []);
	const secondPlace = $derived(scoreTiers.find((t) => t.position === 2)?.beers || []);
	const thirdPlace = $derived(scoreTiers.find((t) => t.position === 3)?.beers || []);

	const restOfRankings = $derived(
		scoreTiers
			.filter((t) => t.position > 3)
			.flatMap((t) => t.beers)
	);

	// Trigger animations when stage changes
	$effect(() => {
		if (revealStage >= 2 && !animatedPlaces.has(3)) {
			animatedPlaces = new Set([...animatedPlaces, 3]);
		}
		if (revealStage >= 3 && !animatedPlaces.has(2)) {
			animatedPlaces = new Set([...animatedPlaces, 2]);
		}
		if (revealStage >= 4 && !animatedPlaces.has(1)) {
			animatedPlaces = new Set([...animatedPlaces, 1]);
			// Fire confetti when 1st place is revealed
			if (!confettiFired) {
				confettiFired = true;
				fireConfetti();
			}
		}
	});

	function fireConfetti() {
		// Multiple bursts for celebration effect
		const duration = 3000;
		const end = Date.now() + duration;

		const colors = ['#f59e0b', '#d97706', '#fbbf24', '#92400e'];

		(function frame() {
			confetti({
				particleCount: 4,
				angle: 60,
				spread: 55,
				origin: { x: 0, y: 0.7 },
				colors
			});
			confetti({
				particleCount: 4,
				angle: 120,
				spread: 55,
				origin: { x: 1, y: 0.7 },
				colors
			});

			if (Date.now() < end) {
				requestAnimationFrame(frame);
			}
		})();

		// Big burst in the center
		setTimeout(() => {
			confetti({
				particleCount: 100,
				spread: 100,
				origin: { x: 0.5, y: 0.5 },
				colors
			});
		}, 500);
	}

	// Real-time subscription
	onMount(() => {
		// If already at stage 4, mark all as animated (returning to page)
		if (revealStage >= 4) {
			animatedPlaces = new Set([1, 2, 3]);
			confettiFired = true;
		} else if (revealStage >= 3) {
			animatedPlaces = new Set([2, 3]);
		} else if (revealStage >= 2) {
			animatedPlaces = new Set([3]);
		}

		const channel = data.supabase
			.channel('results-event')
			.on(
				'postgres_changes',
				{
					event: 'UPDATE',
					schema: 'public',
					table: 'events',
					filter: `id=eq.${data.event.id}`
				},
				(payload) => {
					const updated = payload.new as { reveal_stage: number | null };
					revealStage = updated.reveal_stage ?? 0;
				}
			)
			.subscribe();

		return () => {
			data.supabase.removeChannel(channel);
		};
	});
</script>

<svelte:head>
	<title>Results - {data.event.name}</title>
</svelte:head>

<div class="min-h-screen flex flex-col">
	<!-- Stage 0: Voting in progress -->
	{#if revealStage === 0}
		<div class="flex-1 flex flex-col items-center justify-center p-8 text-center">
			<div class="text-6xl mb-6">🍺</div>
			<h1 class="text-3xl md:text-4xl font-bold text-brown-900 mb-4">Voting in Progress</h1>
			<p class="text-lg text-muted max-w-md">
				Results will be revealed during the awards ceremony. Stay tuned!
			</p>
		</div>

		<!-- Stage 1+: Ceremony has started -->
	{:else}
		<header class="py-8 text-center border-b border-brown-200">
			{#if data.event.logo_url}
				<img
					src={data.event.logo_url}
					alt="{data.event.name} logo"
					class="h-16 md:h-20 w-auto object-contain mx-auto mb-4"
				/>
			{/if}
			<h1 class="text-3xl md:text-5xl font-bold text-brown-900 mb-2">{data.event.name}</h1>
			<p class="text-lg text-muted">People's Choice Awards</p>
		</header>

		<main class="flex-1 max-w-4xl mx-auto w-full px-4 py-8">
			<!-- Ceremony summary (Stage 1+) -->
			<div class="grid grid-cols-3 gap-4 mb-12 text-center">
				<div class="card py-6">
					<div class="text-4xl md:text-5xl font-bold text-amber-600">{data.stats.beerCount}</div>
					<div class="text-sm text-muted mt-1">Beers</div>
				</div>
				<div class="card py-6">
					<div class="text-4xl md:text-5xl font-bold text-amber-600">{data.stats.voterCount}</div>
					<div class="text-sm text-muted mt-1">Voters</div>
				</div>
				<div class="card py-6">
					<div class="text-4xl md:text-5xl font-bold text-amber-600">
						{data.stats.totalPointsCast}
					</div>
					<div class="text-sm text-muted mt-1">Points Cast</div>
				</div>
			</div>

			<!-- Podium section (new reveals appear at top, pushing others down) -->
			<div class="space-y-6">
				<!-- 1st Place (Stage 4) -->
				{#if revealStage >= 4}
					<div class="place-reveal space-y-4" class:animate-entrance={animatedPlaces.has(1)}>
						{#each firstPlace as beer (beer.id)}
							<div class="podium-card podium-first">
								<div class="podium-medal">🥇</div>
								<div class="podium-rank">1st Place{firstPlace.length > 1 ? ' (Tied)' : ''}</div>
								<div class="podium-name">{beer.name}</div>
								{#if beer.brewer}
									<div class="podium-brewer">by {beer.brewer}</div>
								{/if}
								<div class="podium-stats">
									<span class="podium-points">{beer.totalPoints} pts</span>
									<span class="podium-votes">{beer.voterCount} voters</span>
								</div>
							</div>
						{/each}
					</div>
				{/if}

				<!-- 2nd Place (Stage 3+) -->
				{#if revealStage >= 3}
					{#if secondPlace.length > 0}
						<div class="place-reveal space-y-4" class:animate-entrance={animatedPlaces.has(2)}>
							{#each secondPlace as beer (beer.id)}
								<div class="podium-card podium-second">
									<div class="podium-medal">🥈</div>
									<div class="podium-rank">2nd Place{secondPlace.length > 1 ? ' (Tied)' : ''}</div>
									<div class="podium-name">{beer.name}</div>
									{#if beer.brewer}
										<div class="podium-brewer">by {beer.brewer}</div>
									{/if}
									<div class="podium-stats">
										<span class="podium-points">{beer.totalPoints} pts</span>
										<span class="podium-votes">{beer.voterCount} voters</span>
									</div>
								</div>
							{/each}
						</div>
					{:else}
						<div class="place-reveal text-center py-4 text-muted" class:animate-entrance={animatedPlaces.has(2)}>
							No 2nd place — it's all about 1st!
						</div>
					{/if}
				{/if}

				<!-- 3rd Place (Stage 2+) -->
				{#if revealStage >= 2}
					{#if thirdPlace.length > 0}
						<div class="place-reveal space-y-4" class:animate-entrance={animatedPlaces.has(3)}>
							{#each thirdPlace as beer (beer.id)}
								<div class="podium-card podium-third">
									<div class="podium-medal">🥉</div>
									<div class="podium-rank">3rd Place{thirdPlace.length > 1 ? ' (Tied)' : ''}</div>
									<div class="podium-name">{beer.name}</div>
									{#if beer.brewer}
										<div class="podium-brewer">by {beer.brewer}</div>
									{/if}
									<div class="podium-stats">
										<span class="podium-points">{beer.totalPoints} pts</span>
										<span class="podium-votes">{beer.voterCount} voters</span>
									</div>
								</div>
							{/each}
						</div>
					{:else}
						<div class="place-reveal text-center py-4 text-muted" class:animate-entrance={animatedPlaces.has(3)}>
							No 3rd place — tighter competition at the top!
						</div>
					{/if}
				{/if}

				<!-- Rest of rankings (4th place onward, shown after 1st place reveal) -->
				{#if revealStage >= 4 && restOfRankings.length > 0}
					<div class="mt-12">
						<h2 class="text-xl font-semibold text-brown-800 mb-4 text-center">Full Rankings</h2>
						<div class="space-y-3">
							{#each scoreTiers.filter((t) => t.position > 3) as tier (tier.position)}
								{#each tier.beers as beer (beer.id)}
									<div class="card flex items-center gap-4">
										<div
											class="w-10 h-10 rounded-full bg-brown-100 flex items-center justify-center font-bold text-brown-600"
										>
											{tier.position}
										</div>
										<div class="flex-1">
											<div class="font-medium text-brown-900">{beer.name}</div>
											{#if beer.brewer}
												<div class="text-sm text-muted">by {beer.brewer}</div>
											{/if}
										</div>
										<div class="text-right">
											<div class="font-semibold text-amber-700">{beer.totalPoints} pts</div>
											<div class="text-xs text-muted">{beer.voterCount} voters</div>
										</div>
									</div>
								{/each}
							{/each}
						</div>
					</div>
				{/if}
			</div>

			<!-- Waiting message between stages -->
			{#if revealStage === 1}
				<div class="text-center py-12">
					<div class="text-4xl mb-4">🎉</div>
					<p class="text-xl text-brown-700">The ceremony has begun!</p>
					<p class="text-muted mt-2">Get ready for the results...</p>
				</div>
			{:else if revealStage === 2}
				<div class="text-center py-8 text-muted">And now... 2nd place coming up!</div>
			{:else if revealStage === 3}
				<div class="text-center py-8 text-muted">And the moment we've been waiting for...</div>
			{/if}
		</main>
	{/if}
</div>

<style>
	@reference "tailwindcss";

	/* Podium card base styles */
	.podium-card {
		@apply rounded-xl p-6 text-center;
		background: linear-gradient(180deg, #ffffff 0%, #fdfbf7 100%);
		box-shadow:
			0 4px 12px rgba(61, 45, 34, 0.1),
			0 2px 4px rgba(61, 45, 34, 0.06);
	}

	.podium-medal {
		@apply text-5xl md:text-6xl mb-2;
	}

	.podium-rank {
		@apply text-sm font-semibold uppercase tracking-wider mb-2;
	}

	.podium-name {
		@apply text-2xl md:text-3xl font-bold mb-1;
	}

	.podium-brewer {
		@apply text-lg mb-4;
	}

	.podium-stats {
		@apply flex justify-center gap-6 text-lg;
	}

	.podium-points {
		@apply font-bold;
	}

	.podium-votes {
		@apply opacity-70;
	}

	/* 1st place - gold theme */
	.podium-first {
		@apply border-2;
		border-color: #fbbf24;
		background: linear-gradient(180deg, #fffbeb 0%, #fef3c7 100%);
	}
	.podium-first .podium-rank {
		color: #b45309;
	}
	.podium-first .podium-name {
		color: #92400e;
	}
	.podium-first .podium-brewer {
		color: #b45309;
	}
	.podium-first .podium-points {
		color: #d97706;
	}

	/* 2nd place - silver theme */
	.podium-second {
		@apply border;
		border-color: #d1d5db;
		background: linear-gradient(180deg, #f9fafb 0%, #f3f4f6 100%);
	}
	.podium-second .podium-rank {
		color: #6b7280;
	}
	.podium-second .podium-name {
		color: #374151;
	}
	.podium-second .podium-brewer {
		color: #6b7280;
	}
	.podium-second .podium-points {
		color: #4b5563;
	}

	/* 3rd place - bronze theme */
	.podium-third {
		@apply border;
		border-color: #d6c4b8;
		background: linear-gradient(180deg, #fdf8f6 0%, #f2e8e5 100%);
	}
	.podium-third .podium-rank {
		color: #a24a1f;
	}
	.podium-third .podium-name {
		color: #5c4433;
	}
	.podium-third .podium-brewer {
		color: #7c5e42;
	}
	.podium-third .podium-points {
		color: #c45d2a;
	}

	/* Entrance animation */
	.place-reveal {
		opacity: 1;
		transform: translateY(0);
	}

	.animate-entrance {
		animation: slideIn 0.6s ease-out;
	}

	@keyframes slideIn {
		from {
			opacity: 0;
			transform: translateY(30px) scale(0.95);
		}
		to {
			opacity: 1;
			transform: translateY(0) scale(1);
		}
	}
</style>

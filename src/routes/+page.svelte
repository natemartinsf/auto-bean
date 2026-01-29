<script lang="ts">
	import { enhance } from '$app/forms';

	let { form } = $props();

	let isSubmitting = $state(false);
	let name = $state('');
	let email = $state('');
	let clubName = $state('');
	let message = $state('');

	// Trivia spam protection
	const triviaOptions = ['Yeast', 'Hops', 'Malt'];
	const shuffledOptions = [...triviaOptions].sort(() => Math.random() - 0.5);
	const loadTime = Date.now();

	function scrollToForm() {
		document.getElementById('request-access')?.scrollIntoView({ behavior: 'smooth' });
	}
</script>

<svelte:head>
	<title>PintPoll - Digital Voting for Homebrew Competitions</title>
	<meta
		name="description"
		content="Simple, mobile-first voting for homebrew competitions. QR codes, point allocation, live results."
	/>
	<meta property="og:title" content="PintPoll - Digital Voting for Homebrew Competitions">
	<meta property="og:description" content="Simple, mobile-first voting for homebrew competitions. QR codes, point allocation, live results.">
</svelte:head>

<div class="min-h-screen">
	<!-- Nav -->
	<nav class="flex justify-end px-6 py-4">
		<a href="/login" class="text-sm text-brown-500 hover:text-brown-700 transition-colors">Admin Login</a>
	</nav>

	<!-- Hero -->
	<section class="relative overflow-hidden px-6 pt-8 pb-20 md:pt-16 md:pb-28">
		<!-- Decorative grain overlay -->
		<div
			class="pointer-events-none absolute inset-0 opacity-[0.03]"
			style="background-image: url('data:image/svg+xml,{encodeURIComponent(`<svg viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="4" stitchTiles="stitch"/></filter><rect width="100%" height="100%" filter="url(#n)"/></svg>`)}')"
		></div>

		<!-- Decorative hop/wheat circles -->
		<div
			class="absolute -top-20 -right-20 h-64 w-64 rounded-full opacity-[0.07]"
			style="background: radial-gradient(circle, var(--color-amber-400) 0%, transparent 70%)"
		></div>
		<div
			class="absolute -bottom-32 -left-16 h-80 w-80 rounded-full opacity-[0.05]"
			style="background: radial-gradient(circle, var(--color-copper-500) 0%, transparent 70%)"
		></div>

		<div class="relative mx-auto max-w-2xl text-center">
			<!-- Wordmark -->
			<div class="mb-6 inline-block">
				<span
					class="text-5xl font-black tracking-tight text-brown-900 md:text-7xl"
					style="letter-spacing: -0.03em"
				>
					Pint<span class="text-amber-600">Poll</span>
				</span>
			</div>

			<p class="mx-auto mb-3 max-w-lg text-lg text-brown-700 md:text-xl">
				Digital voting for homebrew competition people's choice awards.
			</p>
			<p class="mx-auto mb-10 max-w-md text-brown-500">
				No app downloads. No paper ballots. No beans in bags. Just scan, vote, and celebrate.
			</p>

			<button onclick={scrollToForm} class="btn-primary px-8 py-4 text-lg shadow-lg">
				Request Access
			</button>
		</div>
	</section>

	<!-- Divider -->
	<div class="mx-auto max-w-xs">
		<div
			class="h-px"
			style="background: linear-gradient(90deg, transparent, var(--color-brown-300), transparent)"
		></div>
	</div>

	<!-- How It Works -->
	<section class="px-6 py-16 md:py-20">
		<div class="mx-auto max-w-3xl">
			<h2 class="heading mb-12 text-center">How It Works</h2>

			<div class="grid gap-8 md:grid-cols-2 md:gap-10">
				<!-- Voter Flow -->
				<div class="card p-6">
					<div class="mb-4 flex items-center gap-3">
						<div
							class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-xl"
							style="background: linear-gradient(135deg, var(--color-amber-100), var(--color-amber-200))"
						>
							&#127866;
						</div>
						<h3 class="text-lg font-bold text-brown-900">For Voters</h3>
					</div>

					<ol class="space-y-4">
						<li class="flex gap-3">
							<span
								class="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-500 text-xs font-bold text-white"
								>1</span
							>
							<div>
								<p class="font-medium text-brown-800">Scan your QR card</p>
								<p class="text-sm text-brown-500">
									Each voter gets a unique card. One scan opens your ballot.
								</p>
							</div>
						</li>
						<li class="flex gap-3">
							<span
								class="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-500 text-xs font-bold text-white"
								>2</span
							>
							<div>
								<p class="font-medium text-brown-800">Allocate your points</p>
								<p class="text-sm text-brown-500">
									Spread points across your favorites. Give more to the ones you love.
								</p>
							</div>
						</li>
						<li class="flex gap-3">
							<span
								class="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-500 text-xs font-bold text-white"
								>3</span
							>
							<div>
								<p class="font-medium text-brown-800">Change anytime</p>
								<p class="text-sm text-brown-500">
									Update your votes until results are revealed. No pressure.
								</p>
							</div>
						</li>
					</ol>
				</div>

				<!-- Organizer Flow -->
				<div class="card p-6">
					<div class="mb-4 flex items-center gap-3">
						<div
							class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-xl"
							style="background: linear-gradient(135deg, var(--color-brown-100), var(--color-brown-200))"
						>
							&#127942;
						</div>
						<h3 class="text-lg font-bold text-brown-900">For Organizers</h3>
					</div>

					<ol class="space-y-4">
						<li class="flex gap-3">
							<span
								class="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brown-600 text-xs font-bold text-white"
								>1</span
							>
							<div>
								<p class="font-medium text-brown-800">Create your event</p>
								<p class="text-sm text-brown-500">
									Set up beers, brewers, and configure point limits.
								</p>
							</div>
						</li>
						<li class="flex gap-3">
							<span
								class="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brown-600 text-xs font-bold text-white"
								>2</span
							>
							<div>
								<p class="font-medium text-brown-800">Print QR cards</p>
								<p class="text-sm text-brown-500">
									Generate and print voter cards. Hand them out at the door.
								</p>
							</div>
						</li>
						<li class="flex gap-3">
							<span
								class="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brown-600 text-xs font-bold text-white"
								>3</span
							>
							<div>
								<p class="font-medium text-brown-800">Reveal results live</p>
								<p class="text-sm text-brown-500">
									Flip the switch and watch the leaderboard unveil on the big screen.
								</p>
							</div>
						</li>
					</ol>
				</div>
			</div>
		</div>
	</section>

	<!-- Divider -->
	<div class="mx-auto max-w-xs">
		<div
			class="h-px"
			style="background: linear-gradient(90deg, transparent, var(--color-brown-300), transparent)"
		></div>
	</div>

	<!-- Request Access -->
	<section id="request-access" class="scroll-mt-8 px-6 py-16 md:py-20">
		<div class="mx-auto max-w-lg">
			<h2 class="heading mb-3 text-center">Get Started</h2>
			<p class="mb-8 text-center text-brown-500">
				PintPoll is currently invite-only. Tell us about your club and we'll get you set up.
			</p>

			{#if form?.success}
				<div class="card border-success/30 p-8 text-center">
					<div class="mb-3 text-4xl">&#127881;</div>
					<h3 class="mb-2 text-lg font-bold text-brown-900">Request received!</h3>
					<p class="text-brown-600">
						We'll review your request and reach out soon. In the meantime, start thinking about
						which homebrew deserves the crown.
					</p>
				</div>
			{:else}
				<div class="card p-6">
					{#if form?.error}
						<div class="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-error">
							{form.error}
						</div>
					{/if}

					<form
						method="POST"
						action="?/requestAccess"
						use:enhance={() => {
							isSubmitting = true;
							return async ({ update }) => {
								await update();
								isSubmitting = false;
								if (form?.success) {
									name = '';
									email = '';
									clubName = '';
									message = '';
								}
							};
						}}
						class="space-y-4"
					>
						<input type="text" name="website" class="hidden" tabindex="-1" autocomplete="off" />
						<div>
							<label class="label" for="name">Your name</label>
							<input
								class="input"
								id="name"
								name="name"
								type="text"
								required
								placeholder="Jane Brewmaster"
								bind:value={name}
							/>
						</div>

						<div>
							<label class="label" for="email">Email</label>
							<input
								class="input"
								id="email"
								name="email"
								type="email"
								required
								placeholder="jane@brewclub.org"
								bind:value={email}
							/>
						</div>

						<div>
							<label class="label" for="club_name">Club or organization</label>
							<input
								class="input"
								id="club_name"
								name="club_name"
								type="text"
								required
								placeholder="Bay Area Mashers"
								bind:value={clubName}
							/>
						</div>

						<div>
							<span class="label">What converts sugars into alcohol during fermentation?</span>
							<div class="mt-2 flex gap-4">
								{#each shuffledOptions as option}
									<label class="flex cursor-pointer items-center gap-2">
										<input
											type="radio"
											name="trivia"
											value={option}
											required
											class="h-4 w-4 border-brown-300 text-amber-600 focus:ring-amber-500"
										/>
										<span class="text-sm text-brown-700">{option}</span>
									</label>
								{/each}
							</div>
						</div>

						<input type="hidden" name="loadTime" value={loadTime} />

						<div>
							<label class="label" for="message">
								Anything else?
								<span class="font-normal text-brown-400">(optional)</span>
							</label>
							<textarea
								class="input"
								id="message"
								name="message"
								rows="3"
								placeholder="Tell us about your event, how many voters you expect, etc."
								bind:value={message}
							></textarea>
						</div>

						<button type="submit" class="btn-primary w-full" disabled={isSubmitting}>
							{isSubmitting ? 'Sending...' : 'Request Access'}
						</button>
					</form>
				</div>
			{/if}
		</div>
	</section>

	<!-- Footer -->
	<footer class="px-6 pb-8 pt-12">
		<div class="mx-auto max-w-lg text-center">
			<div
				class="mb-6 h-px"
				style="background: linear-gradient(90deg, transparent, var(--color-brown-200), transparent)"
			></div>
			<p class="text-sm text-brown-400">
				Made with &#127866; in Alameda
				<span class="mx-1.5 text-brown-300">&middot;</span>
				<a
					href="https://ko-fi.com/natemartinsf"
					target="_blank"
					rel="noopener noreferrer"
					class="text-brown-500 underline underline-offset-2 transition-colors hover:text-amber-600"
				>
					Buy me a beer
				</a>
			</p>
			<p class="mt-2 text-xs text-brown-300">&copy; 2026 PintPoll</p>
		</div>
	</footer>
</div>

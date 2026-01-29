<script lang="ts">
	import { enhance, deserialize } from '$app/forms';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import { Files, Check, RefreshCw, QrCode, Upload, Trash2 } from 'lucide-svelte';
	import type { Beer } from '$lib/types';
		import QRCodeStyling from 'qr-code-styling';

	type BeerWithToken = Beer & { brewer_tokens: { id: string } | null };

	let { data, form } = $props();

	let copied = $state(false);
	let copiedVoterLink = $state(false);
	let copiedFeedbackId = $state<string | null>(null);
	let beers = $state<BeerWithToken[]>([]);
	let testVoterUrl = $state('');
	let voteTotals = $state<Record<string, { totalPoints: number; voterCount: number }>>({});
	let isRefreshingVotes = $state(false);
	let blindTasting = $state(false);
	let brewerCodeMap = $state<Record<string, string>>({});

	// Sync blind tasting state with props (only on initial load or navigation)
	$effect(() => {
		blindTasting = data.event.blind_tasting ?? false;
	});

	$effect(() => {
		brewerCodeMap = { ...data.brewerCodeMap };
	});

	// Sync state with props when data changes (e.g., after form submissions or navigation)
	$effect(() => {
		beers = data.beers as BeerWithToken[];
	});

	$effect(() => {
		voteTotals = data.voteTotals;
	});
	let lastRefreshed = $state<Date>(new Date());
	let qrCount = $state(100);
	let isGeneratingQR = $state(false);
	let isUploadingLogo = $state(false);
	let logoUrl = $state<string | null>(null);
	let logoFileInput: HTMLInputElement;

	// Sync logo URL with props
	$effect(() => {
		logoUrl = data.event.logo_url;
	});

	const manageUrl = $derived(data.manageCode ? `${$page.url.origin}/manage/${data.manageCode}` : '');
	const resultsUrl = $derived(`${$page.url.origin}/results/${data.eventCode}`);

	async function refreshVoteTotals() {
		isRefreshingVotes = true;
		try {
			const beerIds = beers.map((b) => b.id);
			if (beerIds.length === 0) {
				voteTotals = {};
				lastRefreshed = new Date();
				return;
			}

			const { data: voteData, error } = await data.supabase
				.from('votes')
				.select('beer_id, points, voter_id')
				.in('beer_id', beerIds);

			if (error) {
				// Ignore AbortError - happens during navigation or hydration, polling will retry
				if (error.message?.includes('AbortError') || error.message?.includes('aborted')) {
					return;
				}
				console.error('Error fetching vote totals:', error);
				return;
			}

			const newTotals: Record<string, { totalPoints: number; voterCount: number }> = {};
			const votersByBeer: Record<string, Set<string>> = {};

			for (const vote of voteData || []) {
				if (!vote.beer_id || vote.points === null || !vote.voter_id) continue;
				if (!newTotals[vote.beer_id]) {
					newTotals[vote.beer_id] = { totalPoints: 0, voterCount: 0 };
				}
				newTotals[vote.beer_id].totalPoints += vote.points;

				if (!votersByBeer[vote.beer_id]) {
					votersByBeer[vote.beer_id] = new Set();
				}
				votersByBeer[vote.beer_id].add(vote.voter_id);
			}

			for (const beerId of Object.keys(votersByBeer)) {
				if (newTotals[beerId]) {
					newTotals[beerId].voterCount = votersByBeer[beerId].size;
				}
			}

			voteTotals = newTotals;
			lastRefreshed = new Date();
		} catch (err) {
			// Catch AbortError thrown as exception
			if (err instanceof Error && (err.name === 'AbortError' || err.message?.includes('aborted'))) {
				return;
			}
			console.error('Error refreshing vote totals:', err);
		} finally {
			isRefreshingVotes = false;
		}
	}

	// Real-time subscription for beer updates + vote polling
	onMount(() => {
		// Poll vote totals every 10 seconds
		const pollInterval = setInterval(refreshVoteTotals, 10000);

		const channel = data.supabase
			.channel('admin-beers-changes')
			.on(
				'postgres_changes',
				{
					event: 'INSERT',
					schema: 'public',
					table: 'beers',
					filter: `event_id=eq.${data.event.id}`
				},
				async (payload) => {
					const newBeer = payload.new as Beer;
					if (!beers.some((b) => b.id === newBeer.id)) {
						// Fetch the brewer_token for the new beer
						const { data: tokenData } = await data.supabase
							.from('brewer_tokens')
							.select('id')
							.eq('beer_id', newBeer.id)
							.single();

						const beerWithToken: BeerWithToken = {
							...newBeer,
							brewer_tokens: tokenData
						};
						beers = [...beers, beerWithToken];

						// Fetch brewer short code for the new beer
						const { data: codeData } = await data.supabase
							.from('short_codes')
							.select('code')
							.eq('target_type', 'brewer')
							.eq('target_id', newBeer.id)
							.single();

						if (codeData) {
							brewerCodeMap = { ...brewerCodeMap, [newBeer.id]: codeData.code };
						}
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
			clearInterval(pollInterval);
			data.supabase.removeChannel(channel);
		};
	});

	async function copyToClipboard(text: string) {
		await navigator.clipboard.writeText(text);
		copied = true;
		setTimeout(() => (copied = false), 2000);
	}

	async function copyVoterLink() {
		if (!testVoterUrl) return;
		await navigator.clipboard.writeText(testVoterUrl);
		copiedVoterLink = true;
		setTimeout(() => (copiedVoterLink = false), 2000);
	}

	async function copyFeedbackUrl(beerId: string) {
		const code = brewerCodeMap[beerId];
		if (!code) return;
		const url = `${$page.url.origin}/feedback/${code}`;
		await navigator.clipboard.writeText(url);
		copiedFeedbackId = beerId;
		setTimeout(() => (copiedFeedbackId = null), 2000);
	}

	async function generateQRCodes() {
		if (qrCount < 1 || qrCount > 500) return;
		isGeneratingQR = true;

		try {
			// Call server action to generate and store short codes
			const formData = new FormData();
			formData.append('count', qrCount.toString());

			const response = await fetch('?/generateQRCodes', {
				method: 'POST',
				body: formData,
				credentials: 'same-origin',
				headers: {
					'Accept': 'application/json'
				}
			});

			const result = deserialize(await response.text());

			if (result.type === 'error') {
				console.error('Server error:', result.error);
				alert('Server error. Please try again.');
				return;
			}

			if (result.type === 'failure') {
				const errorMsg = (result.data as { error?: string })?.error || 'Server error';
				console.error('Error generating QR codes:', errorMsg);
				alert(errorMsg);
				return;
			}

			if (result.type !== 'success') {
				console.error('Unexpected result type:', result.type);
				alert('Unexpected error. Please try again.');
				return;
			}

			const voterCodes = (result.data as { voterCodes?: string[] })?.voterCodes;
			if (!voterCodes || voterCodes.length === 0) {
				console.error('No voter codes returned:', result);
				alert('Failed to generate voter codes. Please try again.');
				return;
			}

			// Generate QR code data URLs
			const qrDataUrls: string[] = [];
			for (const code of voterCodes) {
				const url = `https://pintpoll.com/vote/${data.eventCode}/${code}`;

				// Base QR code options
				const qrOptions: ConstructorParameters<typeof QRCodeStyling>[0] = {
					width: 200,
					height: 200,
					data: url,
					dotsOptions: {
						color: '#4a3728',
						type: 'rounded'
					},
					cornersSquareOptions: {
						color: '#4a3728',
						type: 'extra-rounded'
					},
					cornersDotOptions: {
						color: '#d97706',
						type: 'dot'
					},
					backgroundOptions: {
						color: '#ffffff'
					}
				};

				// Add logo if event has one
				if (logoUrl) {
					qrOptions.image = logoUrl;
					qrOptions.imageOptions = {
						hideBackgroundDots: true,
						imageSize: 0.4,
						margin: 2,
						crossOrigin: 'anonymous'
					};
					// Increase error correction to compensate for logo overlay
					qrOptions.qrOptions = {
						errorCorrectionLevel: 'H'
					};
				}

				const qr = new QRCodeStyling(qrOptions);

				const blob = await qr.getRawData('png');
				if (blob && blob instanceof Blob) {
					const dataUrl = await blobToDataUrl(blob);
					qrDataUrls.push(dataUrl);
				}
			}

			// Build printable HTML
			const voters = voterCodes.map((code, i) => ({ code, number: i + 1 }));
			const html = buildPrintableHtml(voters, qrDataUrls, data.event.name, data.eventCode);

			// Open in new tab
			const newWindow = window.open('', '_blank');
			if (newWindow) {
				newWindow.document.write(html);
				newWindow.document.close();
			}
		} finally {
			isGeneratingQR = false;
		}
	}

	function blobToDataUrl(blob: Blob): Promise<string> {
		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onloadend = () => resolve(reader.result as string);
			reader.onerror = reject;
			reader.readAsDataURL(blob);
		});
	}

	function buildPrintableHtml(
		voters: { code: string; number: number }[],
		qrDataUrls: string[],
		eventName: string,
		eventCode: string
	): string {
		const cards = voters
			.map(
				(voter, i) => `
			<div class="card">
				<img src="${qrDataUrls[i]}" alt="QR Code" />
				<div class="instruction">Scan to vote</div>
				<div class="url">pintpoll.com/vote/${eventCode}/${voter.code}</div>
			</div>
		`
			)
			.join('');

		return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<link rel="icon" href="/favicon.ico" sizes="32x32">
	<link rel="icon" href="/favicon.svg" type="image/svg+xml">
	<title>QR Codes - ${eventName}</title>
	<style>
		* {
			margin: 0;
			padding: 0;
			box-sizing: border-box;
		}

		@page {
			size: letter;
			margin: 0.5in;
		}

		body {
			font-family: system-ui, -apple-system, sans-serif;
		}

		.grid {
			display: grid;
			grid-template-columns: repeat(3, 1fr);
			gap: 0;
		}

		.card {
			border: 2px dashed #ccc;
			padding: 12px;
			text-align: center;
			page-break-inside: avoid;
			height: 2.5in;
			display: flex;
			flex-direction: column;
			align-items: center;
			justify-content: center;
		}

		.card img {
			width: 120px;
			height: 120px;
		}

		.instruction {
			font-size: 12px;
			color: #666;
			margin-top: 4px;
		}

		.url {
			font-size: 8px;
			color: #999;
			margin-top: 4px;
			word-break: break-all;
			max-width: 100%;
		}

		@media print {
			.no-print {
				display: none;
			}
		}
	</style>
</head>
<body>
	<div class="no-print" style="padding: 16px; background: #f5f5f5; margin-bottom: 16px;">
		<strong>${eventName}</strong> — ${voters.length} QR codes
		<button onclick="window.print()" style="margin-left: 16px; padding: 8px 16px; cursor: pointer;">
			Print
		</button>
	</div>
	<div class="grid">
		${cards}
	</div>
</body>
</html>`;
	}
</script>

<svelte:head>
	<title>{data.event.name} - Admin</title>
</svelte:head>

<div class="space-y-8">
	<!-- Header with back link -->
	<div>
		<a href="/admin" class="text-sm text-brown-600 hover:text-brown-800 no-underline mb-2 inline-block">
			&larr; Back to Events
		</a>
		<h1 class="heading">{data.event.name}</h1>
		<div class="text-muted mt-1 space-x-3">
			{#if data.event.date}
				<span>{new Date(data.event.date).toLocaleDateString()}</span>
			{/if}
			<span>{data.event.max_points} points max</span>
		</div>
	</div>

	<!-- Manage URL -->
	<div class="card">
		<h2 class="text-lg font-semibold text-brown-900 mb-3">Tap Volunteer URL</h2>
		<p class="text-sm text-muted mb-3">Share this link with tap volunteers so they can add beers.</p>
		<div class="relative">
			<input type="text" readonly value={manageUrl} class="input w-full text-sm pr-20" />
			<button
				type="button"
				onclick={() => copyToClipboard(manageUrl)}
				class="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5 px-2 py-1 rounded text-sm text-brown-600 hover:text-brown-800 hover:bg-brown-100 transition-colors"
				title={copied ? 'Copied!' : 'Copy to clipboard'}
			>
				{#if copied}
					<Check class="w-4 h-4 text-green-600" />
					<span class="text-green-600">Copied</span>
				{:else}
					<Files class="w-4 h-4" />
					<span>Copy</span>
				{/if}
			</button>
		</div>
	</div>

	<!-- Test Voter Link -->
	<div class="card">
		<h2 class="text-lg font-semibold text-brown-900 mb-3">Test Voter Link</h2>
		<p class="text-sm text-muted mb-3">Generate a one-time voter link to test the voting experience.</p>
		{#if testVoterUrl}
			<div class="flex gap-2 mb-3">
				<input type="text" readonly value={testVoterUrl} class="input flex-1 text-sm" />
				<button
					type="button"
					onclick={copyVoterLink}
					class="btn-secondary flex items-center gap-1.5 text-sm"
				>
					{#if copiedVoterLink}
						<Check class="w-4 h-4 text-green-600" />
						<span class="text-green-600">Copied</span>
					{:else}
						<Files class="w-4 h-4" />
						<span>Copy</span>
					{/if}
				</button>
			</div>
			<div class="flex gap-2">
				<a href={testVoterUrl} target="_blank" rel="noopener noreferrer" class="btn-primary text-sm">
					Open Voter Page
				</a>
				<form
					method="POST"
					action="?/generateTestVoter"
					use:enhance={() => {
						return async ({ result }) => {
							if (result.type === 'success' && result.data?.testVoterCode) {
								testVoterUrl = `${$page.url.origin}/vote/${data.eventCode}/${result.data.testVoterCode}`;
							}
						};
					}}
				>
					<button type="submit" class="btn-ghost text-sm">
						Generate New
					</button>
				</form>
			</div>
		{:else}
			<form
				method="POST"
				action="?/generateTestVoter"
				use:enhance={() => {
					return async ({ result }) => {
						if (result.type === 'success' && result.data?.testVoterCode) {
							testVoterUrl = `${$page.url.origin}/vote/${data.eventCode}/${result.data.testVoterCode}`;
						}
					};
				}}
			>
				<button type="submit" class="btn-primary">
					Generate Test Link
				</button>
			</form>
		{/if}
	</div>

	<!-- QR Code Generation -->
	<div class="card">
		<h2 class="text-lg font-semibold text-brown-900 mb-3">Generate QR Codes</h2>
		<p class="text-sm text-muted mb-4">
			Generate printable QR code cards for voters. Each card contains a unique voting link.
		</p>
		<div class="flex items-end gap-3">
			<div class="flex-1 max-w-32">
				<label for="qr-count" class="block text-sm text-muted mb-1">Number of cards</label>
				<input
					id="qr-count"
					type="number"
					bind:value={qrCount}
					min="1"
					max="500"
					class="input w-full"
				/>
			</div>
			<button
				type="button"
				onclick={generateQRCodes}
				disabled={isGeneratingQR || qrCount < 1 || qrCount > 500}
				class="btn-primary flex items-center gap-2"
			>
				{#if isGeneratingQR}
					<RefreshCw class="w-4 h-4 animate-spin" />
					<span>Generating...</span>
				{:else}
					<QrCode class="w-4 h-4" />
					<span>Generate</span>
				{/if}
			</button>
		</div>
		{#if qrCount > 100}
			<p class="text-sm text-amber-600 mt-2">
				Generating {qrCount} codes may take a moment.
			</p>
		{/if}
	</div>

	<!-- Event Logo -->
	<div class="card">
		<h2 class="text-lg font-semibold text-brown-900 mb-3">Event Logo</h2>
		<p class="text-sm text-muted mb-4">
			Upload a logo to display on the voter and results pages. PNG, JPG, or SVG, max 500KB.
		</p>

		{#if logoUrl}
			<!-- Logo preview and remove -->
			<div class="flex items-start gap-4">
				<img
					src={logoUrl}
					alt="Event logo"
					class="h-20 w-auto object-contain rounded border border-brown-200"
				/>
				<div class="flex flex-col gap-2">
					<form
						method="POST"
						action="?/removeLogo"
						use:enhance={() => {
							if (!confirm('Remove the event logo?')) {
								return () => {};
							}
							logoUrl = null;
							return async ({ result }) => {
								if (result.type === 'failure') {
									// Revert on error
									logoUrl = data.event.logo_url;
								}
							};
						}}
					>
						<button type="submit" class="btn-ghost text-red-600 hover:text-red-700 text-sm flex items-center gap-1.5">
							<Trash2 class="w-4 h-4" />
							Remove
						</button>
					</form>
					<button
						type="button"
						onclick={() => logoFileInput.click()}
						class="btn-ghost text-sm flex items-center gap-1.5"
					>
						<Upload class="w-4 h-4" />
						Replace
					</button>
				</div>
			</div>
		{:else}
			<!-- Upload button -->
			<button
				type="button"
				onclick={() => logoFileInput.click()}
				disabled={isUploadingLogo}
				class="btn-secondary flex items-center gap-2"
			>
				{#if isUploadingLogo}
					<RefreshCw class="w-4 h-4 animate-spin" />
					<span>Uploading...</span>
				{:else}
					<Upload class="w-4 h-4" />
					<span>Upload Logo</span>
				{/if}
			</button>
		{/if}

		<!-- Hidden file input and form -->
		<form
			method="POST"
			action="?/uploadLogo"
			enctype="multipart/form-data"
			use:enhance={() => {
				isUploadingLogo = true;
				return async ({ result, update }) => {
					isUploadingLogo = false;
					if (result.type === 'success') {
						await update();
					}
				};
			}}
			class="hidden"
			id="logo-upload-form"
		>
			<input
				type="file"
				name="logo"
				accept="image/png,image/jpeg,image/jpg,image/svg+xml"
				bind:this={logoFileInput}
				onchange={(e) => {
					const file = e.currentTarget.files?.[0];
					if (file) {
						// Validate size client-side
						if (file.size > 500 * 1024) {
							alert('File too large. Maximum size is 500KB.');
							e.currentTarget.value = '';
							return;
						}
						e.currentTarget.form?.requestSubmit();
					}
				}}
			/>
		</form>

		{#if form?.error && (form?.action === 'uploadLogo' || form?.action === 'removeLogo')}
			<p class="text-red-600 text-sm mt-3">{form.error}</p>
		{/if}
	</div>

	<!-- Blind Tasting Mode -->
	<div class="card">
		<form
			method="POST"
			action="?/toggleBlindTasting"
			use:enhance={() => {
				// Optimistic update - toggle immediately
				blindTasting = !blindTasting;
				return async ({ result }) => {
					if (result.type === 'failure') {
						// Revert on error
						blindTasting = !blindTasting;
					}
					// Don't call update() - we already updated optimistically
				};
			}}
		>
			<label class="flex items-center gap-3 cursor-pointer mb-3">
				<input
					type="checkbox"
					name="enabled"
					checked={blindTasting}
					onchange={(e) => e.currentTarget.form?.requestSubmit()}
					class="w-5 h-5 rounded border-brown-300 text-amber-600 focus:ring-amber-500"
				/>
				<span class="text-lg font-semibold text-brown-900">Blind Tasting Mode</span>
			</label>
		</form>
		<p class="text-sm text-muted">
			When enabled, brewer names are hidden from voters during voting. Brewers are still revealed on the results page.
		</p>
		{#if form?.error && form?.action === 'toggleBlindTasting'}
			<p class="text-red-600 text-sm mt-3">{form.error}</p>
		{/if}
	</div>

	<!-- Results Ceremony Control -->
	<div class="card">
		<h2 class="text-lg font-semibold text-brown-900 mb-3">Results Ceremony</h2>

		<!-- Current Stage Status -->
		<div class="mb-4">
			<p class="text-sm text-muted">
				Current status:
				{#if data.event.reveal_stage === 0}
					<span class="text-brown-700 font-medium">Hidden</span> — Voting active
				{:else if data.event.reveal_stage === 1}
					<span class="text-amber-600 font-medium">Ceremony Started</span> — Voters redirected to results
				{:else if data.event.reveal_stage === 2}
					<span class="text-amber-600 font-medium">3rd Place Revealed</span>
				{:else if data.event.reveal_stage === 3}
					<span class="text-amber-600 font-medium">2nd Place Revealed</span>
				{:else if data.event.reveal_stage === 4}
					<span class="text-green-600 font-medium">1st Place Revealed</span> — Ceremony complete
				{/if}
			</p>
		</div>

		<!-- Stage Control Buttons -->
		<div class="flex items-center gap-3">
			<form method="POST" action="?/advanceStage" use:enhance>
				{#if data.event.reveal_stage === 0}
					<button type="submit" class="btn-primary">Start Ceremony</button>
				{:else if data.event.reveal_stage === 1}
					<button type="submit" class="btn-primary">Reveal 3rd Place</button>
				{:else if data.event.reveal_stage === 2}
					<button type="submit" class="btn-primary">Reveal 2nd Place</button>
				{:else if data.event.reveal_stage === 3}
					<button type="submit" class="btn-primary">Reveal 1st Place</button>
				{:else}
					<button type="submit" disabled class="btn-primary opacity-50 cursor-not-allowed">Ceremony Complete</button>
				{/if}
			</form>

			{#if (data.event.reveal_stage ?? 0) > 0}
				<form
					method="POST"
					action="?/resetStage"
					use:enhance={() => {
						if (!confirm('Reset the ceremony? This will hide results and allow voting again.')) {
							return () => {};
						}
						return async ({ update }) => {
							await update();
						};
					}}
				>
					<button type="submit" class="btn-secondary">Reset</button>
				</form>
			{/if}
		</div>

		{#if form?.error && (form?.action === 'advanceStage' || form?.action === 'resetStage')}
			<p class="text-red-600 text-sm mt-3">{form.error}</p>
		{/if}

		<div class="mt-4 pt-4 border-t border-brown-100">
			<a href={resultsUrl} target="_blank" rel="noopener noreferrer" class="text-sm">
				View Results Page &rarr;
			</a>
		</div>
	</div>

	<!-- Beers List -->
	<div class="card">
		<div class="flex items-center justify-between mb-4">
			<h2 class="text-lg font-semibold text-brown-900">Beers ({beers.length})</h2>
			<div class="flex items-center gap-2">
				<span class="text-xs text-muted">
					Updated {lastRefreshed.toLocaleTimeString()}
				</span>
				<button
					type="button"
					onclick={refreshVoteTotals}
					disabled={isRefreshingVotes}
					class="flex items-center gap-1.5 px-2 py-1 rounded text-sm text-brown-600 hover:text-brown-800 hover:bg-brown-100 transition-colors disabled:opacity-50"
					title="Refresh vote totals"
				>
					<RefreshCw class="w-4 h-4 {isRefreshingVotes ? 'animate-spin' : ''}" />
					<span>Refresh</span>
				</button>
			</div>
		</div>
		{#if form?.error && form?.action === 'deleteBeer'}
			<p class="text-red-600 text-sm mb-3">{form.error}</p>
		{/if}
		{#if beers.length === 0}
			<p class="text-muted">No beers added yet. Share the manage URL with tap volunteers to add beers.</p>
		{:else}
			<div class="space-y-2">
				{#each beers as beer (beer.id)}
					{@const beerVotes = voteTotals[beer.id]}
					<div class="rounded-lg border border-brown-100 bg-white/60 p-3">
						<div class="flex items-center justify-between">
							<div class="flex-1 min-w-0">
								<div class="flex items-center gap-2 flex-wrap">
									<span class="font-medium text-brown-900">{beer.name}</span>
									{#if beer.brewer}
										<span class="text-muted">by {beer.brewer}</span>
									{/if}
									{#if beer.style}
										<span class="text-sm text-muted">({beer.style})</span>
									{/if}
								</div>
								<div class="text-sm text-muted mt-1">
									{#if beerVotes}
										<span class="text-brown-700 font-medium">{beerVotes.totalPoints} pts</span>
										<span class="mx-1">·</span>
										<span>{beerVotes.voterCount} voter{beerVotes.voterCount === 1 ? '' : 's'}</span>
									{:else}
										<span class="text-brown-500">No votes yet</span>
									{/if}
								</div>
							</div>
							<div class="flex items-center gap-1">
								{#if brewerCodeMap[beer.id]}
									<button
										type="button"
										onclick={() => copyFeedbackUrl(beer.id)}
										class="flex items-center gap-1 px-2 py-1 rounded text-xs text-brown-600 hover:text-brown-800 hover:bg-brown-100 transition-colors"
										title={copiedFeedbackId === beer.id ? 'Copied!' : 'Copy feedback URL'}
									>
										{#if copiedFeedbackId === beer.id}
											<Check class="w-3.5 h-3.5 text-green-600" />
											<span class="text-green-600">Copied!</span>
										{:else}
											<Files class="w-3.5 h-3.5" />
											<span>Feedback URL</span>
										{/if}
									</button>
								{/if}
								<form
									method="POST"
									action="?/deleteBeer"
									use:enhance={() => {
										if (!confirm(`Delete "${beer.name}"? This will also delete all votes and feedback for this beer.`)) {
											return () => {};
										}
										return async ({ update }) => {
											await update();
										};
									}}
								>
									<input type="hidden" name="beerId" value={beer.id} />
									<button type="submit" class="flex items-center gap-1 px-2 py-1 rounded text-xs text-red-600 hover:text-red-700 hover:bg-red-50 transition-colors">
										<Trash2 class="w-3.5 h-3.5" />
										<span>Delete</span>
									</button>
								</form>
							</div>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>

</div>

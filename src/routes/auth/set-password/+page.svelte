<script lang="ts">
	let { data } = $props();

	let password = $state('');
	let confirmPassword = $state('');
	let error = $state('');
	let loading = $state(false);

	async function handleSubmit(e: Event) {
		e.preventDefault();
		error = '';

		if (password.length < 8) {
			error = 'Password must be at least 8 characters.';
			return;
		}

		if (password !== confirmPassword) {
			error = 'Passwords do not match.';
			return;
		}

		loading = true;

		const { error: updateError } = await data.supabase.auth.updateUser({ password });

		if (updateError) {
			error = updateError.message;
			loading = false;
			return;
		}

		window.location.href = '/admin';
	}
</script>

<svelte:head>
	<title>Set Password - People's Choice Beer Voting</title>
</svelte:head>

<div class="min-h-screen flex items-start justify-center px-4 pt-[20vh]">
	<div class="w-full max-w-sm">
		<div class="text-center mb-8">
			<div class="text-4xl mb-3">🍺</div>
			<h1 class="text-2xl font-bold text-brown-900 mb-2">Set Your Password</h1>
			<p class="text-sm text-brown-500">Choose a password for your admin account.</p>
		</div>

		<form class="card space-y-4" onsubmit={handleSubmit}>
			<div>
				<label class="label" for="password">Password</label>
				<input
					class="input"
					id="password"
					type="password"
					bind:value={password}
					placeholder="••••••••"
					required
					minlength={8}
					disabled={loading}
				/>
			</div>

			<div>
				<label class="label" for="confirm-password">Confirm Password</label>
				<input
					class="input"
					id="confirm-password"
					type="password"
					bind:value={confirmPassword}
					placeholder="••••••••"
					required
					minlength={8}
					disabled={loading}
				/>
			</div>

			{#if error}
				<p class="text-error">{error}</p>
			{/if}

			<button class="btn-primary w-full" type="submit" disabled={loading}>
				{loading ? 'Setting password...' : 'Set password'}
			</button>
		</form>
	</div>
</div>

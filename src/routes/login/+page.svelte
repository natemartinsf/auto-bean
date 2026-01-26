<script lang="ts">
	let { data } = $props();

	let email = $state('');
	let password = $state('');
	let error = $state('');
	let loading = $state(false);

	async function handleSubmit(e: Event) {
		e.preventDefault();
		error = '';
		loading = true;

		const { error: authError } = await data.supabase.auth.signInWithPassword({
			email,
			password
		});

		if (authError) {
			error = authError.message;
			loading = false;
			return;
		}

		// Hard redirect to ensure server reads the new auth cookies
		window.location.href = '/admin';
	}
</script>

<svelte:head>
	<title>Login - People's Choice Beer Voting</title>
</svelte:head>

<div class="min-h-screen flex items-start justify-center px-4 pt-[20vh]">
	<div class="w-full max-w-sm">
		<div class="text-center mb-8">
			<div class="text-4xl mb-3">🍺</div>
			<h1 class="text-2xl font-bold text-brown-900">People's Choice</h1>
			<h1 class="text-2xl font-bold text-brown-900 mb-2">Beer Voting</h1>
			<p class="text-sm text-brown-500">Admin Login</p>
		</div>

		<form class="card space-y-4" onsubmit={handleSubmit}>
			<div>
				<label class="label" for="email">Email</label>
				<input
					class="input"
					id="email"
					type="email"
					bind:value={email}
					placeholder="you@example.com"
					required
					disabled={loading}
				/>
			</div>

			<div>
				<label class="label" for="password">Password</label>
				<input
					class="input"
					id="password"
					type="password"
					bind:value={password}
					placeholder="••••••••"
					required
					disabled={loading}
				/>
			</div>

			{#if error}
				<p class="text-error">{error}</p>
			{/if}

			<button class="btn-primary w-full" type="submit" disabled={loading}>
				{loading ? 'Signing in...' : 'Sign in'}
			</button>
		</form>
	</div>
</div>

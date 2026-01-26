<script lang="ts">
	let { data } = $props();

	let email = $state('');
	let password = $state('');
	let error = $state('');
	let loading = $state(false);
	let showForgotPassword = $state(false);
	let resetSent = $state(false);

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

	async function handleResetPassword(e: Event) {
		e.preventDefault();
		error = '';
		loading = true;

		const { error: resetError } = await data.supabase.auth.resetPasswordForEmail(email, {
			redirectTo: `${window.location.origin}/auth/callback?next=set-password`
		});

		if (resetError) {
			error = resetError.message;
			loading = false;
			return;
		}

		resetSent = true;
		loading = false;
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

		{#if showForgotPassword}
			<div class="card space-y-4">
				{#if resetSent}
					<p class="text-green-700 text-sm">
						Check your email for a password reset link.
					</p>
				{:else}
					<form class="space-y-4" onsubmit={handleResetPassword}>
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

						{#if error}
							<p class="text-error">{error}</p>
						{/if}

						<button class="btn-primary w-full" type="submit" disabled={loading}>
							{loading ? 'Sending...' : 'Send reset link'}
						</button>
					</form>
				{/if}
				<button
					class="btn-ghost w-full text-sm"
					onclick={() => { showForgotPassword = false; error = ''; resetSent = false; }}
				>
					Back to login
				</button>
			</div>
		{:else}
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

				<button
					type="button"
					class="btn-ghost w-full text-sm"
					onclick={() => { showForgotPassword = true; error = ''; }}
				>
					Forgot password?
				</button>
			</form>
		{/if}
	</div>
</div>

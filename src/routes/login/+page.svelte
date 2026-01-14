<script lang="ts">
	import { supabase } from '$lib/supabase';
	import { goto } from '$app/navigation';

	let email = $state('');
	let password = $state('');
	let error = $state('');
	let loading = $state(false);

	async function handleSubmit(e: Event) {
		e.preventDefault();
		error = '';
		loading = true;

		const { error: authError } = await supabase.auth.signInWithPassword({
			email,
			password
		});

		if (authError) {
			error = authError.message;
			loading = false;
			return;
		}

		goto('/admin');
	}
</script>

<svelte:head>
	<title>Login - People's Choice Beer Voting</title>
</svelte:head>

<div class="min-h-screen flex items-center justify-center p-4">
	<div class="w-full max-w-sm">
		<h1 class="heading text-center mb-6">Admin Login</h1>

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

			<p class="text-center text-sm text-muted">
				New admin? <a href="/signup">Create an account</a>
			</p>
		</form>
	</div>
</div>

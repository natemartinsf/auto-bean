<script lang="ts">
	import { page } from '$app/stores';
</script>

<svelte:head>
	<title>Error {$page.status} - PintPoll</title>
</svelte:head>

<div class="min-h-screen flex items-center justify-center px-6">
	<div class="text-center">
		<h1 class="text-7xl font-bold text-amber-500 mb-4">{$page.status}</h1>
		<p class="text-xl text-brown-700 mb-8">{$page.error?.message || 'Something went wrong'}</p>
		<a href="/" class="btn-primary inline-block">Go Home</a>
	</div>
</div>

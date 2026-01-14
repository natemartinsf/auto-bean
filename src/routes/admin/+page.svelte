<script lang="ts">
	let { data } = $props();
</script>

<svelte:head>
	<title>Admin - People's Choice Beer Voting</title>
</svelte:head>

<h1 class="heading mb-4">Events</h1>
<p class="text-muted">Welcome, {data.admin?.email}. Event management coming in Task 3.1.</p>

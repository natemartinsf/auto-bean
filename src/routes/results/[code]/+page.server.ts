import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import type { Event, Beer } from '$lib/types';
import { resolveShortCode } from '$lib/short-codes';

interface RankedBeer extends Beer {
	totalPoints: number;
	voterCount: number;
	rank: number;
}

export const load: PageServerLoad = async ({ locals, params }) => {
	const eventId = await resolveShortCode(locals.supabase, params.code, 'event');

	if (!eventId) {
		throw error(404, 'Event not found');
	}

	// Get event
	const { data: event, error: eventError } = await locals.supabase
		.from('events')
		.select('*')
		.eq('id', eventId)
		.single();

	if (eventError || !event) {
		throw error(404, 'Event not found');
	}

	// Get beers for this event
	const { data: beersData, error: beersError } = await locals.supabase
		.from('beers')
		.select('*')
		.eq('event_id', eventId);

	if (beersError) {
		console.error('Error fetching beers:', beersError);
	}

	const beers = (beersData || []) as Beer[];

	// Get all votes for beers in this event
	const beerIds = beers.map((b) => b.id);
	let votes: { beer_id: string; points: number }[] = [];

	if (beerIds.length > 0) {
		const { data: votesData, error: votesError } = await locals.supabase
			.from('votes')
			.select('beer_id, points')
			.in('beer_id', beerIds);

		if (votesError) {
			console.error('Error fetching votes:', votesError);
		} else {
			votes = (votesData || []) as { beer_id: string; points: number }[];
		}
	}

	// Get voter count for this event
	const { count: voterCount, error: voterError } = await locals.supabase
		.from('voters')
		.select('*', { count: 'exact', head: true })
		.eq('event_id', eventId);

	if (voterError) {
		console.error('Error counting voters:', voterError);
	}

	// Calculate rankings
	const beerStats = new Map<string, { totalPoints: number; voterCount: number }>();

	for (const vote of votes) {
		const current = beerStats.get(vote.beer_id) || { totalPoints: 0, voterCount: 0 };
		current.totalPoints += vote.points;
		current.voterCount += 1;
		beerStats.set(vote.beer_id, current);
	}

	// Build ranked beers array
	const rankedBeers: RankedBeer[] = beers
		.map((beer) => {
			const stats = beerStats.get(beer.id) || { totalPoints: 0, voterCount: 0 };
			return {
				...beer,
				totalPoints: stats.totalPoints,
				voterCount: stats.voterCount,
				rank: 0 // Will be assigned after sorting
			};
		})
		.sort((a, b) => b.totalPoints - a.totalPoints);

	// Assign ranks (handling ties)
	let currentRank = 1;
	for (let i = 0; i < rankedBeers.length; i++) {
		if (i > 0 && rankedBeers[i].totalPoints < rankedBeers[i - 1].totalPoints) {
			currentRank = i + 1;
		}
		rankedBeers[i].rank = currentRank;
	}

	// Calculate total points cast
	const totalPointsCast = votes.reduce((sum, v) => sum + v.points, 0);

	return {
		event: event as Event,
		rankedBeers,
		stats: {
			beerCount: beers.length,
			voterCount: voterCount || 0,
			totalPointsCast
		}
	};
};

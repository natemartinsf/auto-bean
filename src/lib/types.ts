// Database types matching Supabase schema
// See: supabase/migrations/001_initial_schema.sql

export interface Database {
	public: {
		Tables: {
			events: {
				Row: Event;
				Insert: EventInsert;
				Update: EventUpdate;
			};
			voters: {
				Row: Voter;
				Insert: VoterInsert;
				Update: VoterUpdate;
			};
			beers: {
				Row: Beer;
				Insert: BeerInsert;
				Update: BeerUpdate;
			};
			votes: {
				Row: Vote;
				Insert: VoteInsert;
				Update: VoteUpdate;
			};
			feedback: {
				Row: Feedback;
				Insert: FeedbackInsert;
				Update: FeedbackUpdate;
			};
			brewer_tokens: {
				Row: BrewerToken;
				Insert: BrewerTokenInsert;
				Update: BrewerTokenUpdate;
			};
			admins: {
				Row: Admin;
				Insert: AdminInsert;
				Update: AdminUpdate;
			};
			event_admins: {
				Row: EventAdmin;
				Insert: EventAdminInsert;
				Update: EventAdminUpdate;
			};
		};
	};
}

// Events
export interface Event {
	id: string;
	name: string;
	date: string | null;
	max_points: number;
	results_visible: boolean;
	manage_token: string;
	created_at: string;
}

export interface EventInsert {
	id?: string;
	name: string;
	date?: string | null;
	max_points?: number;
	results_visible?: boolean;
	manage_token?: string;
	created_at?: string;
}

export interface EventUpdate {
	id?: string;
	name?: string;
	date?: string | null;
	max_points?: number;
	results_visible?: boolean;
	manage_token?: string;
	created_at?: string;
}

// Voters
export interface Voter {
	id: string;
	event_id: string;
	created_at: string;
}

export interface VoterInsert {
	id: string; // Required - from QR code UUID
	event_id: string;
	created_at?: string;
}

export interface VoterUpdate {
	id?: string;
	event_id?: string;
	created_at?: string;
}

// Beers
export interface Beer {
	id: string;
	event_id: string;
	name: string;
	brewer: string;
	style: string | null;
	created_at: string;
}

export interface BeerInsert {
	id?: string;
	event_id: string;
	name: string;
	brewer: string;
	style?: string | null;
	created_at?: string;
}

export interface BeerUpdate {
	id?: string;
	event_id?: string;
	name?: string;
	brewer?: string;
	style?: string | null;
	created_at?: string;
}

// Votes
export interface Vote {
	id: string;
	voter_id: string;
	beer_id: string;
	points: number;
	updated_at: string;
}

export interface VoteInsert {
	id?: string;
	voter_id: string;
	beer_id: string;
	points: number;
	updated_at?: string;
}

export interface VoteUpdate {
	id?: string;
	voter_id?: string;
	beer_id?: string;
	points?: number;
	updated_at?: string;
}

// Feedback
export interface Feedback {
	id: string;
	voter_id: string;
	beer_id: string;
	notes: string | null;
	share_with_brewer: boolean;
	created_at: string;
}

export interface FeedbackInsert {
	id?: string;
	voter_id: string;
	beer_id: string;
	notes?: string | null;
	share_with_brewer?: boolean;
	created_at?: string;
}

export interface FeedbackUpdate {
	id?: string;
	voter_id?: string;
	beer_id?: string;
	notes?: string | null;
	share_with_brewer?: boolean;
	created_at?: string;
}

// Brewer Tokens
export interface BrewerToken {
	id: string;
	beer_id: string;
	created_at: string;
}

export interface BrewerTokenInsert {
	id?: string;
	beer_id: string;
	created_at?: string;
}

export interface BrewerTokenUpdate {
	id?: string;
	beer_id?: string;
	created_at?: string;
}

// Admins
export interface Admin {
	id: string;
	user_id: string;
	email: string;
	created_at: string;
}

export interface AdminInsert {
	id?: string;
	user_id: string;
	email: string;
	created_at?: string;
}

export interface AdminUpdate {
	id?: string;
	user_id?: string;
	email?: string;
	created_at?: string;
}

// Event Admins (junction table)
export interface EventAdmin {
	event_id: string;
	admin_id: string;
	created_at: string;
}

export interface EventAdminInsert {
	event_id: string;
	admin_id: string;
	created_at?: string;
}

export interface EventAdminUpdate {
	event_id?: string;
	admin_id?: string;
	created_at?: string;
}

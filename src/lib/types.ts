// Re-export generated types from Supabase
// Run `npm run gen:types` after schema changes to regenerate

export type { Database, Tables, TablesInsert, TablesUpdate } from './database.types';

import type { Database } from './database.types';

// Convenient type aliases for Row types
export type Event = Database['public']['Tables']['events']['Row'];
export type EventInsert = Database['public']['Tables']['events']['Insert'];
export type EventUpdate = Database['public']['Tables']['events']['Update'];

export type Voter = Database['public']['Tables']['voters']['Row'];
export type VoterInsert = Database['public']['Tables']['voters']['Insert'];
export type VoterUpdate = Database['public']['Tables']['voters']['Update'];

export type Beer = Database['public']['Tables']['beers']['Row'];
export type BeerInsert = Database['public']['Tables']['beers']['Insert'];
export type BeerUpdate = Database['public']['Tables']['beers']['Update'];

export type Vote = Database['public']['Tables']['votes']['Row'];
export type VoteInsert = Database['public']['Tables']['votes']['Insert'];
export type VoteUpdate = Database['public']['Tables']['votes']['Update'];

export type Feedback = Database['public']['Tables']['feedback']['Row'];
export type FeedbackInsert = Database['public']['Tables']['feedback']['Insert'];
export type FeedbackUpdate = Database['public']['Tables']['feedback']['Update'];

export type BrewerToken = Database['public']['Tables']['brewer_tokens']['Row'];
export type BrewerTokenInsert = Database['public']['Tables']['brewer_tokens']['Insert'];
export type BrewerTokenUpdate = Database['public']['Tables']['brewer_tokens']['Update'];

export type Admin = Database['public']['Tables']['admins']['Row'];
export type AdminInsert = Database['public']['Tables']['admins']['Insert'];
export type AdminUpdate = Database['public']['Tables']['admins']['Update'];

export type EventAdmin = Database['public']['Tables']['event_admins']['Row'];
export type EventAdminInsert = Database['public']['Tables']['event_admins']['Insert'];
export type EventAdminUpdate = Database['public']['Tables']['event_admins']['Update'];

export type ShortCode = Database['public']['Tables']['short_codes']['Row'];
export type ShortCodeInsert = Database['public']['Tables']['short_codes']['Insert'];
export type ShortCodeUpdate = Database['public']['Tables']['short_codes']['Update'];

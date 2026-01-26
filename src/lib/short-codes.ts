import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

export type ShortCodeType = 'event' | 'voter' | 'manage' | 'brewer';

const CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789';
const CODE_LENGTH = 8;

/** Generate an 8-char lowercase alphanumeric short code */
export function generateShortCode(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(CODE_LENGTH));
	let result = '';
	for (let i = 0; i < CODE_LENGTH; i++) {
		result += CHARS[bytes[i] % 36];
	}
	return result;
}

/** Resolve a short code to its target UUID. Returns null if not found. */
export async function resolveShortCode(
	supabase: SupabaseClient<Database>,
	code: string,
	targetType: ShortCodeType
): Promise<string | null> {
	const { data } = await supabase
		.from('short_codes')
		.select('target_id')
		.eq('code', code.toLowerCase())
		.eq('target_type', targetType)
		.single();

	return data?.target_id ?? null;
}

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

export type ShortCodeType = 'event' | 'voter' | 'manage' | 'brewer';

const CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789';
const CODE_LENGTH = 8;

const MAX_RETRIES = 5;

function randomCode(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(CODE_LENGTH));
	let result = '';
	for (let i = 0; i < CODE_LENGTH; i++) {
		result += CHARS[bytes[i] % 36];
	}
	return result;
}

/** Generate an 8-char short code guaranteed unique in the database. Retries on collision. */
export async function generateShortCode(
	supabase: SupabaseClient<Database>
): Promise<string> {
	for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
		const code = randomCode();
		const { data, error } = await supabase
			.from('short_codes')
			.select('code')
			.eq('code', code)
			.maybeSingle();

		if (error) {
			throw new Error(`Failed to check short code uniqueness: ${error.message}`);
		}

		if (!data) {
			return code;
		}
	}

	throw new Error(`Failed to generate unique short code after ${MAX_RETRIES} attempts`);
}

/** Resolve a short code to its target UUID. Returns null if not found, throws on DB errors. */
export async function resolveShortCode(
	supabase: SupabaseClient<Database>,
	code: string,
	targetType: ShortCodeType
): Promise<string | null> {
	const { data, error } = await supabase
		.from('short_codes')
		.select('target_id')
		.eq('code', code.toLowerCase())
		.eq('target_type', targetType)
		.maybeSingle();

	if (error) {
		throw new Error(`Failed to resolve short code: ${error.message}`);
	}

	return data?.target_id ?? null;
}

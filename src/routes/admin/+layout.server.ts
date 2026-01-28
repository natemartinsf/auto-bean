import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

interface AdminInfo {
	id: string;
	email: string;
	is_super: boolean;
	organization_id: string;
	organization_name: string;
}

export const load: LayoutServerLoad = async ({ locals }) => {
	const { session, user } = await locals.safeGetSession();

	if (!session || !user) {
		throw redirect(303, '/login');
	}

	// Check if user is in the admins table
	const { data: admin, error } = await locals.supabase
		.from('admins')
		.select('id, email, is_super, organization_id, organizations(name)')
		.eq('user_id', user.id)
		.single();

	if (error || !admin) {
		return {
			session,
			user,
			admin: null as AdminInfo | null,
			isAdmin: false as const,
			isSuper: false
		};
	}

	const adminInfo: AdminInfo = {
		id: admin.id,
		email: admin.email,
		is_super: admin.is_super,
		organization_id: admin.organization_id,
		organization_name: (admin.organizations as unknown as { name: string })?.name ?? ''
	};

	return {
		session,
		user,
		admin: adminInfo,
		isAdmin: true as const,
		isSuper: admin.is_super
	};
};

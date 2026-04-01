import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface RoleDefinition {
  id: string;
  name: string;
  display_name: string;
  description: string | null;
  is_system: boolean;
}

export interface UserProfile {
  id: string;
  user_id: string;
  full_name: string | null;
  role_id: string | null;
  company_id: string | null;
  is_active: boolean;
  role_definitions?: RoleDefinition | null;
}

export function usePermissions() {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["user-permissions", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      // Fetch user profile with role definition
      const { data: profile } = await (supabase as any)
        .from("rh_user_profiles")
        .select("*, rh_role_definitions(*)")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!profile?.role_id) return { profile, permissions: [] };

      // Fetch permissions for this role
      const { data: perms } = await (supabase as any)
        .from("rh_role_permissions")
        .select("module, can_view, can_edit")
        .eq("role_id", profile.role_id);

      return { profile, permissions: perms ?? [] };
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  });

  const permMap = new Map<string, { canView: boolean; canEdit: boolean }>();
  (data?.permissions ?? []).forEach((p: any) => {
    permMap.set(p.module, { canView: p.can_view, canEdit: p.can_edit });
  });

  const roleDef = data?.profile?.role_definitions as RoleDefinition | null;
  const roleName = roleDef?.name ?? null;
  const isSuperAdmin = roleName === "super_admin";
  const isAdmin = roleName === "admin" || isSuperAdmin;

  return {
    role: roleName,
    roleName: roleDef?.display_name ?? null,
    canView: (module: string) => {
      if (isSuperAdmin) return true;
      return permMap.get(module)?.canView ?? false;
    },
    canEdit: (module: string) => {
      if (isSuperAdmin) return true;
      return permMap.get(module)?.canEdit ?? false;
    },
    isAdmin,
    isSuperAdmin,
    permissions: permMap,
    loading: isLoading,
    userProfile: data?.profile as UserProfile | null,
  };
}

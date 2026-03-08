import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { Users } from "lucide-react";
import { usePermissions } from "@/hooks/usePermissions";

interface RoleDef {
  id: string;
  name: string;
  display_name: string;
}

interface UserRow {
  id: string;
  email: string;
  name: string;
  profile_id: string | null;
  role_id: string | null;
  role_name: string | null;
  role_display: string | null;
  is_active: boolean;
  created_at: string;
}

const ROLE_COLORS: Record<string, string> = {
  super_admin: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  admin: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  rh: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  diretoria: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  financeiro: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
};

export default function UserManagementTab() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [roles, setRoles] = useState<RoleDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const { isSuperAdmin } = usePermissions();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke("list-users", {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      const authUsers = res.data ?? [];

      const [profilesRes, rolesRes] = await Promise.all([
        (supabase as any).from("user_profiles").select("*, role_definitions(*)"),
        (supabase as any).from("role_definitions").select("*").order("created_at"),
      ]);

      const profiles = profilesRes.data ?? [];
      setRoles(rolesRes.data ?? []);

      const merged: UserRow[] = authUsers.map((u: any) => {
        const profile = profiles.find((p: any) => p.user_id === u.id);
        return {
          id: u.id,
          email: u.email,
          name: u.name || "",
          profile_id: profile?.id ?? null,
          role_id: profile?.role_id ?? null,
          role_name: profile?.role_definitions?.name ?? null,
          role_display: profile?.role_definitions?.display_name ?? null,
          is_active: profile?.is_active ?? true,
          created_at: u.created_at,
        };
      });

      setUsers(merged);
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRoleChange = async (user: UserRow, newRoleId: string) => {
    const targetRole = roles.find((r) => r.id === newRoleId);

    if (!isSuperAdmin && targetRole?.name === "super_admin") {
      toast({ title: "Apenas Super Admins podem atribuir este perfil.", variant: "destructive" });
      return;
    }
    if (user.role_name === "super_admin" && !isSuperAdmin) {
      toast({ title: "Você não pode alterar um Super Admin.", variant: "destructive" });
      return;
    }

    setSaving(user.id);
    try {
      if (user.profile_id) {
        await (supabase as any)
          .from("user_profiles")
          .update({ role_id: newRoleId })
          .eq("id", user.profile_id);
      } else {
        await (supabase as any)
          .from("user_profiles")
          .insert({ user_id: user.id, role_id: newRoleId });
      }
      toast({ title: `Perfil de ${user.name || user.email} atualizado.` });
      await fetchData();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
    setSaving(null);
  };

  const handleToggleActive = async (user: UserRow) => {
    if (user.role_name === "super_admin" && !isSuperAdmin) {
      toast({ title: "Super Admin não pode ser desativado por Admin.", variant: "destructive" });
      return;
    }

    setSaving(user.id);
    try {
      if (user.profile_id) {
        await (supabase as any)
          .from("user_profiles")
          .update({ is_active: !user.is_active })
          .eq("id", user.profile_id);
      } else {
        await (supabase as any)
          .from("user_profiles")
          .insert({ user_id: user.id, is_active: !user.is_active });
      }
      toast({ title: `Usuário ${user.is_active ? "desativado" : "ativado"}.` });
      await fetchData();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
    setSaving(null);
  };

  if (loading) return <Skeleton className="h-96 w-full" />;

  const assignableRoles = isSuperAdmin
    ? roles
    : roles.filter((r) => r.name !== "super_admin");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          Gestão de Usuários
        </CardTitle>
        <CardDescription>
          Gerencie os perfis de acesso e status dos usuários do sistema.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead>Perfil</TableHead>
              <TableHead>Alterar Perfil</TableHead>
              <TableHead className="text-center">Ativo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => (
              <TableRow key={u.id} className={!u.is_active ? "opacity-50" : ""}>
                <TableCell className="font-medium">{u.name || "—"}</TableCell>
                <TableCell className="text-sm">{u.email}</TableCell>
                <TableCell>
                  {u.role_display ? (
                    <Badge className={`border-0 ${ROLE_COLORS[u.role_name ?? ""] ?? ""}`}>
                      {u.role_display}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground">
                      Sem perfil
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  <Select
                    value={u.role_id ?? ""}
                    onValueChange={(v) => handleRoleChange(u, v)}
                    disabled={saving === u.id}
                  >
                    <SelectTrigger className="w-[160px]">
                      <SelectValue placeholder="Selecionar" />
                    </SelectTrigger>
                    <SelectContent>
                      {assignableRoles.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.display_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="text-center">
                  <Switch
                    checked={u.is_active}
                    onCheckedChange={() => handleToggleActive(u)}
                    disabled={saving === u.id}
                  />
                </TableCell>
              </TableRow>
            ))}
            {users.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  Nenhum usuário encontrado.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

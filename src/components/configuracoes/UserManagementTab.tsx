import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { Users, UserPlus, Link2, RotateCw, X, Loader2, Copy, CheckCircle2 } from "lucide-react";
import { usePermissions } from "@/hooks/usePermissions";
import { useCompany } from "@/contexts/CompanyContext";
import { useAuth } from "@/contexts/AuthContext";

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

interface InviteRow {
  id: string;
  email: string;
  full_name: string | null;
  role_display: string | null;
  invited_by_name: string | null;
  status: string;
  created_at: string;
  expires_at: string;
  invite_link: string | null;
}

const ROLE_COLORS: Record<string, string> = {
  super_admin: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  admin: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  rh: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  diretoria: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  financeiro: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  accepted: "bg-green-100 text-green-800",
  expired: "bg-muted text-muted-foreground",
  revoked: "bg-red-100 text-red-800",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Pendente",
  accepted: "Aceito",
  expired: "Expirado",
  revoked: "Revogado",
};

export default function UserManagementTab() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [roles, setRoles] = useState<RoleDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: "", full_name: "", role_name: "", company_id: "" });
  const [inviteResult, setInviteResult] = useState<{ link: string; name: string; email: string; role: string } | null>(null);
  const { isSuperAdmin } = usePermissions();
  const { user } = useAuth();
  const { companies } = useCompany();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke("list-users", {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      const authUsers = res.data ?? [];

      const [profilesRes, rolesRes, invitesRes] = await Promise.all([
        (supabase as any).from("rh_user_profiles").select("*, rh_role_definitions(*)"),
        (supabase as any).from("rh_role_definitions").select("*").order("created_at"),
        (supabase as any).from("rh_user_invites").select("*, rh_role_definitions(display_name)").order("created_at", { ascending: false }),
      ]);

      const profiles = profilesRes.data ?? [];
      setRoles(rolesRes.data ?? []);

      const merged: UserRow[] = authUsers.map((u: any) => {
        const profile = profiles.find((p: any) => p.user_id === u.id);
        return {
          id: u.id,
          email: u.email,
          name: u.name || profile?.full_name || "",
          profile_id: profile?.id ?? null,
          role_id: profile?.role_id ?? null,
          role_name: profile?.role_definitions?.name ?? null,
          role_display: profile?.role_definitions?.display_name ?? null,
          is_active: profile?.is_active ?? true,
          created_at: u.created_at,
        };
      });

      setUsers(merged);

      const inviteRows: InviteRow[] = (invitesRes.data ?? []).map((inv: any) => {
        const inviter = authUsers.find((u: any) => u.id === inv.invited_by);
        return {
          id: inv.id,
          email: inv.email,
          full_name: inv.full_name,
          role_display: inv.role_definitions?.display_name ?? null,
          invited_by_name: inviter?.name || inviter?.email || "—",
          status: inv.status,
          created_at: inv.created_at,
          expires_at: inv.expires_at,
          invite_link: inv.invite_link ?? null,
        };
      });
      setInvites(inviteRows);
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleRoleChange = async (u: UserRow, newRoleId: string) => {
    const targetRole = roles.find((r) => r.id === newRoleId);
    if (!isSuperAdmin && targetRole?.name === "super_admin") {
      toast({ title: "Apenas Super Admins podem atribuir este perfil.", variant: "destructive" });
      return;
    }
    if (u.role_name === "super_admin" && !isSuperAdmin) {
      toast({ title: "Você não pode alterar um Super Admin.", variant: "destructive" });
      return;
    }
    setSaving(u.id);
    try {
      if (u.profile_id) {
        await (supabase as any).from("rh_user_profiles").update({ role_id: newRoleId }).eq("id", u.profile_id);
      } else {
        await (supabase as any).from("rh_user_profiles").insert({ user_id: u.id, role_id: newRoleId });
      }
      toast({ title: `Perfil de ${u.name || u.email} atualizado.` });
      await fetchData();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
    setSaving(null);
  };

  const handleToggleActive = async (u: UserRow) => {
    if (u.role_name === "super_admin" && !isSuperAdmin) {
      toast({ title: "Super Admin não pode ser desativado por Admin.", variant: "destructive" });
      return;
    }
    setSaving(u.id);
    try {
      if (u.profile_id) {
        await (supabase as any).from("rh_user_profiles").update({ is_active: !u.is_active }).eq("id", u.profile_id);
      } else {
        await (supabase as any).from("rh_user_profiles").insert({ user_id: u.id, is_active: !u.is_active });
      }
      toast({ title: `Usuário ${u.is_active ? "desativado" : "ativado"}.` });
      await fetchData();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
    setSaving(null);
  };

  const handleGenerateInvite = async () => {
    if (!inviteForm.email || !inviteForm.full_name || !inviteForm.role_name) {
      toast({ title: "Preencha todos os campos obrigatórios.", variant: "destructive" });
      return;
    }
    setInviteLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke("invite-user", {
        headers: { Authorization: `Bearer ${session?.access_token}` },
        body: {
          email: inviteForm.email,
          full_name: inviteForm.full_name,
          role_name: inviteForm.role_name,
          company_id: inviteForm.company_id || null,
        },
      });
      if (res.error || res.data?.error) {
        throw new Error(res.data?.error || res.error?.message || "Erro ao gerar convite");
      }
      const roleDisplay = roles.find(r => r.name === inviteForm.role_name)?.display_name || inviteForm.role_name;
      setInviteResult({
        link: res.data.invite_link,
        name: inviteForm.full_name,
        email: inviteForm.email,
        role: roleDisplay,
      });
      toast({ title: `Convite gerado para ${inviteForm.email}` });
      await fetchData();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
    setInviteLoading(false);
  };

  const handleCopyLink = async (link: string) => {
    try {
      await navigator.clipboard.writeText(link);
      toast({ title: "Link copiado!" });
    } catch {
      toast({ title: "Erro ao copiar link", variant: "destructive" });
    }
  };

  const handleRegenerateLink = async (inv: InviteRow) => {
    setSaving(inv.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const role = roles.find(r => r.display_name === inv.role_display);
      const res = await supabase.functions.invoke("invite-user", {
        headers: { Authorization: `Bearer ${session?.access_token}` },
        body: {
          email: inv.email,
          full_name: inv.full_name || "",
          role_name: role?.name || "rh",
        },
      });
      if (res.error || res.data?.error) {
        throw new Error(res.data?.error || res.error?.message || "Erro ao regenerar convite");
      }
      if (res.data?.invite_link) {
        await handleCopyLink(res.data.invite_link);
        toast({ title: "Novo link gerado e copiado!" });
      }
      await fetchData();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
    setSaving(null);
  };

  const handleRevokeInvite = async (inv: InviteRow) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke("invite-user", {
        headers: { Authorization: `Bearer ${session?.access_token}` },
        body: {
          action: "revoke",
          invite_id: inv.id,
        },
      });

      if (res.error || res.data?.error) {
        throw new Error(res.data?.error || res.error?.message || "Erro ao revogar convite");
      }

      toast({ title: "Convite revogado." });
      await fetchData();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  const closeInviteModal = () => {
    setInviteOpen(false);
    setInviteResult(null);
    setInviteForm({ email: "", full_name: "", role_name: "", company_id: "" });
  };

  if (loading) return <Skeleton className="h-96 w-full" />;

  const assignableRoles = isSuperAdmin
    ? roles
    : roles.filter((r) => r.name !== "super_admin");

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Gestão de Usuários
          </CardTitle>
          <CardDescription>Gerencie usuários e convites do sistema.</CardDescription>
        </div>
        <Button onClick={() => setInviteOpen(true)} className="gap-2">
          <UserPlus className="h-4 w-4" />
          Convidar Usuário
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        <Tabs defaultValue="users" className="w-full">
          <div className="px-6 pb-2">
            <TabsList>
              <TabsTrigger value="users">Usuários Ativos</TabsTrigger>
              <TabsTrigger value="invites">Convites</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="users" className="mt-0">
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
                        <Badge variant="outline" className="text-muted-foreground">Sem perfil</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Select value={u.role_id ?? ""} onValueChange={(v) => handleRoleChange(u, v)} disabled={saving === u.id}>
                        <SelectTrigger className="w-[160px]">
                          <SelectValue placeholder="Selecionar" />
                        </SelectTrigger>
                        <SelectContent>
                          {assignableRoles.map((r) => (
                            <SelectItem key={r.id} value={r.id}>{r.display_name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch checked={u.is_active} onCheckedChange={() => handleToggleActive(u)} disabled={saving === u.id} />
                    </TableCell>
                  </TableRow>
                ))}
                {users.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhum usuário encontrado.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TabsContent>

          <TabsContent value="invites" className="mt-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Perfil</TableHead>
                  <TableHead>Convidado por</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invites.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="text-sm">{inv.email}</TableCell>
                    <TableCell className="font-medium">{inv.full_name || "—"}</TableCell>
                    <TableCell>{inv.role_display || "—"}</TableCell>
                    <TableCell className="text-sm">{inv.invited_by_name}</TableCell>
                    <TableCell className="text-sm">{new Date(inv.created_at).toLocaleDateString("pt-BR")}</TableCell>
                    <TableCell>
                      <Badge className={`border-0 ${STATUS_COLORS[inv.status] ?? ""}`}>
                        {STATUS_LABELS[inv.status] ?? inv.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {inv.status === "pending" && (
                        <div className="flex gap-1">
                          {inv.invite_link && (
                            <Button size="sm" variant="ghost" onClick={() => handleCopyLink(inv.invite_link!)} title="Copiar link">
                              <Copy className="h-4 w-4" />
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" onClick={() => handleRegenerateLink(inv)} disabled={saving === inv.id} title="Regenerar link">
                            <RotateCw className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleRevokeInvite(inv)} title="Revogar">
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                      {inv.status === "expired" && (
                        <Button size="sm" variant="ghost" onClick={() => handleRegenerateLink(inv)} disabled={saving === inv.id} title="Regenerar">
                          <RotateCw className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {invites.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhum convite registrado.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TabsContent>
        </Tabs>
      </CardContent>

      {/* Invite Modal */}
      <Dialog open={inviteOpen} onOpenChange={(open) => { if (!open) closeInviteModal(); }}>
        <DialogContent className="max-w-lg">
          {!inviteResult ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Link2 className="h-5 w-5" /> Convidar Usuário
                </DialogTitle>
                <DialogDescription>Gere um link de convite para um novo usuário.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>E-mail *</Label>
                  <Input type="email" placeholder="usuario@empresa.com" value={inviteForm.email} onChange={(e) => setInviteForm(f => ({ ...f, email: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Nome completo *</Label>
                  <Input placeholder="Nome do colaborador" value={inviteForm.full_name} onChange={(e) => setInviteForm(f => ({ ...f, full_name: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Perfil de acesso *</Label>
                  <Select value={inviteForm.role_name} onValueChange={(v) => setInviteForm(f => ({ ...f, role_name: v }))}>
                    <SelectTrigger><SelectValue placeholder="Selecionar perfil" /></SelectTrigger>
                    <SelectContent>
                      {assignableRoles.map((r) => (
                        <SelectItem key={r.id} value={r.name}>{r.display_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Empresa</Label>
                  <Select value={inviteForm.company_id} onValueChange={(v) => setInviteForm(f => ({ ...f, company_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Todas as empresas" /></SelectTrigger>
                    <SelectContent>
                      {(companies ?? []).map((c: any) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={closeInviteModal}>Cancelar</Button>
                <Button onClick={handleGenerateInvite} disabled={inviteLoading} className="gap-2">
                  {inviteLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
                  Gerar Link de Convite
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-green-700 dark:text-green-400">
                  <CheckCircle2 className="h-5 w-5" /> Convite gerado com sucesso!
                </DialogTitle>
                <DialogDescription>Envie este link para o convidado por WhatsApp, email ou outro meio.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-1 text-sm">
                  <p><span className="text-muted-foreground">Convite para:</span> <strong>{inviteResult.name}</strong></p>
                  <p><span className="text-muted-foreground">Email:</span> {inviteResult.email}</p>
                  <p><span className="text-muted-foreground">Perfil:</span> {inviteResult.role}</p>
                  <p><span className="text-muted-foreground">Expira em:</span> 7 dias</p>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Link de acesso:</Label>
                  <div className="flex items-center gap-2 rounded-md border bg-muted/30 p-3">
                    <code className="flex-1 text-xs break-all select-all">{inviteResult.link}</code>
                    <Button size="sm" variant="ghost" onClick={() => handleCopyLink(inviteResult.link)} title="Copiar">
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => handleCopyLink(inviteResult.link)} className="gap-2">
                  <Copy className="h-4 w-4" /> Copiar Link
                </Button>
                <Button onClick={closeInviteModal}>Fechar</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

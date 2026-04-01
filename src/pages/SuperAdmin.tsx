import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePermissions } from "@/hooks/usePermissions";
import { Navigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Shield, Users, Database, Activity } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface UserWithRoles {
  user_id: string;
  email: string;
  roles: string[];
}

export default function SuperAdmin() {
  const { isSuperAdmin } = usePermissions();

  if (!isSuperAdmin) return <Navigate to="/" replace />;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Shield className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Super Admin</h1>
          <p className="text-sm text-muted-foreground">Painel exclusivo de administração avançada</p>
        </div>
      </div>

      <Tabs defaultValue="users" className="space-y-4">
        <TabsList>
          <TabsTrigger value="users"><Users className="h-4 w-4 mr-1" /> Usuários & Roles</TabsTrigger>
          <TabsTrigger value="stats"><Activity className="h-4 w-4 mr-1" /> Estatísticas</TabsTrigger>
          <TabsTrigger value="database"><Database className="h-4 w-4 mr-1" /> Dados</TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <UsersRolesPanel />
        </TabsContent>

        <TabsContent value="stats">
          <StatsPanel />
        </TabsContent>

        <TabsContent value="database">
          <DatabasePanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function UsersRolesPanel() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newRole, setNewRole] = useState<string>("");
  const [selectedUserId, setSelectedUserId] = useState<string>("");

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke("list-users", {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (res.data && !res.error) setUsers(res.data);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleAddRole = async () => {
    if (!selectedUserId || !newRole) return;
    const { error } = await supabase.from("rh_user_roles").insert({
      user_id: selectedUserId,
      role: newRole as any,
    });
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Role adicionado com sucesso" });
      fetchUsers();
    }
  };

  const handleDeleteRole = async (roleId: string) => {
    const { error } = await supabase.from("rh_user_roles").delete().eq("id", roleId);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Role removido" });
      fetchUsers();
    }
  };

  const roleColors: Record<string, string> = {
    super_admin: "bg-red-100 text-red-800",
    admin_rh: "bg-blue-100 text-blue-800",
    gestor_financeiro: "bg-green-100 text-green-800",
    assistente_dp: "bg-yellow-100 text-yellow-800",
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Gerenciamento de Roles</CardTitle>
        <CardDescription>Visualize e gerencie todos os usuários e seus roles</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2 items-end">
          <div className="w-64">
            <label className="text-sm font-medium">Usuário</label>
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger><SelectValue placeholder="Selecionar usuário" /></SelectTrigger>
              <SelectContent>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name || u.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-48">
            <label className="text-sm font-medium">Role</label>
            <Select value={newRole} onValueChange={setNewRole}>
              <SelectTrigger><SelectValue placeholder="Selecionar role" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="super_admin">Super Admin</SelectItem>
                <SelectItem value="admin_rh">Admin RH</SelectItem>
                <SelectItem value="gestor_financeiro">Gestor Financeiro</SelectItem>
                <SelectItem value="assistente_dp">Assistente DP</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleAddRole} size="sm">Adicionar</Button>
        </div>

        {loading ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Roles</TableHead>
                <TableHead className="w-20">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.name || "—"}</TableCell>
                  <TableCell className="text-sm">{u.email}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {u.roles.length === 0 && <span className="text-xs text-muted-foreground">Sem role</span>}
                      {u.roles.map((r: any) => (
                        <Badge key={r.id} className={`border-0 ${roleColors[r.role] ?? ""}`}>
                          {r.role}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      {u.roles.map((r: any) => (
                        <Button
                          key={r.id}
                          variant="ghost"
                          size="sm"
                          className="text-destructive text-xs h-6 px-2"
                          onClick={() => handleDeleteRole(r.id)}
                        >
                          × {r.role}
                        </Button>
                      ))}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {users.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    Nenhum usuário encontrado.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function StatsPanel() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      const [employees, payroll, timeRecords, roles] = await Promise.all([
        supabase.from("rh_employees").select("id", { count: "exact", head: true }),
        supabase.from("rh_payroll_monthly_records").select("id", { count: "exact", head: true }),
        supabase.from("rh_time_records").select("id", { count: "exact", head: true }),
        supabase.from("rh_user_roles").select("id", { count: "exact", head: true }),
      ]);
      setStats({
        employees: employees.count ?? 0,
        payroll: payroll.count ?? 0,
        timeRecords: timeRecords.count ?? 0,
        roles: roles.count ?? 0,
      });
      setLoading(false);
    };
    fetchStats();
  }, []);

  if (loading) return <Skeleton className="h-40 w-full" />;

  const cards = [
    { label: "Colaboradores", value: stats.employees, icon: Users },
    { label: "Registros de Folha", value: stats.payroll, icon: Database },
    { label: "Registros de Ponto", value: stats.timeRecords, icon: Activity },
    { label: "Roles Atribuídos", value: stats.roles, icon: Shield },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((c) => (
        <Card key={c.label}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{c.label}</CardTitle>
            <c.icon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{c.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function DatabasePanel() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("rh_integration_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      setLogs(data ?? []);
      setLoading(false);
    };
    fetch();
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Últimos Logs de Integração</CardTitle>
        <CardDescription>20 registros mais recentes</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-40 w-full" />
        ) : logs.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">Nenhum log encontrado.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fonte</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Endpoint</TableHead>
                <TableHead>Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="text-xs">{log.source}</TableCell>
                  <TableCell>
                    <Badge variant={log.status === "success" ? "default" : "destructive"}>
                      {log.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs font-mono truncate max-w-[200px]">{log.endpoint ?? "—"}</TableCell>
                  <TableCell className="text-xs">{new Date(log.created_at).toLocaleString("pt-BR")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

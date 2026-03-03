import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
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
  const { role, roles } = useAuth();
  const isSuperAdmin = roles?.includes("super_admin");

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
  const [userRoles, setUserRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newRole, setNewRole] = useState<string>("");
  const [selectedUserId, setSelectedUserId] = useState<string>("");

  const fetchRoles = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("user_roles")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) setUserRoles(data);
    setLoading(false);
  };

  useEffect(() => { fetchRoles(); }, []);

  const handleAddRole = async () => {
    if (!selectedUserId || !newRole) return;
    const { error } = await supabase.from("user_roles").insert({
      user_id: selectedUserId,
      role: newRole as any,
    });
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Role adicionado com sucesso" });
      fetchRoles();
    }
  };

  const handleDeleteRole = async (id: string) => {
    const { error } = await supabase.from("user_roles").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Role removido" });
      fetchRoles();
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
        <CardDescription>Visualize e gerencie todos os roles de usuários do sistema</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <label className="text-sm font-medium">User ID</label>
            <input
              className="w-full border rounded px-3 py-2 text-sm"
              placeholder="UUID do usuário"
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
            />
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
                <TableHead>User ID</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Criado em</TableHead>
                <TableHead className="w-20">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {userRoles.map((ur) => (
                <TableRow key={ur.id}>
                  <TableCell className="font-mono text-xs">{ur.user_id}</TableCell>
                  <TableCell>
                    <Badge className={`border-0 ${roleColors[ur.role] ?? ""}`}>
                      {ur.role}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs">
                    {new Date(ur.created_at).toLocaleString("pt-BR")}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive text-xs"
                      onClick={() => handleDeleteRole(ur.id)}
                    >
                      Remover
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {userRoles.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    Nenhum role encontrado.
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
        supabase.from("employees").select("id", { count: "exact", head: true }),
        supabase.from("payroll_monthly_records").select("id", { count: "exact", head: true }),
        supabase.from("time_records").select("id", { count: "exact", head: true }),
        supabase.from("user_roles").select("id", { count: "exact", head: true }),
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
        .from("integration_logs")
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

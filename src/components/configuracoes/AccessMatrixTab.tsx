import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "@/hooks/use-toast";
import { Shield, Info } from "lucide-react";

const MODULE_TOOLTIPS: Record<string, string> = {
  salario_diretoria: "Controla a visualização de salários de CEO e Diretores",
};

interface RoleDef {
  id: string;
  name: string;
  display_name: string;
  is_system: boolean;
}

interface Permission {
  id: string;
  role_id: string;
  module: string;
  can_view: boolean;
  can_edit: boolean;
}

const MODULE_SECTIONS = [
  {
    label: "Geral",
    modules: [{ key: "dashboard", label: "Dashboard" }],
  },
  {
    label: "Pessoas",
    modules: [
      { key: "colaboradores", label: "Colaboradores" },
      { key: "colaboradores.formacao", label: "› Formação Acadêmica" },
      { key: "salario_diretoria", label: "› Salário Diretoria" },
      { key: "aniversariantes", label: "Aniversariantes" },
    ],
  },
  {
    label: "Folha",
    modules: [
      { key: "folha", label: "Fechamentos Mensais" },
      { key: "folha.custo", label: "Custo de Pessoal" },
      { key: "controladoria", label: "Controladoria" },
    ],
  },
  {
    label: "Gestão",
    modules: [
      { key: "ferias", label: "Férias" },
      { key: "simulador", label: "Simulador de Rescisão" },
    ],
  },
  {
    label: "Recrutamento",
    modules: [
      { key: "recrutamento", label: "Recrutamento" },
      { key: "recrutamento.ia", label: "› Gerador de Vaga IA" },
    ],
  },
  {
    label: "Sistema",
    modules: [
      { key: "configuracoes", label: "Configurações" },
      { key: "configuracoes.integracoes", label: "› Integrações" },
      { key: "configuracoes.acessos", label: "› Gestão de Acessos" },
      { key: "configuracoes.usuarios", label: "› Gestão de Usuários" },
    ],
  },
];

const ROLE_ORDER = ["super_admin", "admin", "rh", "diretoria", "financeiro"];

const ROLE_BADGE_VARIANT: Record<string, "destructive" | "default" | "secondary"> = {
  super_admin: "destructive",
  admin: "default",
  rh: "secondary",
  diretoria: "secondary",
  financeiro: "secondary",
};

export default function AccessMatrixTab() {
  const [roles, setRoles] = useState<RoleDef[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const [rolesRes, permsRes] = await Promise.all([
      (supabase as any).from("role_definitions").select("*").order("created_at"),
      (supabase as any).from("role_permissions").select("*"),
    ]);
    setRoles(rolesRes.data ?? []);
    setPermissions(permsRes.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getPerm = (roleId: string, module: string) =>
    permissions.find((p) => p.role_id === roleId && p.module === module);

  const handleToggle = async (
    roleId: string,
    roleName: string,
    module: string,
    field: "can_view" | "can_edit",
    value: boolean
  ) => {
    if (roleName === "super_admin") return;

    const updates: Record<string, boolean> = {};
    if (field === "can_edit") {
      updates.can_edit = value;
      if (value) updates.can_view = true;
    } else {
      updates.can_view = value;
      if (!value) updates.can_edit = false;
    }

    // Optimistic update
    setPermissions((prev) =>
      prev.map((p) =>
        p.role_id === roleId && p.module === module ? { ...p, ...updates } : p
      )
    );

    const perm = getPerm(roleId, module);
    if (perm) {
      const { error } = await (supabase as any)
        .from("role_permissions")
        .update(updates)
        .eq("id", perm.id);
      if (error) {
        toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
        fetchData();
      }
    }
  };

  if (loading) return <Skeleton className="h-96 w-full" />;

  const sortedRoles = [...roles].sort(
    (a, b) => ROLE_ORDER.indexOf(a.name) - ROLE_ORDER.indexOf(b.name)
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          Matriz de Permissões
        </CardTitle>
        <CardDescription>
          Configure as permissões de cada perfil por módulo. Alterações são salvas automaticamente.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left p-3 font-medium text-muted-foreground min-w-[220px]">
                Módulo
              </th>
              {sortedRoles.map((r) => (
                <th key={r.id} className="text-center p-3 font-medium min-w-[130px]">
                  <Badge variant={ROLE_BADGE_VARIANT[r.name] ?? "secondary"}>
                    {r.display_name}
                  </Badge>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MODULE_SECTIONS.map((section) => (
              <SectionRows
                key={section.label}
                section={section}
                sortedRoles={sortedRoles}
                getPerm={getPerm}
                handleToggle={handleToggle}
              />
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

function SectionRows({
  section,
  sortedRoles,
  getPerm,
  handleToggle,
}: {
  section: (typeof MODULE_SECTIONS)[number];
  sortedRoles: { id: string; name: string; display_name: string }[];
  getPerm: (roleId: string, module: string) => any;
  handleToggle: (
    roleId: string,
    roleName: string,
    module: string,
    field: "can_view" | "can_edit",
    value: boolean
  ) => void;
}) {
  return (
    <>
      <tr>
        <td
          colSpan={sortedRoles.length + 1}
          className="bg-muted/50 px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider"
        >
          {section.label}
        </td>
      </tr>
      {section.modules.map((mod) => (
        <tr key={mod.key} className="border-b hover:bg-muted/30 transition-colors">
          <td className="p-3 font-medium whitespace-nowrap">{mod.label}</td>
          {sortedRoles.map((role) => {
            const isLocked = role.name === "super_admin";
            const perm = getPerm(role.id, mod.key);
            const canV = isLocked ? true : perm?.can_view ?? false;
            const canE = isLocked ? true : perm?.can_edit ?? false;

            return (
              <td key={role.id} className="p-3 text-center">
                <div className="flex items-center justify-center gap-3">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <label className="flex items-center gap-1 cursor-pointer">
                        <Checkbox
                          checked={canV}
                          disabled={isLocked}
                          onCheckedChange={(v) =>
                            handleToggle(role.id, role.name, mod.key, "can_view", !!v)
                          }
                        />
                        <span
                          className={`text-xs ${canV ? "text-green-600 dark:text-green-400 font-medium" : "text-muted-foreground"}`}
                        >
                          V
                        </span>
                      </label>
                    </TooltipTrigger>
                    <TooltipContent>
                      {isLocked ? "Super Admin sempre tem acesso total" : "Visualizar"}
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <label className="flex items-center gap-1 cursor-pointer">
                        <Checkbox
                          checked={canE}
                          disabled={isLocked}
                          onCheckedChange={(v) =>
                            handleToggle(role.id, role.name, mod.key, "can_edit", !!v)
                          }
                        />
                        <span
                          className={`text-xs ${canE ? "text-blue-600 dark:text-blue-400 font-medium" : "text-muted-foreground"}`}
                        >
                          E
                        </span>
                      </label>
                    </TooltipTrigger>
                    <TooltipContent>
                      {isLocked ? "Super Admin sempre tem acesso total" : "Editar"}
                    </TooltipContent>
                  </Tooltip>
                </div>
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );
}

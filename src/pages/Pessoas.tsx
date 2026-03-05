import { useState } from "react";
import { useEmployees } from "@/hooks/useEmployees";
import type { Employee } from "@/hooks/useEmployees";
import { EmployeeFormDialog } from "@/components/pessoas/EmployeeFormDialog";
import { EmployeeDetailSheet } from "@/components/pessoas/EmployeeDetailSheet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import {
  Tooltip, TooltipContent, TooltipTrigger, TooltipProvider,
} from "@/components/ui/tooltip";
import { Plus, Search, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Constants } from "@/integrations/supabase/types";

const statusColors: Record<string, string> = {
  ativo: "bg-success text-success-foreground",
  inativo: "bg-muted text-muted-foreground",
  ferias: "bg-warning text-warning-foreground",
  afastado: "bg-chart-4 text-primary-foreground",
  desligado: "bg-destructive text-destructive-foreground",
};

/** Returns list of missing required field labels */
function getMissingFields(emp: Employee): string[] {
  const missing: string[] = [];
  if (!emp.numero_cpf) missing.push("CPF");
  if (!emp.data_nascimento) missing.push("Data Nascimento");
  if (!emp.cargo) missing.push("Cargo");
  if (!emp.telefone) missing.push("Telefone");
  if (!emp.email_holerite) missing.push("E-mail");
  if (!emp.numero_rg) missing.push("RG");
  if (!emp.numero_pis_nit) missing.push("PIS/NIT");
  return missing;
}

export default function Pessoas() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [deptFilter, setDeptFilter] = useState<string | null>(null);
  const [cadastroFilter, setCadastroFilter] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editEmployee, setEditEmployee] = useState<Employee | null>(null);
  const [detailEmployee, setDetailEmployee] = useState<Employee | null>(null);

  const { employees, departamentos, loading, createEmployee, updateEmployee } = useEmployees({
    search,
    status: statusFilter,
    departamento: deptFilter,
  });

  // Client-side filter for cadastro_completo
  const filteredEmployees = cadastroFilter === null
    ? employees
    : employees.filter((emp) => {
        const isComplete = (emp as any).cadastro_completo === true;
        return cadastroFilter === "completo" ? isComplete : !isComplete;
      });

  const incompleteCount = employees.filter((emp) => !(emp as any).cadastro_completo).length;

  const handleNew = () => {
    setEditEmployee(null);
    setFormOpen(true);
  };

  const handleEdit = (emp: Employee) => {
    setDetailEmployee(null);
    setEditEmployee(emp);
    setFormOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Colaboradores</h1>
          <p className="text-muted-foreground text-sm">
            {filteredEmployees.length} colaborador{filteredEmployees.length !== 1 ? "es" : ""} encontrado{filteredEmployees.length !== 1 ? "s" : ""}
            {incompleteCount > 0 && (
              <span className="ml-2 text-warning">
                · {incompleteCount} incompleto{incompleteCount !== 1 ? "s" : ""}
              </span>
            )}
          </p>
        </div>
        <Button onClick={handleNew}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Colaborador
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou CPF..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter ?? "all"} onValueChange={(v) => setStatusFilter(v === "all" ? null : v)}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {Constants.public.Enums.employee_status.map((s) => (
              <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={deptFilter ?? "all"} onValueChange={(v) => setDeptFilter(v === "all" ? null : v)}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Departamento" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os deptos</SelectItem>
            {departamentos.map((d) => (
              <SelectItem key={d} value={d}>{d}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={cadastroFilter ?? "all"} onValueChange={(v) => setCadastroFilter(v === "all" ? null : v)}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Cadastro" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os cadastros</SelectItem>
            <SelectItem value="incompleto">Apenas incompletos</SelectItem>
            <SelectItem value="completo">Apenas completos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <TooltipProvider>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Matrícula</TableHead>
                  <TableHead>Colaborador</TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Departamento</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[100px]">Cadastro</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8">
                      <Skeleton className="h-10 w-full" />
                    </TableCell>
                  </TableRow>
                ) : filteredEmployees.length > 0 ? (
                  filteredEmployees.map((emp) => {
                    const isComplete = (emp as any).cadastro_completo === true;
                    const missingFields = getMissingFields(emp);
                    return (
                      <TableRow
                        key={emp.id}
                        className="cursor-pointer"
                        onClick={() => setDetailEmployee(emp)}
                      >
                        <TableCell className="font-mono text-xs">{emp.matricula_interna || emp.numero_funcional || "—"}</TableCell>
                        <TableCell className="font-medium">{emp.nome_completo}</TableCell>
                        <TableCell>{emp.empresa || "—"}</TableCell>
                        <TableCell>{emp.departamento || "—"}</TableCell>
                        <TableCell>{emp.cargo || "—"}</TableCell>
                        <TableCell>
                          <Badge className={`border-0 ${statusColors[emp.status] ?? ""}`}>
                            {emp.status.charAt(0).toUpperCase() + emp.status.slice(1)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {isComplete ? (
                            <Badge variant="secondary" className="border-0 bg-success/10 text-success gap-1">
                              <CheckCircle2 className="h-3 w-3" />
                              Completo
                            </Badge>
                          ) : (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge variant="secondary" className="border-0 bg-warning/10 text-warning gap-1 cursor-help">
                                  <AlertTriangle className="h-3 w-3" />
                                  Incompleto
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent side="left" className="max-w-xs">
                                <p className="text-xs font-medium mb-1">Campos faltantes:</p>
                                <p className="text-xs">{missingFields.length > 0 ? missingFields.join(", ") : "Verificar dados"}</p>
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-12">
                      Nenhum colaborador encontrado.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TooltipProvider>
        </CardContent>
      </Card>

      {/* Form Dialog */}
      <EmployeeFormDialog
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditEmployee(null); }}
        employee={editEmployee}
        onSave={createEmployee}
        onUpdate={updateEmployee}
      />

      {/* Detail Sheet */}
      <EmployeeDetailSheet
        employee={detailEmployee}
        open={!!detailEmployee}
        onClose={() => setDetailEmployee(null)}
        onEdit={handleEdit}
      />
    </div>
  );
}

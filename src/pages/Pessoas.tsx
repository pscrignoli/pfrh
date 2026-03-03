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
import { Plus, Search } from "lucide-react";
import { Constants } from "@/integrations/supabase/types";

const statusColors: Record<string, string> = {
  ativo: "bg-success text-success-foreground",
  inativo: "bg-muted text-muted-foreground",
  ferias: "bg-warning text-warning-foreground",
  afastado: "bg-chart-4 text-primary-foreground",
  desligado: "bg-destructive text-destructive-foreground",
};

export default function Pessoas() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [deptFilter, setDeptFilter] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editEmployee, setEditEmployee] = useState<Employee | null>(null);
  const [detailEmployee, setDetailEmployee] = useState<Employee | null>(null);

  const { employees, departamentos, loading, createEmployee, updateEmployee } = useEmployees({
    search,
    status: statusFilter,
    departamento: deptFilter,
  });

  const handleNew = () => {
    setEditEmployee(null);
    setFormOpen(true);
  };

  const handleEdit = (emp: Employee) => {
    setDetailEmployee(null);
    setEditEmployee(emp);
    setFormOpen(true);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Gestão de Pessoas</h1>
          <p className="text-muted-foreground text-sm">
            {employees.length} colaborador{employees.length !== 1 ? "es" : ""} encontrado{employees.length !== 1 ? "s" : ""}
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
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Matrícula</TableHead>
                <TableHead>Colaborador</TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead>Departamento</TableHead>
                <TableHead>Cargo</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees.map((emp) => (
                <TableRow
                  key={emp.id}
                  className="cursor-pointer"
                  onClick={() => setDetailEmployee(emp)}
                >
                  <TableCell className="font-mono text-xs">{emp.matricula_interna || "—"}</TableCell>
                  <TableCell className="font-medium">{emp.nome_completo}</TableCell>
                  <TableCell>{emp.empresa || "—"}</TableCell>
                  <TableCell>{emp.departamento || "—"}</TableCell>
                  <TableCell>{emp.cargo || "—"}</TableCell>
                  <TableCell>
                    <Badge className={`border-0 ${statusColors[emp.status] ?? ""}`}>
                      {emp.status.charAt(0).toUpperCase() + emp.status.slice(1)}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {employees.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-12">
                    Nenhum colaborador encontrado.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
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

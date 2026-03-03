import type { Employee } from "@/hooks/useEmployees";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Pencil, FolderOpen } from "lucide-react";

const statusColors: Record<string, string> = {
  ativo: "bg-success text-success-foreground",
  inativo: "bg-muted text-muted-foreground",
  ferias: "bg-warning text-warning-foreground",
  afastado: "bg-chart-4 text-primary-foreground",
  desligado: "bg-destructive text-destructive-foreground",
};

function Field({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value || "—"}</p>
    </div>
  );
}

interface Props {
  employee: Employee | null;
  open: boolean;
  onClose: () => void;
  onEdit: (emp: Employee) => void;
}

export function EmployeeDetailSheet({ employee, open, onClose, onEdit }: Props) {
  if (!employee) return null;

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="pb-4">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-xl">{employee.nome_completo}</SheetTitle>
            <Badge className={`border-0 ${statusColors[employee.status] ?? ""}`}>
              {employee.status.charAt(0).toUpperCase() + employee.status.slice(1)}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {employee.cargo ?? "Sem cargo"} · {employee.departamento ?? "Sem depto"}
          </p>
        </SheetHeader>

        <div className="space-y-5 mt-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Dados Pessoais</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <Field label="CPF" value={employee.numero_cpf} />
              <Field label="RG" value={employee.numero_rg} />
              <Field label="Nascimento" value={employee.data_nascimento ? new Date(employee.data_nascimento + "T00:00:00").toLocaleDateString("pt-BR") : null} />
              <Field label="Gênero" value={employee.genero} />
              <Field label="Telefone" value={employee.telefone} />
              <Field label="E-mail Holerite" value={employee.email_holerite} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Contrato</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <Field label="Empresa" value={employee.empresa} />
              <Field label="Admissão" value={new Date(employee.data_admissao + "T00:00:00").toLocaleDateString("pt-BR")} />
              <Field label="Tipo Contrato" value={employee.tipo_contrato?.toUpperCase()} />
              <Field label="Jornada" value={employee.jornada_semanal ? `${employee.jornada_semanal}h/sem` : null} />
              <Field label="Matrícula Interna" value={employee.matricula_interna} />
              <Field label="Matrícula e-Social" value={employee.matricula_esocial} />
              <Field label="CTPS" value={employee.ctps} />
              <Field label="PIS/NIT" value={employee.numero_pis_nit} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Contato de Emergência</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <Field label="Nome" value={employee.nome_contato_emergencia} />
              <Field label="Parentesco" value={employee.grau_parentesco} />
              <Field label="Telefone" value={employee.telefone_emergencia} />
            </CardContent>
          </Card>

          <Card className="border-dashed">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <FolderOpen className="h-4 w-4" />
                Documentos do Colaborador
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground text-center py-6">
                Integração com armazenamento de documentos disponível em breve.
              </p>
            </CardContent>
          </Card>

          <Button className="w-full" onClick={() => onEdit(employee)}>
            <Pencil className="h-4 w-4 mr-2" />
            Editar Colaborador
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

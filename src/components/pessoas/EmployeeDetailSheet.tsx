import { useNavigate } from "react-router-dom";
import type { Employee } from "@/hooks/useEmployees";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Pencil, FolderOpen, CheckCircle2, AlertTriangle, GraduationCap, Calculator } from "lucide-react";

const grauLabels: Record<string, string> = {
  ensino_medio: "Ensino Médio",
  tecnico: "Técnico",
  superior: "Superior",
  pos_mba: "Pós/MBA",
  mestrado: "Mestrado",
  doutorado: "Doutorado",
  pos_doutorado: "Pós Doutorado",
};

const grauColors: Record<string, string> = {
  ensino_medio: "bg-muted text-muted-foreground",
  tecnico: "bg-cyan-100 text-cyan-700",
  superior: "bg-green-100 text-green-700",
  pos_mba: "bg-blue-100 text-blue-700",
  mestrado: "bg-purple-100 text-purple-700",
  doutorado: "bg-amber-100 text-amber-800",
  pos_doutorado: "bg-amber-50 text-amber-900 border border-amber-300",
};

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

  const ext = employee as any;
  const isComplete = ext.cadastro_completo === true;

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="pb-4">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-xl">{employee.nome_completo}</SheetTitle>
            <div className="flex items-center gap-2">
              {isComplete ? (
                <Badge variant="secondary" className="border-0 bg-success/10 text-success gap-1 text-xs">
                  <CheckCircle2 className="h-3 w-3" /> Completo
                </Badge>
              ) : (
                <Badge variant="secondary" className="border-0 bg-warning/10 text-warning gap-1 text-xs">
                  <AlertTriangle className="h-3 w-3" /> Incompleto
                </Badge>
              )}
              <Badge className={`border-0 ${statusColors[employee.status] ?? ""}`}>
                {employee.status.charAt(0).toUpperCase() + employee.status.slice(1)}
              </Badge>
            </div>
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
              <Field label="Demissão" value={ext.data_demissao ? new Date(ext.data_demissao + "T00:00:00").toLocaleDateString("pt-BR") : null} />
              <Field label="Tipo Contrato" value={employee.tipo_contrato?.toUpperCase()} />
              <Field label="Jornada" value={employee.jornada_semanal ? `${employee.jornada_semanal}h/sem` : null} />
              <Field label="Salário Base" value={ext.salario_base ? `R$ ${Number(ext.salario_base).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : null} />
              <Field label="CBO" value={ext.cbo} />
              <Field label="Sindicato" value={ext.sindicato_codigo} />
              <Field label="Matrícula Interna" value={employee.matricula_interna} />
              <Field label="Nº Funcional" value={employee.numero_funcional} />
              <Field label="Matrícula e-Social" value={employee.matricula_esocial} />
              <Field label="CTPS" value={employee.ctps} />
              <Field label="PIS/NIT" value={employee.numero_pis_nit} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Dependentes & Outros</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <Field label="Dependentes IR" value={ext.dependentes_ir ?? 0} />
              <Field label="Dependentes SF" value={ext.dependentes_sf ?? 0} />
              {ext.empregare_pessoa_id && (
                <Field label="Empregare ID" value={ext.empregare_pessoa_id} />
              )}
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

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <GraduationCap className="h-4 w-4" />
                Formação Acadêmica
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {ext.grau_escolaridade ? (
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="secondary" className={`border-0 ${grauColors[ext.grau_escolaridade] ?? ""}`}>
                    {grauLabels[ext.grau_escolaridade] ?? ext.grau_escolaridade}
                  </Badge>
                  {ext.cursando && (
                    <Badge variant="secondary" className="border-0 bg-yellow-100 text-yellow-700">
                      Cursando
                    </Badge>
                  )}
                </div>
              ) : null}
              {ext.formacao_academica ? (
                <div className="space-y-1">
                  {String(ext.formacao_academica).split("/").map((part: string, i: number) => (
                    <p key={i} className="text-sm">{part.trim()}</p>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">Não informada</p>
              )}
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

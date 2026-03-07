import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { EmployeeVacation } from "@/hooks/useFerias";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: EmployeeVacation | null;
  onSave: (data: any) => Promise<void>;
}

export function FeriasScheduleDialog({ open, onOpenChange, employee, onSave }: Props) {
  const [dataInicio, setDataInicio] = useState<Date>();
  const [diasGozo, setDiasGozo] = useState(30);
  const [diasAbono, setDiasAbono] = useState(0);
  const [abonoPecuniario, setAbonoPecuniario] = useState(false);
  const [adiantamento13, setAdiantamento13] = useState(false);
  const [observacao, setObservacao] = useState("");
  const [saving, setSaving] = useState(false);

  if (!employee) return null;

  const salario = employee.salarioBase ?? 0;
  const diasEfetivos = diasGozo - diasAbono;
  const salarioFerias = (salario / 30) * diasEfetivos;
  const tercoConstitucional = salarioFerias / 3;
  const abonoPecuniarioValor = abonoPecuniario ? (salario / 30) * diasAbono + ((salario / 30) * diasAbono) / 3 : 0;
  const totalBruto = salarioFerias + tercoConstitucional + abonoPecuniarioValor;

  // Simplified INSS calculation
  const inss = Math.min(totalBruto * 0.14, 908.86);
  const baseIRRF = totalBruto - inss;
  let irrf = 0;
  if (baseIRRF > 4664.68) irrf = baseIRRF * 0.275 - 896.0;
  else if (baseIRRF > 3751.06) irrf = baseIRRF * 0.225 - 662.77;
  else if (baseIRRF > 2826.66) irrf = baseIRRF * 0.15 - 381.44;
  else if (baseIRRF > 2259.21) irrf = baseIRRF * 0.075 - 169.44;

  const valorLiquido = totalBruto - inss - Math.max(irrf, 0);

  const fmtBRL = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const handleSave = async () => {
    if (!dataInicio) {
      toast.error("Selecione a data de início das férias");
      return;
    }
    setSaving(true);
    try {
      await onSave({
        employee_id: employee.employeeId,
        periodo_aquisitivo_inicio: employee.periodoAquisitivoInicio.toISOString().split("T")[0],
        periodo_aquisitivo_fim: employee.periodoAquisitivoFim.toISOString().split("T")[0],
        data_inicio: format(dataInicio, "yyyy-MM-dd"),
        dias_gozo: diasEfetivos,
        dias_abono: diasAbono,
        abono_pecuniario: abonoPecuniario,
        adiantamento_13: adiantamento13,
        valor_bruto: totalBruto,
        valor_inss: inss,
        valor_irrf: Math.max(irrf, 0),
        valor_liquido: valorLiquido,
        observacao: observacao || null,
      });
      toast.success("Férias programadas com sucesso!");
      onOpenChange(false);
      setDataInicio(undefined);
      setDiasGozo(30);
      setDiasAbono(0);
      setAbonoPecuniario(false);
      setAdiantamento13(false);
      setObservacao("");
    } catch (err: any) {
      toast.error("Erro ao salvar: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Programar Férias</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-muted-foreground text-xs">Colaborador</Label>
            <p className="font-medium">{employee.nome}</p>
            <p className="text-xs text-muted-foreground">{employee.cargo} • {employee.departamento}</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-muted-foreground text-xs">Período Aquisitivo</Label>
              <p className="text-sm font-medium">
                {format(employee.periodoAquisitivoInicio, "dd/MM/yyyy")} a{" "}
                {format(employee.periodoAquisitivoFim, "dd/MM/yyyy")}
              </p>
            </div>
            <div>
              <Label className="text-muted-foreground text-xs">Salário Base</Label>
              <p className="text-sm font-medium">{fmtBRL(salario)}</p>
            </div>
          </div>

          <div>
            <Label>Data de Início</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn("w-full justify-start text-left font-normal", !dataInicio && "text-muted-foreground")}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dataInicio ? format(dataInicio, "dd/MM/yyyy") : "Selecionar data"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dataInicio}
                  onSelect={setDataInicio}
                  locale={ptBR}
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Dias de Gozo</Label>
              <Input
                type="number"
                value={diasGozo}
                onChange={(e) => setDiasGozo(Number(e.target.value))}
                min={10}
                max={30}
              />
            </div>
            <div>
              <Label>Dias Abono</Label>
              <Input
                type="number"
                value={diasAbono}
                onChange={(e) => setDiasAbono(Number(e.target.value))}
                min={0}
                max={10}
                disabled={!abonoPecuniario}
              />
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Checkbox
                id="abono"
                checked={abonoPecuniario}
                onCheckedChange={(v) => {
                  setAbonoPecuniario(!!v);
                  if (!v) setDiasAbono(0);
                  else setDiasAbono(10);
                }}
              />
              <Label htmlFor="abono" className="text-sm">Vender 10 dias</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="adiant13"
                checked={adiantamento13}
                onCheckedChange={(v) => setAdiantamento13(!!v)}
              />
              <Label htmlFor="adiant13" className="text-sm">Adiantamento 13º</Label>
            </div>
          </div>

          <div className="rounded-lg border bg-muted/30 p-3 space-y-1 text-sm">
            <div className="flex justify-between">
              <span>Salário Férias ({diasEfetivos} dias)</span>
              <span>{fmtBRL(salarioFerias)}</span>
            </div>
            <div className="flex justify-between">
              <span>1/3 Constitucional</span>
              <span>{fmtBRL(tercoConstitucional)}</span>
            </div>
            {abonoPecuniario && (
              <div className="flex justify-between">
                <span>Abono Pecuniário ({diasAbono} dias + 1/3)</span>
                <span>{fmtBRL(abonoPecuniarioValor)}</span>
              </div>
            )}
            <div className="flex justify-between font-semibold border-t pt-1">
              <span>Total Bruto</span>
              <span>{fmtBRL(totalBruto)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>INSS</span>
              <span>-{fmtBRL(inss)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>IRRF</span>
              <span>-{fmtBRL(Math.max(irrf, 0))}</span>
            </div>
            <div className="flex justify-between font-bold text-primary border-t pt-1">
              <span>Valor Líquido</span>
              <span>{fmtBRL(valorLiquido)}</span>
            </div>
          </div>

          <div>
            <Label>Observação</Label>
            <Textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} rows={2} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Salvando..." : "Programar Férias"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

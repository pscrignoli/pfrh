import type { PayrollRecord } from "@/hooks/useFinanceiroData";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";

function currency(v: number | null | undefined) {
  if (v == null) return "R$ 0,00";
  return Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  );
}

interface Props {
  record: PayrollRecord | null;
  open: boolean;
  onClose: () => void;
}

export function PayrollDetailSheet({ record, open, onClose }: Props) {
  if (!record) return null;
  const r = record;

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="pb-4">
          <SheetTitle>{r.employee_name}</SheetTitle>
          <p className="text-sm text-muted-foreground">
            Competência: {String(r.mes).padStart(2, "0")}/{r.ano} · {r.cargo ?? "Sem cargo"}
          </p>
        </SheetHeader>

        <Accordion type="multiple" defaultValue={["vencimentos", "descontos", "provisoes", "beneficios"]} className="space-y-2">
          {/* Vencimentos */}
          <AccordionItem value="vencimentos">
            <AccordionTrigger className="text-sm font-semibold">Vencimentos e Horas</AccordionTrigger>
            <AccordionContent className="space-y-0">
              <Field label="Salário Base" value={currency(r.salario_base)} />
              <Field label="Salário" value={currency(r.salario)} />
              <Field label="Diferença Salário" value={currency(r.diferenca_salario)} />
              <Field label="Hora 50%" value={currency(r.hora_50)} />
              <Field label="Hora 60%" value={currency(r.hora_60)} />
              <Field label="Hora 80%" value={currency(r.hora_80)} />
              <Field label="Hora 100%" value={currency(r.hora_100)} />
              <Field label="HE Total" value={currency(r.he_total)} />
              <Field label="DSR s/ Horas" value={currency(r.dsr_horas)} />
              <Field label="Adicional Noturno" value={currency(r.adicional_noturno)} />
              <Field label="Bônus / Gratificação" value={currency(r.bonus_gratificacao)} />
              <Field label="Salário Família" value={currency(r.salario_familia)} />
              <Field label="Insalubridade" value={currency(r.insalubridade)} />
              <Field label="Auxílio Alimentação" value={currency(r.auxilio_alimentacao)} />
              <Field label="Vale Transporte" value={currency(r.vale_transporte)} />
              <Field label="Ajuda de Custo" value={currency(r.ajuda_de_custo)} />
              <div className="border-t pt-1 mt-1">
                <Field label="Soma Vencimentos" value={currency(r.soma)} />
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Descontos */}
          <AccordionItem value="descontos">
            <AccordionTrigger className="text-sm font-semibold">Descontos</AccordionTrigger>
            <AccordionContent className="space-y-0">
              <Field label="Faltas" value={currency(r.falta)} />
              <Field label="Desconto VT" value={currency(r.desconto_vale_transporte)} />
              <Field label="FGTS 8%" value={currency(r.fgts_8)} />
              <Field label="INSS 20%" value={currency(r.inss_20)} />
              <div className="border-t pt-1 mt-1">
                <Field label="Total Folha" value={currency(r.total_folha)} />
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Provisões */}
          <AccordionItem value="provisoes">
            <AccordionTrigger className="text-sm font-semibold">Provisões (Passivo)</AccordionTrigger>
            <AccordionContent className="space-y-0">
              <Field label="Avos Férias" value={currency(r.avos_ferias)} />
              <Field label="Férias" value={currency(r.ferias)} />
              <Field label="1/3 Férias" value={currency(r.terco_ferias)} />
              <Field label="FGTS s/ Férias" value={currency(r.fgts_ferias)} />
              <Field label="INSS s/ Férias" value={currency(r.inss_ferias)} />
              <Field label="Férias + 13º" value={currency(r.ferias_13)} />
              <Field label="13º Salário" value={currency(r.decimo_terceiro)} />
              <Field label="INSS s/ 13º" value={currency(r.inss_13)} />
              <Field label="FGTS s/ 13º" value={currency(r.fgts_13)} />
              <Field label="Salário/Gratificação" value={currency(r.salario_gratificacao)} />
              <div className="border-t pt-1 mt-1">
                <Field label="Total Encargos" value={currency(r.encargos)} />
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Benefícios */}
          <AccordionItem value="beneficios">
            <AccordionTrigger className="text-sm font-semibold">Benefícios</AccordionTrigger>
            <AccordionContent className="space-y-0">
              <Field label="Convênio Médico" value={currency(r.convenio_medico)} />
              <Field label="Plano Odontológico" value={currency(r.plano_odontologico)} />
              <Field label="Plano Odonto (Empresa)" value={currency(r.plano_odontologico_empresa)} />
              <Field label="VR / Alimentação" value={currency(r.vr_alimentacao)} />
              <Field label="VR Auto" value={currency(r.vr_auto)} />
              <div className="border-t pt-1 mt-1">
                <Field label="Total Benefícios" value={currency(r.beneficios)} />
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <div className="mt-6 rounded-lg bg-primary/10 p-4">
          <div className="flex justify-between text-base font-bold">
            <span>Total Geral</span>
            <span>{currency(r.total_geral)}</span>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

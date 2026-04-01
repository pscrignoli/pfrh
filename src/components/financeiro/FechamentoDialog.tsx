import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Lock, Unlock, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  onClose: () => void;
  ano: number;
  mes: number;
  recordIds: string[];
  currentStatus: string; // "fechado" means we're reopening
  onDone: () => void;
}

const monthNames = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export function FechamentoDialog({ open, onClose, ano, mes, recordIds, currentStatus, onDone }: Props) {
  const { companyId } = useCompany();
  const [loading, setLoading] = useState(false);
  const [justificativa, setJustificativa] = useState("");

  const isReopen = currentStatus === "fechado";

  const handleConfirm = async () => {
    if (isReopen && !justificativa.trim()) {
      toast({ title: "Justificativa obrigatória", description: "Informe o motivo para reabrir o mês.", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const newStatus = isReopen ? "conferido" : "fechado";

      await supabase
        .from("rh_payroll_monthly_records")
        .update({ status: newStatus })
        .in("id", recordIds);

      await supabase.from("rh_integration_logs").insert({
        source: "folha_mensal",
        direction: "internal",
        endpoint: isReopen ? "fechamento/reabrir" : "fechamento/fechar",
        status: "success" as const,
        request_payload: {
          ano,
          mes,
          count: recordIds.length,
          action: isReopen ? "reopen" : "close",
          ...(isReopen ? { justificativa: justificativa.trim() } : {}),
        } as any,
        response_payload: { status: newStatus } as any,
        company_id: companyId,
      });

      toast({
        title: isReopen ? "Mês reaberto" : "Mês fechado com sucesso!",
        description: isReopen
          ? `${monthNames[mes - 1]}/${ano} foi reaberto. Justificativa registrada.`
          : `${monthNames[mes - 1]}/${ano} está fechado. Transmissão habilitada.`,
      });

      setJustificativa("");
      onDone();
      onClose();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isReopen ? <Unlock className="h-5 w-5" /> : <Lock className="h-5 w-5" />}
            {isReopen ? "Reabrir Mês" : "Fechar Mês"}
          </DialogTitle>
          <DialogDescription>
            {isReopen
              ? `Você está reabrindo ${monthNames[mes - 1]}/${ano}. Os registros voltarão para "conferido" e poderão ser editados.`
              : `Ao fechar ${monthNames[mes - 1]}/${ano}, os botões de importar e calcular serão desabilitados. A transmissão será habilitada.`}
          </DialogDescription>
        </DialogHeader>

        {isReopen && (
          <div className="space-y-2">
            <Label htmlFor="justificativa">Justificativa *</Label>
            <Textarea
              id="justificativa"
              placeholder="Informe o motivo para reabrir este mês..."
              value={justificativa}
              onChange={e => setJustificativa(e.target.value)}
              rows={3}
            />
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={loading || (isReopen && !justificativa.trim())}
            variant={isReopen ? "outline" : "default"}
          >
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isReopen ? "Confirmar Reabertura" : "Confirmar Fechamento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ShieldAlert, AlertTriangle, Info, CheckCircle2, Pencil,
} from "lucide-react";
import type { AuditAlert } from "@/utils/auditarFolha";

// ── Types ──

export interface CorrectionLog {
  funcionario: string;
  numero: number;
  regra: string;
  campo: string;
  valor_original: unknown;
  valor_corrigido: unknown;
  justificativa: string;
}

export interface CorrectionApply {
  numero: number;
  regra: string;
  corrections: Record<string, unknown>;
  justificativa: string;
}

// ── Helpers ──

const fmtNum = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2 });
const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const SITUACAO_OPTIONS = [
  { value: "Trabalhando", label: "Trabalhando" },
  { value: "Demitido", label: "Demitido" },
  { value: "Auxilio Doenca", label: "Auxílio Doença" },
  { value: "Licenca Maternidade", label: "Licença Maternidade" },
  { value: "Afastado", label: "Afastado" },
];

const severityConfig = {
  critico: { icon: ShieldAlert, bgClass: "bg-destructive/10 border-destructive/30", textClass: "text-destructive", label: "Crítico" },
  atencao: { icon: AlertTriangle, bgClass: "bg-yellow-500/10 border-yellow-500/30", textClass: "text-yellow-600", label: "Atenção" },
  informativo: { icon: Info, bgClass: "bg-blue-500/10 border-blue-500/30", textClass: "text-blue-600", label: "Info" },
} as const;

// Rules that support the "Corrigir" button
const CORRECTABLE_RULES = new Set([
  "proventos_zero",
  "proventos_divergentes",
  "fgts_divergente",
  "fgts_zero",
  "salario_acima_media",
  "salario_abaixo_media",
  "he_excessiva",
  "situacao_vazia",
  "liquido_negativo",
  "salario_zero",
  "duplicado",
  "desconto_excessivo",
]);

interface Props {
  alert: AuditAlert;
  isDismissed: boolean;
  isCorrected: boolean;
  onDismiss: () => void;
  onCorrect: (apply: CorrectionApply) => void;
}

export function AuditAlertCard({ alert, isDismissed, isCorrected, onDismiss, onCorrect }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [justificativa, setJustificativa] = useState("");

  // Form-specific state
  const [situacao, setSituacao] = useState("");
  const [proventos, setProventos] = useState("");
  const [fgts, setFgts] = useState("");
  const [he, setHe] = useState("");

  const config = severityConfig[alert.severity];
  const Icon = config.icon;
  const isCorrectable = CORRECTABLE_RULES.has(alert.regra) && alert.severity !== "informativo";
  const resolved = isDismissed || isCorrected;

  const handleSave = () => {
    const corrections: Record<string, unknown> = {};

    if (alert.regra === "proventos_zero" || alert.regra === "situacao_vazia") {
      if (situacao) corrections.situacao = situacao;
    }
    if (alert.regra === "proventos_divergentes" && proventos) {
      corrections.proventos = parseFloat(proventos.replace(/\./g, "").replace(",", "."));
    }
    if ((alert.regra === "fgts_divergente" || alert.regra === "fgts_zero") && fgts) {
      corrections.fgts = parseFloat(fgts.replace(/\./g, "").replace(",", "."));
    }
    if (alert.regra === "he_excessiva" && he) {
      corrections.he = parseFloat(he.replace(/\./g, "").replace(",", "."));
    }

    onCorrect({
      numero: alert.numero,
      regra: alert.regra,
      corrections,
      justificativa,
    });
    setExpanded(false);
  };

  const renderAlertValues = (valores: Record<string, unknown>) => {
    const entries = Object.entries(valores);
    if (entries.length === 0) return null;
    return (
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
        {entries.map(([k, v]) => (
          <span key={k} className="text-[10px] text-muted-foreground">
            {k.replace(/_/g, " ")}: <strong>{typeof v === "number" ? fmtNum(v) : String(v ?? "—")}</strong>
          </span>
        ))}
      </div>
    );
  };

  // Render inline correction form based on rule
  const renderCorrectionForm = () => {
    switch (alert.regra) {
      case "proventos_zero":
        return (
          <div className="space-y-2">
            <div>
              <label className="text-[10px] font-medium text-muted-foreground">Situação correta</label>
              <Select value={situacao} onValueChange={(v) => setSituacao(v)}>
                <SelectTrigger className="h-8 text-xs mt-0.5"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {SITUACAO_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {(situacao === "Auxilio Doenca" || situacao === "Licenca Maternidade" || situacao === "Afastado") && (
                <p className="text-[10px] text-green-600 mt-1">✓ Proventos zerados são esperados para essa situação</p>
              )}
            </div>
          </div>
        );

      case "situacao_vazia":
        return (
          <div className="space-y-2">
            <div>
              <label className="text-[10px] font-medium text-muted-foreground">Situação</label>
              <Select value={situacao} onValueChange={(v) => setSituacao(v)}>
                <SelectTrigger className="h-8 text-xs mt-0.5"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {SITUACAO_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        );

      case "proventos_divergentes":
        return (
          <div className="space-y-2">
            {alert.valores.salario_base && (
              <p className="text-[10px] text-muted-foreground">
                Salário base: {fmt(alert.valores.salario_base as number)} · Proventos: {fmt(alert.valores.proventos as number)}
              </p>
            )}
            <div>
              <label className="text-[10px] font-medium text-muted-foreground">Proventos corrigido (R$)</label>
              <Input
                className="h-8 text-xs mt-0.5"
                placeholder={fmtNum(alert.valores.proventos as number)}
                value={proventos}
                onChange={(e) => setProventos(e.target.value)}
              />
            </div>
          </div>
        );

      case "fgts_divergente":
      case "fgts_zero": {
        const salBase = (alert.valores.salario_base as number) || 0;
        const isDemitido = String(alert.valores.situacao ?? "").toLowerCase().includes("demitid");
        return (
          <div className="space-y-2">
            <div className="flex gap-3 text-[10px] text-muted-foreground">
              <span>8% do salário = <strong>{fmt(salBase * 0.08)}</strong></span>
              {alert.valores.esperado && (
                <span>Esperado = <strong>{fmt(alert.valores.esperado as number)}</strong></span>
              )}
            </div>
            {isDemitido && (
              <p className="text-[10px] text-yellow-600">⚠ FGTS de rescisão (GRRF) pode diferir do 8% mensal</p>
            )}
            <div>
              <label className="text-[10px] font-medium text-muted-foreground">FGTS corrigido (R$)</label>
              <Input
                className="h-8 text-xs mt-0.5"
                placeholder={fmtNum((alert.valores.fgts as number) || 0)}
                value={fgts}
                onChange={(e) => setFgts(e.target.value)}
              />
            </div>
          </div>
        );
      }

      case "salario_acima_media":
      case "salario_abaixo_media":
        return (
          <div className="space-y-1">
            <p className="text-[10px] text-muted-foreground">
              Salário: {fmt(alert.valores.salario as number)} · Média: {fmt(alert.valores.media as number)} · Desvio: {fmt(alert.valores.desvio as number)}
            </p>
            <p className="text-[10px] text-muted-foreground italic">Salário não pode ser editado (vem do arquivo). Adicione uma justificativa.</p>
          </div>
        );

      case "he_excessiva":
        return (
          <div className="space-y-2">
            <p className="text-[10px] text-muted-foreground">
              HE = {(alert.valores.pct as number)}% do salário base ({fmt(alert.valores.salario_base as number)})
            </p>
            <div>
              <label className="text-[10px] font-medium text-muted-foreground">Valor HE corrigido (R$)</label>
              <Input
                className="h-8 text-xs mt-0.5"
                placeholder={fmtNum(alert.valores.he as number)}
                value={he}
                onChange={(e) => setHe(e.target.value)}
              />
            </div>
          </div>
        );

      // Justificativa-only rules
      case "liquido_negativo":
      case "salario_zero":
      case "duplicado":
      case "desconto_excessivo":
        return (
          <p className="text-[10px] text-muted-foreground italic">
            Este tipo de alerta não suporta correção de valor. Adicione uma justificativa para registrar sua revisão.
          </p>
        );

      default:
        return null;
    }
  };

  return (
    <div
      className={`rounded-lg border p-3 transition-all ${
        isCorrected
          ? "bg-green-500/10 border-green-500/30"
          : isDismissed
          ? "opacity-50 bg-muted/30 border-muted"
          : config.bgClass
      }`}
    >
      {/* Header row */}
      <div className="flex items-start gap-2">
        {isCorrected ? (
          <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0 text-green-600" />
        ) : (
          <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${isDismissed ? "text-muted-foreground" : config.textClass}`} />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium truncate">{alert.funcionario}</span>
            <Badge variant="outline" className="text-[9px] shrink-0">Func {alert.numero}</Badge>
            {isCorrected && <Badge className="text-[9px] bg-green-600 hover:bg-green-700">Corrigido</Badge>}
            {isDismissed && !isCorrected && <Badge variant="secondary" className="text-[9px]">Revisado</Badge>}
          </div>
          <p className={`text-xs mt-0.5 ${resolved ? "text-muted-foreground" : ""}`}>
            {alert.descricao}
          </p>
          {renderAlertValues(alert.valores)}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1.5 shrink-0">
          {isCorrectable && !resolved && (
            <Button
              variant="outline"
              size="sm"
              className="h-6 px-2 text-[10px] border-primary/40 text-primary hover:bg-primary/10"
              onClick={() => setExpanded(!expanded)}
            >
              <Pencil className="h-3 w-3 mr-0.5" />
              Corrigir
            </Button>
          )}
          {!isCorrected && (
            <label className="flex items-center gap-1 cursor-pointer">
              <Checkbox
                checked={isDismissed}
                onCheckedChange={onDismiss}
                className="h-3.5 w-3.5"
              />
              <span className="text-[10px] text-muted-foreground">
                {isDismissed ? "Revisado" : "Ignorar"}
              </span>
            </label>
          )}
        </div>
      </div>

      {/* Expanded correction form */}
      {expanded && !resolved && (
        <div className="mt-3 ml-6 space-y-2 border-t pt-3">
          {renderCorrectionForm()}
          <div>
            <label className="text-[10px] font-medium text-muted-foreground">Justificativa</label>
            <Textarea
              className="min-h-[48px] text-xs mt-0.5 resize-none"
              placeholder="Motivo da correção..."
              value={justificativa}
              onChange={(e) => setJustificativa(e.target.value)}
            />
          </div>
          <div className="flex justify-end">
            <Button
              size="sm"
              className="h-7 text-xs"
              disabled={!justificativa.trim()}
              onClick={handleSave}
            >
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Salvar Correção
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

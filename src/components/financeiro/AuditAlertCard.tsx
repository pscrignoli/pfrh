import { useState, useRef, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
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
  { value: "Auxilio Doenca", label: "Auxílio Doença" },
  { value: "Licenca Maternidade", label: "Lic. Maternidade" },
  { value: "Afastado", label: "Afastado" },
];

const severityConfig = {
  critico: { icon: ShieldAlert, bgClass: "bg-destructive/10 border-destructive/30", textClass: "text-destructive", label: "Crítico" },
  atencao: { icon: AlertTriangle, bgClass: "bg-yellow-500/10 border-yellow-500/30", textClass: "text-yellow-600", label: "Atenção" },
  informativo: { icon: Info, bgClass: "bg-blue-500/10 border-blue-500/30", textClass: "text-blue-600", label: "Info" },
} as const;

const CORRECTABLE_RULES = new Set([
  "proventos_zero", "proventos_divergentes", "fgts_divergente", "fgts_zero",
  "salario_acima_media", "salario_abaixo_media", "he_excessiva", "situacao_vazia",
  "liquido_negativo", "salario_zero", "duplicado", "desconto_excessivo",
]);

// ── Inline Editable Value ──

function EditableValue({ value, onSave, label }: {
  value: number;
  onSave: (v: number) => void;
  label: string;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(fmtNum(value));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const save = useCallback(() => {
    const parsed = parseFloat(text.replace(/\./g, "").replace(",", "."));
    if (!isNaN(parsed)) onSave(parsed);
    setEditing(false);
  }, [text, onSave]);

  if (editing) {
    return (
      <input
        ref={inputRef}
        className="inline-block w-[90px] h-5 px-1 text-[10px] font-mono border border-primary rounded bg-primary/5 outline-none"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
          if (e.key === "Escape") setEditing(false);
        }}
      />
    );
  }

  return (
    <span
      className="cursor-pointer group/edit inline-flex items-center gap-0.5 hover:bg-primary/10 rounded px-0.5 -mx-0.5 transition-colors"
      onClick={() => { setText(fmtNum(value)); setEditing(true); }}
      title={`Editar ${label}`}
    >
      <strong>{fmtNum(value)}</strong>
      <Pencil className="h-2.5 w-2.5 opacity-0 group-hover/edit:opacity-60 text-primary transition-opacity" />
    </span>
  );
}

// ── Main Component ──

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
  const [pendingCorrections, setPendingCorrections] = useState<Record<string, unknown>>({});

  const config = severityConfig[alert.severity];
  const Icon = config.icon;
  const isCorrectable = CORRECTABLE_RULES.has(alert.regra) && alert.severity !== "informativo";
  const resolved = isDismissed || isCorrected;

  // Quick apply (one-click correction with auto justificativa)
  const quickApply = useCallback((corrections: Record<string, unknown>, justif: string) => {
    onCorrect({ numero: alert.numero, regra: alert.regra, corrections, justificativa: justif });
  }, [alert, onCorrect]);

  // Inline value edit → auto-apply with justificativa
  const handleInlineEdit = useCallback((campo: string, valor: number) => {
    setPendingCorrections(prev => ({ ...prev, [campo]: valor }));
    if (!expanded) setExpanded(true);
  }, [expanded]);

  const handleSave = () => {
    onCorrect({
      numero: alert.numero,
      regra: alert.regra,
      corrections: pendingCorrections,
      justificativa,
    });
    setExpanded(false);
    setPendingCorrections({});
  };

  // Compute suggestion for FGTS
  const fgtsSuggestion = (alert.regra === "fgts_divergente" || alert.regra === "fgts_zero")
    ? Math.round(((alert.valores.salario_base as number) || 0) * 0.08 * 100) / 100
    : null;

  // Render alert values with click-to-edit on numeric values
  const renderAlertValues = (valores: Record<string, unknown>) => {
    const entries = Object.entries(valores);
    if (entries.length === 0) return null;

    // Fields that can be edited inline per rule
    const editableFields: Record<string, string[]> = {
      proventos_divergentes: ["proventos"],
      fgts_divergente: ["fgts"],
      fgts_zero: ["fgts"],
      he_excessiva: ["he"],
    };
    const editables = new Set(editableFields[alert.regra] ?? []);

    return (
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
        {entries.map(([k, v]) => {
          const corrected = pendingCorrections[k];
          const isEdited = corrected !== undefined;

          if (editables.has(k) && typeof v === "number" && !resolved) {
            return (
              <span key={k} className="text-[10px] text-muted-foreground inline-flex items-center gap-0.5">
                {k.replace(/_/g, " ")}:{" "}
                {isEdited ? (
                  <>
                    <span className="line-through opacity-50">{fmtNum(v)}</span>
                    <span className="text-green-600 font-semibold"> → {fmtNum(corrected as number)}</span>
                  </>
                ) : (
                  <EditableValue value={v} label={k} onSave={(nv) => handleInlineEdit(k, nv)} />
                )}
              </span>
            );
          }

          return (
            <span key={k} className="text-[10px] text-muted-foreground">
              {k.replace(/_/g, " ")}: <strong>{typeof v === "number" ? fmtNum(v) : String(v ?? "—")}</strong>
            </span>
          );
        })}
      </div>
    );
  };

  // Quick situacao badges
  const renderQuickSituacao = () => {
    if (alert.regra !== "situacao_vazia" && alert.regra !== "proventos_zero") return null;
    if (resolved) return null;
    return (
      <div className="flex gap-1 mt-1.5 flex-wrap">
        {SITUACAO_OPTIONS.map(opt => (
          <Badge
            key={opt.value}
            variant="outline"
            className="text-[9px] cursor-pointer hover:bg-primary/10 hover:border-primary/40 transition-colors"
            onClick={() => quickApply({ situacao: opt.value }, `Situação definida como ${opt.label}`)}
          >
            {opt.label}
          </Badge>
        ))}
      </div>
    );
  };

  // Accept suggestion button
  const renderSuggestion = () => {
    if (resolved) return null;

    if (fgtsSuggestion !== null && fgtsSuggestion > 0) {
      return (
        <div className="mt-1.5 flex items-center gap-1.5">
          <span className="text-[10px] text-muted-foreground">Sugestão: <strong className="text-primary">{fmt(fgtsSuggestion)}</strong> (8% do salário)</span>
          <Button
            variant="outline"
            size="sm"
            className="h-5 px-1.5 text-[9px] border-green-500/40 text-green-600 hover:bg-green-500/10"
            onClick={() => quickApply({ fgts: fgtsSuggestion }, "FGTS ajustado para 8% do salário base")}
          >
            Aplicar
          </Button>
        </div>
      );
    }

    return null;
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
          {renderQuickSituacao()}
          {renderSuggestion()}
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
          {Object.keys(pendingCorrections).length > 0 && (
            <div className="text-[10px] text-green-600 font-medium">
              {Object.entries(pendingCorrections).map(([k, v]) => (
                <span key={k} className="mr-3">
                  {k}: <span className="line-through opacity-50 text-muted-foreground">{fmtNum(alert.valores[k] as number)}</span> → <strong>{fmtNum(v as number)}</strong>
                </span>
              ))}
            </div>
          )}
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

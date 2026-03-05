import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Filter, X } from "lucide-react";
import type { EmpregareVaga } from "@/hooks/useEmpregareVagas";

interface Props {
  vagas: EmpregareVaga[];
  onSelect: (vaga: EmpregareVaga) => void;
}

const situacaoConfig: Record<string, { label: string; className: string }> = {
  aberta: { label: "Aberta", className: "bg-success/15 text-success border-success/30" },
  encerrada: { label: "Encerrada", className: "bg-muted-foreground/15 text-muted-foreground border-muted-foreground/30" },
  cancelada: { label: "Cancelada", className: "bg-destructive/15 text-destructive border-destructive/30" },
  congelada: { label: "Congelada", className: "bg-warning/15 text-warning border-warning/30" },
};

export default function EmpregareVagasList({ vagas, onSelect }: Props) {
  const [search, setSearch] = useState("");
  const [filterSituacao, setFilterSituacao] = useState<string>("todas");

  const filtered = vagas.filter((v) => {
    const matchSearch = !search || v.titulo.toLowerCase().includes(search.toLowerCase()) ||
      (v.cidade ?? "").toLowerCase().includes(search.toLowerCase());
    const matchSituacao = filterSituacao === "todas" || (v.situacao ?? "").toLowerCase() === filterSituacao;
    return matchSearch && matchSituacao;
  });

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar vaga..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
          {search && (
            <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7" onClick={() => setSearch("")}>
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
        <Select value={filterSituacao} onValueChange={setFilterSituacao}>
          <SelectTrigger className="w-[140px]">
            <Filter className="h-3.5 w-3.5 mr-1" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas</SelectItem>
            <SelectItem value="aberta">Abertas</SelectItem>
            <SelectItem value="encerrada">Encerradas</SelectItem>
            <SelectItem value="cancelada">Canceladas</SelectItem>
            <SelectItem value="congelada">Congeladas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2 max-h-[calc(100vh-320px)] overflow-y-auto pr-1">
        {filtered.length === 0 ? (
          <p className="text-center text-muted-foreground py-8 text-sm">Nenhuma vaga encontrada</p>
        ) : (
          filtered.map((v) => {
            const sit = (v.situacao ?? "aberta").toLowerCase();
            const sc = situacaoConfig[sit] ?? situacaoConfig.aberta;
            const totalEtapas = (v.etapas || []).reduce((s: number, e: any) => s + (e.qntde ?? e.Qntde ?? e.qtd ?? 0), 0);

            return (
              <div
                key={v.id}
                onClick={() => onSelect(v)}
                className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 cursor-pointer transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{v.titulo}</p>
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    {v.cidade && <span>{v.cidade}{v.estado ? ` - ${v.estado}` : ""}</span>}
                    {v.total_vagas > 1 && <span>· {v.total_vagas} posições</span>}
                    {totalEtapas > 0 && <span>· {totalEtapas} candidatos</span>}
                  </div>
                  {v.responsaveis?.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {v.responsaveis.map((r: any) => r.nome ?? r.Nome).filter(Boolean).join(", ")}
                    </p>
                  )}
                </div>
                <Badge variant="outline" className={sc.className}>{sc.label}</Badge>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

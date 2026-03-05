import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Filter, X, MapPin, Users, ChevronRight, Calendar } from "lucide-react";
import type { EmpregareVaga } from "@/hooks/useEmpregareVagas";

interface Props {
  vagas: EmpregareVaga[];
  onSelect: (vaga: EmpregareVaga) => void;
}

const situacaoConfig: Record<string, { label: string; className: string; dot: string }> = {
  aberta: { label: "Aberta", className: "bg-success/10 text-success border-success/20", dot: "bg-success" },
  encerrada: { label: "Encerrada", className: "bg-muted-foreground/10 text-muted-foreground border-muted-foreground/20", dot: "bg-muted-foreground" },
  cancelada: { label: "Cancelada", className: "bg-destructive/10 text-destructive border-destructive/20", dot: "bg-destructive" },
  congelada: { label: "Congelada", className: "bg-warning/10 text-warning border-warning/20", dot: "bg-warning" },
};

export default function EmpregareVagasList({ vagas, onSelect }: Props) {
  const [search, setSearch] = useState("");
  const [filterSituacao, setFilterSituacao] = useState<string>("aberta");

  const filtered = vagas.filter((v) => {
    const matchSearch = !search || v.titulo.toLowerCase().includes(search.toLowerCase()) ||
      (v.cidade ?? "").toLowerCase().includes(search.toLowerCase());
    const matchSituacao = filterSituacao === "todas" || (v.situacao ?? "").toLowerCase() === filterSituacao.toLowerCase();
    return matchSearch && matchSituacao;
  });

  return (
    <div className="space-y-4">
      {/* Search & Filter bar */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por título ou cidade..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-card/50 backdrop-blur-sm border-border/50 focus:border-primary/40 transition-all duration-300"
          />
          {search && (
            <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7" onClick={() => setSearch("")}>
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
        <Select value={filterSituacao} onValueChange={setFilterSituacao}>
          <SelectTrigger className="w-[140px] bg-card/50 backdrop-blur-sm border-border/50">
            <Filter className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
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

      {/* Results count */}
      <p className="text-xs text-muted-foreground">{filtered.length} vaga{filtered.length !== 1 ? "s" : ""}</p>

      {/* Vagas list */}
      <div className="space-y-2 max-h-[calc(100vh-340px)] overflow-y-auto pr-1 scrollbar-thin">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Search className="h-8 w-8 mb-2 opacity-30" />
            <p className="text-sm font-medium">Nenhuma vaga encontrada</p>
            <p className="text-xs">Tente ajustar os filtros</p>
          </div>
        ) : (
          filtered.map((v, i) => {
            const sit = (v.situacao ?? "aberta").toLowerCase();
            const sc = situacaoConfig[sit] ?? situacaoConfig.aberta;

            const totalCandidatos = (v.etapas || []).reduce((s: number, e: any) => {
              const nome = (e.nome ?? e.Nome ?? "").toLowerCase();
              if (nome === "todos" || nome === "all") return e.qntde ?? e.Qntde ?? e.qtd ?? s;
              return s;
            }, 0);

            const dataCadastro = v.data_cadastro ? new Date(v.data_cadastro).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) : null;

            return (
              <div
                key={v.id}
                onClick={() => onSelect(v)}
                className="group relative flex items-center gap-4 p-4 rounded-xl border border-border/50 bg-card/80 backdrop-blur-sm
                  hover:border-primary/30 hover:shadow-[0_0_20px_-8px_hsl(var(--primary)/0.15)] 
                  cursor-pointer transition-all duration-300 ease-out
                  animate-fade-in"
                style={{ animationDelay: `${Math.min(i * 40, 400)}ms` }}
              >
                {/* Status dot */}
                <div className="flex flex-col items-center gap-1 shrink-0">
                  <div className={`h-2.5 w-2.5 rounded-full ${sc.dot} ring-2 ring-offset-2 ring-offset-card ${sc.dot}/30`}
                    style={{ boxShadow: sit === "aberta" ? `0 0 8px hsl(var(--success) / 0.4)` : "none" }}
                  />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-sm leading-tight line-clamp-1 group-hover:text-primary transition-colors duration-200">
                      {v.titulo}
                    </h3>
                    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 shrink-0 ${sc.className}`}>
                      {sc.label}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {v.cidade && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {v.cidade}{v.estado ? ` - ${v.estado}` : ""}
                      </span>
                    )}
                    {v.total_vagas > 1 && (
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {v.total_vagas} posições
                      </span>
                    )}
                    {totalCandidatos > 0 && (
                      <span className="flex items-center gap-1 text-primary/70 font-medium">
                        {totalCandidatos} candidatos
                      </span>
                    )}
                    {dataCadastro && (
                      <span className="flex items-center gap-1 ml-auto">
                        <Calendar className="h-3 w-3" />
                        {dataCadastro}
                      </span>
                    )}
                  </div>

                  {v.responsaveis?.length > 0 && (
                    <p className="text-[11px] text-muted-foreground/70 truncate">
                      {v.responsaveis.map((r: any) => r.nome ?? r.Nome).filter(Boolean).join(", ")}
                    </p>
                  )}
                </div>

                {/* Arrow */}
                <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary/50 group-hover:translate-x-0.5 transition-all duration-200 shrink-0" />
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

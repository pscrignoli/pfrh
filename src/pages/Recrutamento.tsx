import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Briefcase, MapPin, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useVacancies } from "@/hooks/useVacancies";
import { useDepartments } from "@/hooks/useDepartments";
import { toast } from "sonner";

const statusConfig: Record<string, { label: string; className: string }> = {
  aberta: { label: "Aberta", className: "bg-success/15 text-success border-success/30" },
  pausada: { label: "Pausada", className: "bg-warning/15 text-warning border-warning/30" },
  fechada: { label: "Fechada", className: "bg-muted-foreground/15 text-muted-foreground border-muted-foreground/30" },
};

const workModelLabels: Record<string, string> = {
  presencial: "Presencial",
  hibrido: "Híbrido",
  remoto: "Remoto",
};

export default function Recrutamento() {
  const navigate = useNavigate();
  const { vacancies, loading, createVacancy } = useVacancies();
  const { departments } = useDepartments(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ title: "", department_id: "", work_model: "presencial" });
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!form.title.trim()) { toast.error("Informe o título da vaga."); return; }
    setSaving(true);
    try {
      await createVacancy({
        title: form.title.trim(),
        department_id: form.department_id || null,
        work_model: form.work_model,
      });
      toast.success("Vaga criada com sucesso!");
      setForm({ title: "", department_id: "", work_model: "presencial" });
      setDialogOpen(false);
    } catch (e: any) {
      toast.error(e.message || "Erro ao criar vaga.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Recrutamento</h1>
          <p className="text-muted-foreground text-sm">Gerencie vagas e candidatos</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> Nova Vaga
        </Button>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-40 rounded-lg" />)}
        </div>
      ) : vacancies.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <Briefcase className="h-12 w-12 mb-3 opacity-40" />
          <p className="text-lg font-medium">Nenhuma vaga cadastrada</p>
          <p className="text-sm">Clique em "+ Nova Vaga" para começar.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {vacancies.map((v) => {
            const sc = statusConfig[v.status] || statusConfig.aberta;
            return (
              <Card
                key={v.id}
                className="cursor-pointer hover:shadow-md transition-shadow border hover:border-primary/30"
                onClick={() => navigate(`/recrutamento/vagas/${v.id}`)}
              >
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-base leading-tight line-clamp-2">{v.title}</h3>
                    <Badge variant="outline" className={sc.className}>{sc.label}</Badge>
                  </div>
                  <div className="flex flex-col gap-1.5 text-sm text-muted-foreground">
                    {v.departments?.name && (
                      <span className="flex items-center gap-1.5">
                        <Briefcase className="h-3.5 w-3.5" /> {v.departments.name}
                      </span>
                    )}
                    <span className="flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5" /> {workModelLabels[v.work_model]}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm font-medium pt-1 border-t">
                    <Users className="h-3.5 w-3.5 text-primary" />
                    <span>{v.candidate_count ?? 0} candidato{(v.candidate_count ?? 0) !== 1 ? "s" : ""}</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Vaga</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Título da Vaga *</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ex: Analista de RH" />
            </div>
            <div className="space-y-2">
              <Label>Departamento</Label>
              <Select value={form.department_id} onValueChange={(v) => setForm({ ...form, department_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Modelo de Trabalho</Label>
              <Select value={form.work_model} onValueChange={(v) => setForm({ ...form, work_model: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="presencial">Presencial</SelectItem>
                  <SelectItem value="hibrido">Híbrido</SelectItem>
                  <SelectItem value="remoto">Remoto</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={saving}>{saving ? "Criando..." : "Criar Vaga"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

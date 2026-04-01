import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { Settings, Plug, BookOpen, Upload, Trash2, Save, Loader2, Building2, Plus, Pencil, Shield, Users } from "lucide-react";
import { useDepartments } from "@/hooks/useDepartments";
import EmpregareTab from "@/components/configuracoes/EmpregareTab";
import AccessMatrixTab from "@/components/configuracoes/AccessMatrixTab";
import UserManagementTab from "@/components/configuracoes/UserManagementTab";

// ── Types ──
interface DocEmbedding {
  id: string;
  source_document: string | null;
  content: string;
  created_at: string;
}

// ── Integration Tab ──
function IntegrationTab({ readOnly }: { readOnly?: boolean }) {
  const [url, setUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    supabase
      .from("rh_system_settings")
      .select("value")
      .eq("key", "controladoria_api_url")
      .maybeSingle()
      .then(({ data }) => {
        if (data?.value) setUrl(data.value);
        setLoading(false);
      });
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("rh_system_settings")
        .upsert(
          { key: "controladoria_api_url", value: url, updated_by: user?.id } as any,
          { onConflict: "key" }
        );
      if (error) throw error;
      toast({ title: "URL salva com sucesso." });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Skeleton className="h-48 w-full" />;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Plug className="h-5 w-5 text-primary" />
          Configurações de Integração
        </CardTitle>
        <CardDescription>Configure as URLs de webhook para integrações externas.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">URL da API da Controladoria</label>
          <div className="flex gap-2">
            <Input
              placeholder="https://api.controladoria.exemplo.com/v1/folha"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="flex-1"
              disabled={readOnly}
            />
            {!readOnly && (
              <Button onClick={save} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Salvar
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Endpoint de destino para o envio da folha de pagamento mensal.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Knowledge Base Tab ──
function KnowledgeBaseTab({ readOnly }: { readOnly?: boolean }) {
  const [docs, setDocs] = useState<DocEmbedding[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dragOver, setDragOver] = useState(false);

  const fetchDocs = useCallback(async () => {
    const { data } = await supabase
      .from("rh_document_embeddings")
      .select("*")
      .order("created_at", { ascending: false });
    setDocs(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchDocs(); }, [fetchDocs]);

  const uploadFile = async (file: File) => {
    if (file.size > 20 * 1024 * 1024) {
      toast({ title: "Arquivo muito grande", description: "Limite de 20MB.", variant: "destructive" });
      return;
    }

    setUploading(true);
    try {
      const filePath = `${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("hr_documents")
        .upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("hr_documents")
        .getPublicUrl(filePath);

      await supabase.from("rh_document_embeddings").insert({
        source_document: file.name,
        content: `Documento enviado: ${file.name}. URL: ${urlData.publicUrl}. Aguardando vetorização.`,
        metadata: { file_path: filePath, url: urlData.publicUrl, size: file.size } as any,
      });

      toast({ title: "Documento enviado com sucesso!", description: file.name });
      await fetchDocs();
    } catch (e: any) {
      toast({ title: "Erro no upload", description: e.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await uploadFile(file);
    e.target.value = "";
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) await uploadFile(file);
  };

  const handleDelete = async (doc: DocEmbedding) => {
    if (!confirm("Tem certeza que deseja remover este documento?")) return;
    try {
      await supabase.from("rh_document_embeddings").delete().eq("id", doc.id);
      const meta = (doc as any).metadata;
      if (meta?.file_path) {
        await supabase.storage.from("hr_documents").remove([meta.file_path]);
      }
      toast({ title: "Documento removido." });
      await fetchDocs();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4">
      {!readOnly && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              Base de Conhecimento (RAG)
            </CardTitle>
            <CardDescription>
              Envie documentos (PDFs, TXTs) com políticas de RH e legislação trabalhista para alimentar o assistente de IA.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <label
              className={`flex flex-col items-center justify-center w-full h-36 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
                dragOver ? "border-primary bg-primary/5" : "hover:bg-muted/50"
              }`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
            >
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <Upload className="h-8 w-8" />
                <span className="text-sm font-medium">
                  {uploading ? "Enviando..." : "Clique ou arraste um arquivo aqui"}
                </span>
                <span className="text-xs">PDF, TXT, DOCX — Máx. 20MB</span>
              </div>
              <input
                type="file"
                className="hidden"
                accept=".pdf,.txt,.docx,.doc"
                onChange={handleUpload}
                disabled={uploading}
              />
            </label>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Documentos Enviados ({docs.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6"><Skeleton className="h-24 w-full" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Documento</TableHead>
                  <TableHead>Data de Envio</TableHead>
                  {!readOnly && <TableHead />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {docs.map((doc) => (
                  <TableRow key={doc.id}>
                    <TableCell className="font-medium">{doc.source_document ?? "Sem título"}</TableCell>
                    <TableCell className="text-xs">
                      {new Date(doc.created_at).toLocaleString("pt-BR")}
                    </TableCell>
                    {!readOnly && (
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(doc)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
                {docs.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={readOnly ? 2 : 3} className="text-center text-muted-foreground py-8">
                      Nenhum documento enviado ainda.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Departments Tab ──
function DepartmentsTab({ readOnly }: { readOnly?: boolean }) {
  const { departments, loading, createDepartment, updateDepartment } = useDepartments();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDept, setEditDept] = useState<{ id: string; name: string; code: string; status: string } | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");

  const openNew = () => {
    setEditDept(null);
    setName("");
    setCode("");
    setDialogOpen(true);
  };

  const openEdit = (dept: any) => {
    setEditDept(dept);
    setName(dept.name);
    setCode(dept.code ?? "");
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast({ title: "Nome é obrigatório", variant: "destructive" });
      return;
    }
    try {
      if (editDept) {
        await updateDepartment(editDept.id, { name: name.trim(), code: code.trim() || undefined });
        toast({ title: "Departamento atualizado." });
      } else {
        await createDepartment(name.trim(), code.trim());
        toast({ title: "Departamento criado." });
      }
      setDialogOpen(false);
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  const toggleStatus = async (dept: any) => {
    if (readOnly) return;
    try {
      await updateDepartment(dept.id, { status: dept.status === "active" ? "inactive" : "active" });
      toast({ title: `Departamento ${dept.status === "active" ? "desativado" : "ativado"}.` });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                Departamentos
              </CardTitle>
              <CardDescription>Gerencie os departamentos disponíveis para os colaboradores.</CardDescription>
            </div>
            {!readOnly && (
              <Button onClick={openNew} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Novo Departamento
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6"><Skeleton className="h-24 w-full" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Código</TableHead>
                  <TableHead>Status</TableHead>
                  {!readOnly && <TableHead className="w-32">Ações</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {departments.map((dept) => (
                  <TableRow key={dept.id}>
                    <TableCell className="font-medium">{dept.name}</TableCell>
                    <TableCell className="font-mono text-xs">{dept.code || "—"}</TableCell>
                    <TableCell>
                      <Badge
                        variant={dept.status === "active" ? "default" : "secondary"}
                        className={!readOnly ? "cursor-pointer" : ""}
                        onClick={() => !readOnly && toggleStatus(dept)}
                      >
                        {dept.status === "active" ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    {!readOnly && (
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => openEdit(dept)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
                {departments.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={readOnly ? 3 : 4} className="text-center text-muted-foreground py-8">
                      Nenhum departamento cadastrado.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {!readOnly && (
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editDept ? "Editar Departamento" : "Novo Departamento"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Nome *</label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Recursos Humanos" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Código (Centro de Custo)</label>
                <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Ex: CC-001" />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                <Button onClick={handleSave}>{editDept ? "Salvar" : "Criar"}</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

// ── Main Page ──
export default function Configuracoes() {
  const { canView, canEdit, isAdmin } = usePermissions();

  const showAcessos = canView("configuracoes.acessos");
  const showUsuarios = canView("configuracoes.usuarios");
  const showIntegracoes = canView("configuracoes.integracoes");
  const isReadOnly = !canEdit("configuracoes");

  const defaultTab = showAcessos ? "acessos" : showUsuarios ? "usuarios" : "departamentos";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Settings className="h-6 w-6 text-primary" />
          Configurações
        </h1>
        <p className="text-muted-foreground text-sm">
          Central de controle do sistema — acesso restrito a administradores.
        </p>
      </div>

      <Tabs defaultValue={defaultTab}>
        <TabsList className="flex-wrap">
          {showAcessos && (
            <TabsTrigger value="acessos">
              <Shield className="h-4 w-4 mr-1" />
              Matriz de Acessos
            </TabsTrigger>
          )}
          {showUsuarios && (
            <TabsTrigger value="usuarios">
              <Users className="h-4 w-4 mr-1" />
              Gestão de Usuários
            </TabsTrigger>
          )}
          <TabsTrigger value="departamentos">Departamentos</TabsTrigger>
          {showIntegracoes && (
            <>
              <TabsTrigger value="integracoes">Integrações</TabsTrigger>
              <TabsTrigger value="conhecimento">Base de Conhecimento</TabsTrigger>
              <TabsTrigger value="empregare">API Empregare</TabsTrigger>
            </>
          )}
        </TabsList>

        {showAcessos && (
          <TabsContent value="acessos" className="mt-4">
            <AccessMatrixTab />
          </TabsContent>
        )}
        {showUsuarios && (
          <TabsContent value="usuarios" className="mt-4">
            <UserManagementTab />
          </TabsContent>
        )}
        <TabsContent value="departamentos" className="mt-4">
          <DepartmentsTab readOnly={isReadOnly} />
        </TabsContent>
        {showIntegracoes && (
          <>
            <TabsContent value="integracoes" className="mt-4">
              <IntegrationTab readOnly={isReadOnly} />
            </TabsContent>
            <TabsContent value="conhecimento" className="mt-4">
              <KnowledgeBaseTab readOnly={isReadOnly} />
            </TabsContent>
            <TabsContent value="empregare" className="mt-4">
              <EmpregareTab />
            </TabsContent>
          </>
        )}
      </Tabs>
    </div>
  );
}

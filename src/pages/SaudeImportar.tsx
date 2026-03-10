import { useState } from "react";
import { HealthImportDialog } from "@/components/saude/HealthImportDialog";
import { Button } from "@/components/ui/button";
import { Upload, HeartPulse } from "lucide-react";

export default function SaudeImportar() {
  const [importOpen, setImportOpen] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <HeartPulse className="h-6 w-6 text-primary" />
            Importar Fatura de Saúde
          </h1>
          <p className="text-muted-foreground">
            Upload de faturas Unimed (XLS) ou Bradesco Saúde (PDF)
          </p>
        </div>
        <Button onClick={() => setImportOpen(true)} className="gap-2">
          <Upload className="h-4 w-4" />
          Importar Fatura
        </Button>
      </div>

      <div className="rounded-lg border bg-card p-12 text-center text-muted-foreground">
        <Upload className="mx-auto h-12 w-12 mb-4 opacity-30" />
        <p className="text-lg font-medium">Clique em "Importar Fatura" para começar</p>
        <p className="text-sm mt-1">
          Suporte para Unimed SJR Preto (XLS) e Bradesco Saúde (PDF)
        </p>
      </div>

      <HealthImportDialog open={importOpen} onOpenChange={setImportOpen} />
    </div>
  );
}

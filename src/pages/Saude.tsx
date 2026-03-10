import { useState } from "react";
import { Heart } from "lucide-react";
import { HealthImportDialog } from "@/components/saude/HealthImportDialog";
import { Button } from "@/components/ui/button";

export default function Saude() {
  const [importOpen, setImportOpen] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Heart className="h-6 w-6 text-primary" />
            Saúde &amp; Benefícios
          </h1>
          <p className="text-muted-foreground">
            Gestão de planos de saúde e odontológicos
          </p>
        </div>
        <Button onClick={() => setImportOpen(true)}>Importar Fatura</Button>
      </div>

      <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
        <Heart className="mx-auto h-12 w-12 mb-4 opacity-30" />
        <p className="text-lg font-medium">Dashboard em construção</p>
        <p className="text-sm mt-1">
          Importe a primeira fatura para começar a visualizar os dados.
        </p>
      </div>

      <HealthImportDialog open={importOpen} onOpenChange={setImportOpen} />
    </div>
  );
}

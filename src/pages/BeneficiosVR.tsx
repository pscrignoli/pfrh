import { Construction, UtensilsCrossed } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export default function BeneficiosVR() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="max-w-md w-full">
        <CardContent className="flex flex-col items-center gap-4 pt-6 text-center">
          <div className="rounded-full bg-muted p-4">
            <UtensilsCrossed className="h-8 w-8 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-semibold">Vale Refeição</h2>
          <p className="text-muted-foreground text-sm">
            Este módulo está em desenvolvimento e estará disponível em breve.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

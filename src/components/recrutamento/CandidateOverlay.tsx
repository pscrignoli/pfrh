import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { Candidate } from "@/hooks/useCandidates";

function getInitials(name: string) {
  return name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

export default function CandidateOverlay({ candidate }: { candidate: Candidate }) {
  return (
    <div className="bg-card border rounded-lg p-3 shadow-lg cursor-grabbing w-64">
      <div className="flex items-center gap-2.5">
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarFallback className="text-xs bg-primary/10 text-primary font-semibold">
            {getInitials(candidate.name)}
          </AvatarFallback>
        </Avatar>
        <p className="font-medium text-sm truncate">{candidate.name}</p>
      </div>
    </div>
  );
}

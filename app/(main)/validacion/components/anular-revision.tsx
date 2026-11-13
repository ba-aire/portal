"use client";

import { Loader2, Undo2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { withBasePath } from "@/lib/base-path";
import { MOTIVO_MIN, type Revision } from "@/lib/revision/models";
import { formatearInstante } from "@/lib/revision/presentacion";

// Anular no borra: agrega una fila que deja sin efecto a la otra, con su
// propio motivo. Los minutos vuelven a contar en la próxima corrida.
export default function AnularRevision({
  revision,
  serie,
  onAnulada,
}: {
  revision: Revision;
  serie: string;
  onAnulada: () => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);

  const anular = async () => {
    setEnviando(true);
    try {
      const res = await fetch(
        withBasePath(`/api/revisiones/${revision.revision_id}/anular`),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ motivo }),
        },
      );
      const cuerpo = await res.json().catch(() => null);
      if (!res.ok) throw new Error(cuerpo?.error ?? "Error al anular");
      toast.success(`Revisión #${revision.revision_id} anulada`);
      setAbierto(false);
      setMotivo("");
      onAnulada();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <Undo2 className="h-4 w-4" />
          Anular
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Anular la revisión #{revision.revision_id}</DialogTitle>
          <DialogDescription>
            {revision.station_name}, {serie}, de{" "}
            {formatearInstante(revision.desde)} a{" "}
            {formatearInstante(revision.hasta)}. Queda registrada como anulada y
            deja de aplicarse en la próxima corrida. No se puede deshacer: si
            hace falta, se registra de nuevo.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-1.5">
          <Label htmlFor="motivo-anulacion">Motivo</Label>
          <textarea
            id="motivo-anulacion"
            className="min-h-20 rounded-md border px-3 py-2 text-sm"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button
            variant="destructive"
            onClick={anular}
            disabled={enviando || motivo.trim().length < MOTIVO_MIN}
          >
            {enviando && <Loader2 className="h-4 w-4 animate-spin" />}
            Anular
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

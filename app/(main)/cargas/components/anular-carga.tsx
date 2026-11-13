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
import { type Carga, MOTIVO_MIN } from "@/lib/carga/models";

// Anular no borra: agrega una fila que deja sin efecto a la carga ENTERA. Sus
// horas vuelven a lo que midió la red (o a no tener dato) en la próxima corrida.
export default function AnularCarga({
  carga,
  onAnulada,
}: {
  carga: Carga;
  onAnulada: () => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);

  const anular = async () => {
    setEnviando(true);
    try {
      const res = await fetch(
        withBasePath(`/api/cargas/${carga.carga_id}/anular`),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ motivo }),
        },
      );
      const cuerpo = await res.json().catch(() => null);
      if (!res.ok) throw new Error(cuerpo?.error ?? "Error al anular");
      toast.success(`Carga #${carga.carga_id} anulada`);
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
          <DialogTitle>Anular la carga #{carga.carga_id}</DialogTitle>
          <DialogDescription>
            {carga.station_name}, {carga.n_horas} valores horarios. Se anula
            entera: sus horas vuelven a lo que midió la red, o quedan sin dato.
            No se puede deshacer: si hace falta, se carga de nuevo.
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

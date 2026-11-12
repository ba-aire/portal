"use client";

import { AlertTriangle, Eye, Loader2, Plus } from "lucide-react";
import { useMemo, useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { withBasePath } from "@/lib/base-path";
import {
  type Accion,
  type Catalogo,
  ETIQUETA_ACCION,
  MOTIVO_MIN,
  type VistaPrevia,
} from "@/lib/revision/models";
import {
  formatearInstante,
  localAIso,
  opcionesDeSerie,
  STATUS,
  serieDeOpcion,
} from "@/lib/revision/presentacion";

const AYUDA: Record<Accion, string> = {
  invalidar:
    "Los minutos OK o con alarma del período dejan de entrar al promedio horario. Una hora con menos de 45 minutos válidos deja de publicarse en gold.",
  reincorporar:
    "Las alarmas del equipo en el período vuelven a contar como minutos válidos (por defecto quedan afuera).",
};

export default function NuevaRevision({
  catalogo,
  onRegistrada,
}: {
  catalogo: Catalogo;
  onRegistrada: () => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [accion, setAccion] = useState<Accion>("invalidar");
  const [estacion, setEstacion] = useState("");
  const [serie, setSerie] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [motivo, setMotivo] = useState("");
  const [vista, setVista] = useState<{
    clave: string;
    datos: VistaPrevia;
  } | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const opciones = useMemo(
    () => opcionesDeSerie(catalogo.parametros),
    [catalogo.parametros],
  );

  // El cuerpo del pedido, o null mientras falte algo.
  const pedido = useMemo(() => {
    const d = localAIso(desde);
    const h = localAIso(hasta);
    if (!estacion || !serie || !d || !h) return null;
    return {
      station_code: estacion,
      ...serieDeOpcion(serie),
      desde: d,
      hasta: h,
    };
  }, [estacion, serie, desde, hasta]);

  // La vista previa vale para el pedido con que se pidió: si cambia algo, hay
  // que volver a pedirla antes de registrar.
  const clave = pedido ? JSON.stringify(pedido) : "";
  const vistaVigente = vista && vista.clave === clave ? vista.datos : null;

  const llamar = async (url: string, cuerpo: unknown) => {
    const res = await fetch(withBasePath(url), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cuerpo),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) throw new Error(json?.error ?? "Error inesperado");
    return json;
  };

  const verVistaPrevia = async () => {
    if (!pedido) return;
    setOcupado(true);
    try {
      setVista({
        clave,
        datos: await llamar("/api/revisiones/vista-previa", pedido),
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setOcupado(false);
    }
  };

  const registrar = async () => {
    if (!pedido) return;
    setOcupado(true);
    try {
      const { revision_id } = await llamar("/api/revisiones", {
        ...pedido,
        accion,
        motivo,
      });
      toast.success(
        `Revisión #${revision_id} registrada. Se aplica en la próxima corrida del pipeline.`,
      );
      setAbierto(false);
      setSerie("");
      setDesde("");
      setHasta("");
      setMotivo("");
      setVista(null);
      onRegistrada();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setOcupado(false);
    }
  };

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4" />
          Nueva revisión
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nueva revisión</DialogTitle>
          <DialogDescription>{AYUDA[accion]}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label>Acción</Label>
            <Select
              value={accion}
              onValueChange={(v) => setAccion(v as Accion)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="invalidar">
                  {ETIQUETA_ACCION.invalidar}
                </SelectItem>
                <SelectItem value="reincorporar">
                  {ETIQUETA_ACCION.reincorporar}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Estación</Label>
            <Select value={estacion} onValueChange={setEstacion}>
              <SelectTrigger>
                <SelectValue placeholder="Elegir" />
              </SelectTrigger>
              <SelectContent>
                {catalogo.estaciones.map((e) => (
                  <SelectItem key={e.station_code} value={e.station_code}>
                    {e.station_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5 sm:col-span-2">
            <Label>Serie</Label>
            <Select value={serie} onValueChange={setSerie}>
              <SelectTrigger>
                <SelectValue placeholder="Un parámetro o un equipo completo" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Equipo completo</SelectLabel>
                  {opciones.equipos.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
                <SelectGroup>
                  <SelectLabel>Parámetro</SelectLabel>
                  {opciones.parametros.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="desde">Desde (incluido)</Label>
            <Input
              id="desde"
              type="datetime-local"
              step={60}
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="hasta">Hasta (excluido)</Label>
            <Input
              id="hasta"
              type="datetime-local"
              step={60}
              value={hasta}
              onChange={(e) => setHasta(e.target.value)}
            />
          </div>
          <p className="text-xs text-muted-foreground sm:col-span-2">
            «Hasta» no se incluye: de 08:00 a 10:00 son los minutos 08:00 a
            09:59. Para el BAM (PM10) va la hora publicada, la que se ve en los
            datos horarios, no la de su reloj.
          </p>
          <div className="grid gap-1.5 sm:col-span-2">
            <Label htmlFor="motivo">Motivo</Label>
            <textarea
              id="motivo"
              className="min-h-20 rounded-md border px-3 py-2 text-sm"
              placeholder="Qué pasó y cómo se constató (al menos 10 caracteres)"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
            />
          </div>
        </div>

        {vistaVigente && <TablaVistaPrevia vista={vistaVigente} />}

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={verVistaPrevia}
            disabled={!pedido || ocupado}
          >
            <Eye className="h-4 w-4" />
            Vista previa
          </Button>
          <Button
            onClick={registrar}
            variant={accion === "invalidar" ? "destructive" : "default"}
            disabled={
              !vistaVigente || ocupado || motivo.trim().length < MOTIVO_MIN
            }
            title={vistaVigente ? undefined : "Primero, la vista previa"}
          >
            {ocupado && <Loader2 className="h-4 w-4 animate-spin" />}
            Registrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TablaVistaPrevia({ vista }: { vista: VistaPrevia }) {
  const statusPresentes = STATUS.filter((s) =>
    vista.parametros.some((p) => p.minutos[s.value]),
  );
  return (
    <div className="space-y-2 text-sm">
      <p className="font-medium">Lo que hay hoy en el período</p>
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-xs">
          <thead className="bg-muted/50">
            <tr>
              <th className="p-2 text-left">Parámetro</th>
              {statusPresentes.map((s) => (
                <th key={s.value} className="p-2 text-right">
                  {s.label}
                </th>
              ))}
              <th className="p-2 text-right">Horas válidas en gold</th>
            </tr>
          </thead>
          <tbody>
            {vista.parametros.map((p) => (
              <tr key={p.parameter_code} className="border-t">
                <td className="p-2">{p.display_name}</td>
                {statusPresentes.map((s) => (
                  <td key={s.value} className="p-2 text-right">
                    {p.minutos[s.value] ?? 0}
                  </td>
                ))}
                <td className="p-2 text-right">
                  {p.horas_validas} de {p.horas}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {vista.parametros.every((p) => Object.keys(p.minutos).length === 0) && (
        <p className="text-muted-foreground">
          No hay minutos de esta serie en el período.
        </p>
      )}
      {vista.superpuestas.length > 0 && (
        <div className="flex gap-2 rounded-md border border-amber-300 bg-amber-50 p-2 text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            Se superpone con revisiones vigentes:{" "}
            {vista.superpuestas
              .map(
                (s) =>
                  `#${s.revision_id} (${ETIQUETA_ACCION[s.accion].toLowerCase()}, ${formatearInstante(s.desde)} a ${formatearInstante(s.hasta)})`,
              )
              .join("; ")}
            . Si un minuto queda invalidado y reincorporado a la vez, gana la
            invalidación.
          </div>
        </div>
      )}
    </div>
  );
}

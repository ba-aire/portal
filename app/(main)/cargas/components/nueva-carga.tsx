"use client";

import { AlertTriangle, Eye, Loader2, Upload } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { withBasePath } from "@/lib/base-path";
import { MAX_HORAS, MOTIVO_MIN, type VistaPrevia } from "@/lib/carga/models";
import {
  type Celda,
  formatearHoraArgentina,
  leerPlanilla,
  type MarcaDeHora,
} from "@/lib/carga/parser";
import type { Catalogo } from "@/lib/revision/models";
import { formatearInstante } from "@/lib/revision/presentacion";
import { abrirArchivo } from "./abrir-archivo";

export default function NuevaCarga({
  catalogo,
  onCargada,
}: {
  catalogo: Catalogo;
  onCargada: () => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [estacion, setEstacion] = useState("");
  const [marca, setMarca] = useState<MarcaDeHora>("inicio");
  const [archivo, setArchivo] = useState<{
    nombre: string;
    celdas: Celda[][];
  } | null>(null);
  const [errorDeArchivo, setErrorDeArchivo] = useState<string | null>(null);
  const [motivo, setMotivo] = useState("");
  const [vista, setVista] = useState<{
    clave: string;
    datos: VistaPrevia;
  } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  // La vista previa en la que quien carga confirmó que el lote pisa cargas
  // vigentes. Vale para ESA vista: si cambia el lote o se vuelve a consultar,
  // se pide de nuevo.
  const [confirmadaEn, setConfirmadaEn] = useState<VistaPrevia | null>(null);

  const codigos = useMemo(
    () => catalogo.parametros.map((p) => p.parameter_code),
    [catalogo.parametros],
  );

  // El archivo se lee de nuevo si cambia qué marca la hora: mueve todo una hora.
  const lectura = useMemo(
    () => (archivo ? leerPlanilla(archivo.celdas, codigos, marca) : null),
    [archivo, codigos, marca],
  );
  const horas = lectura?.ok ? lectura.horas : null;
  const demasiadas = horas !== null && horas.length > MAX_HORAS;

  // La vista previa vale para el lote con que se pidió.
  const clave = horas
    ? `${estacion}|${marca}|${archivo?.nombre}|${horas.length}`
    : "";
  const vistaVigente = vista && vista.clave === clave ? vista.datos : null;
  const pisaCargas = (vistaVigente?.solapes.length ?? 0) > 0;
  const pisarConfirmado =
    vistaVigente !== null && confirmadaEn === vistaVigente;

  // El nombre del archivo suele decir la estación ("...-nox-cordoba-..."). Si
  // nombra a OTRA que la elegida, se avisa: es el error más fácil de cometer,
  // y la base no tiene cómo notarlo.
  const otraEstacion = useMemo(() => {
    if (!archivo || !estacion) return null;
    const nombre = archivo.nombre.toLowerCase();
    if (nombre.includes(estacion)) return null;
    return (
      catalogo.estaciones.find(
        (e) => e.station_code !== estacion && nombre.includes(e.station_code),
      ) ?? null
    );
  }, [archivo, estacion, catalogo.estaciones]);

  // Al cerrar se descarta todo: la próxima carga arranca limpia.
  useEffect(() => {
    if (!abierto) {
      setArchivo(null);
      setErrorDeArchivo(null);
      setMotivo("");
      setVista(null);
    }
  }, [abierto]);
  const elegirArchivo = async (f: File | undefined) => {
    setArchivo(null);
    setErrorDeArchivo(null);
    if (!f) return;
    try {
      setArchivo({ nombre: f.name, celdas: await abrirArchivo(f) });
    } catch {
      setErrorDeArchivo("No se pudo abrir el archivo: ¿es un .csv o un .xlsx?");
    }
  };

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
    if (!horas || !estacion) return;
    setOcupado(true);
    try {
      setVista({
        clave,
        datos: await llamar("/api/cargas/vista-previa", {
          station_code: estacion,
          horas,
        }),
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setOcupado(false);
    }
  };

  const cargar = async () => {
    if (!horas || !estacion) return;
    setOcupado(true);
    try {
      const { carga_id } = await llamar("/api/cargas", {
        station_code: estacion,
        archivo: archivo?.nombre,
        motivo,
        horas,
      });
      toast.success(
        `Carga #${carga_id} registrada: ${horas.length} valores horarios. Se publican en la próxima corrida del pipeline.`,
      );
      setAbierto(false);
      onCargada();
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
          <Upload className="h-4 w-4" />
          Nueva carga
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nueva carga</DialogTitle>
          <DialogDescription>
            Un archivo .csv o .xlsx de una sola estación, con las columnas
            FECHA, HORA y una por parámetro (por ejemplo NO, NO2, NOX), una fila
            por hora. En hora de Argentina y en la unidad de cada parámetro. Una
            celda vacía o «s/d» es una hora sin dato y no se carga.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
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
          <div className="grid gap-1.5">
            <Label>La HORA marca</Label>
            <Select
              value={marca}
              onValueChange={(v) => setMarca(v as MarcaDeHora)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="inicio">
                  El inicio (05:00 = de 05:00 a 06:00)
                </SelectItem>
                <SelectItem value="fin">
                  El final (05:00 = de 04:00 a 05:00)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5 sm:col-span-2">
            <Label htmlFor="archivo">Archivo</Label>
            <Input
              id="archivo"
              type="file"
              accept=".csv,.xlsx"
              onChange={(e) => elegirArchivo(e.target.files?.[0])}
            />
          </div>
        </div>

        {errorDeArchivo && <Errores errores={[errorDeArchivo]} />}
        {lectura && !lectura.ok && <Errores errores={lectura.errores} />}
        {demasiadas && (
          <Errores
            errores={[
              `El archivo trae ${horas?.length} horas y una carga admite hasta ${MAX_HORAS}. Partilo en archivos más chicos.`,
            ]}
          />
        )}

        {lectura?.ok && !demasiadas && (
          <p className="text-sm">
            {lectura.filas} filas, {lectura.horas.length} valores de{" "}
            {lectura.parametros.join(", ")}, del{" "}
            {formatearHoraArgentina(lectura.horas[0].ts_hour)} al{" "}
            {formatearHoraArgentina(
              lectura.horas[lectura.horas.length - 1].ts_hour,
            )}{" "}
            (inicio de cada hora).
            {lectura.sinDato > 0 &&
              ` ${lectura.sinDato} celdas sin dato, que no se cargan.`}
          </p>
        )}

        {otraEstacion && (
          <div className="flex gap-2 rounded-md border border-amber-300 bg-amber-50 p-2 text-sm text-amber-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            El nombre del archivo dice «{otraEstacion.station_code}» y la
            estación elegida es otra. Revisá antes de cargar.
          </div>
        )}

        {vistaVigente && <TablaVistaPrevia vista={vistaVigente} />}

        {vistaVigente && pisaCargas && (
          <CargasPisadas
            vista={vistaVigente}
            nombre={(c) =>
              catalogo.parametros.find((p) => p.parameter_code === c)
                ?.display_name ?? c
            }
            confirmado={pisarConfirmado}
            onConfirmar={(v) => setConfirmadaEn(v ? vistaVigente : null)}
          />
        )}

        <div className="grid gap-1.5">
          <Label htmlFor="motivo">Motivo</Label>
          <textarea
            id="motivo"
            className="min-h-20 rounded-md border px-3 py-2 text-sm"
            placeholder="De dónde salen los datos y por qué se cargan (al menos 10 caracteres)"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
          />
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={verVistaPrevia}
            disabled={!horas || demasiadas || !estacion || ocupado}
          >
            <Eye className="h-4 w-4" />
            Vista previa
          </Button>
          <Button
            onClick={cargar}
            disabled={
              !vistaVigente ||
              ocupado ||
              motivo.trim().length < MOTIVO_MIN ||
              (pisaCargas && !pisarConfirmado)
            }
            title={
              !vistaVigente
                ? "Primero, la vista previa"
                : pisaCargas && !pisarConfirmado
                  ? "Confirmá que reemplaza cargas vigentes"
                  : undefined
            }
          >
            {ocupado && <Loader2 className="h-4 w-4 animate-spin" />}
            Cargar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Errores({ errores }: { errores: string[] }) {
  return (
    <div className="flex gap-2 rounded-md border border-red-300 bg-red-50 p-2 text-sm text-red-900">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <ul className="list-inside list-disc">
        {errores.map((e) => (
          <li key={e}>{e}</li>
        ))}
      </ul>
    </div>
  );
}

function TablaVistaPrevia({ vista }: { vista: VistaPrevia }) {
  const reemplaza = vista.parametros.reduce(
    (n, p) => n + p.reemplaza_validas,
    0,
  );
  const yaCargadas = vista.parametros.reduce((n, p) => n + p.ya_cargadas, 0);
  return (
    <div className="space-y-2 text-sm">
      <p className="font-medium">Lo que se va a cargar</p>
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-xs">
          <thead className="bg-muted/50">
            <tr>
              <th className="p-2 text-left">Parámetro</th>
              <th className="p-2 text-right">Horas</th>
              <th className="p-2 text-right">Mínimo</th>
              <th className="p-2 text-right">Máximo</th>
              <th className="p-2 text-right">Reemplaza horas válidas</th>
              <th className="p-2 text-right">Ya cargadas</th>
            </tr>
          </thead>
          <tbody>
            {vista.parametros.map((p) => (
              <tr key={p.parameter_code} className="border-t">
                <td className="p-2">
                  {p.display_name}
                  {p.unit && (
                    <span className="text-muted-foreground"> ({p.unit})</span>
                  )}
                </td>
                <td className="p-2 text-right">{p.horas}</td>
                <td className="p-2 text-right">{p.minimo}</td>
                <td className="p-2 text-right">{p.maximo}</td>
                <td className="p-2 text-right">{p.reemplaza_validas}</td>
                <td className="p-2 text-right">{p.ya_cargadas}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {(reemplaza > 0 || yaCargadas > 0) && (
        <div className="flex gap-2 rounded-md border border-amber-300 bg-amber-50 p-2 text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            {reemplaza > 0 &&
              `${reemplaza} horas ya tienen un promedio válido medido por la red: la carga lo reemplaza. `}
            {yaCargadas > 0 &&
              `${yaCargadas} horas ya estaban cargadas: vale esta carga, la más nueva. Abajo, cuáles.`}
          </div>
        </div>
      )}
    </div>
  );
}

// Las cargas vigentes que este lote pisa, y la confirmación para seguir. La
// base lo aceptaría igual (vale la carga más nueva, hora por hora): el aviso
// está para que no pase sin querer.
function CargasPisadas({
  vista,
  nombre,
  confirmado,
  onConfirmar,
}: {
  vista: VistaPrevia;
  nombre: (codigo: string) => string;
  confirmado: boolean;
  onConfirmar: (v: boolean) => void;
}) {
  const total = vista.solapes.reduce((n, s) => n + s.horas, 0);
  return (
    <div className="space-y-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
      <p className="flex gap-2 font-medium">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        {vista.solapes.length === 1
          ? `Esta carga reemplaza ${total} horas de la carga #${vista.solapes[0].carga_id}, que sigue vigente.`
          : `Esta carga reemplaza ${total} horas de ${vista.solapes.length} cargas vigentes.`}
      </p>
      <ul className="space-y-1.5 pl-6">
        {vista.solapes.map((s) => (
          <li key={s.carga_id}>
            <span className="font-medium">#{s.carga_id}</span>: {s.horas} horas
            de {s.parametros.map(nombre).join(", ")}, del{" "}
            {formatearHoraArgentina(s.desde)} al{" "}
            {formatearHoraArgentina(s.hasta)}.{" "}
            <span className="text-amber-800">
              Registrada el {formatearInstante(s.registrado_en)} por{" "}
              {s.registrado_por}
              {s.archivo && ` (${s.archivo})`}: {s.motivo}
            </span>
          </li>
        ))}
      </ul>
      <p className="pl-6">
        En esas horas va a valer esta carga. Las otras horas de esas cargas no
        cambian. Si anulás esta carga más adelante, vuelven a valer las
        anteriores.
      </p>
      <div className="flex items-start gap-2 pl-6">
        <Checkbox
          id="confirmar-pisar"
          checked={confirmado}
          onCheckedChange={(v) => onConfirmar(v === true)}
          className="mt-0.5 bg-white"
        />
        <Label htmlFor="confirmar-pisar" className="leading-snug">
          Entiendo que esta carga reemplaza esas horas de cargas anteriores
        </Label>
      </div>
    </div>
  );
}

"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  Label,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface ChartProps {
  data: Record<string, string | number>[];
}

// data example para CO:
/*
[
  {
    "time": "2025-09-19T23:55:00Z",
    "centenario": "0.000",
    "cordoba": "0.000",
    "catalinas": "0.000",
    "cifa": "0.000",
  },
  {
    "time": "2025-09-20T00:00:00Z",
    "centenario": "0.000",
    "cordoba": "0.000",
    "catalinas": "0.000",
    "cifa": "0.000",
  }
]
*/

export default function Chart({ data }: ChartProps) {
  if (!Array.isArray(data) || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-96">
        <span className="text-gray-500">No hay datos para mostrar</span>
      </div>
    );
  }

  // Obtengo los datos ordenados por ubicación (columnas) dinámicamente excluyendo 'time'.
  // Recorro todas las filas por si la fuente mergeó tablas con timestamps distintos
  // (p.ej. pm10 + pm25) y data[0] no tiene todas las columnas.
  const locations = Array.from(
    data.reduce((set, row) => {
      Object.keys(row).forEach((k) => {
        if (k !== "time") set.add(k);
      });
      return set;
    }, new Set<string>()),
  );
  // Verifico si el contaminante seleccionado por el usuario es NOx totales
  // para mostrar grafico de area acumulativo no + no2 y nox
  const isNox = locations.some((location) => location.includes("NOx"));

  // Colores predefinidos para cada estación
  const stationColor: Record<string, string> = {
    centenario: "var(--color-centenario)",
    "centenario NO": "var(--color-centenario-no)",
    "centenario NO2": "var(--color-centenario-no2)",
    "centenario NOx": "var(--color-centenario-nox)",
    cordoba: "var(--color-cordoba)",
    "cordoba NO": "var(--color-cordoba-no)",
    "cordoba NO2": "var(--color-cordoba-no2)",
    "cordoba NOx": "var(--color-cordoba-nox)",
    catalinas: "var(--color-catalinas)",
    "catalinas NO": "var(--color-catalinas-no)",
    "catalinas NO2": "var(--color-catalinas-no2)",
    "catalinas NOx": "var(--color-catalinas-nox)",
    cifa: "var(--color-cifa)",
    "cifa NO": "var(--color-cifa-no)",
    "cifa NO2": "var(--color-cifa-no2)",
    "cifa NOx": "var(--color-cifa-nox)",
    "centenario PM10": "#006449",
    "centenario PM25": "#4a9477",
    "cordoba PM10": "#d03156",
    "cordoba PM25": "#e27a8f",
    "catalinas PM10": "#008ebd",
    "catalinas PM25": "#4db8d9",
    "cifa PM10": "#7b30b5",
    "cifa PM25": "#a878c4",
    otra: "var(--color-otra)",
  };

  const displayName = (location: string) => {
    let label = location;
    if (label === "catalinas" || label.startsWith("catalinas ")) {
      label = label.replace(/^catalinas/, "La Boca");
    } else {
      label = label.charAt(0).toUpperCase() + label.slice(1);
    }
    // Mostrar "PM2.5" al usuario aunque la clave interna sea "PM25"
    return label.replace(/\bPM25\b/, "PM2.5");
  };

  // Mapeo los datos para el gráfico
  const chartData = data.map((row) => {
    const mappedRow: Record<string, string | number | null> = {
      timestamp: new Intl.DateTimeFormat("es-AR", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "America/Argentina/Buenos_Aires",
      }).format(new Date(row.time)),
    };

    locations.forEach((location) => {
      const raw = row[location];
      // Devuelvo número real (no string con toFixed) para que recharts escale
      // bien y no arrastre NaN; null para puntos faltantes así la línea
      // salta el hueco en vez de caer a 0.
      if (raw === null || raw === undefined || raw === "") {
        mappedRow[location] = null;
        return;
      }
      const n = Number(raw);
      mappedRow[location] = Number.isFinite(n) ? n : null;
    });

    return mappedRow;
  });

  return (
    <div className="flex flex-col gap-28 my-20">
      <ResponsiveContainer
        width="100%"
        height={400}
        style={{ display: isNox ? "" : "none" }}
      >
        <AreaChart
          data={chartData}
          margin={{ top: 50, right: 30, left: 0, bottom: 5 }}
        >
          <Label
            value="NO2 y NO apilados + NOx totales"
            position="top"
            offset={30}
            style={{
              fill: "var(--color-primary)",
              fontSize: 20,
              fontWeight: 600,
            }}
          />
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="timestamp" tick={{ fontSize: 12 }}></XAxis>
          <YAxis />
          <Tooltip
            itemSorter={(item) => {
              const name = typeof item.name === "string" ? item.name : "";
              if (name.includes("NO2")) return 2;
              if (name.includes("NOx")) return 0;
              if (name.includes("NO")) return 1;
              return 3;
            }}
          />
          <Legend iconType="plainline" iconSize={20} />
          {locations.map((location) =>
            location.includes("NOx") ? (
              <Line
                key={location}
                type="monotone"
                dataKey={location}
                name={displayName(location)}
                stroke={stationColor[location] ?? "var(--color-otra)"}
                dot={false}
                strokeWidth={3}
                strokeDasharray="4 7"
              />
            ) : (
              <Area
                key={location}
                type="monotone"
                dataKey={location}
                name={displayName(location)}
                stackId="1"
                stroke={stationColor[location] ?? "var(--color-otra)"}
                fill={stationColor[location] ?? "var(--color-otra)"}
              />
            ),
          )}
        </AreaChart>
      </ResponsiveContainer>
      <ResponsiveContainer width="100%" height={400}>
        <LineChart
          data={chartData}
          margin={{ top: 50, right: 30, left: 0, bottom: 5 }}
        >
          <Label
            value="Concentraciones por contaminante - variables individuales"
            position="top"
            offset={30}
            style={{
              fill: "var(--color-primary)",
              fontSize: 20,
              fontWeight: 600,
            }}
          />
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="timestamp" tick={{ fontSize: 12 }}></XAxis>
          <YAxis />
          <Tooltip
            itemSorter={(item) => {
              const name = typeof item.name === "string" ? item.name : "";
              if (name.includes("NO2")) return 2;
              if (name.includes("NOx")) return 0;
              if (name.includes("NO")) return 1;
              return 3;
            }}
          />
          <Legend iconType="plainline" />
          {locations.map((location) => (
            <Line
              key={location}
              type="linear"
              dataKey={location}
              stroke={stationColor[location] ?? "var(--color-otra)"}
              name={displayName(location)}
              dot={false}
              strokeWidth={location.includes("NOx") ? 3 : 2}
              strokeDasharray={location.includes("NOx") ? "4 7" : "4 0"}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export interface MeasurementChartProps {
  data: { label: string; valor: number }[];
  metric: "peso" | "altura";
}

export function MeasurementChart({ data, metric }: MeasurementChartProps) {
  const lineColor = metric === "peso" ? "#0f172a" : "#F2A97F";
  const unitLabel = metric === "peso" ? "kg" : "cm";

  if (data.length === 0) {
    return (
      <div className="bg-card rounded-2xl shadow-xs border border-border/50 p-5">
        <p className="text-sm text-muted-foreground text-center">
          Registre medidas para acompanhar a evolução ao longo do tempo.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-2xl shadow-xs border border-border/50 p-5">
      <h2 className="text-base font-semibold text-foreground mb-4">
        {metric === "peso" ? "Evolução do Peso" : "Evolução da Altura"}
      </h2>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={data} margin={{ top: 5, right: 10, left: -15, bottom: 5 }}>
          <CartesianGrid vertical={false} stroke="#f1f5f9" />
          <XAxis
            dataKey="label"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: "#64748b" }}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: "#64748b" }}
            label={{ value: unitLabel, angle: -90, position: "insideLeft", fontSize: 11, fill: "#94a3b8" }}
          />
          <Tooltip
            contentStyle={{
              borderRadius: "12px",
              border: "1px solid #e2e8f0",
              backgroundColor: "#ffffff",
              fontSize: "12px",
              boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
            }}
            formatter={(value) => [`${Number(value)} ${unitLabel}`, metric === "peso" ? "Peso" : "Altura"]}
          />
          <Line
            type="monotone"
            dataKey="valor"
            name={metric === "peso" ? "Peso" : "Altura"}
            stroke={lineColor}
            strokeWidth={3}
            dot={{ r: 4, fill: lineColor, strokeWidth: 0 }}
            activeDot={{ r: 6, fill: lineColor, strokeWidth: 0 }}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

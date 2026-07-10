import { useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { PricePoint } from "@/lib/price-tracker";

interface PriceChartProps {
  history: PricePoint[];
  currency?: string;
  targetPrice?: number | null;
}

export function PriceChart({ history, currency = "INR", targetPrice }: PriceChartProps) {
  const data = useMemo(
    () =>
      [...history]
        .sort((a, b) => new Date(a.checked_at).getTime() - new Date(b.checked_at).getTime())
        .map((p) => ({
          t: new Date(p.checked_at).getTime(),
          price: Number(p.price),
          label: new Date(p.checked_at).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        })),
    [history],
  );

  if (data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">
        No price points yet
      </div>
    );
  }

  const prices = data.map((d) => d.price);
  const min = Math.min(...prices, targetPrice ?? Infinity);
  const max = Math.max(...prices, targetPrice ?? -Infinity);
  const pad = Math.max((max - min) * 0.1, 1);

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
          <defs>
            <linearGradient id="priceFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(217 91% 60%)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="hsl(217 91% 60%)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            tickLine={false}
            axisLine={false}
            minTickGap={24}
          />
          <YAxis
            domain={[Math.floor(min - pad), Math.ceil(max + pad)]}
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            tickLine={false}
            axisLine={false}
            width={56}
            tickFormatter={(v) => `${currency === "INR" ? "₹" : ""}${Number(v).toLocaleString()}`}
          />
          <Tooltip
            contentStyle={{
              background: "hsl(var(--popover))",
              border: "1px solid hsl(var(--border))",
              borderRadius: 12,
              fontSize: 12,
              color: "hsl(var(--popover-foreground))",
            }}
            formatter={(value: number) => [`${currency === "INR" ? "₹" : ""}${Number(value).toLocaleString()}`, "Price"]}
          />
          {targetPrice ? (
            <ReferenceLine
              y={targetPrice}
              stroke="hsl(142 71% 45%)"
              strokeDasharray="4 4"
              label={{ value: "Target", position: "insideTopRight", fontSize: 10, fill: "hsl(142 71% 45%)" }}
            />
          ) : null}
          <Area type="monotone" dataKey="price" stroke="hsl(217 91% 60%)" strokeWidth={2} fill="url(#priceFill)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

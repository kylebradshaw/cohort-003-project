import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface EnrollmentChartProps {
  data: { date: string; count: number }[];
}

export function EnrollmentChart({ data }: EnrollmentChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-lg border border-dashed">
        <p className="text-sm text-muted-foreground">No enrollment data for this period</p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
        <defs>
          <linearGradient id="enrollmentGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="hsl(var(--chart-2, 142 71% 45%))" stopOpacity={0.3} />
            <stop offset="95%" stopColor="hsl(var(--chart-2, 142 71% 45%))" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
        <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} width={40} />
        <Tooltip formatter={(value) => [Number(value), "Enrollments"]} />
        <Area
          type="monotone"
          dataKey="count"
          stroke="hsl(142 71% 45%)"
          strokeWidth={2}
          fill="url(#enrollmentGradient)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

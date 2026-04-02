import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  ResponsiveContainer,
} from "recharts";

interface LessonDropoffItem {
  lessonId: number;
  title: string;
  position: number;
  completedCount: number;
  enrolledCount: number;
}

interface LessonDropoffChartProps {
  data: LessonDropoffItem[];
}

export function LessonDropoffChart({ data }: LessonDropoffChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-lg border border-dashed">
        <p className="text-sm text-muted-foreground">No lesson data available</p>
      </div>
    );
  }

  if (data[0].enrolledCount === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-lg border border-dashed">
        <p className="text-sm text-muted-foreground">No enrollments yet</p>
      </div>
    );
  }

  const chartData = data.map((d) => ({
    name: d.title.length > 25 ? d.title.slice(0, 23) + "…" : d.title,
    fullTitle: d.title,
    completionPct: d.enrolledCount > 0 ? Math.round((d.completedCount / d.enrolledCount) * 100) : 0,
    lessonId: d.lessonId,
  }));

  const minPct = Math.min(...chartData.map((d) => d.completionPct));
  const highestDropoffLesson = chartData.find((d) => d.completionPct === minPct);

  return (
    <div className="space-y-3">
      {highestDropoffLesson && (
        <div className="rounded-md bg-orange-50 px-3 py-2 text-sm dark:bg-orange-900/20">
          <span className="font-medium text-orange-700 dark:text-orange-400">Highest drop-off: </span>
          <span className="text-orange-600 dark:text-orange-300">{highestDropoffLesson.fullTitle}</span>
          <span className="text-orange-500 dark:text-orange-400"> ({highestDropoffLesson.completionPct}% completion)</span>
        </div>
      )}
      <ResponsiveContainer width="100%" height={Math.max(200, chartData.length * 36)}>
        <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 32, left: 8, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-muted" />
          <XAxis
            type="number"
            domain={[0, 100]}
            tickFormatter={(v) => `${v}%`}
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            dataKey="name"
            type="category"
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={150}
          />
          <Tooltip
            formatter={(value) => [`${value}%`, "Completion rate"]}
            labelFormatter={(label, payload) => payload?.[0]?.payload?.fullTitle ?? label}
          />
          <Bar dataKey="completionPct" radius={[0, 4, 4, 0]}>
            {chartData.map((entry) => (
              <Cell
                key={entry.lessonId}
                fill={
                  entry.lessonId === highestDropoffLesson?.lessonId
                    ? "hsl(25 95% 53%)"
                    : "hsl(var(--primary))"
                }
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

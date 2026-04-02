import { useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { ChevronDown, ChevronRight } from "lucide-react";

interface VideoAbandonmentItem {
  lessonId: number;
  title: string;
  medianStopSeconds: number;
  buckets: { secondsBucket: number; count: number }[];
}

interface VideoAbandonmentChartProps {
  data: VideoAbandonmentItem[];
}

function formatSeconds(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

function LessonAbandonmentPanel({ item }: { item: VideoAbandonmentItem }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-lg border">
      <button
        type="button"
        className="flex w-full items-center justify-between p-3 text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <div>
          <span className="font-medium text-sm">{item.title}</span>
          <span className="ml-3 text-xs text-muted-foreground">
            Median stop: {formatSeconds(Math.round(item.medianStopSeconds))}
          </span>
        </div>
        {open ? <ChevronDown className="size-4 text-muted-foreground" /> : <ChevronRight className="size-4 text-muted-foreground" />}
      </button>
      {open && (
        <div className="border-t px-3 pb-4 pt-3">
          <ResponsiveContainer width="100%" height={180}>
            <BarChart
              data={item.buckets}
              margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="secondsBucket"
                tickFormatter={formatSeconds}
                tick={{ fontSize: 10 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                width={30}
              />
              <Tooltip
                labelFormatter={(v) => `At ${formatSeconds(Number(v))}s`}
                formatter={(value) => [Number(value), "Stop events"]}
              />
              <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

export function VideoAbandonmentChart({ data }: VideoAbandonmentChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-24 items-center justify-center rounded-lg border border-dashed">
        <p className="text-sm text-muted-foreground">No video watch data recorded</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {data.map((item) => (
        <LessonAbandonmentPanel key={item.lessonId} item={item} />
      ))}
    </div>
  );
}

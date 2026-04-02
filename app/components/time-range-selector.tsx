import { useNavigate, useSearchParams } from "react-router";
import type { TimeRange } from "~/services/analyticsService";

const RANGES: { value: TimeRange; label: string }[] = [
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
  { value: "all", label: "All time" },
];

export function TimeRangeSelector({ selectedRange }: { selectedRange: TimeRange }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  function handleChange(value: TimeRange) {
    const params = new URLSearchParams(searchParams);
    params.set("range", value);
    navigate(`?${params.toString()}`, { replace: true });
  }

  return (
    <div className="inline-flex rounded-lg border bg-muted p-1">
      {RANGES.map((r) => (
        <button
          key={r.value}
          type="button"
          onClick={() => handleChange(r.value)}
          className={
            r.value === selectedRange
              ? "rounded-md bg-background px-3 py-1.5 text-sm font-medium shadow-sm"
              : "rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
          }
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}

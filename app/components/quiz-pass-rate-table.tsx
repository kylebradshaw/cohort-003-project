import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

interface QuizStatsItem {
  quizId: number;
  title: string;
  passRate: number;
  attemptCount: number;
  questions: { questionId: number; text: string; correctRate: number }[];
}

interface QuizPassRateTableProps {
  data: QuizStatsItem[];
}

function pct(rate: number) {
  return `${Math.round(rate * 100)}%`;
}

function PassRateBar({ rate }: { rate: number }) {
  const pctValue = Math.round(rate * 100);
  const color =
    pctValue >= 70 ? "bg-green-500" : pctValue >= 40 ? "bg-yellow-500" : "bg-red-500";

  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-24 overflow-hidden rounded-full bg-muted">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pctValue}%` }} />
      </div>
      <span className="text-sm tabular-nums">{pct(rate)}</span>
    </div>
  );
}

function QuizRow({ quiz }: { quiz: QuizStatsItem }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <tr className="border-b">
        <td className="py-3 pr-4">
          <button
            type="button"
            className="flex items-center gap-2 hover:text-primary"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <ChevronDown className="size-4 shrink-0" /> : <ChevronRight className="size-4 shrink-0" />}
            <span className="font-medium text-sm">{quiz.title}</span>
          </button>
        </td>
        <td className="py-3 pr-4">
          {quiz.attemptCount === 0 ? (
            <span className="text-sm text-muted-foreground">No attempts yet</span>
          ) : (
            <PassRateBar rate={quiz.passRate} />
          )}
        </td>
        <td className="py-3 text-right text-sm tabular-nums text-muted-foreground">
          {quiz.attemptCount}
        </td>
      </tr>
      {open && quiz.questions.length > 0 && (
        <tr className="border-b bg-muted/30">
          <td colSpan={3} className="px-8 py-3">
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Per-question correct rate</p>
              {quiz.questions.map((q) => (
                <div key={q.questionId} className="flex items-center gap-3">
                  <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">{q.text}</span>
                  <PassRateBar rate={q.correctRate} />
                </div>
              ))}
            </div>
          </td>
        </tr>
      )}
      {open && quiz.questions.length === 0 && (
        <tr className="border-b bg-muted/30">
          <td colSpan={3} className="px-8 py-2 text-sm text-muted-foreground">
            No questions recorded
          </td>
        </tr>
      )}
    </>
  );
}

export function QuizPassRateTable({ data }: QuizPassRateTableProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-24 items-center justify-center rounded-lg border border-dashed">
        <p className="text-sm text-muted-foreground">No quizzes in this course</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th className="pb-2 pr-4 text-sm font-medium">Quiz</th>
            <th className="pb-2 pr-4 text-sm font-medium">Pass rate</th>
            <th className="pb-2 text-right text-sm font-medium">Attempts</th>
          </tr>
        </thead>
        <tbody>
          {data.map((quiz) => (
            <QuizRow key={quiz.quizId} quiz={quiz} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

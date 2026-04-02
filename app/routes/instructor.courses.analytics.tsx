import { Link, useSearchParams } from "react-router";
import type { Route } from "./+types/instructor.courses.analytics";
import { getCurrentUserId } from "~/lib/session";
import { getUserById, getUsersByRole } from "~/services/userService";
import { UserRole } from "~/db/schema";
import {
  sinceDate,
  getRevenueSeries,
  getRevenueByCountry,
  getEnrollmentSeries,
  getCourseSummaries,
  type TimeRange,
} from "~/services/analyticsService";
import { TimeRangeSelector } from "~/components/time-range-selector";
import { RevenueChart } from "~/components/revenue-chart";
import { EnrollmentChart } from "~/components/enrollment-chart";
import { CountryRevenueTable } from "~/components/country-revenue-table";
import { Card, CardContent, CardHeader } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import { BarChart2, AlertTriangle } from "lucide-react";
import { data, isRouteErrorResponse } from "react-router";
import * as v from "valibot";

const VALID_RANGES: TimeRange[] = ["7d", "30d", "90d", "all"];

function parseRange(value: string | null): TimeRange {
  if (value && (VALID_RANGES as string[]).includes(value)) return value as TimeRange;
  return "30d";
}

export function meta() {
  return [
    { title: "Analytics — Cadence" },
    { name: "description", content: "Cross-course analytics" },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const currentUserId = await getCurrentUserId(request);
  if (!currentUserId) throw data("Sign in required.", { status: 401 });

  const user = getUserById(currentUserId);
  if (!user || (user.role !== UserRole.Instructor && user.role !== UserRole.Admin)) {
    throw data("Only instructors and admins can access this page.", { status: 403 });
  }

  const url = new URL(request.url);
  const range = parseRange(url.searchParams.get("range"));
  const since = sinceDate(range);

  let instructorId: number | undefined;
  let allInstructors: { id: number; name: string }[] | null = null;

  if (user.role === UserRole.Admin) {
    allInstructors = getUsersByRole(UserRole.Instructor).map((u) => ({ id: u.id, name: u.name }));
    const filterParam = url.searchParams.get("instructorId");
    if (filterParam) {
      const parsed = parseInt(filterParam, 10);
      if (!isNaN(parsed)) instructorId = parsed;
    }
  } else {
    instructorId = user.id;
  }

  const revenueSeries = getRevenueSeries({ instructorId, since });
  const enrollmentSeries = getEnrollmentSeries({ instructorId, since });
  const revenueByCountry = getRevenueByCountry({ instructorId, since });
  const courseSummaries = instructorId !== undefined
    ? getCourseSummaries({ instructorId, since })
    : [];

  return {
    revenueSeries,
    enrollmentSeries,
    revenueByCountry,
    courseSummaries,
    selectedRange: range,
    allInstructors,
    selectedInstructorId: instructorId ?? null,
    isAdmin: user.role === UserRole.Admin,
  };
}

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export function HydrateFallback() {
  return (
    <div className="mx-auto max-w-7xl p-6 lg:p-8 space-y-8">
      <Skeleton className="h-9 w-64" />
      <Skeleton className="h-10 w-72" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-56" />
        <Skeleton className="h-56" />
      </div>
      <Skeleton className="h-48" />
    </div>
  );
}

export default function CrossCourseAnalytics({ loaderData }: Route.ComponentProps) {
  const {
    revenueSeries,
    enrollmentSeries,
    revenueByCountry,
    courseSummaries,
    selectedRange,
    allInstructors,
    selectedInstructorId,
    isAdmin,
  } = loaderData;

  const [searchParams] = useSearchParams();

  const totalRevenue = revenueSeries.reduce((s: number, r) => s + r.amountCents, 0);
  const totalEnrollments = enrollmentSeries.reduce((s: number, r) => s + r.count, 0);

  return (
    <div className="mx-auto max-w-7xl p-6 lg:p-8 space-y-8">
      {/* Breadcrumb */}
      <nav className="text-sm text-muted-foreground">
        <Link to="/" className="hover:text-foreground">Home</Link>
        <span className="mx-2">/</span>
        <Link to="/instructor" className="hover:text-foreground">My Courses</Link>
        <span className="mx-2">/</span>
        <span className="text-foreground">Analytics</span>
      </nav>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <BarChart2 className="size-8" />
            Analytics
          </h1>
          <p className="mt-1 text-muted-foreground">
            {isAdmin && !selectedInstructorId
              ? "Platform-wide performance across all instructors"
              : "Performance across your courses"}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {isAdmin && allInstructors && (
            <InstructorFilter
              instructors={allInstructors}
              selectedId={selectedInstructorId}
              searchParams={searchParams}
            />
          )}
          <TimeRangeSelector selectedRange={selectedRange} />
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <p className="text-sm text-muted-foreground">Total Revenue</p>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{formatCurrency(totalRevenue)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <p className="text-sm text-muted-foreground">Total Enrollments</p>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{totalEnrollments}</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <h2 className="text-base font-semibold">Revenue over time</h2>
          </CardHeader>
          <CardContent>
            <RevenueChart data={revenueSeries} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <h2 className="text-base font-semibold">Enrollments over time</h2>
          </CardHeader>
          <CardContent>
            <EnrollmentChart data={enrollmentSeries} />
          </CardContent>
        </Card>
      </div>

      {/* Revenue by country */}
      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold">Revenue by country</h2>
        </CardHeader>
        <CardContent>
          <CountryRevenueTable data={revenueByCountry} />
        </CardContent>
      </Card>

      {/* Per-course summary */}
      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold">Course breakdown</h2>
        </CardHeader>
        <CardContent>
          {courseSummaries.length === 0 ? (
            <div className="flex h-24 items-center justify-center rounded-lg border border-dashed">
              <p className="text-sm text-muted-foreground">
                {isAdmin && !selectedInstructorId
                  ? "Select an instructor to see course details"
                  : "No courses found"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 pr-4 font-medium">Course</th>
                    <th className="pb-2 pr-4 text-right font-medium">Revenue</th>
                    <th className="pb-2 pr-4 text-right font-medium">Enrollments</th>
                    <th className="pb-2 text-right font-medium">Completion</th>
                  </tr>
                </thead>
                <tbody>
                  {courseSummaries.map((course) => (
                    <tr key={course.courseId} className="border-b last:border-0">
                      <td className="py-2 pr-4">
                        <Link
                          to={`/instructor/${course.courseId}/analytics`}
                          className="font-medium hover:text-primary hover:underline"
                        >
                          {course.title}
                        </Link>
                      </td>
                      <td className="py-2 pr-4 text-right tabular-nums">
                        {formatCurrency(course.totalRevenueCents)}
                      </td>
                      <td className="py-2 pr-4 text-right tabular-nums">
                        {course.totalEnrollments}
                      </td>
                      <td className="py-2 text-right tabular-nums">
                        {Math.round(course.completionRate * 100)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function InstructorFilter({
  instructors,
  selectedId,
  searchParams,
}: {
  instructors: { id: number; name: string }[];
  selectedId: number | null;
  searchParams: URLSearchParams;
}) {
  function buildUrl(id: string) {
    const params = new URLSearchParams(searchParams);
    if (id) params.set("instructorId", id);
    else params.delete("instructorId");
    return `?${params.toString()}`;
  }

  return (
    <div className="flex items-center gap-2 text-sm">
      <label htmlFor="instructor-filter" className="text-muted-foreground whitespace-nowrap">
        Instructor:
      </label>
      <select
        id="instructor-filter"
        className="rounded-md border bg-background px-2 py-1.5 text-sm"
        value={selectedId ?? ""}
        onChange={(e) => {
          window.location.href = buildUrl(e.target.value);
        }}
      >
        <option value="">All Instructors</option>
        {instructors.map((i) => (
          <option key={i.id} value={i.id}>
            {i.name}
          </option>
        ))}
      </select>
    </div>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let title = "Something went wrong";
  let message = "An unexpected error occurred.";

  if (isRouteErrorResponse(error)) {
    if (error.status === 401) {
      title = "Sign in required";
      message = typeof error.data === "string" ? error.data : "Please sign in.";
    } else if (error.status === 403) {
      title = "Access denied";
      message = typeof error.data === "string" ? error.data : "You don't have permission.";
    } else {
      title = `Error ${error.status}`;
      message = typeof error.data === "string" ? error.data : error.statusText;
    }
  }

  return (
    <div className="flex min-h-[50vh] items-center justify-center p-6">
      <div className="text-center">
        <AlertTriangle className="mx-auto mb-4 size-12 text-muted-foreground" />
        <h1 className="mb-2 text-2xl font-bold">{title}</h1>
        <p className="mb-6 text-muted-foreground">{message}</p>
        <Link to="/instructor">
          <button className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90">
            Back to Dashboard
          </button>
        </Link>
      </div>
    </div>
  );
}

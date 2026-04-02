import { Link } from "react-router";
import type { Route } from "./+types/instructor.$courseId.analytics";
import { getCurrentUserId } from "~/lib/session";
import { getUserById } from "~/services/userService";
import { getCourseById } from "~/services/courseService";
import { UserRole } from "~/db/schema";
import {
  sinceDate,
  getRevenueSeries,
  getRevenueByCountry,
  getEnrollmentSeries,
  getCourseCompletionRate,
  getLessonDropoff,
  getVideoAbandonment,
  getQuizStats,
  type TimeRange,
} from "~/services/analyticsService";
import { TimeRangeSelector } from "~/components/time-range-selector";
import { RevenueChart } from "~/components/revenue-chart";
import { EnrollmentChart } from "~/components/enrollment-chart";
import { CountryRevenueTable } from "~/components/country-revenue-table";
import { LessonDropoffChart } from "~/components/lesson-dropoff-chart";
import { VideoAbandonmentChart } from "~/components/video-abandonment-chart";
import { QuizPassRateTable } from "~/components/quiz-pass-rate-table";
import { Card, CardContent, CardHeader } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import { BarChart2, AlertTriangle } from "lucide-react";
import { data, isRouteErrorResponse } from "react-router";
import * as v from "valibot";
import { parseParams } from "~/lib/validation";

const paramsSchema = v.object({
  courseId: v.pipe(v.unknown(), v.transform(Number), v.integer()),
});

const VALID_RANGES: TimeRange[] = ["7d", "30d", "90d", "all"];

function parseRange(value: string | null): TimeRange {
  if (value && (VALID_RANGES as string[]).includes(value)) return value as TimeRange;
  return "30d";
}

export function meta({ data: loaderData }: Route.MetaArgs) {
  const title = loaderData?.course?.title ?? "Course";
  return [
    { title: `${title} Analytics — Cadence` },
    { name: "description", content: `Analytics for ${title}` },
  ];
}

export async function loader({ params, request }: Route.LoaderArgs) {
  const currentUserId = await getCurrentUserId(request);
  if (!currentUserId) throw data("Sign in required.", { status: 401 });

  const user = getUserById(currentUserId);
  if (!user || (user.role !== UserRole.Instructor && user.role !== UserRole.Admin)) {
    throw data("Only instructors and admins can access this page.", { status: 403 });
  }

  const { courseId } = parseParams(params, paramsSchema);
  const course = getCourseById(courseId);
  if (!course) throw data("Course not found.", { status: 404 });

  // Instructors can only view their own courses; admins can view any
  if (user.role !== UserRole.Admin && course.instructorId !== user.id) {
    throw data("You don't have permission to view this course's analytics.", { status: 403 });
  }

  const url = new URL(request.url);
  const range = parseRange(url.searchParams.get("range"));
  const since = sinceDate(range);

  const revenueSeries = getRevenueSeries({ courseId, since });
  const enrollmentSeries = getEnrollmentSeries({ courseId, since });
  const revenueByCountry = getRevenueByCountry({ courseId, since });
  const completionRate = getCourseCompletionRate({ courseId });
  const lessonDropoff = getLessonDropoff({ courseId });
  const videoAbandonment = getVideoAbandonment({ courseId });
  const quizStats = getQuizStats({ courseId });

  return {
    course: { id: course.id, title: course.title },
    revenueSeries,
    enrollmentSeries,
    revenueByCountry,
    completionRate,
    lessonDropoff,
    videoAbandonment,
    quizStats,
    selectedRange: range,
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
      <Skeleton className="h-9 w-72" />
      <Skeleton className="h-10 w-72" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-56" />
        <Skeleton className="h-56" />
      </div>
      <Skeleton className="h-64" />
      <Skeleton className="h-48" />
    </div>
  );
}

export default function PerCourseAnalytics({ loaderData }: Route.ComponentProps) {
  const {
    course,
    revenueSeries,
    enrollmentSeries,
    revenueByCountry,
    completionRate,
    lessonDropoff,
    videoAbandonment,
    quizStats,
    selectedRange,
  } = loaderData;

  const totalRevenue = revenueSeries.reduce((s, r) => s + r.amountCents, 0);
  const totalEnrollments = enrollmentSeries.reduce((s, r) => s + r.count, 0);

  return (
    <div className="mx-auto max-w-7xl p-6 lg:p-8 space-y-8">
      {/* Breadcrumb */}
      <nav className="text-sm text-muted-foreground">
        <Link to="/" className="hover:text-foreground">Home</Link>
        <span className="mx-2">/</span>
        <Link to="/instructor" className="hover:text-foreground">My Courses</Link>
        <span className="mx-2">/</span>
        <Link to="/instructor/courses/analytics" className="hover:text-foreground">Analytics</Link>
        <span className="mx-2">/</span>
        <span className="text-foreground">{course.title}</span>
      </nav>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <BarChart2 className="size-8" />
            {course.title}
          </h1>
          <p className="mt-1 text-muted-foreground">Course analytics</p>
        </div>
        <TimeRangeSelector selectedRange={selectedRange} />
      </div>

      {/* Summary stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <p className="text-sm text-muted-foreground">Revenue ({selectedRange === "all" ? "all time" : selectedRange})</p>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{formatCurrency(totalRevenue)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <p className="text-sm text-muted-foreground">Enrollments ({selectedRange === "all" ? "all time" : selectedRange})</p>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{totalEnrollments}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <p className="text-sm text-muted-foreground">Completion rate (overall)</p>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{Math.round(completionRate * 100)}%</p>
          </CardContent>
        </Card>
      </div>

      {/* Revenue & Enrollment charts */}
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

      {/* Lesson drop-off */}
      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold">Lesson drop-off</h2>
          <p className="text-sm text-muted-foreground">Completion rate per lesson, in order</p>
        </CardHeader>
        <CardContent>
          <LessonDropoffChart data={lessonDropoff} />
        </CardContent>
      </Card>

      {/* Video abandonment */}
      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold">Video abandonment</h2>
          <p className="text-sm text-muted-foreground">Where students stop watching (only lessons with recorded events shown)</p>
        </CardHeader>
        <CardContent>
          <VideoAbandonmentChart data={videoAbandonment} />
        </CardContent>
      </Card>

      {/* Quiz stats */}
      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold">Quiz performance</h2>
          <p className="text-sm text-muted-foreground">Click a quiz to expand per-question breakdown</p>
        </CardHeader>
        <CardContent>
          <QuizPassRateTable data={quizStats} />
        </CardContent>
      </Card>
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
    } else if (error.status === 404) {
      title = "Course not found";
      message = typeof error.data === "string" ? error.data : "This course does not exist.";
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
        <Link to="/instructor/courses/analytics">
          <button className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90">
            Back to Analytics
          </button>
        </Link>
      </div>
    </div>
  );
}

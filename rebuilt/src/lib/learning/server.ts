import "server-only";
import { booksSnapshot } from "./books";
import { promotionsSnapshot } from "./promotions";
import { reportFilters, reportsSnapshot } from "./reports";
import { gradesSnapshot, gradeFilters } from "./grades";
import { createAuthAdmin } from "@/lib/auth/admin";
import { AccessDenied } from "@/lib/auth/authorization";
import {
  learningFilters,
  learningSnapshot,
  type LearningModule,
} from "./validation";
import type { Json } from "@/lib/supabase/cloud.types";
export async function learningData(
  actor: string,
  session: string,
  domain: LearningModule,
  filters: unknown = {},
) {
  const parsed: ReturnType<typeof learningFilters.parse> =
      domain === "grades"
        ? gradeFilters.parse(filters)
        : domain === "reports"
          ? reportFilters.parse(filters)
          : learningFilters.parse(filters),
    r = await createAuthAdmin().rpc("app_learning_read", {
      p_actor: actor,
      p_session: session,
      p_module: domain,
      p_filters: parsed as Json,
    });
  if (r.error) throw new Error("Unavailable");
  if (!r.data) throw new AccessDenied();
  if (domain === "grades") {
    try {
      const data = gradesSnapshot.parse(r.data);
      if (parsed.semester && data.semester !== parsed.semester)
        throw Error("Period mismatch");
      let catalog = data;
      if (parsed.studentId && parsed.classId) {
        const full = await createAuthAdmin().rpc("app_learning_read", {
          p_actor: actor,
          p_session: session,
          p_module: domain,
          p_filters: {
            classId: parsed.classId,
            ...(parsed.subjectId ? { subjectId: parsed.subjectId } : {}),
            semester: data.semester,
          },
        });
        if (full.error || !full.data) throw Error("Roster unavailable");
        catalog = gradesSnapshot.parse(full.data);
        if (
          catalog.revision !== data.revision ||
          catalog.semester !== data.semester
        )
          throw Error("Roster changed");
      }
      data.extra.entryPeople = catalog.people.filter(
        (p) => !parsed.classId || p.class_id === parsed.classId,
      );
      data.extra.scope = {
        ...(parsed.classId ? { classId: parsed.classId } : {}),
        ...(parsed.subjectId ? { subjectId: parsed.subjectId } : {}),
        ...(parsed.studentId ? { studentId: parsed.studentId } : {}),
        semester: data.semester,
      };
      return data;
    } catch {
      throw Error("Grades unavailable");
    }
  }
  if (domain === "reports") {
    try {
      const raw = learningSnapshot.parse(r.data);
      const scope = { ...reportFilters.parse(parsed), semester: raw.semester };
      if (parsed.semester && raw.semester !== parsed.semester)
        throw Error("Report period mismatch");
      return reportsSnapshot.parse({ ...raw, extra: { ...raw.extra, scope } });
    } catch {
      throw Error("Reports unavailable");
    }
  }
  if (domain === "promotions") {
    try {
      return promotionsSnapshot.parse(r.data);
    } catch {
      throw Error("Promotions unavailable");
    }
  }
  try {
    return booksSnapshot.parse(r.data);
  } catch {
    throw Error("Books unavailable");
  }
}

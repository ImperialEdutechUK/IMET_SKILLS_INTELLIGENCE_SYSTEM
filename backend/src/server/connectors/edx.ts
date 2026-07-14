/**
 * EdxCourseCatalogConnector — official edX Discovery API (OAuth2 client
 * credentials). Enabled only when EDX_CLIENT_ID / EDX_CLIENT_SECRET exist.
 *
 * Env:
 *   EDX_CLIENT_ID, EDX_CLIENT_SECRET   OAuth2 client credentials
 *   EDX_API_BASE                       default "https://api.edx.org"
 *   EDX_DISCOVERY_BASE                 default "https://discovery.edx.org"
 */
import type { CourseCatalogueInput, CourseSourceConnector, ExternalCourse } from "./types";

export class EdxCourseCatalogConnector implements CourseSourceConnector {
  sourceName = "edx";

  isConfigured(): boolean {
    return !!(process.env.EDX_CLIENT_ID && process.env.EDX_CLIENT_SECRET);
  }

  private async getToken(): Promise<string> {
    const base = process.env.EDX_API_BASE?.replace(/\/$/, "") || "https://api.edx.org";
    const res = await fetch(`${base}/oauth2/v1/access_token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: process.env.EDX_CLIENT_ID as string,
        client_secret: process.env.EDX_CLIENT_SECRET as string,
        token_type: "jwt",
      }),
    });
    if (!res.ok) throw new Error(`edX auth failed (${res.status}): ${(await res.text()).slice(0, 300)}`);
    const data = (await res.json()) as { access_token?: string };
    if (!data.access_token) throw new Error("edX auth returned no access_token.");
    return data.access_token;
  }

  async fetchCourses(query?: string): Promise<ExternalCourse[]> {
    if (!this.isConfigured()) {
      throw new Error("edX connector is not configured (EDX_CLIENT_ID / EDX_CLIENT_SECRET missing).");
    }
    const token = await this.getToken();
    const discovery = process.env.EDX_DISCOVERY_BASE?.replace(/\/$/, "") || "https://discovery.edx.org";
    const url = new URL(`${discovery}/api/v1/courses/`);
    if (query) url.searchParams.set("q", query);
    url.searchParams.set("limit", "50");

    const res = await fetch(url, { headers: { Authorization: `JWT ${token}` } });
    if (!res.ok) throw new Error(`edX course fetch failed (${res.status}): ${(await res.text()).slice(0, 300)}`);
    const data = (await res.json()) as { results?: EdxCourse[] };

    return (data.results ?? []).map((c) => this.toExternal(c));
  }

  private toExternal(c: EdxCourse): ExternalCourse {
    const run = c.course_runs?.[0];
    return {
      title: c.title,
      provider: c.owners?.[0]?.name ?? "edX",
      url: c.marketing_url ?? undefined,
      description: c.short_description ?? c.full_description ?? undefined,
      skills: c.skill_names ?? [],
      level: c.level_type ?? run?.level_type ?? undefined,
      durationHours: run?.estimated_hours ?? undefined,
      costType: run?.type === "verified" || run?.type === "professional" ? "paid" : "free",
      language: run?.content_language ?? "English",
      externalId: c.key ?? c.uuid,
      raw: c,
    };
  }

  normalizeCourse(course: ExternalCourse): CourseCatalogueInput {
    return {
      title: course.title.trim(),
      description: course.description,
      provider: course.provider ?? "edX",
      source: "edx",
      externalSource: this.sourceName,
      externalId: course.externalId,
      externalUrl: course.url,
      level: course.level,
      durationHours: course.durationHours,
      cpdHours: course.durationHours ?? 0,
      costType: course.costType,
      language: course.language ?? "English",
      rating: course.rating,
      approved: false, // requires human approval before recommendation
      preferredProvider: false,
      availableToOrg: false,
      skills: course.skills ?? [],
    };
  }
}

interface EdxCourse {
  key?: string;
  uuid?: string;
  title: string;
  short_description?: string;
  full_description?: string;
  level_type?: string;
  marketing_url?: string;
  skill_names?: string[];
  owners?: { name: string }[];
  course_runs?: {
    type?: string;
    level_type?: string;
    estimated_hours?: number;
    content_language?: string;
  }[];
}

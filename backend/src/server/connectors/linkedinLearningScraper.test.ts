import { describe, it, expect } from "vitest";
import { parseCoursePage, slugFromUrl } from "./linkedinLearningScraper";
import { toExternalCourse } from "./linkedinLearningCatalog";
import { isCandidateSlug } from "./linkedinLearningEnumerate";
import { parseIsoDuration } from "./duration";

// A trimmed but faithful copy of a real /learning/{slug} page: one Course
// JSON-LD block, one BreadcrumbList, and the skill-pill anchor list.
const html = `
<script type="application/ld+json">{"@context":"http://schema.org/","@type":"Course",
"provider":{"@type":"Organization","name":"LinkedIn Learning"},
"hasCourseInstance":{"@type":"CourseInstance","courseWorkload":"PT3H41M22S",
"instructor":[{"@type":"Person","name":"Joe Marini"}]},
"inLanguage":"en","name":"Learning Python",
"offers":[{"@type":"Offer","category":"Subscription"}],
"description":"  Start programming in Python.  ",
"educationalLevel":"Beginner"}</script>
<script type="application/ld+json">{"@context":"http://schema.org/","@type":"BreadcrumbList",
"itemListElement":[{"@type":"ListItem","position":1,"name":"All topics","item":"x"},
{"@type":"ListItem","position":2,"name":"Technology","item":"y"},
{"@type":"ListItem","position":3,"name":"Software Development","item":"z"}]}</script>
<ul class="course-skills__skill-list">
  <li><a href="/learning/search?keywords=Python" class="pill skill-pill"> Python (Programming Language) </a></li>
  <li><a href="/learning/search?keywords=Programming" class="pill skill-pill">Programming</a></li>
</ul>`;

describe("parseIsoDuration", () => {
  it("parses ISO-8601 course workloads to hours", () => {
    expect(parseIsoDuration("PT3H41M22S")).toBe(3.69);
    expect(parseIsoDuration("PT55S")).toBe(0.02);
    expect(parseIsoDuration("PT2H")).toBe(2);
  });

  it("returns undefined for empty or malformed input", () => {
    expect(parseIsoDuration(undefined)).toBeUndefined();
    expect(parseIsoDuration("3 hours")).toBeUndefined();
    expect(parseIsoDuration("PT")).toBeUndefined();
  });
});

describe("parseCoursePage", () => {
  it("pulls every field out of a live course page", () => {
    const c = parseCoursePage("learning-python", html)!;
    expect(c.title).toBe("Learning Python");
    expect(c.description).toBe("Start programming in Python."); // trimmed
    expect(c.provider).toBe("Joe Marini"); // instructor, not the platform
    expect(c.skills).toEqual(["Python (Programming Language)", "Programming"]);
    expect(c.level).toBe("Beginner");
    expect(c.durationHours).toBe(3.69);
    expect(c.language).toBe("English");
    expect(c.costType).toBe("subscription");
    expect(c.category).toBe("Technology"); // breadcrumb position 2
    expect(c.url).toBe("https://www.linkedin.com/learning/learning-python");
  });

  it("returns null when there is no Course JSON-LD (retired/404 shell)", () => {
    expect(parseCoursePage("gone", "<html>Page Not Found</html>")).toBeNull();
  });

  it("falls back to the platform name when no instructor is listed", () => {
    const noInstructor = `<script type="application/ld+json">{"@type":"Course",
      "name":"Solo","hasCourseInstance":{"@type":"CourseInstance"},"inLanguage":"en"}</script>`;
    expect(parseCoursePage("x", noInstructor)?.provider).toBe("LinkedIn Learning");
  });
});

describe("toExternalCourse", () => {
  it("carries the scraped fields and stashes the category on raw", () => {
    const scraped = parseCoursePage("learning-python", html)!;
    const ext = toExternalCourse(scraped);
    expect(ext.externalId).toBe("learning-python");
    expect(ext.costType).toBe("subscription");
    expect((ext.raw as { category?: string }).category).toBe("Technology");
  });
});

describe("isCandidateSlug", () => {
  it("accepts real multi-word course slugs", () => {
    expect(isCandidateSlug("learning-python-2")).toBe(true);
    expect(isCandidateSlug("html-essential-training-22425519")).toBe(true);
  });

  it("rejects feature paths and single-word junk", () => {
    expect(isCandidateSlug("search")).toBe(false);
    expect(isCandidateSlug("topics")).toBe(false);
    expect(isCandidateSlug("python")).toBe(false); // no hyphen
  });
});

describe("slugFromUrl", () => {
  it("recovers the course slug from course and lesson URLs", () => {
    expect(slugFromUrl("https://www.linkedin.com/learning/learning-python-2")).toBe("learning-python-2");
    expect(slugFromUrl("https://www.linkedin.com/learning/learning-python-2/welcome?x=1")).toBe("learning-python-2");
  });

  it("returns undefined for non-learning URLs", () => {
    expect(slugFromUrl("https://www.linkedin.com/feed")).toBeUndefined();
    expect(slugFromUrl(null)).toBeUndefined();
  });
});

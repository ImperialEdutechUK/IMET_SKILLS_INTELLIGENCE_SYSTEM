import { describe, it, expect } from "vitest";
import { extractProduct, parseCoursePage, toCatalogueInput } from "./edxCatalogScraper";

/** Build a page: an og:title meta tag + the course object escaped into flight data. */
function page(obj: Record<string, unknown>, ogTitle = "HarvardX: How to Learn Online"): string {
  const json = JSON.stringify({ _highlightResult: {}, ...obj });
  const escaped = json.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\//g, "\\/");
  // A decoy recommendation object precedes it, to prove we pick the page's own course.
  const decoy = JSON.stringify({ productName: "Some Other Course", productType: "Course" })
    .replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return (
    `<meta property="og:title" content="${ogTitle}">` +
    `<script>self.__next_f.push([1,"…${decoy}…${escaped}…"])</script>`
  );
}

const base = {
  productUuid: "0e575a39-da1e-4e33-bb3b-e96cc6ffc58e",
  productName: "How to Learn Online",
  productType: "Course",
  levelType: "Introductory",
  availability: ["Current"],
  onlyArchivedCourseRuns: false,
  skills: [{ skill: "Metacognition" }, { skill: "Learning Design" }, { skill: "Metacognition" }],
  partners: [{ name: "edX" }],
  subjects: [{ name: "Education & Teacher Training", languageCode: "en" }],
  productUrl: "https://www.edx.org/learn/how-to-learn/edx-how-to-learn-online",
  productShortDescription: "<p>Be a successful online learner.</p>",
  activeCourseRun: { languageId: "en-us", minEffort: 4, maxEffort: 6, weeksToComplete: 2 },
};

describe("extractProduct", () => {
  it("picks the page's own course (matched via og:title), not a recommendation decoy", () => {
    const o = extractProduct(page(base));
    expect(o?.productName).toBe("How to Learn Online");
    expect(o?.productUuid).toBe("0e575a39-da1e-4e33-bb3b-e96cc6ffc58e");
  });

  it("handles HTML entities in og:title", () => {
    const o = extractProduct(page({ ...base, productName: "CS50's Intro" }, "HarvardX: CS50&#x27;s Intro"));
    expect(o?.productName).toBe("CS50's Intro");
  });
});

describe("parseCoursePage", () => {
  it("maps an English, current Course with skills", () => {
    const c = parseCoursePage(page(base))!;
    expect(c.title).toBe("How to Learn Online");
    expect(c.externalId).toBe("0e575a39-da1e-4e33-bb3b-e96cc6ffc58e");
    expect(c.skills).toEqual(["Metacognition", "Learning Design"]); // objects→names, deduped
    expect(c.level).toBe("Beginner"); // Introductory → Beginner
    expect(c.durationHours).toBe(10); // 2 weeks × avg(4,6)
    expect(c.description).toBe("Be a successful online learner."); // html stripped
    expect(c.category).toBe("Education & Teacher Training");
    expect(c.language).toBe("English");
    expect(c.url).toBe("https://www.edx.org/learn/how-to-learn/edx-how-to-learn-online");
  });

  it("drops non-English courses (languageId not en*)", () => {
    expect(parseCoursePage(page({ ...base, activeCourseRun: { languageId: "ar-ae" } }))).toBeNull();
  });

  it("drops archived-only courses", () => {
    expect(parseCoursePage(page({ ...base, onlyArchivedCourseRuns: true }))).toBeNull();
    expect(parseCoursePage(page({ ...base, availability: ["Archived"] }))).toBeNull();
  });

  it("drops non-Course products and skill-less courses", () => {
    expect(parseCoursePage(page({ ...base, productType: "Program" }))).toBeNull();
    expect(parseCoursePage(page({ ...base, skills: [] }))).toBeNull();
  });
});

describe("toCatalogueInput", () => {
  it("normalises to an edX catalogue row", () => {
    const input = toCatalogueInput(parseCoursePage(page(base))!);
    expect(input.source).toBe("edx");
    expect(input.externalSource).toBe("edx");
    expect(input.language).toBe("English");
    expect(input.category).toBe("Education & Teacher Training");
    expect(input.cpdHours).toBe(10);
  });
});

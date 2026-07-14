import { describe, it, expect } from "vitest";
import { humanizeSlug, languageName, toExternalCourse } from "./coursera";
import { parseCoursePage, slugFromUrl } from "./courseraScraper";
import { parseLinkedInDuration, rowToExternalCourse } from "./linkedin";

describe("humanizeSlug", () => {
  it("title-cases slug tokens", () => {
    expect(humanizeSlug("machine-learning")).toBe("Machine Learning");
    expect(humanizeSlug("information-technology")).toBe("Information Technology");
  });

  it("preserves acronyms", () => {
    expect(humanizeSlug("it-support")).toBe("IT Support");
    expect(humanizeSlug("ai")).toBe("AI");
  });
});

describe("languageName", () => {
  it("expands language codes", () => {
    expect(languageName("en")).toBe("English");
    expect(languageName(undefined)).toBeUndefined();
  });

  it("falls back to the raw code for nonsense", () => {
    expect(languageName("zz-ZZ")).toBe("zz-ZZ");
  });
});

describe("toExternalCourse", () => {
  const partners = new Map([["443", "Google Cloud"]]);
  // Shape taken verbatim from a live courses.v1 response.
  const raw = {
    id: "l31la3mKEe-zFg7heHyXOQ",
    slug: "googlecloud-vertex-ai",
    name: "  Getting started with Vertex AI  ",
    description: "A self-paced lab.",
    workload: "1 hour 30 minutes",
    primaryLanguages: ["en"],
    domainTypes: [
      { domainId: "information-technology", subdomainId: "cloud-computing" },
      { domainId: "data-science", subdomainId: "machine-learning" },
    ],
    partnerIds: ["443"],
  };

  it("maps the catalogue row onto an ExternalCourse", () => {
    const c = toExternalCourse(raw, partners);
    expect(c.title).toBe("Getting started with Vertex AI"); // trimmed
    expect(c.provider).toBe("Google Cloud"); // partner, not "Coursera"
    expect(c.url).toBe("https://www.coursera.org/learn/googlecloud-vertex-ai");
    expect(c.externalId).toBe("l31la3mKEe-zFg7heHyXOQ");
    expect(c.durationHours).toBe(1.5);
    expect(c.language).toBe("English");
  });

  it("uses sub-domains as skills and the domain as the category", () => {
    const c = toExternalCourse(raw, partners);
    expect(c.skills).toEqual(["Cloud Computing", "Machine Learning"]);
    expect((c.raw as { category?: string }).category).toBe("Information Technology");
  });

  it("asserts nothing it cannot know", () => {
    const c = toExternalCourse(raw, partners);
    // level, rating and price are page-only; the API never supplies them.
    expect(c.level).toBeUndefined();
    expect(c.rating).toBeUndefined();
    expect(c.costType).toBeUndefined();
  });

  it("falls back to Coursera when the partner is unknown", () => {
    const c = toExternalCourse({ ...raw, partnerIds: ["999"] }, partners);
    expect(c.provider).toBe("Coursera");
  });
});

describe("parseCoursePage", () => {
  const html = `
    <script>{"difficultyLevel":"BEGINNER","skills":["Python Programming","NumPy","  "],
    "averageFiveStarRating":4.895412619127876,"reviewCount":32638}</script>
    <script type="application/ld+json">{"@type":"Review","ratingValue":5}</script>
  `;

  it("extracts skills, level and rating", () => {
    const d = parseCoursePage("machine-learning", html);
    expect(d.skills).toEqual(["Python Programming", "NumPy"]); // blank dropped
    expect(d.level).toBe("Beginner");
    expect(d.rating).toBe(4.9);
    expect(d.reviewCount).toBe(32638);
  });

  it("ignores the bare ratingValue from FAQ/Review JSON-LD", () => {
    // A naive `"ratingValue"` regex would read 5 from the Review block.
    expect(parseCoursePage("x", html).rating).not.toBe(5);
  });

  it("maps MIXED difficulty to no level rather than a wrong one", () => {
    expect(parseCoursePage("x", '{"difficultyLevel":"MIXED"}').level).toBeUndefined();
  });

  it("survives a page with none of the fields", () => {
    const d = parseCoursePage("x", "<html><body>nothing here</body></html>");
    expect(d).toEqual({ slug: "x", skills: [] });
  });

  it("does not throw on a malformed skills blob", () => {
    expect(parseCoursePage("x", '"skills":[not json]').skills).toEqual([]);
  });
});

describe("slugFromUrl", () => {
  it("recovers the slug from every course URL shape", () => {
    expect(slugFromUrl("https://www.coursera.org/learn/machine-learning")).toBe("machine-learning");
    expect(slugFromUrl("https://www.coursera.org/projects/foo?x=1")).toBe("foo");
    expect(slugFromUrl("https://www.coursera.org/specializations/bar#z")).toBe("bar");
  });

  it("returns undefined for non-Coursera urls", () => {
    expect(slugFromUrl("https://edx.org/course/x")).toBeUndefined();
    expect(slugFromUrl(null)).toBeUndefined();
  });
});

describe("LinkedIn export mapping", () => {
  it("reads seconds from a column that names its unit", () => {
    expect(parseLinkedInDuration({ "Duration (seconds)": 5400 })).toBe(1.5);
  });

  it("treats a plain Duration column as hours", () => {
    expect(parseLinkedInDuration({ Duration: 2 })).toBe(2);
  });

  it("parses h:mm:ss runtimes", () => {
    expect(parseLinkedInDuration({ Duration: "01:30:00" })).toBe(1.5);
  });

  it("maps an exported row, tolerating column spellings", () => {
    const c = rowToExternalCourse({
      "Course Title": "Python Essential Training",
      "Course URL": "https://www.linkedin.com/learning/python-essential-training",
      Skills: "Python; Programming, Debugging",
      Difficulty: "Beginner",
      "Duration (seconds)": 7200,
      "Content ID": "urn:li:course:123",
    });
    expect(c?.title).toBe("Python Essential Training");
    expect(c?.skills).toEqual(["Python", "Programming", "Debugging"]);
    expect(c?.durationHours).toBe(2);
    expect(c?.level).toBe("Beginner");
    expect(c?.externalId).toBe("urn:li:course:123");
    expect(c?.costType).toBe("subscription");
  });

  it("rejects a row with no title", () => {
    expect(rowToExternalCourse({ "Course URL": "https://x" })).toBeNull();
  });
});

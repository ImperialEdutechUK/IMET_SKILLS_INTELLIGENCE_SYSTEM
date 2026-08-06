import { describe, it, expect } from "vitest";
import {
  NON_LATIN_TITLE,
  PAGE_SIZE,
  VISIBLE,
  catalogueCacheKey,
  catalogueOrderBy,
  catalogueWhere,
  isFiltered,
  parseCatalogueFilters,
} from "./catalogue";

const parse = (query: string) => parseCatalogueFilters(new URL(`http://x/api/courses/catalogue${query}`));

describe("parseCatalogueFilters", () => {
  it("defaults to page 1, title sort and no filters", () => {
    const f = parse("");
    expect(f).toMatchObject({ q: "", provider: null, categoryId: null, level: null, source: null, cost: null, sort: "title", page: 1 });
  });

  it("keeps whitelisted enum values", () => {
    const f = parse("?level=Advanced&source=edx&cost=free&sort=rating");
    expect(f).toMatchObject({ level: "Advanced", source: "edx", cost: "free", sort: "rating" });
  });

  it("drops values outside the whitelist rather than passing them to Prisma", () => {
    // An unknown enum makes Prisma throw at query time, which would turn a typo
    // in a shared URL into a 500 for whoever opened it.
    const f = parse("?level=Wizard&source=udemy&cost=barter&sort=cheapest");
    expect(f).toMatchObject({ level: null, source: null, cost: null, sort: "title" });
  });

  it("is case-sensitive about levels, matching the stored values", () => {
    expect(parse("?level=beginner").level).toBeNull();
    expect(parse("?level=Beginner").level).toBe("Beginner");
  });

  it("falls back to page 1 for junk, negative or zero pages", () => {
    expect(parse("?page=abc").page).toBe(1);
    expect(parse("?page=-4").page).toBe(1);
    expect(parse("?page=0").page).toBe(1);
    expect(parse("?page=17").page).toBe(17);
  });

  it("truncates a pasted essay to a searchable length", () => {
    expect(parse(`?q=${"a".repeat(500)}`).q).toHaveLength(80);
  });

  it("trims whitespace and treats blank filters as absent", () => {
    const f = parse("?q=%20%20data%20%20&provider=%20&category=%20");
    expect(f.q).toBe("data");
    expect(f.provider).toBeNull();
    expect(f.categoryId).toBeNull();
  });
});

describe("isFiltered", () => {
  it("ignores a one-character query — it matches almost everything and costs a full scan to prove it", () => {
    expect(isFiltered(parse("?q=a"))).toBe(false);
    expect(isFiltered(parse("?q=ai"))).toBe(true);
  });

  it("is false for sort and page alone, which do not narrow anything", () => {
    expect(isFiltered(parse("?sort=rating&page=9"))).toBe(false);
  });

  it("is true for any structured filter", () => {
    expect(isFiltered(parse("?level=Advanced"))).toBe(true);
    expect(isFiltered(parse("?category=cat_1"))).toBe(true);
    expect(isFiltered(parse("?provider=Coursera"))).toBe(true);
  });
});

describe("catalogueWhere", () => {
  it("always applies the visibility gate, so un-approved scrape rows can never leak", () => {
    expect(catalogueWhere(parse(""))).toMatchObject(VISIBLE);
    expect(catalogueWhere(parse("?q=python&level=Advanced"))).toMatchObject(VISIBLE);
  });

  it("searches title and provider only — never the long TOASTed text columns", () => {
    const where = catalogueWhere(parse("?q=python"));
    expect(where.OR).toEqual([
      { title: { contains: "python", mode: "insensitive" } },
      { provider: { contains: "python", mode: "insensitive" } },
    ]);
  });

  it("does not build a search clause for a one-character query", () => {
    expect(catalogueWhere(parse("?q=p")).OR).toBeUndefined();
  });

  it("excludes hidden course ids when given, and omits the clause when the list is empty", () => {
    expect(catalogueWhere(parse(""), ["c1", "c2"]).id).toEqual({ notIn: ["c1", "c2"] });
    expect(catalogueWhere(parse(""), []).id).toBeUndefined();
    expect(catalogueWhere(parse("")).id).toBeUndefined();
  });

  it("composes every filter into one AND-ed where", () => {
    const where = catalogueWhere(parse("?provider=Packt&category=cat_1&level=Beginner&source=coursera&cost=free"));
    expect(where).toMatchObject({
      approved: true,
      status: "published",
      provider: "Packt",
      categoryId: "cat_1",
      level: "Beginner",
      source: "coursera",
      costType: "free",
    });
  });
});

describe("NON_LATIN_TITLE", () => {
  // The constant is one string interpreted by two engines; these tests run it
  // as a JS RegExp, which shares the \uXXXX class syntax with Postgres AREs.
  const nonLatin = new RegExp(NON_LATIN_TITLE, "u");

  it("flags titles written in a non-Latin script", () => {
    expect(nonLatin.test("神经光子学")).toBe(true);
    expect(nonLatin.test("إدارة الرياضيات الإلكترونية")).toBe(true);
    expect(nonLatin.test("Gemini in Google Sheets - 한국어")).toBe(true);
    expect(nonLatin.test("Introduction to Generative AI Studio - בעברית")).toBe(true);
    expect(nonLatin.test("Conversational English Skills | 生活英语听说")).toBe(true);
  });

  it("keeps English titles, including accents, curly quotes and Ⅰ/™", () => {
    expect(nonLatin.test("z/OS System Services Structure")).toBe(false);
    expect(nonLatin.test("A Beginner’s Guide to Café Culture — Part Ⅰ™")).toBe(false);
    expect(nonLatin.test("Krzysztof's Advanced C++ (2024–2026)")).toBe(false);
  });
});

describe("catalogueOrderBy", () => {
  it("tie-breaks every sort on title so a row cannot appear on two pages", () => {
    for (const sort of ["title", "rating", "newest", "shortest"] as const) {
      const order = catalogueOrderBy(sort);
      expect(order[order.length - 1]).toEqual({ title: "asc" });
    }
  });

  it("sorts unrated and unlengthed courses last rather than first", () => {
    expect(catalogueOrderBy("rating")[0]).toEqual({ rating: { sort: "desc", nulls: "last" } });
    expect(catalogueOrderBy("shortest")[0]).toEqual({ durationHours: { sort: "asc", nulls: "last" } });
  });
});

describe("catalogueCacheKey", () => {
  it("is identical for two users asking the same question — otherwise the shared cache never hits", () => {
    expect(catalogueCacheKey(parse("?q=Python&level=Beginner"), "rows"))
      .toBe(catalogueCacheKey(parse("?q=python&level=Beginner"), "rows"));
  });

  it("separates rows from counts", () => {
    const f = parse("?q=python");
    expect(catalogueCacheKey(f, "rows")).not.toBe(catalogueCacheKey(f, "count"));
  });

  it("ignores sort and page for a count, which they cannot change", () => {
    expect(catalogueCacheKey(parse("?q=python&sort=rating&page=4"), "count"))
      .toBe(catalogueCacheKey(parse("?q=python&sort=title&page=1"), "count"));
  });

  it("separates rows by sort and by page", () => {
    expect(catalogueCacheKey(parse("?q=python&sort=rating"), "rows"))
      .not.toBe(catalogueCacheKey(parse("?q=python&sort=title"), "rows"));
    expect(catalogueCacheKey(parse("?q=python&page=2"), "rows"))
      .not.toBe(catalogueCacheKey(parse("?q=python&page=3"), "rows"));
  });

  it("does not collide when a value contains the field separator", () => {
    expect(catalogueCacheKey(parse("?provider=a%7Cb"), "count"))
      .not.toBe(catalogueCacheKey(parse("?provider=a&category=b"), "count"));
  });
});

describe("PAGE_SIZE", () => {
  it("divides cleanly into the 2, 3 and 4 column grids the page renders", () => {
    for (const columns of [2, 3, 4]) expect(PAGE_SIZE % columns).toBe(0);
  });
});

import type { WilcomDesignSearchResponse } from "@/app/design-lookup/types";

export const WILCOM_DESIGN_SEARCH_PARAMS = [
  "name",
  "reference",
  "customer",
  "category",
  "status",
  "digitizer",
  "keyword",
  "style",
  "dateFrom",
  "dateTo",
  "limit",
] as const;

export type WilcomDesignSearchParam = (typeof WILCOM_DESIGN_SEARCH_PARAMS)[number];

export type WilcomDesignSearchInput = Partial<
  Record<WilcomDesignSearchParam, string | number | null | undefined>
>;

function clampLimit(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 50;
  return Math.min(Math.trunc(n), 100);
}

function getSearchUrl() {
  const url =
    process.env.WILCOM_DESIGNS_SEARCH_URL?.trim() ||
    "https://capamerica.biz/api/wilcom/designs/search";

  try {
    return new URL(url);
  } catch {
    throw new Error("Wilcom search URL is not configured correctly.");
  }
}

export async function searchWilcomDesigns(
  input: WilcomDesignSearchInput
): Promise<WilcomDesignSearchResponse> {
  const apiKey = process.env.WILCOM_API_KEY?.trim();

  if (!apiKey) {
    throw new Error("Wilcom API key is not configured.");
  }

  const url = getSearchUrl();

  for (const key of WILCOM_DESIGN_SEARCH_PARAMS) {
    if (key === "limit") continue;

    const rawValue = input[key];
    const value = rawValue == null ? "" : String(rawValue).trim();

    if (value) {
      url.searchParams.set(key, value);
    }
  }

  url.searchParams.set("limit", String(clampLimit(input.limit)));

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Accept: "application/json",
      "x-api-key": apiKey,
    },
    cache: "no-store",
  });

  const text = await res.text();

  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (!res.ok) {
    const message =
      typeof data === "object" &&
      data !== null &&
      "error" in data &&
      typeof (data as { error?: unknown }).error === "string"
        ? (data as { error: string }).error
        : text?.slice(0, 300) || "Wilcom design lookup failed.";

    throw new Error(message);
  }

  if (Array.isArray(data)) {
    return {
      count: data.length,
      results: data as WilcomDesignSearchResponse["results"],
    };
  }

  if (
    typeof data === "object" &&
    data !== null &&
    Array.isArray((data as WilcomDesignSearchResponse).results)
  ) {
    const payload = data as WilcomDesignSearchResponse;

    return {
      count: Number.isFinite(Number(payload.count))
        ? Number(payload.count)
        : payload.results.length,
      results: payload.results,
    };
  }

  return {
    count: 0,
    results: [],
  };
}
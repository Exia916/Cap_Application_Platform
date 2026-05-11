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

function safeUrlForLog(url: URL) {
  const copy = new URL(url.toString());
  return copy.toString();
}

function isSelfReferencingUrl(url: URL) {
  const host = url.hostname.toLowerCase();

  return (
    host === "app.capamerica.net" ||
    host.endsWith(".vercel.app")
  );
}

export async function searchWilcomDesigns(
  input: WilcomDesignSearchInput
): Promise<WilcomDesignSearchResponse> {
  const apiKey = process.env.WILCOM_API_KEY?.trim();

  if (!apiKey) {
    console.error("[WilcomDesigns] Missing WILCOM_API_KEY environment variable.");
    throw new Error("Wilcom API key is not configured.");
  }

  const url = getSearchUrl();

  if (isSelfReferencingUrl(url)) {
    console.error(
      "[WilcomDesigns] WILCOM_DESIGNS_SEARCH_URL appears to point back to CAP/Vercel. This would cause a recursive API call.",
      {
        configuredUrl: safeUrlForLog(url),
      }
    );

    throw new Error("Wilcom search URL is pointing back to CAP instead of the Wilcom service.");
  }

  for (const key of WILCOM_DESIGN_SEARCH_PARAMS) {
    if (key === "limit") continue;

    const rawValue = input[key];
    const value = rawValue == null ? "" : String(rawValue).trim();

    if (value) {
      url.searchParams.set(key, value);
    }
  }

  url.searchParams.set("limit", String(clampLimit(input.limit)));

  let res: Response;

  try {
    res = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Accept: "application/json",
        "x-api-key": apiKey,
      },
      cache: "no-store",
    });
  } catch (err: any) {
    console.error("[WilcomDesigns] Fetch to external Wilcom endpoint failed.", {
      url: safeUrlForLog(url),
      errorName: err?.name,
      errorMessage: err?.message,
      errorCause: err?.cause,
    });

    throw new Error(
      "Unable to reach the Wilcom design lookup service from the CAP server."
    );
  }

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
        : text?.slice(0, 500) || "Wilcom design lookup failed.";

    console.error("[WilcomDesigns] External Wilcom endpoint returned an error.", {
      url: safeUrlForLog(url),
      status: res.status,
      statusText: res.statusText,
      responseText: text?.slice(0, 1000),
    });

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

  console.warn("[WilcomDesigns] External Wilcom endpoint returned an unexpected payload.", {
    url: safeUrlForLog(url),
    payloadType: typeof data,
    responseText: text?.slice(0, 1000),
  });

  return {
    count: 0,
    results: [],
  };
}
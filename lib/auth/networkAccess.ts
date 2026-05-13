import type { NextRequest } from "next/server";

export type NetworkAccessType = "onsite" | "offsite" | "unknown";

export type NetworkAccessResult = {
  clientIp: string | null;
  accessType: NetworkAccessType;
  isOnsite: boolean;
  isOffsite: boolean;
  matchedRule: string | null;
  configuredRules: string[];
  reason: string | null;
};

function cleanIp(value: string | null | undefined): string | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;

  const first = raw.split(",")[0]?.trim() || raw;

  // Strip IPv6-mapped IPv4 prefix if present.
  if (first.startsWith("::ffff:")) return first.slice("::ffff:".length);

  return first;
}

export function getClientIpFromRequest(req: NextRequest | Request): string | null {
  return (
    cleanIp(req.headers.get("x-forwarded-for")) ||
    cleanIp(req.headers.get("x-real-ip")) ||
    cleanIp(req.headers.get("cf-connecting-ip")) ||
    cleanIp(req.headers.get("true-client-ip")) ||
    null
  );
}

function parseIpv4(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;

  const nums = parts.map((p) => Number(p));
  if (nums.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null;

  return (
    ((nums[0] << 24) >>> 0) +
    ((nums[1] << 16) >>> 0) +
    ((nums[2] << 8) >>> 0) +
    (nums[3] >>> 0)
  ) >>> 0;
}

function cidrMatches(ip: string, cidr: string): boolean {
  const cleanRule = cidr.trim();
  if (!cleanRule) return false;

  const [ruleIp, prefixRaw] = cleanRule.includes("/")
    ? cleanRule.split("/")
    : [cleanRule, "32"];

  const ipNum = parseIpv4(ip);
  const ruleNum = parseIpv4(ruleIp);

  if (ipNum == null || ruleNum == null) return false;

  const prefix = Number(prefixRaw);
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32) return false;

  if (prefix === 0) return true;

  const mask = (0xffffffff << (32 - prefix)) >>> 0;

  return (ipNum & mask) === (ruleNum & mask);
}

export function getConfiguredOnsiteCidrs(): string[] {
  return String(process.env.CAP_ONSITE_CIDRS ?? "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

export function assessNetworkAccess(req: NextRequest | Request): NetworkAccessResult {
  const clientIp = getClientIpFromRequest(req);
  const configuredRules = getConfiguredOnsiteCidrs();

  if (!clientIp) {
    return {
      clientIp: null,
      accessType: "unknown",
      isOnsite: false,
      isOffsite: false,
      matchedRule: null,
      configuredRules,
      reason: "NO_CLIENT_IP_DETECTED",
    };
  }

  if (configuredRules.length === 0) {
    return {
      clientIp,
      accessType: "unknown",
      isOnsite: false,
      isOffsite: false,
      matchedRule: null,
      configuredRules,
      reason: "NO_ONSITE_CIDRS_CONFIGURED",
    };
  }

  const matchedRule = configuredRules.find((rule) => cidrMatches(clientIp, rule)) ?? null;

  if (matchedRule) {
    return {
      clientIp,
      accessType: "onsite",
      isOnsite: true,
      isOffsite: false,
      matchedRule,
      configuredRules,
      reason: null,
    };
  }

  return {
    clientIp,
    accessType: "offsite",
    isOnsite: false,
    isOffsite: true,
    matchedRule: null,
    configuredRules,
    reason: "CLIENT_IP_DID_NOT_MATCH_ONSITE_CIDRS",
  };
}

export function getOffsiteSecurityQuestionsMode():
  | "off"
  | "audit"
  | "enroll"
  | "enforce" {
  const mode = String(process.env.OFFSITE_SECURITY_QUESTIONS_MODE ?? "off")
    .trim()
    .toLowerCase();

  if (mode === "audit" || mode === "enroll" || mode === "enforce") return mode;
  return "off";
}
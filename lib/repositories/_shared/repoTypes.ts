export type VoidMode = "exclude" | "include" | "only";

export type StandardRepoOptions = {
  includeVoided?: boolean;
  onlyVoided?: boolean;
};

export function resolveVoidMode(opts?: StandardRepoOptions): VoidMode {
  if (opts?.onlyVoided) return "only";
  if (opts?.includeVoided) return "include";
  return "exclude";
}
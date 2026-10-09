export const DEFAULT_API_ORIGIN = "http://127.0.0.1:8787";

export function normalizeApiOrigin(value: string | undefined): string {
  const raw = value?.trim() || DEFAULT_API_ORIGIN;
  let url: URL;

  try {
    url = new URL(raw);
  } catch {
    throw new Error("VITE_CONTEXTLAYER_API_BASE_URL must be a valid HTTP(S) origin.");
  }

  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      "VITE_CONTEXTLAYER_API_BASE_URL must contain only one HTTP(S) origin without credentials, path, query or hash."
    );
  }

  return url.origin;
}

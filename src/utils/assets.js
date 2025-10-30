const ASSET_ROOT = `${import.meta.env.BASE_URL ?? "/"}models/`;

/**
 * Returns a URL string pointing to an asset within the public/models directory.
 * Leading slashes are stripped and each path segment is encoded to handle spaces.
 *
 * @param {string} relativePath - Path inside the models folder (e.g. "assets/step1.mp3").
 * @returns {string} Resolved URL string.
 */
export function assetUrl(relativePath = "") {
  const trimmed = relativePath.replace(/^\//, "");
  const encoded = trimmed
    .split("/")
    .filter(Boolean)
    .map(encodeURIComponent)
    .join("/");

  return `${ASSET_ROOT}${encoded}`;
}

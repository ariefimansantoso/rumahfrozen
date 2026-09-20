import DOMPurify from "isomorphic-dompurify";

const SAFE_URI_PATTERN =
  /^(?:(?:https?|mailto|tel):|\/(?!\/)|#|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i;

DOMPurify.addHook("afterSanitizeAttributes", (node) => {
  const element = node as Element;
  if (
    typeof element.getAttribute !== "function" ||
    typeof element.removeAttribute !== "function" ||
    typeof element.setAttribute !== "function"
  ) {
    return;
  }

  for (const attr of ["href", "src"]) {
    const value = element.getAttribute(attr);
    if (!value || value.trim().toLowerCase().startsWith("data:")) {
      element.removeAttribute(attr);
    }
  }

  if (element.getAttribute("target") === "_blank") {
    element.setAttribute("rel", "noopener noreferrer");
  }
});

/**
 * Sanitizes untrusted HTML before it is injected via dangerouslySetInnerHTML.
 *
 * Rich-text content (blog posts, content pages, product descriptions) can be
 * authored by vendors or admins and is rendered on the public storefront, so it
 * must be sanitized to prevent stored XSS. This runs in both the Node.js (server
 * components / SSR) and browser environments via isomorphic-dompurify.
 *
 * The allow-list mirrors the formatting produced by the TipTap rich-text editor
 * (headings, lists, links, basic inline formatting, images, tables) and strips
 * anything that can execute script (e.g. <script>, event handlers, javascript:
 * URLs, inline style attributes, or data: images).
 */
export function sanitizeHtml(dirty: string | null | undefined): string {
  if (!dirty) return "";

  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: [
      "a",
      "b",
      "blockquote",
      "br",
      "code",
      "div",
      "em",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "hr",
      "i",
      "img",
      "li",
      "ol",
      "p",
      "pre",
      "s",
      "span",
      "strong",
      "sub",
      "sup",
      "table",
      "tbody",
      "td",
      "th",
      "thead",
      "tr",
      "u",
      "ul",
    ],
    ALLOWED_ATTR: [
      "href",
      "src",
      "alt",
      "title",
      "target",
      "rel",
      "class",
      "colspan",
      "rowspan",
      "width",
      "height",
    ],
    // Only permit safe URL schemes for links and images.
    ALLOWED_URI_REGEXP: SAFE_URI_PATTERN,
    ADD_ATTR: ["target"],
    // Drop unknown / dangerous protocols and ensure noopener on target=_blank.
    FORBID_TAGS: ["script", "style", "iframe", "form", "object", "embed"],
    FORBID_ATTR: ["style", "onerror", "onload", "onclick", "onmouseover"],
  });
}

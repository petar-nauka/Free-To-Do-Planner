import DOMPurify from 'isomorphic-dompurify';
import { cn } from '@/lib/utils';

interface SafeHtmlProps {
  html: string;
  className?: string;
  /**
   * When true, allows iframes for embeds (YouTube, etc).
   * Use only for trusted content sources.
   */
  allowIframes?: boolean;
}

// Allowed tags for rich text rendering (notes, descriptions, comments).
// Intentionally excludes: <script>, <style>, <iframe>, <object>, <embed>,
// <form>, <input>, <button>, etc. that could be used for XSS or phishing.
const ALLOWED_TAGS = [
  'p', 'br', 'hr',
  'strong', 'b', 'em', 'i', 'u', 's', 'del', 'mark',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li',
  'blockquote', 'code', 'pre',
  'a',
  'img',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'span', 'div',
];

// Whitelisted attributes — note: NO `on*` event handlers, NO `style` (could
// hide things, position fixed overlays, etc.), NO `srcdoc`, etc.
const ALLOWED_ATTR = [
  'href', 'target', 'rel',
  'src', 'alt', 'title', 'width', 'height',
  'class',
  'colspan', 'rowspan',
];

// Configure DOMPurify once
const purifyConfig = {
  ALLOWED_TAGS,
  ALLOWED_ATTR,
  // Block dangerous URL schemes (javascript:, data:, vbscript:)
  ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel|ftp):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
  // Prevent DOM clobbering attacks
  SANITIZE_DOM: true,
  // Disallow unknown protocols entirely
  ALLOW_UNKNOWN_PROTOCOLS: false,
  // Force all <a> to have rel="noopener noreferrer" via hook below
};

// Add hook: force safe link attributes on every <a>
let hooksInstalled = false;
function installHooks() {
  if (hooksInstalled || typeof window === 'undefined') return;
  DOMPurify.addHook('afterSanitizeAttributes', (node: Element) => {
    if (node.tagName === 'A') {
      // External links: always open in new tab with noopener
      node.setAttribute('target', '_blank');
      node.setAttribute('rel', 'noopener noreferrer nofollow');
    }
    // Strip any inline event handlers that slipped through
    if ('attributes' in node) {
      for (const attr of Array.from(node.attributes)) {
        if (attr.name.toLowerCase().startsWith('on')) {
          node.removeAttribute(attr.name);
        }
      }
    }
  });
  hooksInstalled = true;
}

installHooks();

/**
 * Sanitize HTML string and return clean HTML.
 * Use this when you need the sanitized string but render manually.
 */
export function sanitizeHtml(html: string): string {
  if (!html) return '';
  return DOMPurify.sanitize(html, purifyConfig);
}

/**
 * Render untrusted HTML safely. Uses DOMPurify to strip <script>,
 * event handlers, dangerous URLs, and other XSS vectors.
 */
export function SafeHtml({ html, className }: SafeHtmlProps) {
  const clean = sanitizeHtml(html);
  return (
    <div
      className={cn('prose prose-sm dark:prose-invert max-w-none break-words [&_a]:text-primary [&_a]:underline', className)}
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  );
}

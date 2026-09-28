/**
 * File upload validation rules.
 * Prevents executable uploads, malware-masked-as-image, oversized files.
 */

// Maximum size in MB
export const DEFAULT_MAX_FILE_SIZE_MB = 50;

// Whitelisted MIME types — categorized for clarity
const ALLOWED_MIME_TYPES = new Set<string>([
  // Images
  'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'image/bmp', 'image/heic', 'image/heif',
  // Documents
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.oasis.opendocument.text',
  'application/vnd.oasis.opendocument.spreadsheet',
  // Text
  'text/plain', 'text/csv', 'text/markdown', 'text/html', 'text/xml',
  'application/json', 'application/xml',
  // Archives (allowed but warned)
  'application/zip', 'application/x-zip-compressed',
  'application/x-7z-compressed', 'application/x-rar-compressed', 'application/x-tar', 'application/gzip',
  // Audio
  'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/webm', 'audio/mp4', 'audio/aac', 'audio/flac',
  // Video
  'video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska',
]);

// Forbidden file extensions — these are blocked regardless of MIME type
// because Windows/some OSes execute based on extension.
const FORBIDDEN_EXTENSIONS = new Set<string>([
  // Windows executables
  'exe', 'msi', 'bat', 'cmd', 'com', 'scr', 'pif', 'vbs', 'vbe', 'wsf', 'wsh', 'cpl',
  // Scripts
  'ps1', 'psm1', 'js', 'jse', 'jar', 'sh', 'bash', 'zsh', 'fish', 'pl', 'py', 'rb', 'php',
  // System
  'dll', 'sys', 'drv', 'ocx',
  // Linux/Mac
  'deb', 'rpm', 'dmg', 'app', 'pkg',
  // Browser-executable
  'hta', 'htaccess', 'phtml',
  // Office macros
  'docm', 'xlsm', 'pptm', 'dotm', 'xltm', 'potm',
]);

export interface FileValidationResult {
  valid: boolean;
  error?: string;
  warning?: string;
}

function getExtension(filename: string): string {
  const idx = filename.lastIndexOf('.');
  if (idx < 0) return '';
  return filename.slice(idx + 1).toLowerCase();
}

export function validateFileUpload(
  file: File,
  options?: { maxSizeMb?: number }
): FileValidationResult {
  const maxSizeMb = options?.maxSizeMb ?? DEFAULT_MAX_FILE_SIZE_MB;
  const maxBytes = maxSizeMb * 1024 * 1024;

  // 1. Filename sanity check
  if (!file.name || file.name.length > 255) {
    return { valid: false, error: 'Невалидно име на файл' };
  }

  // Reject filenames with path traversal sequences or null bytes
  if (file.name.includes('..') || file.name.includes('/') || file.name.includes('\\') || file.name.includes('\0')) {
    return { valid: false, error: 'Името на файла съдържа забранени символи' };
  }

  // 2. Size check
  if (file.size === 0) {
    return { valid: false, error: 'Празен файл (0 байта)' };
  }
  if (file.size > maxBytes) {
    const sizeMb = (file.size / 1024 / 1024).toFixed(1);
    return { valid: false, error: `Файлът е ${sizeMb} MB. Максимум: ${maxSizeMb} MB` };
  }

  // 3. Forbidden extension check (defense against execution)
  const ext = getExtension(file.name);
  if (ext && FORBIDDEN_EXTENSIONS.has(ext)) {
    return { valid: false, error: `Файлове от тип ".${ext}" не са разрешени (изпълним файл / скрипт)` };
  }

  // 4. MIME type whitelist
  const mime = (file.type || '').toLowerCase();
  if (mime && !ALLOWED_MIME_TYPES.has(mime)) {
    // Allow without MIME type — browser sometimes can't determine it for less common formats
    return {
      valid: false,
      error: `MIME тип "${mime}" не е разрешен. Свържете се с администратора ако смятате, че това е грешка.`,
    };
  }

  // 5. Soft warnings for archives (zips often hide malware)
  if (ext === 'zip' || ext === 'rar' || ext === '7z') {
    return {
      valid: true,
      warning: 'Архивите могат да съдържат изпълним код. Уверете се, че знаете подателя.',
    };
  }

  return { valid: true };
}

/**
 * Sanitize filename for storage path — removes path traversal,
 * null bytes, and control chars. Keeps the extension.
 */
export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[\x00-\x1f\x7f]/g, '')
    .replace(/[/\\]/g, '_')
    .replace(/\.{2,}/g, '.')
    .slice(0, 200);
}

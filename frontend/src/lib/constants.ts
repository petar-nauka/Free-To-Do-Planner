export const PROJECT_COLORS = [
  { name: 'red', class: 'bg-project-red' },
  { name: 'orange', class: 'bg-project-orange' },
  { name: 'amber', class: 'bg-project-amber' },
  { name: 'yellow', class: 'bg-project-yellow' },
  { name: 'lime', class: 'bg-project-lime' },
  { name: 'green', class: 'bg-project-green' },
  { name: 'teal', class: 'bg-project-teal' },
  { name: 'cyan', class: 'bg-project-cyan' },
  { name: 'blue', class: 'bg-project-blue' },
  { name: 'indigo', class: 'bg-project-indigo' },
  { name: 'purple', class: 'bg-project-purple' },
  { name: 'pink', class: 'bg-project-pink' },
] as const;

export const PROJECT_ICONS = [
  'folder', 'star', 'heart', 'zap', 'rocket', 'target',
  'briefcase', 'code', 'book', 'music', 'camera', 'home',
] as const;

export const HIGHLIGHT_COLORS = [
  { name: 'yellow', class: 'bg-highlight-yellow' },
  { name: 'green', class: 'bg-highlight-green' },
  { name: 'blue', class: 'bg-highlight-blue' },
  { name: 'pink', class: 'bg-highlight-pink' },
  { name: 'purple', class: 'bg-highlight-purple' },
  { name: 'orange', class: 'bg-highlight-orange' },
  { name: 'red', class: 'bg-highlight-red' },
  { name: 'teal', class: 'bg-highlight-teal' },
  { name: 'gray', class: 'bg-highlight-gray' },
  { name: 'lime', class: 'bg-highlight-lime' },
] as const;

export const TAG_COLORS = PROJECT_COLORS;

export type ProjectColor = typeof PROJECT_COLORS[number]['name'];
export type ProjectIcon = typeof PROJECT_ICONS[number];
export type HighlightColor = typeof HIGHLIGHT_COLORS[number]['name'];
export type TagColor = typeof TAG_COLORS[number]['name'];

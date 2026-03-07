import type { Tool } from '../types/tool';
import type { LibraryTool } from '../types/libraryTool';

export interface ValidationIssue {
  field:    string;
  severity: 'error' | 'warning';
  message:  string;
}

/** Shared validation that covers both hard errors and suspicious-value warnings. */
export function validateTool(
  tool: Pick<Tool, 'description' | 'toolNumber' | 'pocketNumber' | 'geometry' | 'cutting'>,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const geo = tool.geometry;
  const cut = tool.cutting ?? {};

  const fmt = (n: number) => parseFloat(n.toPrecision(6)).toString();

  // ── Errors ──────────────────────────────────────────────────────────────────

  if (!tool.description.trim())
    issues.push({ field: 'description', severity: 'error', message: 'Description is required.' });

  if (!Number.isInteger(tool.toolNumber) || tool.toolNumber < 0)
    issues.push({ field: 'toolNumber', severity: 'error', message: 'Must be a non-negative integer.' });

  if (tool.pocketNumber !== undefined && (!Number.isInteger(tool.pocketNumber) || tool.pocketNumber < 0))
    issues.push({ field: 'pocketNumber', severity: 'error', message: 'Must be a non-negative integer.' });

  if (!geo.diameter || geo.diameter <= 0)
    issues.push({ field: 'diameter', severity: 'error', message: 'Must be greater than 0.' });

  // Length hierarchy
  const { overallLength: ol, bodyLength: bl, fluteLength: fl, shoulderLength: sl } = geo;

  if (bl !== undefined && fl !== undefined && bl < fl)
    issues.push({ field: 'bodyLength', severity: 'error', message: `Must be ≥ flute length (${fmt(fl)}).` });

  if (bl !== undefined && fl !== undefined && sl !== undefined && bl < fl + sl)
    issues.push({ field: 'bodyLength', severity: 'error', message: `Must be ≥ flute + shoulder (${fmt(fl + sl)}).` });

  if (ol !== undefined && bl !== undefined && ol < bl)
    issues.push({ field: 'overallLength', severity: 'error', message: `Must be ≥ body length (${fmt(bl)}).` });

  if (ol !== undefined && fl !== undefined && bl === undefined && ol < fl)
    issues.push({ field: 'overallLength', severity: 'error', message: `Must be ≥ flute length (${fmt(fl)}).` });

  if (ol !== undefined && fl !== undefined && sl !== undefined && bl === undefined && ol < fl + sl)
    issues.push({ field: 'overallLength', severity: 'error', message: `Must be ≥ flute + shoulder (${fmt(fl + sl)}).` });

  // ── Warnings ─────────────────────────────────────────────────────────────────

  if (geo.diameter > 0 && geo.diameter < 0.01)
    issues.push({ field: 'diameter', severity: 'warning', message: 'Unusually small diameter (< 0.01).' });

  if (geo.diameter > 500)
    issues.push({ field: 'diameter', severity: 'warning', message: 'Unusually large diameter (> 500).' });

  if (cut.spindleRpm !== undefined && cut.spindleRpm > 50_000)
    issues.push({ field: 'spindleRpm', severity: 'warning', message: 'Spindle RPM > 50,000 is unusually high.' });

  if (cut.spindleRpm !== undefined && cut.spindleRpm > 0 && !cut.feedCutting)
    issues.push({ field: 'feedCutting', severity: 'warning', message: 'Spindle speed is set but cutting feed is 0.' });

  return issues;
}

// ── Duplicate Detection ───────────────────────────────────────────────────────

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
  return dp[m][n];
}

function strSimilarity(a: string, b: string): number {
  const na = a.toLowerCase().trim(), nb = b.toLowerCase().trim();
  if (na === nb) return 1;
  const max = Math.max(na.length, nb.length);
  return max === 0 ? 1 : 1 - levenshtein(na, nb) / max;
}

export type DuplicateReason = 'same-number' | 'same-diameter-type' | 'similar-description';

export interface DuplicateMatch {
  incomingIndex:       number;
  existingId:          string;
  existingDescription: string;
  reason:              DuplicateReason;
}

export function findDuplicates(
  incoming: Tool[],
  existing: Pick<LibraryTool, 'id' | 'toolNumber' | 'type' | 'geometry' | 'description'>[],
): DuplicateMatch[] {
  const matches: DuplicateMatch[] = [];
  for (let i = 0; i < incoming.length; i++) {
    const t = incoming[i];
    const reported = new Set<string>();
    for (const ex of existing) {
      if (reported.has(ex.id)) continue;
      if (t.toolNumber === ex.toolNumber) {
        matches.push({ incomingIndex: i, existingId: ex.id, existingDescription: ex.description, reason: 'same-number' });
        reported.add(ex.id);
      } else if (t.type === ex.type && Math.abs(t.geometry.diameter - ex.geometry.diameter) < 0.001) {
        matches.push({ incomingIndex: i, existingId: ex.id, existingDescription: ex.description, reason: 'same-diameter-type' });
        reported.add(ex.id);
      } else if (strSimilarity(t.description, ex.description) >= 0.75) {
        matches.push({ incomingIndex: i, existingId: ex.id, existingDescription: ex.description, reason: 'similar-description' });
        reported.add(ex.id);
      }
    }
  }
  return matches;
}

/** Extract only errors as a simple field → message map (for backwards-compat with ToolEditor). */
export type Errors = Partial<Record<string, string>>;

export function getErrors(issues: ValidationIssue[]): Errors {
  const e: Errors = {};
  for (const issue of issues) {
    if (issue.severity === 'error' && !e[issue.field]) {
      e[issue.field] = issue.message;
    }
  }
  return e;
}

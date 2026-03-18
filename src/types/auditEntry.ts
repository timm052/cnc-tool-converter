/**
 * Per-tool field-change audit trail entry stored in IndexedDB.
 * Recorded automatically by LibraryContext.updateTool for every field that changes.
 */
export interface ToolAuditEntry {
  /** UUID */
  id:         string;
  toolId:     string;
  timestamp:  number;
  /** Free-text operator name (no auth required) */
  changedBy?: string;
  /** Fields that changed in this update */
  fields: AuditField[];
}

export interface AuditField {
  field:    string;
  oldValue: unknown;
  newValue: unknown;
}

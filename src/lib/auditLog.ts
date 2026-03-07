// Audit log system for tracking critical changes

export interface AuditEntry {
  id: string;
  userId: string;
  userName: string;
  userRole?: string;
  module: string;
  action: string;
  entityId: string;
  previousValue?: string;
  newValue?: string;
  comment?: string;
  authorizedBy?: string;
  authorizedByRole?: string;
  timestamp: string;
}

const auditLogs: AuditEntry[] = [];

export function addAuditLog(entry: Omit<AuditEntry, 'id' | 'timestamp'>) {
  const log: AuditEntry = {
    ...entry,
    id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
  };
  auditLogs.unshift(log);
  console.log('[AUDIT]', log.module, log.action, log.entityId, log.authorizedBy ? `(auth: ${log.authorizedBy})` : '', log.comment || '');
  return log;
}

export function getAuditLogs(filters?: { module?: string; entityId?: string }) {
  if (!filters) return [...auditLogs];
  return auditLogs.filter(l =>
    (!filters.module || l.module === filters.module) &&
    (!filters.entityId || l.entityId === filters.entityId)
  );
}

/**
 * Audit Logger Service
 * Comprehensive audit trail for all sync operations and system events
 * Provides compliance logging with retention policies
 * @version 1.0.0
 */

import * as fs from 'fs/promises';
import * as path from 'path';

export enum AuditEventType {
  // System events
  SYSTEM_START = 'system_start',
  SYSTEM_STOP = 'system_stop',
  SYSTEM_ERROR = 'system_error',
  CONFIG_CHANGE = 'config_change',

  // Sync events
  SYNC_QUEUED = 'sync_queued',
  SYNC_STARTED = 'sync_started',
  SYNC_COMPLETED = 'sync_completed',
  SYNC_FAILED = 'sync_failed',
  BATCH_SYNC = 'batch_sync',

  // Conflict events
  CONFLICT_DETECTED = 'conflict_detected',
  CONFLICT_RESOLVED = 'conflict_resolved',

  // Data events
  DATA_VALIDATED = 'data_validated',
  DATA_REJECTED = 'data_rejected',
  DATA_MODIFIED = 'data_modified',

  // Security events
  ACCESS_GRANTED = 'access_granted',
  ACCESS_DENIED = 'access_denied',
  AUTHENTICATION_FAILED = 'authentication_failed',

  // Queue events
  QUEUE_OVERFLOW = 'queue_overflow',
  DEAD_LETTER_QUEUE_FULL = 'dead_letter_queue_full',
}

export enum AuditSeverity {
  DEBUG = 'debug',
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical',
}

export interface AuditEvent {
  id?: string;
  type: AuditEventType;
  timestamp: Date;
  severity?: AuditSeverity;
  actor: string;
  action: string;
  resource?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  duration?: number;
  outcome?: 'success' | 'failure';
  metadata?: Record<string, unknown>;
}

export interface AuditQuery {
  startDate?: Date;
  endDate?: Date;
  types?: AuditEventType[];
  actors?: string[];
  resources?: string[];
  severities?: AuditSeverity[];
  outcomes?: Array<'success' | 'failure'>;
  limit?: number;
  offset?: number;
}

export interface AuditLoggerConfig {
  enableFileLogging: boolean;
  logDirectory: string;
  logFileName: string;
  maxFileSize: number;
  maxFiles: number;
  retentionDays: number;
  enableConsoleLogging: boolean;
  enableDatabaseLogging: boolean;
  bufferSize: number;
  flushIntervalMs: number;
  compressOldLogs: boolean;
  encryptLogs: boolean;
}

export interface AuditStatistics {
  totalEvents: number;
  eventsByType: Record<AuditEventType, number>;
  eventsBySeverity: Record<AuditSeverity, number>;
  eventsByOutcome: { success: number; failure: number };
  oldestEvent?: Date;
  newestEvent?: Date;
  averageEventsPerDay: number;
}

/**
 * Comprehensive audit logging service
 */
export class AuditLogger {
  private config: AuditLoggerConfig;
  private eventBuffer: AuditEvent[];
  private eventLog: AuditEvent[];
  private flushTimer?: NodeJS.Timeout;
  private currentLogFile?: string;
  private logFileSize: number;
  private eventCounter: number;

  constructor(config?: Partial<AuditLoggerConfig>) {
    this.config = {
      enableFileLogging: config?.enableFileLogging ?? true,
      logDirectory: config?.logDirectory ?? './logs/audit',
      logFileName: config?.logFileName ?? 'audit.log',
      maxFileSize: config?.maxFileSize ?? 104857600, // 100MB
      maxFiles: config?.maxFiles ?? 10,
      retentionDays: config?.retentionDays ?? 90,
      enableConsoleLogging: config?.enableConsoleLogging ?? true,
      enableDatabaseLogging: config?.enableDatabaseLogging ?? false,
      bufferSize: config?.bufferSize ?? 100,
      flushIntervalMs: config?.flushIntervalMs ?? 5000,
      compressOldLogs: config?.compressOldLogs ?? true,
      encryptLogs: config?.encryptLogs ?? false,
    };

    this.eventBuffer = [];
    this.eventLog = [];
    this.logFileSize = 0;
    this.eventCounter = 0;

    this.initialize();
  }

  /**
   * Initialize audit logger
   */
  private async initialize(): Promise<void> {
    if (this.config.enableFileLogging) {
      await this.ensureLogDirectory();
      this.currentLogFile = this.getCurrentLogFilePath();
      this.logFileSize = await this.getFileSize(this.currentLogFile);
    }

    // Start auto-flush timer
    this.startAutoFlush();

    // Clean up old logs
    this.scheduleLogCleanup();
  }

  /**
   * Log an audit event
   */
  async log(event: AuditEvent): Promise<void> {
    const enrichedEvent: AuditEvent = {
      ...event,
      id: event.id ?? this.generateEventId(),
      timestamp: event.timestamp ?? new Date(),
      severity: event.severity ?? this.determineSeverity(event.type),
    };

    // Add to buffer
    this.eventBuffer.push(enrichedEvent);
    this.eventLog.push(enrichedEvent);
    this.eventCounter++;

    // Console logging
    if (this.config.enableConsoleLogging) {
      this.logToConsole(enrichedEvent);
    }

    // Immediate flush if buffer is full
    if (this.eventBuffer.length >= this.config.bufferSize) {
      await this.flush();
    }

    // Database logging
    if (this.config.enableDatabaseLogging) {
      await this.logToDatabase(enrichedEvent);
    }
  }

  /**
   * Log multiple events in batch
   */
  async logBatch(events: AuditEvent[]): Promise<void> {
    const enrichedEvents = events.map(event => ({
      ...event,
      id: event.id ?? this.generateEventId(),
      timestamp: event.timestamp ?? new Date(),
      severity: event.severity ?? this.determineSeverity(event.type),
    }));

    this.eventBuffer.push(...enrichedEvents);
    this.eventLog.push(...enrichedEvents);
    this.eventCounter += enrichedEvents.length;

    if (this.config.enableConsoleLogging) {
      enrichedEvents.forEach(event => this.logToConsole(event));
    }

    if (this.eventBuffer.length >= this.config.bufferSize) {
      await this.flush();
    }
  }

  /**
   * Flush buffer to disk
   */
  async flush(): Promise<void> {
    if (this.eventBuffer.length === 0) {
      return;
    }

    if (this.config.enableFileLogging) {
      await this.writeToFile(this.eventBuffer);
    }

    this.eventBuffer = [];
  }

  /**
   * Query audit logs
   */
  query(queryParams: AuditQuery): AuditEvent[] {
    let results = [...this.eventLog];

    // Filter by date range
    if (queryParams.startDate) {
      results = results.filter(event => event.timestamp >= queryParams.startDate!);
    }

    if (queryParams.endDate) {
      results = results.filter(event => event.timestamp <= queryParams.endDate!);
    }

    // Filter by types
    if (queryParams.types && queryParams.types.length > 0) {
      results = results.filter(event => queryParams.types!.includes(event.type));
    }

    // Filter by actors
    if (queryParams.actors && queryParams.actors.length > 0) {
      results = results.filter(event => queryParams.actors!.includes(event.actor));
    }

    // Filter by resources
    if (queryParams.resources && queryParams.resources.length > 0) {
      results = results.filter(
        event => event.resource && queryParams.resources!.includes(event.resource)
      );
    }

    // Filter by severities
    if (queryParams.severities && queryParams.severities.length > 0) {
      results = results.filter(
        event => event.severity && queryParams.severities!.includes(event.severity)
      );
    }

    // Filter by outcomes
    if (queryParams.outcomes && queryParams.outcomes.length > 0) {
      results = results.filter(
        event => event.outcome && queryParams.outcomes!.includes(event.outcome)
      );
    }

    // Sort by timestamp (newest first)
    results.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    // Apply pagination
    const offset = queryParams.offset ?? 0;
    const limit = queryParams.limit ?? results.length;

    return results.slice(offset, offset + limit);
  }

  /**
   * Get audit statistics
   */
  getStatistics(): AuditStatistics {
    const eventsByType: Record<AuditEventType, number> = Object.values(AuditEventType).reduce(
      (acc, type) => {
        acc[type] = 0;
        return acc;
      },
      {} as Record<AuditEventType, number>
    );

    const eventsBySeverity: Record<AuditSeverity, number> = Object.values(AuditSeverity).reduce(
      (acc, severity) => {
        acc[severity] = 0;
        return acc;
      },
      {} as Record<AuditSeverity, number>
    );

    const eventsByOutcome = { success: 0, failure: 0 };

    let oldestEvent: Date | undefined;
    let newestEvent: Date | undefined;

    this.eventLog.forEach(event => {
      eventsByType[event.type]++;

      if (event.severity) {
        eventsBySeverity[event.severity]++;
      }

      if (event.outcome) {
        eventsByOutcome[event.outcome]++;
      }

      if (!oldestEvent || event.timestamp < oldestEvent) {
        oldestEvent = event.timestamp;
      }

      if (!newestEvent || event.timestamp > newestEvent) {
        newestEvent = event.timestamp;
      }
    });

    const dayRange = oldestEvent && newestEvent
      ? (newestEvent.getTime() - oldestEvent.getTime()) / (1000 * 60 * 60 * 24)
      : 1;

    return {
      totalEvents: this.eventLog.length,
      eventsByType,
      eventsBySeverity,
      eventsByOutcome,
      oldestEvent,
      newestEvent,
      averageEventsPerDay: this.eventLog.length / dayRange,
    };
  }

  /**
   * Get recent events
   */
  getRecentEvents(limit: number = 100): AuditEvent[] {
    return this.eventLog.slice(-limit).reverse();
  }

  /**
   * Get events by type
   */
  getEventsByType(type: AuditEventType, limit?: number): AuditEvent[] {
    const events = this.eventLog.filter(event => event.type === type);
    return limit ? events.slice(-limit).reverse() : events.reverse();
  }

  /**
   * Get events by severity
   */
  getEventsBySeverity(severity: AuditSeverity, limit?: number): AuditEvent[] {
    const events = this.eventLog.filter(event => event.severity === severity);
    return limit ? events.slice(-limit).reverse() : events.reverse();
  }

  /**
   * Clear audit log (use with caution)
   */
  clear(): void {
    this.eventLog = [];
    this.eventBuffer = [];
    this.eventCounter = 0;
  }

  /**
   * Export audit log to JSON
   */
  async exportToJson(filePath: string, query?: AuditQuery): Promise<void> {
    const events = query ? this.query(query) : this.eventLog;
    const json = JSON.stringify(events, null, 2);

    await fs.writeFile(filePath, json, 'utf-8');
  }

  /**
   * Export audit log to CSV
   */
  async exportToCsv(filePath: string, query?: AuditQuery): Promise<void> {
    const events = query ? this.query(query) : this.eventLog;

    if (events.length === 0) {
      await fs.writeFile(filePath, '', 'utf-8');
      return;
    }

    // CSV header
    const headers = [
      'ID',
      'Timestamp',
      'Type',
      'Severity',
      'Actor',
      'Action',
      'Resource',
      'Outcome',
      'Duration',
    ];

    const csvLines = [headers.join(',')];

    // CSV rows
    events.forEach(event => {
      const row = [
        event.id ?? '',
        event.timestamp.toISOString(),
        event.type,
        event.severity ?? '',
        event.actor,
        event.action,
        event.resource ?? '',
        event.outcome ?? '',
        event.duration?.toString() ?? '',
      ];

      csvLines.push(row.map(field => `"${field}"`).join(','));
    });

    await fs.writeFile(filePath, csvLines.join('\n'), 'utf-8');
  }

  /**
   * Close audit logger and flush remaining events
   */
  async close(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }

    await this.flush();
  }

  // Private helper methods

  private async ensureLogDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.config.logDirectory, { recursive: true });
    } catch (error) {
      console.error('[AuditLogger] Failed to create log directory:', error);
    }
  }

  private getCurrentLogFilePath(): string {
    const timestamp = new Date().toISOString().split('T')[0];
    const fileName = this.config.logFileName.replace('.log', `_${timestamp}.log`);
    return path.join(this.config.logDirectory, fileName);
  }

  private async getFileSize(filePath: string): Promise<number> {
    try {
      const stats = await fs.stat(filePath);
      return stats.size;
    } catch {
      return 0;
    }
  }

  private async writeToFile(events: AuditEvent[]): Promise<void> {
    if (!this.currentLogFile) {
      return;
    }

    try {
      const lines = events.map(event => JSON.stringify(event)).join('\n') + '\n';
      await fs.appendFile(this.currentLogFile, lines, 'utf-8');

      this.logFileSize += Buffer.byteLength(lines, 'utf-8');

      // Rotate log file if needed
      if (this.logFileSize >= this.config.maxFileSize) {
        await this.rotateLogFile();
      }
    } catch (error) {
      console.error('[AuditLogger] Failed to write to log file:', error);
    }
  }

  private async rotateLogFile(): Promise<void> {
    this.currentLogFile = this.getCurrentLogFilePath();
    this.logFileSize = 0;

    // Clean up old log files
    await this.cleanupOldLogs();
  }

  private async cleanupOldLogs(): Promise<void> {
    try {
      const files = await fs.readdir(this.config.logDirectory);
      const logFiles = files
        .filter(file => file.startsWith(this.config.logFileName.replace('.log', '')) && file.endsWith('.log'))
        .map(file => path.join(this.config.logDirectory, file));

      // Sort by modification time
      const fileStats = await Promise.all(
        logFiles.map(async file => ({
          file,
          mtime: (await fs.stat(file)).mtime,
        }))
      );

      fileStats.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

      // Delete files beyond max count
      const filesToDelete = fileStats.slice(this.config.maxFiles);

      for (const { file } of filesToDelete) {
        await fs.unlink(file);
      }

      // Delete files beyond retention period
      const retentionMs = this.config.retentionDays * 24 * 60 * 60 * 1000;
      const cutoffDate = new Date(Date.now() - retentionMs);

      for (const { file, mtime } of fileStats) {
        if (mtime < cutoffDate) {
          await fs.unlink(file);
        }
      }
    } catch (error) {
      console.error('[AuditLogger] Failed to cleanup old logs:', error);
    }
  }

  private scheduleLogCleanup(): void {
    // Run cleanup daily
    setInterval(() => {
      this.cleanupOldLogs();
    }, 86400000); // 24 hours
  }

  private startAutoFlush(): void {
    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.config.flushIntervalMs);
  }

  private logToConsole(event: AuditEvent): void {
    const timestamp = event.timestamp.toISOString();
    const severity = event.severity ?? 'INFO';
    const message = `[${timestamp}] [${severity}] [${event.type}] ${event.actor} ${event.action}${event.resource ? ` on ${event.resource}` : ''}`;

    switch (severity) {
      case AuditSeverity.DEBUG:
        console.debug(message);
        break;
      case AuditSeverity.INFO:
        console.info(message);
        break;
      case AuditSeverity.WARNING:
        console.warn(message);
        break;
      case AuditSeverity.ERROR:
      case AuditSeverity.CRITICAL:
        console.error(message);
        break;
    }
  }

  private async logToDatabase(event: AuditEvent): Promise<void> {
    // Placeholder for database logging
    // Would insert into audit_log table
  }

  private determineSeverity(type: AuditEventType): AuditSeverity {
    switch (type) {
      case AuditEventType.SYSTEM_ERROR:
      case AuditEventType.SYNC_FAILED:
      case AuditEventType.AUTHENTICATION_FAILED:
      case AuditEventType.ACCESS_DENIED:
        return AuditSeverity.ERROR;

      case AuditEventType.CONFLICT_DETECTED:
      case AuditEventType.DATA_REJECTED:
      case AuditEventType.QUEUE_OVERFLOW:
      case AuditEventType.DEAD_LETTER_QUEUE_FULL:
        return AuditSeverity.WARNING;

      case AuditEventType.SYSTEM_START:
      case AuditEventType.SYSTEM_STOP:
      case AuditEventType.SYNC_COMPLETED:
      case AuditEventType.ACCESS_GRANTED:
        return AuditSeverity.INFO;

      default:
        return AuditSeverity.DEBUG;
    }
  }

  private generateEventId(): string {
    return `audit_${Date.now()}_${this.eventCounter}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export default AuditLogger;

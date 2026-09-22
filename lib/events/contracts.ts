export type AstraEventSeverity = "info" | "warning" | "error" | "critical";

export type AstraEventSourceKind =
  | "github"
  | "repository"
  | "calendar"
  | "email"
  | "automation"
  | "service"
  | "backup"
  | "business"
  | "custom";

export type AstraEventSubscriptionStatus = "enabled" | "disabled";

export type AstraEventDeliveryPolicy = "notify" | "record_only";

export type AstraEventQuietHours = {
  startMinuteOfDay: number;
  endMinuteOfDay: number;
  timezoneOffsetMinutes: number;
};

export type AstraEventSubscription = {
  id: string;
  source: AstraEventSourceKind;
  topic: string;
  projectId?: string;
  status: AstraEventSubscriptionStatus;
  severityFloor: AstraEventSeverity;
  deliveryPolicy: AstraEventDeliveryPolicy;
  debounceMs: number;
  dedupeWindowMs: number;
  rateLimitPerHour: number;
  quietHours?: AstraEventQuietHours;
  allowCriticalDuringQuietHours: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AstraIncomingEvent = {
  source: AstraEventSourceKind;
  topic: string;
  key: string;
  title: string;
  detail?: string;
  severity: AstraEventSeverity;
  occurredAt: string;
  projectId?: string;
  metadata?: Record<string, string>;
};

export type AstraEventDisposition =
  | "delivered"
  | "recorded"
  | "suppressed_debounce"
  | "suppressed_duplicate"
  | "suppressed_quiet_hours"
  | "suppressed_rate_limit";

export type AstraEventRecord = {
  id: string;
  subscriptionId: string;
  source: AstraEventSourceKind;
  topic: string;
  key: string;
  dedupeKey: string;
  title: string;
  detail?: string;
  severity: AstraEventSeverity;
  occurredAt: string;
  projectId?: string;
  metadata?: Record<string, string>;
  disposition: AstraEventDisposition;
  dispositionDetail: string;
  acknowledgedAt?: string;
  createdAt: string;
};

export type AstraEventStore = {
  schemaVersion: 1;
  subscriptions: AstraEventSubscription[];
  events: AstraEventRecord[];
};

export type AstraEventEvaluation = {
  matchedSubscriptions: number;
  records: AstraEventRecord[];
  deliverable: AstraEventRecord[];
};

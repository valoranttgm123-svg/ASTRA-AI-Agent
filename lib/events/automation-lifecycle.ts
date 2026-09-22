import type { AstraAutomationLifecycleEvent } from "../automation/queue";
import type { AstraAutomationService } from "../automation/service";
import type {
  AstraEventEvaluation,
  AstraIncomingEvent,
} from "./contracts";
import { publishIncomingEvent } from "./management";
import {
  safeErrorDetail,
  safePublicDetail,
} from "../security/redaction";

type AutomationEventPublisher = (
  event: AstraIncomingEvent,
) => Promise<AstraEventEvaluation>;

export type AstraAutomationEventBridgeStatus = {
  attached: boolean;
  observed: number;
  matchedSubscriptions: number;
  records: number;
  deliverable: number;
  publishFailures: number;
  lastEventType?: AstraAutomationLifecycleEvent["type"];
  lastEventAt?: string;
  lastError?: string;
};

type MutableBridgeStatus = AstraAutomationEventBridgeStatus;

const bridgeStatus = new WeakMap<
  AstraAutomationService,
  MutableBridgeStatus
>();

function statusFor(service: AstraAutomationService) {
  let status = bridgeStatus.get(service);
  if (!status) {
    status = {
      attached: false,
      observed: 0,
      matchedSubscriptions: 0,
      records: 0,
      deliverable: 0,
      publishFailures: 0,
    };
    bridgeStatus.set(service, status);
  }
  return status;
}

function severityForLifecycle(
  type: AstraAutomationLifecycleEvent["type"],
) {
  if (type === "automation.failed") return "error" as const;
  if (
    type === "automation.cancelled" ||
    type === "automation.waiting_approval"
  ) {
    return "warning" as const;
  }
  return "info" as const;
}

export function automationLifecycleEventToIncomingEvent(
  event: AstraAutomationLifecycleEvent,
): AstraIncomingEvent {
  const occurredAt = new Date(event.at);
  const scheduledFor = new Date(event.scheduledFor);
  if (!Number.isFinite(occurredAt.getTime())) {
    throw new Error("Automation lifecycle event has an invalid at timestamp.");
  }
  if (!Number.isFinite(scheduledFor.getTime())) {
    throw new Error(
      "Automation lifecycle event has an invalid scheduledFor timestamp.",
    );
  }

  const type = event.type.replace("automation.", "");
  return {
    source: "automation",
    topic: event.type,
    key:
      "automation:" +
      event.automationId +
      ":" +
      event.type +
      ":" +
      scheduledFor.toISOString(),
    title:
      event.automationId +
      " · " +
      type.replaceAll("_", " ").toUpperCase(),
    detail: safePublicDetail(
      event.detail,
      "Automation lifecycle update.",
      900,
    ),
    severity: severityForLifecycle(event.type),
    occurredAt: occurredAt.toISOString(),
    metadata: {
      automationId: event.automationId,
      lifecycleType: event.type,
      scheduledFor: scheduledFor.toISOString(),
    },
  };
}

export function getAutomationLifecycleEventBridgeStatus(
  service: AstraAutomationService,
): AstraAutomationEventBridgeStatus {
  return { ...statusFor(service) };
}

export function attachAutomationLifecycleEventBridge(
  service: AstraAutomationService,
  publisher: AutomationEventPublisher = publishIncomingEvent,
) {
  const status = statusFor(service);
  if (status.attached) return false;

  status.attached = true;
  service.subscribeLifecycle((event) => {
    status.observed += 1;
    status.lastEventType = event.type;
    status.lastEventAt = event.at;

    let incoming: AstraIncomingEvent;
    try {
      incoming = automationLifecycleEventToIncomingEvent(event);
    } catch (error) {
      status.publishFailures += 1;
      status.lastError = safeErrorDetail(
        error,
        "Automation Event Engine mapping failed.",
        500,
      );
      return;
    }

    void publisher(incoming)
      .then((result) => {
        status.matchedSubscriptions += result.matchedSubscriptions;
        status.records += result.records.length;
        status.deliverable += result.deliverable.length;
        status.lastError = undefined;
      })
      .catch((error) => {
        status.publishFailures += 1;
        status.lastError = safeErrorDetail(
          error,
          "Automation Event Engine publication failed.",
          500,
        );
      });
  });

  return true;
}

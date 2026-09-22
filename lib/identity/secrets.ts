import type {
  AstraIdentitySession,
  AstraSecretPresence,
  AstraSecretReference,
} from "./contracts";
import { sessionCanUseSecrets } from "./policy";

export type AstraSecretProvider = {
  id: string;
  presence: (
    reference: AstraSecretReference,
    signal?: AbortSignal,
  ) => Promise<boolean>;
  read: (
    reference: AstraSecretReference,
    signal?: AbortSignal,
  ) => Promise<string | null>;
};

function validProviderId(value: string) {
  const id = value.trim();
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$/.test(id)) {
    throw new Error("Secret provider id is invalid.");
  }
  return id;
}

function validReference(reference: AstraSecretReference) {
  const id = reference.id.trim();
  const providerId = validProviderId(reference.providerId);
  const secretName = reference.secretName.trim();
  const purpose = reference.purpose.trim();
  if (!id || id.length > 120) throw new Error("Secret reference id is invalid.");
  if (!secretName || secretName.length > 160) {
    throw new Error("Secret reference name is invalid.");
  }
  if (!purpose || purpose.length > 300) {
    throw new Error("Secret reference purpose is invalid.");
  }
  return { ...reference, id, providerId, secretName, purpose };
}

export class AstraSecretBroker {
  private readonly providers = new Map<string, AstraSecretProvider>();

  register(provider: AstraSecretProvider) {
    const id = validProviderId(provider.id);
    if (this.providers.has(id)) {
      throw new Error("Duplicate secret provider id: " + id + ".");
    }
    this.providers.set(id, { ...provider, id });
    return this;
  }

  async presence(
    referenceInput: AstraSecretReference,
    signal?: AbortSignal,
  ): Promise<AstraSecretPresence> {
    const reference = validReference(referenceInput);
    const provider = this.providers.get(reference.providerId);
    if (!provider) {
      return {
        referenceId: reference.id,
        providerId: reference.providerId,
        configured: false,
        detail: "Secret provider is not configured.",
      };
    }
    const configured = await provider.presence(reference, signal);
    return {
      referenceId: reference.id,
      providerId: reference.providerId,
      configured,
      detail: configured
        ? "Secret reference is configured; value is not exposed."
        : "Secret reference is not configured.",
    };
  }

  async withSecret<T>({
    reference: referenceInput,
    session,
    signal,
    consume,
  }: {
    reference: AstraSecretReference;
    session: AstraIdentitySession;
    signal?: AbortSignal;
    consume: (secret: string) => Promise<T>;
  }): Promise<T> {
    if (!sessionCanUseSecrets(session)) {
      throw new Error(
        "Current identity session is not allowed to use secrets.",
      );
    }

    const reference = validReference(referenceInput);
    const provider = this.providers.get(reference.providerId);
    if (!provider) throw new Error("Secret provider is not configured.");

    if (signal?.aborted) {
      throw signal.reason instanceof Error
        ? signal.reason
        : new DOMException("Secret request aborted.", "AbortError");
    }

    const value = await provider.read(reference, signal);
    if (!value) throw new Error("Secret reference is not configured.");

    return consume(value);
  }
}

export function createEnvironmentSecretProvider(
  bindings: Record<string, string>,
): AstraSecretProvider {
  const normalized = new Map<string, string>();
  for (const [secretName, envName] of Object.entries(bindings)) {
    const key = secretName.trim();
    const variable = envName.trim();
    if (!key || key.length > 160) {
      throw new Error("Environment secret binding name is invalid.");
    }
    if (!/^[A-Z_][A-Z0-9_]{0,127}$/.test(variable)) {
      throw new Error("Environment variable binding is invalid.");
    }
    normalized.set(key, variable);
  }

  return {
    id: "environment",
    presence: async (reference) => {
      const envName = normalized.get(reference.secretName);
      return Boolean(envName && process.env[envName]?.trim());
    },
    read: async (reference) => {
      const envName = normalized.get(reference.secretName);
      const value = envName ? process.env[envName] : undefined;
      return value?.trim() || null;
    },
  };
}

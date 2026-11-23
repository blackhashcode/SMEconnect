import { createTransport, type SendMailOptions } from "nodemailer";
import { EmailConfigurationError } from "@/server/errors";

/** SMTP settings read from the environment at process start/first use. */
export interface EmailConfig {
  from: string;
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  password?: string;
}

/** Minimal interface so callers do not depend on the Nodemailer transport. */
export interface EmailTransport {
  sendMail(options: SendMailOptions): Promise<unknown>;
}

interface PooledSmtpOptions {
  pool: true;
  host: string;
  port: number;
  secure: boolean;
  auth?: { user: string; pass: string };
}

export type TransportFactory = (options: PooledSmtpOptions) => EmailTransport;

export interface EmailDeliveryContext {
  config: EmailConfig;
  transport: EmailTransport;
}

const defaultTransportFactory: TransportFactory = (options) =>
  createTransport(options);

function isValidSender(value: string): boolean {
  if (/[\r\n]/.test(value)) return false;

  // Accepts "Name <address@example.com>" and bare "address@example.com".
  const match = value.match(/^(?:[^<>]+<([^<>]+)>|([^\s<>]+))$/);
  const address = match?.[1] ?? match?.[2];

  return Boolean(address && /^[^\s@<>]+@[^\s@<>]+$/.test(address));
}

/** Reads and validates SMTP configuration without exposing any values. */
export function readEmailConfig(
  env: Record<string, string | undefined> = process.env,
): EmailConfig {
  const from = env.EMAIL_FROM?.trim();
  if (!from) {
    throw new EmailConfigurationError("EMAIL_FROM is not set");
  }
  if (!isValidSender(from)) {
    throw new EmailConfigurationError("EMAIL_FROM is not a valid sender");
  }

  const host = env.SMTP_HOST?.trim();
  if (!host) {
    throw new EmailConfigurationError("SMTP_HOST is not set");
  }

  const rawPort = env.SMTP_PORT?.trim();
  if (!rawPort) {
    throw new EmailConfigurationError("SMTP_PORT is not set");
  }
  const port = Number(rawPort);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new EmailConfigurationError(
      "SMTP_PORT must be an integer between 1 and 65535",
    );
  }

  const user = env.SMTP_USER?.trim() || undefined;
  const password = env.SMTP_PASSWORD || undefined;
  const hasUser = Boolean(user);
  const hasPassword = Boolean(password?.trim());
  if (hasUser !== hasPassword) {
    throw new EmailConfigurationError(
      "SMTP_USER and SMTP_PASSWORD must be set together",
    );
  }

  return {
    from,
    host,
    port,
    // The project has no SMTP_SECURE setting; 465 is the implicit TLS port.
    secure: port === 465,
    ...(hasUser && password ? { user, password } : {}),
  };
}

/** Creates one pooled transport for the process rather than one per email. */
export function createSmtpTransport(
  config: EmailConfig,
  factory: TransportFactory = defaultTransportFactory,
): EmailTransport {
  const auth =
    config.user && config.password
      ? { user: config.user, pass: config.password }
      : undefined;

  return factory({
    pool: true,
    host: config.host,
    port: config.port,
    secure: config.secure,
    ...(auth ? { auth } : {}),
  });
}

let defaultContext: EmailDeliveryContext | undefined;

/** Lazily builds and reuses the default config/transport pair. */
export function getDefaultEmailDeliveryContext(
  env: Record<string, string | undefined> = process.env,
  factory: TransportFactory = defaultTransportFactory,
): EmailDeliveryContext {
  if (!defaultContext) {
    const config = readEmailConfig(env);
    defaultContext = {
      config,
      transport: createSmtpTransport(config, factory),
    };
  }

  return defaultContext;
}

/** Test-only helper to avoid leaking cached state between cases. */
export function resetDefaultEmailDeliveryContext(): void {
  defaultContext = undefined;
}

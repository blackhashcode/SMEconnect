"use client";

import { useEffect, useRef, useState } from "react";

type OpenApiDocument = object;

interface SwaggerRequest {
  credentials?: RequestCredentials;
  [key: string]: unknown;
}

type SwaggerUIBundle = (config: Record<string, unknown>) => unknown;

declare global {
  interface Window {
    SwaggerUIBundle?: SwaggerUIBundle;
  }
}

const SWAGGER_SCRIPT_ID = "swagger-ui-bundle";
const SWAGGER_SCRIPT_SRC = "/docs/assets/swagger-ui-bundle.js";

function loadSwaggerUi(): Promise<void> {
  if (typeof window.SwaggerUIBundle === "function") {
    return Promise.resolve();
  }

  const existing = document.getElementById(SWAGGER_SCRIPT_ID);
  if (existing instanceof HTMLScriptElement) {
    return new Promise((resolve, reject) => {
      if (typeof window.SwaggerUIBundle === "function") {
        resolve();
        return;
      }

      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error("Failed to load the Swagger UI bundle")),
        { once: true },
      );
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.id = SWAGGER_SCRIPT_ID;
    script.src = SWAGGER_SCRIPT_SRC;
    script.async = true;
    script.addEventListener("load", () => resolve(), { once: true });
    script.addEventListener(
      "error",
      () => reject(new Error("Failed to load the Swagger UI bundle")),
      { once: true },
    );
    document.head.appendChild(script);
  });
}

export default function SwaggerUIClient({ spec }: { spec: OpenApiDocument }) {
  const initialized = useRef(false);
  const specRef = useRef(spec);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    specRef.current = spec;
  }, [spec]);

  useEffect(() => {
    let cancelled = false;

    loadSwaggerUi()
      .then(() => {
        if (cancelled || initialized.current) return;

        const bundle = window.SwaggerUIBundle;
        if (typeof bundle !== "function") {
          throw new Error("Swagger UI bundle did not define SwaggerUIBundle");
        }

        initialized.current = true;
        bundle({
          spec: specRef.current,
          dom_id: "#swagger-ui",
          layout: "BaseLayout",
          docExpansion: "none",
          defaultModelRendering: "model",
          defaultModelExpandDepth: -1,
          defaultModelsExpandDepth: -1,
          displayOperationId: false,
          displayRequestDuration: true,
          maxDisplayedTags: -1,
          operationsSorter: "alpha",
          tagsSorter: "alpha",
          tryItOutEnabled: true,
          requestSnippetsEnabled: false,
          filter: false,
          showExtensions: false,
          showCommonExtensions: false,
          showMutatedRequest: false,
          deepLinking: false,
          persistAuthorization: false,
          queryConfigEnabled: false,
          validatorUrl: null,
          withCredentials: true,
          requestInterceptor: (request: SwaggerRequest) => ({
            ...request,
            credentials: "include",
          }),
        });
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : String(cause));
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return <p role="alert">Unable to load API documentation: {error}</p>;
  }

  return <div id="swagger-ui">Loading API documentation…</div>;
}

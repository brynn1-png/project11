import type { Instrumentation } from "next";

export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { logFailure } = await import("@/lib/diagnostics");
  await logFailure({ source: "next_server", operation: `${context.routeType}: ${request.method} ${context.routePath || request.path.split("?")[0]}`, error });
};

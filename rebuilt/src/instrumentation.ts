import type { Instrumentation } from "next";
import { logRequestFailure } from "@/lib/observability/log";
export const onRequestError: Instrumentation.onRequestError = (
  error,
  request,
  context,
) => {
  logRequestFailure(error, request.method, context.routeType);
};

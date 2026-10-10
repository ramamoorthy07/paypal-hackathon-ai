import { describe, expect, it } from "vitest";
import { isDemoProtectedPath, isExemptPath } from "@/lib/access/demo-code";

describe("route gate enumeration audit (A1)", () => {
  // Exhaustive list of known application routes
  const exemptAllowlist = [
    "/unlock",
    "/api/unlock",
    "/api/health",
    "/api/health/live",
    "/api/webhooks/paypal",
    "/api/cron/reminders",
    "/api/cron/overdue",
    "/api/mcp",
  ];

  const protectedRoutes = [
    // Pages
    "/",
    "/dashboard",
    "/invoices",
    "/invoices/inv-test-123",
    "/activity",
    // Protected API Endpoints
    "/api/chat",
    "/api/invoices/confirm",
    "/api/invoices/reconcile",
    "/api/invoices/inv-test-123/remind",
    "/api/invoices/inv-test-123/sync",
    "/api/invoices/inv-test-123/qr",
    "/api/insights/why",
    "/api/summary/monthly",
    "/api/fx",
    "/api/webhooks/simulate",
  ];

  it("verifies all exempt routes are explicitly exempt and not protected", () => {
    for (const route of exemptAllowlist) {
      expect(isExemptPath(route), `Route ${route} should be exempt`).toBe(true);
      expect(isDemoProtectedPath(route), `Route ${route} should NOT be demo-protected`).toBe(false);
    }
  });

  it("verifies all sensitive pages and data endpoints are gated", () => {
    for (const route of protectedRoutes) {
      expect(isExemptPath(route), `Route ${route} must NOT be exempt`).toBe(false);
      expect(isDemoProtectedPath(route), `Route ${route} must be demo-protected`).toBe(true);
    }
  });

  it("fails closed on any newly invented route by default", () => {
    const unknownPages = [
      "/admin",
      "/users",
      "/settings",
      "/api/export",
      "/api/internal/debug",
      "/api/invoices/new-secret-endpoint",
    ];
    for (const route of unknownPages) {
      expect(isExemptPath(route), `Unknown route ${route} must NOT be exempt`).toBe(false);
      expect(isDemoProtectedPath(route), `Unknown route ${route} must be protected by default`).toBe(true);
    }
  });
});

import "@testing-library/jest-dom/vitest";
import { afterAll, afterEach, beforeAll } from "vitest";
import { server } from "./server";

beforeAll(() => server.listen({ onUnhandledRequest: "warn" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// IntersectionObserver is not available in jsdom; provide a no-op mock.
if (typeof IntersectionObserver === "undefined") {
  class IntersectionObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  Object.defineProperty(globalThis, "IntersectionObserver", {
    writable: true,
    configurable: true,
    value: IntersectionObserverMock,
  });
}

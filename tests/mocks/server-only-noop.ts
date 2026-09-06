// Test-only stand-in for the "server-only" package. In the real Next.js
// build, "server-only" prevents server modules from being bundled into
// client code. That enforcement is a webpack-time concern; for unit tests
// run under Vitest/Node it is a no-op so server modules remain importable.
export {};

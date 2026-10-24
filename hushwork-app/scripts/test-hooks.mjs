// Run with `node --import ./scripts/test-hooks.mjs ...` (npm test does). See scripts/test-resolve.mjs.
import { register } from "node:module";
register("./test-resolve.mjs", import.meta.url);

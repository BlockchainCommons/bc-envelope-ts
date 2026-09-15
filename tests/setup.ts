/**
 * Runs before every test file (`vitest.config.ts` `setupFiles`).
 *
 * The known-values directory configuration is pinned to no directories, so
 * the global registry never reads the machine's `~/.known-values` and every
 * name a test prints is the reference's seed name or a codepoint. The pin
 * must precede the first access to the registry, which the format context
 * makes on first use.
 */
import { DirectoryConfig, setDirectoryConfig } from "@blockchaincommons/known-values";
import { registerTags } from "../src/format/index.js";

setDirectoryConfig(new DirectoryConfig());
// The envelope summarisers, as the reference's `bc_envelope::register_tags()`
// installs them; `tests/format-registration.test.ts` covers the state before.
registerTags();

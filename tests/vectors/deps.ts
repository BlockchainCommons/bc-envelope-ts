/* eslint-disable @typescript-eslint/no-explicit-any */
/** The sibling modules each adapter builds keys, ids, specs and RNGs from. */
import type { Deps, Seed } from "./recipes";

export async function baselineDeps(): Promise<Deps> {
  const components: any = await import("../baseline/components-baseline.mjs");
  const rand: any = await import("../baseline/rand-baseline.mjs");
  const sskr: any = await import("../baseline/sskr-baseline.mjs");
  return {
    components,
    rand,
    sskr,
    seededRng: (seed: Seed) => new rand.SeededRandomNumberGenerator(seed.map(BigInt)),
  };
}

export async function currentDeps(): Promise<Deps> {
  const root: any = await import("@blockchaincommons/components");
  const kdf: any = await import("@blockchaincommons/components/kdf");
  const rand: any = await import("@blockchaincommons/rand");
  const sskr: any = await import("@blockchaincommons/sskr");
  return {
    components: { ...root, ...kdf },
    rand,
    sskr,
    seededRng: (seed: Seed) => new rand.SeededRng(seed.map(BigInt)),
  };
}

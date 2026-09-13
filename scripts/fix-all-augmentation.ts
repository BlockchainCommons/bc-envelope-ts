/**
 * After `tsdown`, point the `/all` module augmentation at the package
 * itself. The source augments `./base/envelope.js`; the bundled types keep
 * that string although the class now lives in a hashed chunk under a
 * renamed export, which would leave consumers without the facade's method
 * types. Augmenting `@blockchaincommons/envelope` merges with the
 * re-exported class in every consumer.
 */
import { readFileSync, writeFileSync } from "node:fs";
for (const ext of ["mts", "cts"]) {
  const file = `dist/all.d.${ext}`;
  const text = readFileSync(file, "utf8");
  if (!text.includes('declare module "./base/envelope.js"'))
    throw new Error(`${file}: augmentation not found`);
  writeFileSync(
    file,
    text.replace(
      'declare module "./base/envelope.js"',
      'declare module "@blockchaincommons/envelope"',
    ),
  );
  console.log(`${file}: augmentation -> @blockchaincommons/envelope`);
}

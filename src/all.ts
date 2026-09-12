/**
 * The fluent surface: every extension function installed as an `Envelope`
 * method, so `envelope.sign(key).encryptSubject(k)` reads as before. This is
 * the only entry with import-time side effects; the functions themselves live
 * on their subpaths.
 *
 * @module all
 */
import { Envelope } from "./base/envelope.js";
import * as xattachment from "./extension/attachment.js";
import * as xedge from "./extension/edge.js";
import * as xrecipient from "./extension/recipient.js";
import * as xsecret from "./extension/secret.js";
import * as xsignature from "./extension/signature.js";
import * as xsskr from "./extension/sskr.js";
import * as xtypes from "./extension/types.js";
import * as xdiagnostic from "./format/diagnostic.js";
import * as xenvelope_summary from "./format/envelope-summary.js";
import * as xhex from "./format/hex.js";
import * as xmermaid from "./format/mermaid.js";
import * as xnotation from "./format/notation.js";
import * as xproof from "./extension/proof.js";
import * as xtree from "./format/tree.js";
import * as xseal from "./seal.js";

type Tail<T extends unknown[]> = T extends [unknown, ...infer R] ? R : never;

declare module "./base/envelope.js" {
  interface Envelope {
    /** Method form of `confirmContainsTarget` from `@blockchaincommons/envelope/proof`. */
    confirmContainsTarget(
      ...args: Tail<Parameters<typeof xproof.confirmContainsTarget>>
    ): ReturnType<typeof xproof.confirmContainsTarget>;
    /** Method form of `confirmContainsSet` from `@blockchaincommons/envelope/proof`. */
    confirmContainsSet(
      ...args: Tail<Parameters<typeof xproof.confirmContainsSet>>
    ): ReturnType<typeof xproof.confirmContainsSet>;
    /** Method form of `proofContainsTarget` from `@blockchaincommons/envelope/proof`. */
    proofContainsTarget(
      ...args: Tail<Parameters<typeof xproof.proofContainsTarget>>
    ): ReturnType<typeof xproof.proofContainsTarget>;
    /** Method form of `proofContainsSet` from `@blockchaincommons/envelope/proof`. */
    proofContainsSet(
      ...args: Tail<Parameters<typeof xproof.proofContainsSet>>
    ): ReturnType<typeof xproof.proofContainsSet>;
    /** Method form of `addAttachment` from `@blockchaincommons/envelope/attachment`. */
    addAttachment(
      ...args: Tail<Parameters<typeof xattachment.addAttachment>>
    ): ReturnType<typeof xattachment.addAttachment>;
    /** Method form of `attachmentConformsTo` from `@blockchaincommons/envelope/attachment`. */
    attachmentConformsTo(
      ...args: Tail<Parameters<typeof xattachment.attachmentConformsTo>>
    ): ReturnType<typeof xattachment.attachmentConformsTo>;
    /** Method form of `attachmentPayload` from `@blockchaincommons/envelope/attachment`. */
    attachmentPayload(
      ...args: Tail<Parameters<typeof xattachment.attachmentPayload>>
    ): ReturnType<typeof xattachment.attachmentPayload>;
    /** Method form of `attachmentVendor` from `@blockchaincommons/envelope/attachment`. */
    attachmentVendor(
      ...args: Tail<Parameters<typeof xattachment.attachmentVendor>>
    ): ReturnType<typeof xattachment.attachmentVendor>;
    /** Method form of `expectAttachment` from `@blockchaincommons/envelope/attachment`. */
    expectAttachment(
      ...args: Tail<Parameters<typeof xattachment.expectAttachment>>
    ): ReturnType<typeof xattachment.expectAttachment>;
    /** Method form of `attachments` from `@blockchaincommons/envelope/attachment`. */
    attachments(
      ...args: Tail<Parameters<typeof xattachment.attachments>>
    ): ReturnType<typeof xattachment.attachments>;
    /** Method form of `validateAttachment` from `@blockchaincommons/envelope/attachment`. */
    validateAttachment(
      ...args: Tail<Parameters<typeof xattachment.validateAttachment>>
    ): ReturnType<typeof xattachment.validateAttachment>;
    /** Method form of `addEdgeEnvelope` from `@blockchaincommons/envelope/edge`. */
    addEdgeEnvelope(
      ...args: Tail<Parameters<typeof xedge.addEdgeEnvelope>>
    ): ReturnType<typeof xedge.addEdgeEnvelope>;
    /** Method form of `edgeIsA` from `@blockchaincommons/envelope/edge`. */
    edgeIsA(...args: Tail<Parameters<typeof xedge.edgeIsA>>): ReturnType<typeof xedge.edgeIsA>;
    /** Method form of `edgeSource` from `@blockchaincommons/envelope/edge`. */
    edgeSource(
      ...args: Tail<Parameters<typeof xedge.edgeSource>>
    ): ReturnType<typeof xedge.edgeSource>;
    /** Method form of `edgeSubject` from `@blockchaincommons/envelope/edge`. */
    edgeSubject(
      ...args: Tail<Parameters<typeof xedge.edgeSubject>>
    ): ReturnType<typeof xedge.edgeSubject>;
    /** Method form of `edgeTarget` from `@blockchaincommons/envelope/edge`. */
    edgeTarget(
      ...args: Tail<Parameters<typeof xedge.edgeTarget>>
    ): ReturnType<typeof xedge.edgeTarget>;
    /** Method form of `edges` from `@blockchaincommons/envelope/edge`. */
    edges(...args: Tail<Parameters<typeof xedge.edges>>): ReturnType<typeof xedge.edges>;
    /** Method form of `edgesMatching` from `@blockchaincommons/envelope/edge`. */
    edgesMatching(
      ...args: Tail<Parameters<typeof xedge.edgesMatching>>
    ): ReturnType<typeof xedge.edgesMatching>;
    /** Method form of `validateEdge` from `@blockchaincommons/envelope/edge`. */
    validateEdge(
      ...args: Tail<Parameters<typeof xedge.validateEdge>>
    ): ReturnType<typeof xedge.validateEdge>;
    /** Method form of `addRecipient` from `@blockchaincommons/envelope/recipient`. */
    addRecipient(
      ...args: Tail<Parameters<typeof xrecipient.addRecipient>>
    ): ReturnType<typeof xrecipient.addRecipient>;
    /** Method form of `decryptSubjectToRecipient` from `@blockchaincommons/envelope/recipient`. */
    decryptSubjectToRecipient(
      ...args: Tail<Parameters<typeof xrecipient.decryptSubjectToRecipient>>
    ): ReturnType<typeof xrecipient.decryptSubjectToRecipient>;
    /** Method form of `decryptToRecipient` from `@blockchaincommons/envelope/recipient`. */
    decryptToRecipient(
      ...args: Tail<Parameters<typeof xrecipient.decryptToRecipient>>
    ): ReturnType<typeof xrecipient.decryptToRecipient>;
    /** Method form of `encryptSubjectToRecipient` from `@blockchaincommons/envelope/recipient`. */
    encryptSubjectToRecipient(
      ...args: Tail<Parameters<typeof xrecipient.encryptSubjectToRecipient>>
    ): ReturnType<typeof xrecipient.encryptSubjectToRecipient>;
    /** Method form of `encryptSubjectToRecipients` from `@blockchaincommons/envelope/recipient`. */
    encryptSubjectToRecipients(
      ...args: Tail<Parameters<typeof xrecipient.encryptSubjectToRecipients>>
    ): ReturnType<typeof xrecipient.encryptSubjectToRecipients>;
    /** Method form of `encryptToRecipients` from `@blockchaincommons/envelope/recipient`. */
    encryptToRecipients(
      ...args: Tail<Parameters<typeof xrecipient.encryptToRecipients>>
    ): ReturnType<typeof xrecipient.encryptToRecipients>;
    /** Method form of `recipients` from `@blockchaincommons/envelope/recipient`. */
    recipients(
      ...args: Tail<Parameters<typeof xrecipient.recipients>>
    ): ReturnType<typeof xrecipient.recipients>;
    /** Method form of `addSecret` from `@blockchaincommons/envelope/secret`. */
    addSecret(
      ...args: Tail<Parameters<typeof xsecret.addSecret>>
    ): ReturnType<typeof xsecret.addSecret>;
    /** Method form of `isLockedWithPassword` from `@blockchaincommons/envelope/secret`. */
    isLockedWithPassword(
      ...args: Tail<Parameters<typeof xsecret.isLockedWithPassword>>
    ): ReturnType<typeof xsecret.isLockedWithPassword>;
    /** Method form of `isLockedWithSshAgent` from `@blockchaincommons/envelope/secret`. */
    isLockedWithSshAgent(
      ...args: Tail<Parameters<typeof xsecret.isLockedWithSshAgent>>
    ): ReturnType<typeof xsecret.isLockedWithSshAgent>;
    /** Method form of `lock` from `@blockchaincommons/envelope/secret`. */
    lock(...args: Tail<Parameters<typeof xsecret.lock>>): ReturnType<typeof xsecret.lock>;
    /** Method form of `lockSubject` from `@blockchaincommons/envelope/secret`. */
    lockSubject(
      ...args: Tail<Parameters<typeof xsecret.lockSubject>>
    ): ReturnType<typeof xsecret.lockSubject>;
    /** Method form of `unlock` from `@blockchaincommons/envelope/secret`. */
    unlock(...args: Tail<Parameters<typeof xsecret.unlock>>): ReturnType<typeof xsecret.unlock>;
    /** Method form of `unlockSubject` from `@blockchaincommons/envelope/secret`. */
    unlockSubject(
      ...args: Tail<Parameters<typeof xsecret.unlockSubject>>
    ): ReturnType<typeof xsecret.unlockSubject>;
    /** Method form of `addSignature` from `@blockchaincommons/envelope/signature`. */
    addSignature(
      ...args: Tail<Parameters<typeof xsignature.addSignature>>
    ): ReturnType<typeof xsignature.addSignature>;
    /** Method form of `addSignatures` from `@blockchaincommons/envelope/signature`. */
    addSignatures(
      ...args: Tail<Parameters<typeof xsignature.addSignatures>>
    ): ReturnType<typeof xsignature.addSignatures>;
    /** Method form of `hasSignatureFrom` from `@blockchaincommons/envelope/signature`. */
    hasSignatureFrom(
      ...args: Tail<Parameters<typeof xsignature.hasSignatureFrom>>
    ): ReturnType<typeof xsignature.hasSignatureFrom>;
    /** Method form of `hasSignatureFromReturningMetadata` from `@blockchaincommons/envelope/signature`. */
    hasSignatureFromReturningMetadata(
      ...args: Tail<Parameters<typeof xsignature.hasSignatureFromReturningMetadata>>
    ): ReturnType<typeof xsignature.hasSignatureFromReturningMetadata>;
    /** Method form of `hasSignaturesFrom` from `@blockchaincommons/envelope/signature`. */
    hasSignaturesFrom(
      ...args: Tail<Parameters<typeof xsignature.hasSignaturesFrom>>
    ): ReturnType<typeof xsignature.hasSignaturesFrom>;
    /** Method form of `hasSignaturesFromThreshold` from `@blockchaincommons/envelope/signature`. */
    hasSignaturesFromThreshold(
      ...args: Tail<Parameters<typeof xsignature.hasSignaturesFromThreshold>>
    ): ReturnType<typeof xsignature.hasSignaturesFromThreshold>;
    /** Method form of `isVerifiedSignature` from `@blockchaincommons/envelope/signature`. */
    isVerifiedSignature(
      ...args: Tail<Parameters<typeof xsignature.isVerifiedSignature>>
    ): ReturnType<typeof xsignature.isVerifiedSignature>;
    /** Method form of `makeSignedAssertion` from `@blockchaincommons/envelope/signature`. */
    makeSignedAssertion(
      ...args: Tail<Parameters<typeof xsignature.makeSignedAssertion>>
    ): ReturnType<typeof xsignature.makeSignedAssertion>;
    /** Method form of `sign` from `@blockchaincommons/envelope/signature`. */
    sign(...args: Tail<Parameters<typeof xsignature.sign>>): ReturnType<typeof xsignature.sign>;
    /** Method form of `signatures` from `@blockchaincommons/envelope/signature`. */
    signatures(
      ...args: Tail<Parameters<typeof xsignature.signatures>>
    ): ReturnType<typeof xsignature.signatures>;
    /** Method form of `verify` from `@blockchaincommons/envelope/signature`. */
    verify(
      ...args: Tail<Parameters<typeof xsignature.verify>>
    ): ReturnType<typeof xsignature.verify>;
    /** Method form of `verifyReturningMetadata` from `@blockchaincommons/envelope/signature`. */
    verifyReturningMetadata(
      ...args: Tail<Parameters<typeof xsignature.verifyReturningMetadata>>
    ): ReturnType<typeof xsignature.verifyReturningMetadata>;
    /** Method form of `verifySignature` from `@blockchaincommons/envelope/signature`. */
    verifySignature(
      ...args: Tail<Parameters<typeof xsignature.verifySignature>>
    ): ReturnType<typeof xsignature.verifySignature>;
    /** Method form of `verifySignatureFrom` from `@blockchaincommons/envelope/signature`. */
    verifySignatureFrom(
      ...args: Tail<Parameters<typeof xsignature.verifySignatureFrom>>
    ): ReturnType<typeof xsignature.verifySignatureFrom>;
    /** Method form of `verifySignatureFromReturningMetadata` from `@blockchaincommons/envelope/signature`. */
    verifySignatureFromReturningMetadata(
      ...args: Tail<Parameters<typeof xsignature.verifySignatureFromReturningMetadata>>
    ): ReturnType<typeof xsignature.verifySignatureFromReturningMetadata>;
    /** Method form of `verifySignaturesFrom` from `@blockchaincommons/envelope/signature`. */
    verifySignaturesFrom(
      ...args: Tail<Parameters<typeof xsignature.verifySignaturesFrom>>
    ): ReturnType<typeof xsignature.verifySignaturesFrom>;
    /** Method form of `verifySignaturesFromThreshold` from `@blockchaincommons/envelope/signature`. */
    verifySignaturesFromThreshold(
      ...args: Tail<Parameters<typeof xsignature.verifySignaturesFromThreshold>>
    ): ReturnType<typeof xsignature.verifySignaturesFromThreshold>;
    /** Method form of `sskrSplit` from `@blockchaincommons/envelope/sskr`. */
    sskrSplit(
      ...args: Tail<Parameters<typeof xsskr.sskrSplit>>
    ): ReturnType<typeof xsskr.sskrSplit>;
    /** Method form of `addType` from `@blockchaincommons/envelope/types`. */
    addType(...args: Tail<Parameters<typeof xtypes.addType>>): ReturnType<typeof xtypes.addType>;
    /** Method form of `expectType` from `@blockchaincommons/envelope/types`. */
    expectType(
      ...args: Tail<Parameters<typeof xtypes.expectType>>
    ): ReturnType<typeof xtypes.expectType>;
    /** Method form of `expectTypeValue` from `@blockchaincommons/envelope/types`. */
    expectTypeValue(
      ...args: Tail<Parameters<typeof xtypes.expectTypeValue>>
    ): ReturnType<typeof xtypes.expectTypeValue>;
    /** Method form of `getType` from `@blockchaincommons/envelope/types`. */
    getType(...args: Tail<Parameters<typeof xtypes.getType>>): ReturnType<typeof xtypes.getType>;
    /** Method form of `hasType` from `@blockchaincommons/envelope/types`. */
    hasType(...args: Tail<Parameters<typeof xtypes.hasType>>): ReturnType<typeof xtypes.hasType>;
    /** Method form of `hasTypeValue` from `@blockchaincommons/envelope/types`. */
    hasTypeValue(
      ...args: Tail<Parameters<typeof xtypes.hasTypeValue>>
    ): ReturnType<typeof xtypes.hasTypeValue>;
    /** Method form of `types` from `@blockchaincommons/envelope/types`. */
    types(...args: Tail<Parameters<typeof xtypes.types>>): ReturnType<typeof xtypes.types>;
    /** Method form of `diagnostic` from `@blockchaincommons/envelope/format`. */
    diagnostic(
      ...args: Tail<Parameters<typeof xdiagnostic.diagnostic>>
    ): ReturnType<typeof xdiagnostic.diagnostic>;
    /** Method form of `hex` from `@blockchaincommons/envelope/format`. */
    hex(...args: Tail<Parameters<typeof xhex.hex>>): ReturnType<typeof xhex.hex>;
    /** Method form of `mermaidFormat` from `@blockchaincommons/envelope/format`. */
    mermaidFormat(
      ...args: Tail<Parameters<typeof xmermaid.mermaidFormat>>
    ): ReturnType<typeof xmermaid.mermaidFormat>;
    /** Method form of `format` from `@blockchaincommons/envelope/format`. */
    format(...args: Tail<Parameters<typeof xnotation.format>>): ReturnType<typeof xnotation.format>;
    /** Method form of `formatFlat` from `@blockchaincommons/envelope/format`. */
    formatFlat(
      ...args: Tail<Parameters<typeof xnotation.formatFlat>>
    ): ReturnType<typeof xnotation.formatFlat>;
    /** Method form of `shortId` from `@blockchaincommons/envelope/format`. */
    shortId(...args: Tail<Parameters<typeof xtree.shortId>>): ReturnType<typeof xtree.shortId>;
    /** Method form of `summary` from `@blockchaincommons/envelope/format`. */
    summary(
      ...args: Tail<Parameters<typeof xenvelope_summary.summary>>
    ): ReturnType<typeof xenvelope_summary.summary>;
    /** Method form of `treeFormat` from `@blockchaincommons/envelope/format`. */
    treeFormat(
      ...args: Tail<Parameters<typeof xtree.treeFormat>>
    ): ReturnType<typeof xtree.treeFormat>;
    /** Method form of `encryptToRecipient` from `@blockchaincommons/envelope/seal`. */
    encryptToRecipient(
      ...args: Tail<Parameters<typeof xseal.encryptToRecipient>>
    ): ReturnType<typeof xseal.encryptToRecipient>;
    /** Method form of `seal` from `@blockchaincommons/envelope/seal`. */
    seal(...args: Tail<Parameters<typeof xseal.seal>>): ReturnType<typeof xseal.seal>;
    /** Method form of `unseal` from `@blockchaincommons/envelope/seal`. */
    unseal(...args: Tail<Parameters<typeof xseal.unseal>>): ReturnType<typeof xseal.unseal>;
  }

  namespace Envelope {
    /** Static form of `attachment` from `@blockchaincommons/envelope/attachment`. */
    const attachment: typeof xattachment.attachment;
    /** Static form of `sskrJoin` from `@blockchaincommons/envelope/sskr`. */
    const sskrJoin: typeof xsskr.sskrJoin;
  }
}

const proto = Envelope.prototype as unknown as Record<string, unknown>;
const statics = Envelope as unknown as Record<string, unknown>;
/* eslint-disable @typescript-eslint/no-explicit-any */
function install(name: string, fn: (envelope: Envelope, ...args: any[]) => unknown): void {
  if (Object.prototype.hasOwnProperty.call(proto, name)) return;
  Object.defineProperty(proto, name, {
    value: function (this: Envelope, ...args: any[]) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      return fn(this, ...args);
    },
    writable: true,
    configurable: true,
  });
}
install("addAttachment", xattachment.addAttachment);
install("attachmentConformsTo", xattachment.attachmentConformsTo);
install("attachmentPayload", xattachment.attachmentPayload);
install("attachmentVendor", xattachment.attachmentVendor);
install("expectAttachment", xattachment.expectAttachment);
install("attachments", xattachment.attachments);
statics["attachment"] ??= xattachment.attachment;
install("validateAttachment", xattachment.validateAttachment);
install("addEdgeEnvelope", xedge.addEdgeEnvelope);
install("edgeIsA", xedge.edgeIsA);
install("edgeSource", xedge.edgeSource);
install("edgeSubject", xedge.edgeSubject);
install("edgeTarget", xedge.edgeTarget);
install("edges", xedge.edges);
install("edgesMatching", xedge.edgesMatching);
install("validateEdge", xedge.validateEdge);
install("addRecipient", xrecipient.addRecipient);
install("decryptSubjectToRecipient", xrecipient.decryptSubjectToRecipient);
install("decryptToRecipient", xrecipient.decryptToRecipient);
install("encryptSubjectToRecipient", xrecipient.encryptSubjectToRecipient);
install("encryptSubjectToRecipients", xrecipient.encryptSubjectToRecipients);
install("encryptToRecipients", xrecipient.encryptToRecipients);
install("recipients", xrecipient.recipients);
install("addSecret", xsecret.addSecret);
install("isLockedWithPassword", xsecret.isLockedWithPassword);
install("isLockedWithSshAgent", xsecret.isLockedWithSshAgent);
install("lock", xsecret.lock);
install("lockSubject", xsecret.lockSubject);
install("unlock", xsecret.unlock);
install("unlockSubject", xsecret.unlockSubject);
install("addSignature", xsignature.addSignature);
install("addSignatures", xsignature.addSignatures);
install("hasSignatureFrom", xsignature.hasSignatureFrom);
install("hasSignatureFromReturningMetadata", xsignature.hasSignatureFromReturningMetadata);
install("hasSignaturesFrom", xsignature.hasSignaturesFrom);
install("hasSignaturesFromThreshold", xsignature.hasSignaturesFromThreshold);
install("isVerifiedSignature", xsignature.isVerifiedSignature);
install("makeSignedAssertion", xsignature.makeSignedAssertion);
install("sign", xsignature.sign);
install("signatures", xsignature.signatures);
install("verify", xsignature.verify);
install("verifyReturningMetadata", xsignature.verifyReturningMetadata);
install("verifySignature", xsignature.verifySignature);
install("verifySignatureFrom", xsignature.verifySignatureFrom);
install("verifySignatureFromReturningMetadata", xsignature.verifySignatureFromReturningMetadata);
install("verifySignaturesFrom", xsignature.verifySignaturesFrom);
install("verifySignaturesFromThreshold", xsignature.verifySignaturesFromThreshold);
statics["sskrJoin"] ??= xsskr.sskrJoin;
install("sskrSplit", xsskr.sskrSplit);
install("addType", xtypes.addType);
install("expectType", xtypes.expectType);
install("expectTypeValue", xtypes.expectTypeValue);
install("getType", xtypes.getType);
install("hasType", xtypes.hasType);
install("hasTypeValue", xtypes.hasTypeValue);
install("types", xtypes.types);
install("diagnostic", xdiagnostic.diagnostic);
install("hex", xhex.hex);
install("mermaidFormat", xmermaid.mermaidFormat);
install("format", xnotation.format);
install("formatFlat", xnotation.formatFlat);
install("shortId", xtree.shortId);
install("summary", xenvelope_summary.summary);
install("treeFormat", xtree.treeFormat);
install("encryptToRecipient", xseal.encryptToRecipient);
install("seal", xseal.seal);
install("unseal", xseal.unseal);
install("proofContainsSet", xproof.proofContainsSet);
install("proofContainsTarget", xproof.proofContainsTarget);
install("confirmContainsSet", xproof.confirmContainsSet);
install("confirmContainsTarget", xproof.confirmContainsTarget);
export * from "./index.js";
export * from "./expression.js";
export * from "./extension/attachment.js";
export * from "./extension/edge.js";
export * from "./extension/recipient.js";
export * from "./extension/secret.js";
export * from "./extension/signature.js";
export * from "./extension/sskr.js";
export * from "./extension/types.js";
export * from "./format/index.js";
export * from "./seal.js";

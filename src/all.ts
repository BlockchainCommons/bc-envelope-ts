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
import * as xsalt from "./extension/salt.js";
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
    addSaltWithLen(
      ...args: Tail<Parameters<typeof xsalt.addSaltWithLen>>
    ): ReturnType<typeof xsalt.addSaltWithLen>;
    confirmContainsTarget(
      ...args: Tail<Parameters<typeof xproof.confirmContainsTarget>>
    ): ReturnType<typeof xproof.confirmContainsTarget>;
    confirmContainsSet(
      ...args: Tail<Parameters<typeof xproof.confirmContainsSet>>
    ): ReturnType<typeof xproof.confirmContainsSet>;
    proofContainsTarget(
      ...args: Tail<Parameters<typeof xproof.proofContainsTarget>>
    ): ReturnType<typeof xproof.proofContainsTarget>;
    proofContainsSet(
      ...args: Tail<Parameters<typeof xproof.proofContainsSet>>
    ): ReturnType<typeof xproof.proofContainsSet>;
    addAttachment(
      ...args: Tail<Parameters<typeof xattachment.addAttachment>>
    ): ReturnType<typeof xattachment.addAttachment>;
    attachmentConformsTo(
      ...args: Tail<Parameters<typeof xattachment.attachmentConformsTo>>
    ): ReturnType<typeof xattachment.attachmentConformsTo>;
    attachmentPayload(
      ...args: Tail<Parameters<typeof xattachment.attachmentPayload>>
    ): ReturnType<typeof xattachment.attachmentPayload>;
    attachmentVendor(
      ...args: Tail<Parameters<typeof xattachment.attachmentVendor>>
    ): ReturnType<typeof xattachment.attachmentVendor>;
    attachmentWithVendorAndConformsTo(
      ...args: Tail<Parameters<typeof xattachment.attachmentWithVendorAndConformsTo>>
    ): ReturnType<typeof xattachment.attachmentWithVendorAndConformsTo>;
    attachments(
      ...args: Tail<Parameters<typeof xattachment.attachments>>
    ): ReturnType<typeof xattachment.attachments>;
    attachmentsWithVendorAndConformsTo(
      ...args: Tail<Parameters<typeof xattachment.attachmentsWithVendorAndConformsTo>>
    ): ReturnType<typeof xattachment.attachmentsWithVendorAndConformsTo>;
    validateAttachment(
      ...args: Tail<Parameters<typeof xattachment.validateAttachment>>
    ): ReturnType<typeof xattachment.validateAttachment>;
    addEdgeEnvelope(
      ...args: Tail<Parameters<typeof xedge.addEdgeEnvelope>>
    ): ReturnType<typeof xedge.addEdgeEnvelope>;
    edgeIsA(...args: Tail<Parameters<typeof xedge.edgeIsA>>): ReturnType<typeof xedge.edgeIsA>;
    edgeSource(
      ...args: Tail<Parameters<typeof xedge.edgeSource>>
    ): ReturnType<typeof xedge.edgeSource>;
    edgeSubject(
      ...args: Tail<Parameters<typeof xedge.edgeSubject>>
    ): ReturnType<typeof xedge.edgeSubject>;
    edgeTarget(
      ...args: Tail<Parameters<typeof xedge.edgeTarget>>
    ): ReturnType<typeof xedge.edgeTarget>;
    edges(...args: Tail<Parameters<typeof xedge.edges>>): ReturnType<typeof xedge.edges>;
    edgesMatching(
      ...args: Tail<Parameters<typeof xedge.edgesMatching>>
    ): ReturnType<typeof xedge.edgesMatching>;
    validateEdge(
      ...args: Tail<Parameters<typeof xedge.validateEdge>>
    ): ReturnType<typeof xedge.validateEdge>;
    addRecipient(
      ...args: Tail<Parameters<typeof xrecipient.addRecipient>>
    ): ReturnType<typeof xrecipient.addRecipient>;
    decryptSubjectToRecipient(
      ...args: Tail<Parameters<typeof xrecipient.decryptSubjectToRecipient>>
    ): ReturnType<typeof xrecipient.decryptSubjectToRecipient>;
    decryptToRecipient(
      ...args: Tail<Parameters<typeof xrecipient.decryptToRecipient>>
    ): ReturnType<typeof xrecipient.decryptToRecipient>;
    encryptSubjectToRecipient(
      ...args: Tail<Parameters<typeof xrecipient.encryptSubjectToRecipient>>
    ): ReturnType<typeof xrecipient.encryptSubjectToRecipient>;
    encryptSubjectToRecipients(
      ...args: Tail<Parameters<typeof xrecipient.encryptSubjectToRecipients>>
    ): ReturnType<typeof xrecipient.encryptSubjectToRecipients>;
    encryptToRecipients(
      ...args: Tail<Parameters<typeof xrecipient.encryptToRecipients>>
    ): ReturnType<typeof xrecipient.encryptToRecipients>;
    recipients(
      ...args: Tail<Parameters<typeof xrecipient.recipients>>
    ): ReturnType<typeof xrecipient.recipients>;
    addAssertionEnvelopeSalted(
      ...args: Tail<Parameters<typeof xsalt.addAssertionEnvelopeSalted>>
    ): ReturnType<typeof xsalt.addAssertionEnvelopeSalted>;
    addAssertionSalted(
      ...args: Tail<Parameters<typeof xsalt.addAssertionSalted>>
    ): ReturnType<typeof xsalt.addAssertionSalted>;
    addOptionalAssertionEnvelopeSalted(
      ...args: Tail<Parameters<typeof xsalt.addOptionalAssertionEnvelopeSalted>>
    ): ReturnType<typeof xsalt.addOptionalAssertionEnvelopeSalted>;
    addSalt(...args: Tail<Parameters<typeof xsalt.addSalt>>): ReturnType<typeof xsalt.addSalt>;
    addSaltBytes(
      ...args: Tail<Parameters<typeof xsalt.addSaltBytes>>
    ): ReturnType<typeof xsalt.addSaltBytes>;
    addSaltInRange(
      ...args: Tail<Parameters<typeof xsalt.addSaltInRange>>
    ): ReturnType<typeof xsalt.addSaltInRange>;
    addSaltInRangeUsing(
      ...args: Tail<Parameters<typeof xsalt.addSaltInRangeUsing>>
    ): ReturnType<typeof xsalt.addSaltInRangeUsing>;
    addSaltInstance(
      ...args: Tail<Parameters<typeof xsalt.addSaltInstance>>
    ): ReturnType<typeof xsalt.addSaltInstance>;
    addSaltUsing(
      ...args: Tail<Parameters<typeof xsalt.addSaltUsing>>
    ): ReturnType<typeof xsalt.addSaltUsing>;
    addSaltWithLenUsing(
      ...args: Tail<Parameters<typeof xsalt.addSaltWithLenUsing>>
    ): ReturnType<typeof xsalt.addSaltWithLenUsing>;
    addSaltWithLength(
      ...args: Tail<Parameters<typeof xsalt.addSaltWithLength>>
    ): ReturnType<typeof xsalt.addSaltWithLength>;
    addSecret(
      ...args: Tail<Parameters<typeof xsecret.addSecret>>
    ): ReturnType<typeof xsecret.addSecret>;
    isLockedWithPassword(
      ...args: Tail<Parameters<typeof xsecret.isLockedWithPassword>>
    ): ReturnType<typeof xsecret.isLockedWithPassword>;
    isLockedWithSshAgent(
      ...args: Tail<Parameters<typeof xsecret.isLockedWithSshAgent>>
    ): ReturnType<typeof xsecret.isLockedWithSshAgent>;
    lock(...args: Tail<Parameters<typeof xsecret.lock>>): ReturnType<typeof xsecret.lock>;
    lockSubject(
      ...args: Tail<Parameters<typeof xsecret.lockSubject>>
    ): ReturnType<typeof xsecret.lockSubject>;
    unlock(...args: Tail<Parameters<typeof xsecret.unlock>>): ReturnType<typeof xsecret.unlock>;
    unlockSubject(
      ...args: Tail<Parameters<typeof xsecret.unlockSubject>>
    ): ReturnType<typeof xsecret.unlockSubject>;
    addSignature(
      ...args: Tail<Parameters<typeof xsignature.addSignature>>
    ): ReturnType<typeof xsignature.addSignature>;
    addSignatureOpt(
      ...args: Tail<Parameters<typeof xsignature.addSignatureOpt>>
    ): ReturnType<typeof xsignature.addSignatureOpt>;
    addSignatureWithMetadata(
      ...args: Tail<Parameters<typeof xsignature.addSignatureWithMetadata>>
    ): ReturnType<typeof xsignature.addSignatureWithMetadata>;
    addSignatures(
      ...args: Tail<Parameters<typeof xsignature.addSignatures>>
    ): ReturnType<typeof xsignature.addSignatures>;
    addSignaturesOpt(
      ...args: Tail<Parameters<typeof xsignature.addSignaturesOpt>>
    ): ReturnType<typeof xsignature.addSignaturesOpt>;
    addSignaturesWithMetadata(
      ...args: Tail<Parameters<typeof xsignature.addSignaturesWithMetadata>>
    ): ReturnType<typeof xsignature.addSignaturesWithMetadata>;
    hasSignatureFrom(
      ...args: Tail<Parameters<typeof xsignature.hasSignatureFrom>>
    ): ReturnType<typeof xsignature.hasSignatureFrom>;
    hasSignatureFromReturningMetadata(
      ...args: Tail<Parameters<typeof xsignature.hasSignatureFromReturningMetadata>>
    ): ReturnType<typeof xsignature.hasSignatureFromReturningMetadata>;
    hasSignaturesFrom(
      ...args: Tail<Parameters<typeof xsignature.hasSignaturesFrom>>
    ): ReturnType<typeof xsignature.hasSignaturesFrom>;
    hasSignaturesFromThreshold(
      ...args: Tail<Parameters<typeof xsignature.hasSignaturesFromThreshold>>
    ): ReturnType<typeof xsignature.hasSignaturesFromThreshold>;
    isVerifiedSignature(
      ...args: Tail<Parameters<typeof xsignature.isVerifiedSignature>>
    ): ReturnType<typeof xsignature.isVerifiedSignature>;
    makeSignedAssertion(
      ...args: Tail<Parameters<typeof xsignature.makeSignedAssertion>>
    ): ReturnType<typeof xsignature.makeSignedAssertion>;
    sign(...args: Tail<Parameters<typeof xsignature.sign>>): ReturnType<typeof xsignature.sign>;
    signOpt(
      ...args: Tail<Parameters<typeof xsignature.signOpt>>
    ): ReturnType<typeof xsignature.signOpt>;
    signWithMetadata(
      ...args: Tail<Parameters<typeof xsignature.signWithMetadata>>
    ): ReturnType<typeof xsignature.signWithMetadata>;
    signatures(
      ...args: Tail<Parameters<typeof xsignature.signatures>>
    ): ReturnType<typeof xsignature.signatures>;
    verify(
      ...args: Tail<Parameters<typeof xsignature.verify>>
    ): ReturnType<typeof xsignature.verify>;
    verifyReturningMetadata(
      ...args: Tail<Parameters<typeof xsignature.verifyReturningMetadata>>
    ): ReturnType<typeof xsignature.verifyReturningMetadata>;
    verifySignature(
      ...args: Tail<Parameters<typeof xsignature.verifySignature>>
    ): ReturnType<typeof xsignature.verifySignature>;
    verifySignatureFrom(
      ...args: Tail<Parameters<typeof xsignature.verifySignatureFrom>>
    ): ReturnType<typeof xsignature.verifySignatureFrom>;
    verifySignatureFromReturningMetadata(
      ...args: Tail<Parameters<typeof xsignature.verifySignatureFromReturningMetadata>>
    ): ReturnType<typeof xsignature.verifySignatureFromReturningMetadata>;
    verifySignaturesFrom(
      ...args: Tail<Parameters<typeof xsignature.verifySignaturesFrom>>
    ): ReturnType<typeof xsignature.verifySignaturesFrom>;
    verifySignaturesFromThreshold(
      ...args: Tail<Parameters<typeof xsignature.verifySignaturesFromThreshold>>
    ): ReturnType<typeof xsignature.verifySignaturesFromThreshold>;
    sskrSplit(
      ...args: Tail<Parameters<typeof xsskr.sskrSplit>>
    ): ReturnType<typeof xsskr.sskrSplit>;
    sskrSplitFlattened(
      ...args: Tail<Parameters<typeof xsskr.sskrSplitFlattened>>
    ): ReturnType<typeof xsskr.sskrSplitFlattened>;
    sskrSplitUsing(
      ...args: Tail<Parameters<typeof xsskr.sskrSplitUsing>>
    ): ReturnType<typeof xsskr.sskrSplitUsing>;
    addType(...args: Tail<Parameters<typeof xtypes.addType>>): ReturnType<typeof xtypes.addType>;
    checkType(
      ...args: Tail<Parameters<typeof xtypes.checkType>>
    ): ReturnType<typeof xtypes.checkType>;
    checkTypeValue(
      ...args: Tail<Parameters<typeof xtypes.checkTypeValue>>
    ): ReturnType<typeof xtypes.checkTypeValue>;
    getType(...args: Tail<Parameters<typeof xtypes.getType>>): ReturnType<typeof xtypes.getType>;
    hasType(...args: Tail<Parameters<typeof xtypes.hasType>>): ReturnType<typeof xtypes.hasType>;
    hasTypeValue(
      ...args: Tail<Parameters<typeof xtypes.hasTypeValue>>
    ): ReturnType<typeof xtypes.hasTypeValue>;
    types(...args: Tail<Parameters<typeof xtypes.types>>): ReturnType<typeof xtypes.types>;
    diagnostic(
      ...args: Tail<Parameters<typeof xdiagnostic.diagnostic>>
    ): ReturnType<typeof xdiagnostic.diagnostic>;
    diagnosticAnnotated(
      ...args: Tail<Parameters<typeof xdiagnostic.diagnosticAnnotated>>
    ): ReturnType<typeof xdiagnostic.diagnosticAnnotated>;
    summaryWithContext(
      ...args: Tail<Parameters<typeof xenvelope_summary.summaryWithContext>>
    ): ReturnType<typeof xenvelope_summary.summaryWithContext>;
    cborBytes(...args: Tail<Parameters<typeof xhex.cborBytes>>): ReturnType<typeof xhex.cborBytes>;
    hex(...args: Tail<Parameters<typeof xhex.hex>>): ReturnType<typeof xhex.hex>;
    hexOpt(...args: Tail<Parameters<typeof xhex.hexOpt>>): ReturnType<typeof xhex.hexOpt>;
    mermaidFormat(
      ...args: Tail<Parameters<typeof xmermaid.mermaidFormat>>
    ): ReturnType<typeof xmermaid.mermaidFormat>;
    mermaidFormatOpt(
      ...args: Tail<Parameters<typeof xmermaid.mermaidFormatOpt>>
    ): ReturnType<typeof xmermaid.mermaidFormatOpt>;
    format(...args: Tail<Parameters<typeof xnotation.format>>): ReturnType<typeof xnotation.format>;
    formatFlat(
      ...args: Tail<Parameters<typeof xnotation.formatFlat>>
    ): ReturnType<typeof xnotation.formatFlat>;
    formatOpt(
      ...args: Tail<Parameters<typeof xnotation.formatOpt>>
    ): ReturnType<typeof xnotation.formatOpt>;
    shortId(...args: Tail<Parameters<typeof xtree.shortId>>): ReturnType<typeof xtree.shortId>;
    summary(...args: Tail<Parameters<typeof xtree.summary>>): ReturnType<typeof xtree.summary>;
    treeFormat(
      ...args: Tail<Parameters<typeof xtree.treeFormat>>
    ): ReturnType<typeof xtree.treeFormat>;
    encryptToRecipient(
      ...args: Tail<Parameters<typeof xseal.encryptToRecipient>>
    ): ReturnType<typeof xseal.encryptToRecipient>;
    seal(...args: Tail<Parameters<typeof xseal.seal>>): ReturnType<typeof xseal.seal>;
    sealOpt(...args: Tail<Parameters<typeof xseal.sealOpt>>): ReturnType<typeof xseal.sealOpt>;
    unseal(...args: Tail<Parameters<typeof xseal.unseal>>): ReturnType<typeof xseal.unseal>;
  }

  namespace Envelope {
    const newAttachment: typeof xattachment.newAttachment;
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
install("attachmentWithVendorAndConformsTo", xattachment.attachmentWithVendorAndConformsTo);
install("attachments", xattachment.attachments);
install("attachmentsWithVendorAndConformsTo", xattachment.attachmentsWithVendorAndConformsTo);
statics["newAttachment"] ??= xattachment.newAttachment;
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
install("addAssertionEnvelopeSalted", xsalt.addAssertionEnvelopeSalted);
install("addAssertionSalted", xsalt.addAssertionSalted);
install("addOptionalAssertionEnvelopeSalted", xsalt.addOptionalAssertionEnvelopeSalted);
install("addSalt", xsalt.addSalt);
install("addSaltBytes", xsalt.addSaltBytes);
install("addSaltInRange", xsalt.addSaltInRange);
install("addSaltInRangeUsing", xsalt.addSaltInRangeUsing);
install("addSaltInstance", xsalt.addSaltInstance);
install("addSaltUsing", xsalt.addSaltUsing);
install("addSaltWithLenUsing", xsalt.addSaltWithLenUsing);
install("addSaltWithLength", xsalt.addSaltWithLength);
install("addSecret", xsecret.addSecret);
install("isLockedWithPassword", xsecret.isLockedWithPassword);
install("isLockedWithSshAgent", xsecret.isLockedWithSshAgent);
install("lock", xsecret.lock);
install("lockSubject", xsecret.lockSubject);
install("unlock", xsecret.unlock);
install("unlockSubject", xsecret.unlockSubject);
install("addSignature", xsignature.addSignature);
install("addSignatureOpt", xsignature.addSignatureOpt);
install("addSignatureWithMetadata", xsignature.addSignatureWithMetadata);
install("addSignatures", xsignature.addSignatures);
install("addSignaturesOpt", xsignature.addSignaturesOpt);
install("addSignaturesWithMetadata", xsignature.addSignaturesWithMetadata);
install("hasSignatureFrom", xsignature.hasSignatureFrom);
install("hasSignatureFromReturningMetadata", xsignature.hasSignatureFromReturningMetadata);
install("hasSignaturesFrom", xsignature.hasSignaturesFrom);
install("hasSignaturesFromThreshold", xsignature.hasSignaturesFromThreshold);
install("isVerifiedSignature", xsignature.isVerifiedSignature);
install("makeSignedAssertion", xsignature.makeSignedAssertion);
install("sign", xsignature.sign);
install("signOpt", xsignature.signOpt);
install("signWithMetadata", xsignature.signWithMetadata);
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
install("sskrSplitFlattened", xsskr.sskrSplitFlattened);
install("sskrSplitUsing", xsskr.sskrSplitUsing);
install("addType", xtypes.addType);
install("checkType", xtypes.checkType);
install("checkTypeValue", xtypes.checkTypeValue);
install("getType", xtypes.getType);
install("hasType", xtypes.hasType);
install("hasTypeValue", xtypes.hasTypeValue);
install("types", xtypes.types);
install("diagnostic", xdiagnostic.diagnostic);
install("diagnosticAnnotated", xdiagnostic.diagnosticAnnotated);
install("summaryWithContext", xenvelope_summary.summaryWithContext);
install("cborBytes", xhex.cborBytes);
install("hex", xhex.hex);
install("hexOpt", xhex.hexOpt);
install("mermaidFormat", xmermaid.mermaidFormat);
install("mermaidFormatOpt", xmermaid.mermaidFormatOpt);
install("format", xnotation.format);
install("formatFlat", xnotation.formatFlat);
install("formatOpt", xnotation.formatOpt);
install("shortId", xtree.shortId);
install("summary", xtree.summary);
install("treeFormat", xtree.treeFormat);
install("encryptToRecipient", xseal.encryptToRecipient);
install("seal", xseal.seal);
install("sealOpt", xseal.sealOpt);
install("unseal", xseal.unseal);
install("proofContainsSet", xproof.proofContainsSet);
install("proofContainsTarget", xproof.proofContainsTarget);
install("confirmContainsSet", xproof.confirmContainsSet);
install("confirmContainsTarget", xproof.confirmContainsTarget);
install("addSaltWithLen", xsalt.addSaltWithLen);
export * from "./index.js";
export * from "./expression.js";
export * from "./extension/attachment.js";
export * from "./extension/edge.js";
export * from "./extension/recipient.js";
export * from "./extension/salt.js";
export * from "./extension/secret.js";
export * from "./extension/signature.js";
export * from "./extension/sskr.js";
export * from "./extension/types.js";
export * from "./format/diagnostic.js";
export * from "./format/envelope-summary.js";
export * from "./format/hex.js";
export * from "./format/mermaid.js";
export * from "./format/notation.js";
export * from "./format/tree.js";
export * from "./seal.js";

/**
 * How errors from the layers below (dcbor, components) enter an
 * `EnvelopeError`. Internal: not part of any entry point.
 *
 * The reference converts a `dcbor::Error` into its own `Error::Cbor` with
 * `?` at internal sites (`dcbor error: <Display>`), returns the dcbor error
 * itself from decoders (`try_from_cbor_data`, `TryFrom<CBOR>`), and wraps a
 * `bc_components::Error` as `Error::Components` (`components error:
 * <Display>`). These helpers give the port the same three renderings.
 */
import { CborError } from "@blockchaincommons/dcbor";
import { ComponentsError } from "@blockchaincommons/components";
import { EnvelopeError } from "./error.js";

/**
 * The `CborError` a thrown value stands for: a `CborError` is itself; a
 * `ComponentsError` with code `Cbor` is its `CborError` cause when it has
 * one, else `Custom` of its bare message (the reference's `TryFrom<CBOR>`
 * types return the dcbor error unwrapped); an `EnvelopeError` is `Custom`
 * of its message, as the reference's `.map_err(|e| e.to_string())` renders
 * it; anything else is `Custom` of its text.
 */
export function cborErrorOf(error: unknown): CborError {
  if (CborError.isCborError(error)) return error;
  if (ComponentsError.isComponentsError(error) && error.code === "Cbor") {
    if (CborError.isCborError(error.cause)) return error.cause;
    const message = "message" in error.details ? error.details.message : error.message;
    return CborError.custom(message);
  }
  if (EnvelopeError.isEnvelopeError(error)) return CborError.custom(error.message);
  return CborError.custom(error instanceof Error ? error.message : String(error));
}

/**
 * The `Cbor` error an internal `?` site throws: `dcbor error: <Display>`
 * with the dcbor error as `cause` (the reference's `From<dcbor::Error> for
 * Error`).
 */
export function cborErrorAt(error: unknown): EnvelopeError {
  const cause = cborErrorOf(error);
  return EnvelopeError.cbor(cause.message, cause);
}

/**
 * The `Components` error a failed components call throws: `components
 * error: <Display>` with the `ComponentsError` as `cause` (the reference's
 * `From<bc_components::Error> for Error`). Any other value is returned as
 * it is, so an `EnvelopeError` raised inside the call propagates unchanged.
 */
export function wrapComponents(error: unknown): unknown {
  if (ComponentsError.isComponentsError(error)) {
    return EnvelopeError.components(error.message, error);
  }
  return error;
}

/** Runs `action`; a `ComponentsError` it throws becomes `Components` (see `wrapComponents`). */
export function viaComponents<T>(action: () => T): T {
  try {
    return action();
  } catch (error) {
    throw wrapComponents(error);
  }
}

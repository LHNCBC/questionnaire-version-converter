
// Common functions used by the converters.

export {
  createMsg,
  updateRetStatus
}


/**
 * Create a new message object to be used in the return object of some of the functions.
 * The returned message object has the following fields:
 * - ctxId: the context id, which has the value idOrCtx.linkId || idOrCtx.id || idOrCtx || 'unknown'.
 *          The intention is to use item.linkId for item, questionnaire.id for questionnaire, and
 *          allows the specification of the context id directly.
 * - status: the status code related to this message, the code definition is the same as that
 *           specified in updateRetStatus().
 * - text: the message text.
 * @param idOrCtx an id or context object (questionnaire resource or item) to identify whom the message is about.
 * @param status the conversion status code, see updateRetStatus() for more details
 * @param text the message text.
 * @return the message object created.
 */
function createMsg(idOrCtx, status, text) {
  const ctxId = typeof idOrCtx === 'string' && idOrCtx || idOrCtx?.linkId || idOrCtx?.id || 'unknown';
  return {ctxId, status, text};
}


/**
 * A convenient function for updating the given ret (return) object, which can have the following
 * known fields and any other fields that this function does not care about.
 * . status: the status code, required:
 *    1: conversion completed with-success
 *    0: conversion completed with-warning
 *   -1: conversion completed with-loss, i.e., some elements may have been dropped.
 *   -2: conversion aborted due to unexpected errors.
 * . message: an optional list of message objects, see createMsg() for more details.
 * . data: the optional result value (object or primitive), can be set directly outside of this function.
 * Note that the ret.status is updated only if the given status is less/worse than the existing value.
 * @param ret the result object, see the description above.
 * @param status the status code, see the description above.
 * @param message a single message object or a list of message objects, see the description above.
 * @return the updated ret object.
 */
function updateRetStatus(ret, status, message) {
  if(status < ret.status) {
    ret.status = status;
  }
  if(message) {
    (ret.message = ret.message || []).push(...(Array.isArray(message)? message: [message]));
  }

  return ret;
}

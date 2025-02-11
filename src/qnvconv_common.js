
// Common functions used by the converters.

const path = require("path");

module.exports = {
  createMsg,
  updateRetStatus,
  newPathFrom
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


/**
 * Create a new file path based on a given file path.
 * Whether the created file path is absolute or relative depends on if the newDir (if specified) or
 * the srcFilePath, is absolute or not.
 * If neither newDir nor suffix is provided, the same path will be returned.
 * @param srcFilePath the file path to be based on, required
 * @param newDir the directory for the newly created file (path), optional, default to the input file's directory.
 * @param suffix an suffix to be added to the end (but before the extension, if any) of the file base name
 * @param ext an optional file name extension, only used to decide where the suffix should be added.
 */
function newPathFrom(srcFilePath, newDir, suffix, ext) {
  newDir = newDir || path.dirname(srcFilePath);
  return path.join(newDir, path.basename(srcFilePath, ext || '') + (suffix || '') + (ext || ''));
}
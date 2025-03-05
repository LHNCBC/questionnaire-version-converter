
// Functions for FHIR Questionnaire conversion between R4 and R5

import {createMsg, updateRetStatus} from './qnvconv_common.js';

export {
  qnR4ToR5,
  qnR5ToR4
}

/**
 * Converting the given FHIR questionnaire resource from R4 to R5.
 * @param r4qn the R4 questionnaire to convert
 * @return the result object that has the fields: data, status, and message, where
 *         data is the converted questionnaire. See updateRetStatus() for more details.
 */
function qnR4ToR5(r4qn) {
  if(r4qn.resourceType !== 'Questionnaire') {
    return {status: 0, data: r4qn, message: [createMsg(r4qn, 0, 'Not a Questionnaire resource')]}
  }
  let r5qn = JSON.parse(JSON.stringify(r4qn)); // make a deep copy

  let ret = {status: 1, data: r5qn};
  for(let item of r5qn.item || []) {
    let subRet = qnItemR4ToR5(item);
    updateRetStatus(ret, subRet.status, subRet.message)
  }

  return ret;
}


/**
 * Converting the given questionnaire item from R4 to R5, in place.
 * @param item the questionnaire item to be converted from R4 to R5.
 * @return a result object with two fields, status and data (the converted item).
 *         See updateRetStatus() for more details
 */
function qnItemR4ToR5(item) {
  if(item.type === 'choice') { // implies Coding answer options
    item.type = 'coding'; // the answerOptions are fine
  }
  else if(item.type === 'open-choice') {
    item.type = 'coding';
    item.answerConstraint = 'optionsOrString';
  }

  for(let subItem of item.item || []) {
    qnItemR4ToR5(subItem);
  }

  return {status: 1, data: item};
}


/**
 * Converting the given FHIR questionnaire resource from R5 to R4.
 * @param r5qn the R5 questionnaire to convert.
 * @return the result object that has the fields: data, status, and message, where
           data is the converted questionnaire. See updateRetStatus() for more details.
 */
function qnR5ToR4(r5qn) {
  if(r5qn.resourceType !== 'Questionnaire') {
    return {status: 0, data: r5qn, message: [createMsg(r5qn, 0, 'Not a Questionnaire resource')]}
  }
  let r4qn = JSON.parse(JSON.stringify(r5qn)); // make a deep copy

  let ret = {status: 1, data: r4qn};
  for(let item of r4qn.item || []) {
    let subRet = qnItemR5ToR4(item);
    updateRetStatus(ret, subRet.status, subRet.message);
  }
  if(r4qn.copyrightLabel) {
    delete r4qn.copyrightLabel;
    updateRetStatus(ret, -1, createMsg(r4qn, -1, 'deleted copyrightLabel'));
  }

  return ret;
}


/**
 * Converting R5 item to R4 item.
 * @param item the R5 item to convert.
 * @return the "return object", see updateRetStatus() for more details
 */
function qnItemR5ToR4(item) {
  let ret = {status: 1, data: item}; // successful

  if(item.answerOption?.length || item.answerValueSet) {
    if(item.type === 'coding') {
      if(item.answerConstraint === 'optionsOrType') {
        item.type = 'open-choice';
        updateRetStatus(ret, 0, createMsg(item, 0, 'optionsOrType with type coding is converted as open-choice'));
      }
      else {
        item.type = item.answerConstraint === 'optionsOrString'? 'open-choice': 'choice'
      }
    }
    else {
      if(item.answerConstraint && item.answerConstraint !== 'optionsOnly') {
        updateRetStatus(ret, -1, createMsg(item, -1,
          item.answerConstraint + ': non-coding, non-optionsOnly answerOption treated as options-only.'));
      }
    }
  }
  else if(item.type === 'coding') {
    // This may happen only if some list is specified by some extension(s). For now, we are converting
    // such items to type choice or open-choice based on the value (or absence) of the answerConstraint.
    item.type = (item.answerConstraint && item.answerConstraint !== 'optionsOnly')? 'open-choice': 'choice';
    updateRetStatus(ret, 0, createMsg(item, 0, 'Item of type coding converted to ' + item.type));
  }
  else if(item.answerConstraint) { // no equivalence in R4
    updateRetStatus(ret, -1, createMsg(item, -1,
      'Unable to handle answerConstraint without answerOption/answerValueSet for type ' + item.type));
  }

  delete item.answerConstraint;
  for(let alg in ['versionAlgorithmCoding', 'versionAlgorithmString', 'disabledDisplay']) {
    if(item[alg]) {
      delete item[alg];
      updateRetStatus(ret, -1, createMsg(item, -1, 'Dropped ' + alg));
    }
  }

  for(let subItem of item.item || []) {
    let subRet = qnItemR5ToR4(subItem);
    updateRetStatus(ret, subRet.status, subRet.message);
  }

  return ret;
}


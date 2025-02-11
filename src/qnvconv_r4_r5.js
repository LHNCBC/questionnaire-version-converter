
// Functions for FHIR Questionnaire conversion between R4 and R5

const {createMsg, updateRetStatus} = require('./qnvconv_common');

module.exports = {
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
  if(! r5qn.meta) r5qn.meta = {};
  r5qn.meta.profile = ["http://hl7.org/fhir/5.0/StructureDefinition/Questionnaire"];
  (r5qn.meta.tag = r5qn.meta.tag || []).push({code: 'lhc-qn-converter-R4toR5'})

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
  if(! r4qn.meta) r4qn.meta = {};
  r4qn.meta.profile = ["http://hl7.org/fhir/4.0/StructureDefinition/Questionnaire"];
  (r4qn.meta.tag = r4qn.meta.tag || []).push({code: 'lhc-qn-converter-R5toR4'})

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



// Converting FHIR Questionnaire resources between versions.
// The current conversions are hand-coded. If the scope goes beyond a few versions of
// questionnaires, other options, such as some template or DSL languages, should be explored.
// Specifically, explore the "<version> Conversions" tab on the HL7's page on Questionnaire, which
// was discovered after the work is done, e.g., for R4:
//   https://hl7.org/fhir/R4/questionnaire-version-maps.html
// - it is assumed that the input questionnaire resource is valid
// - conversion continues in the face of errors but records any warnings or errors at the
//   item level and returned in the result object (result.message) - see updateRetStatus()
//   for more details on the format of result objects returned by the functions.

// General notes on Questionnaire.meta:
// - preserved: version, lastUpdated(?), source
// - updated: add a new tag indicating the conversion
// - updated: remove all existing profile and add the profile for the target version;

import {qnR3ToR4, qnR4ToR3} from './qnvconv_stu3_r4.js';
import {qnR4ToR5, qnR5ToR4} from './qnvconv_r4_r5.js';
import {updateRetStatus} from './qnvconv_common.js';

// FHIR version conversion function table - note that STU3 is R3 in this table.
const qnVerConverters = {
  'R4-to-R5': qnR4ToR5,
  'R5-to-R4': qnR5ToR4,
  'R3-to-R4': qnR3ToR4,
  'R4-to-R3': qnR4ToR3
}
const supportedVersions = [... new Set(Object.keys(qnVerConverters).map(k => k.substring(0, 2)))]
  .sort().map(v => v==='R3'? 'STU3': v);

export {
  getConverter,
  convert
};


/**
 * Get the converter function for converting from version vFrom to vTo. If the two
 * versions aren't adjacent (e.g., STU3 to R5), the returned function will be a newly
 * composed anonymous function that performs the conversion one version step at a time.
 * @param vFrom the from version
 * @param vTo the to/target version.
 * @return A function that performs the conversion, or null if the versions are invalid
 *         or the conversion isn't supported yet. The returned converter function:
 *         - takes one single input parameter that is the questionnaire resource, and
 *         - returns a result object with status, data, and message, where the data is the
 *           converted resource. See updateRetStatus() for more details on status and message.
 */
function getConverter(vFrom, vTo) {
  let converterKey = (vn1, vn2) => `R${vn1}-to-R${vn2}`; // key in the qnVerConverters table.
  // get the numeric version numbers to compute chained conversion for non-adjacent versions.
  let [vnFrom, vnTo] = [vFrom, vTo].map(v => parseInt(v.match(/^(STU|R)([0-9]+)/i)?.[2] || -1));
  if(vnFrom < 0 || vnTo < 0 || Math.abs(vnTo - vnFrom) < 1) {
    return null;
  }

  // Version number chain between (and including) the two given versions
  let vnChain = Array(Math.abs(vnTo-vnFrom)+1).fill(0).map((_, i) => vnFrom + (vnFrom < vnTo? i: -i));
  let converters = [];
  for(let i=1; i < vnChain.length; ++i) {
    let converter = qnVerConverters[converterKey(vnChain[i-1], vnChain[i])];
    if(! converter) return null;
    converters.push(converter);
  }
  console.log('==== converter chain:', converters.map(c => c.name));

  // composed and return a function that runs all the converters selected above.
  return (qnJson) => {
    let stepResult = {data: qnJson};
    let finalResult = {status: 1};

    for(let converter of converters) {
      console.log('==== running converter', converter.name);
      stepResult = converter(stepResult.data);
      updateRetStatus(finalResult, stepResult.status, stepResult.message);
    }
    if(stepResult.data) {
      finalResult.data = stepResult.data;
    }

    return finalResult;
  };
}


/**
 * Convert the given FHIR questionnaire from version vFrom to version vTo.
 * @param qnJson the FHIR questionnaire resource in json
 * @param vFrom the FHIR version of the input questionnaire
 * @param vTo the FHIR version to convert to
 * @return an object with 3 fields:
 *         - status: the status code of the conversion. See updateRetStatus() for more details
 *         - data: the converted questionnaire
 *         - message: a list (may not present) of warning/error message objects. See updateRetStatus() for more details
 */
function convert(qnJson, vFrom, vTo) {
  if(! supportedVersions.includes(vFrom) || ! supportedVersions.includes(vTo)) {
    throw new Error('Unsupported FHIR version. Versions currently supported are: ' + supportedVersions.join(', '));
  }
  const convertFunc = getConverter(vFrom, vTo);
  return convertFunc(qnJson);
}

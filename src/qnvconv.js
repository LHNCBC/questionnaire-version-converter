
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

// There is an entry for each supported version; versions must be listed in strictly increasing order.
// The fields are:
// - ver: the FHIR version
// - up_conv: the converter function for converting from this version to the next higher version in this list
// - down_conv: the converter function for converting from this version to the next lower version in this list
// - profile: the profile string of the version.
// - index: the index number in this list - added at the end using the map() operation.
// Note that:
// - R4 and R4B are the same for Questionnaire resource but with different meta.profile.
// - the tag and profile for the converted questionnaire are set outside the converters.
const qnConverterTable = [
  { ver: 'STU3',
    up_conv: qnR3ToR4,
    profile: 'http://hl7.org/fhir/3.0/StructureDefinition/Questionnaire'
  },
  { ver: 'R4',
    up_conv: qnNoOpConv,
    down_conv: qnR4ToR3,
    profile: 'http://hl7.org/fhir/4.0/StructureDefinition/Questionnaire'
  },
  { ver: 'R4B',
    up_conv: qnR4ToR5,
    down_conv: qnNoOpConv,
    profile: 'http://hl7.org/fhir/4.3/StructureDefinition/Questionnaire'
  },
  { ver: 'R5',
    down_conv: qnR5ToR4,
    profile: 'http://hl7.org/fhir/5.0/StructureDefinition/Questionnaire'
  },
].map((v, index) => { v.index = index; return v; });

// A mapping from the FHIR version to the version info object in the qnConverterTable above.
const qnConverterMap = qnConverterTable.reduce((acc, v) => { acc[v.ver] = v; return acc; }, {});

const supportedVersions = Object.keys(qnConverterMap);


/**
 * A NO-OP converter that does nothing and return the input questionnaire itself in the data field.
 * @param qn the input questionnaire to convert
 * @return the result object that has the fields: data, status, and message, where
 *         data is the converted questionnaire. See updateRetStatus() for more details.
 */
function qnNoOpConv(qn) {
  return {status: 1, data: qn}
}


export {
  getConverter,
  convert,
  supportedVersions
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
  if(vFrom === vTo || !qnConverterMap[vFrom] || !qnConverterMap[vTo]) {
    return null;
  }

  let vIndexFr = qnConverterMap[vFrom].index;
  let vIndexTo = qnConverterMap[vTo].index;
  let vIndexChain = Array(Math.abs(vIndexTo-vIndexFr)).fill(0).map((_, i) => vIndexFr + (vIndexFr < vIndexTo? i: -i));

  let funcKey = vIndexFr < vIndexTo? 'up_conv': 'down_conv';
  let converters = vIndexChain.map(vIndex => qnConverterTable[vIndex][funcKey]);

  /**
   * The combined converter function that executes the chain of converters in sequence.
   * @param qnJson the questionnaire resource to be converted
   * @return the result object that has the fields: data, status, and message, where
   *         data is the converted questionnaire. See updateRetStatus() for more details
   */
  function chainedConverter(qnJson) {
    let stepResult = {data: qnJson};
    let finalResult = {status: 1};

    for(let converter of converters) {
      stepResult = converter(stepResult.data);
      updateRetStatus(finalResult, stepResult.status, stepResult.message);
    }
    if(stepResult.data) {
      finalResult.data = stepResult.data;
      updateMeta(finalResult.data, vFrom, vTo);
    }

    return finalResult;
  }
  chainedConverter._versionChain = vIndexChain.map(idx => qnConverterTable[idx].ver); // for internal evaluation/troubleshooting use.
  chainedConverter._versionChain.push(qnConverterMap[vTo].ver);

  return chainedConverter;
}


/**
 * Update the meta field of the converted questionnaire. Specifically:
 * - remove all existing profiles and set to the profile corresponding to vTo.
 * - add a new tag to record this conversion.
 * @param qn the converted questionnaire resource
 * @param vFrom the FHIR version converted from
 * @param vTo the FHIR version converted to
 */
function updateMeta(qn, vFrom, vTo) {
  qn.meta = qn.meta || {};
  qn.meta.profile = [ qnConverterMap[vTo].profile ];

  let convTag = {
    code: `lhc-qnvconv-${vFrom}-to-${vTo}`,
    display: `Converted from ${vFrom} to ${vTo} by the LHC Questionnaire Version Converter`
  };

  (qn.meta.tag = qn.meta.tag || []).push(convTag);
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
  if(! qnConverterMap[vFrom] || ! qnConverterMap[vTo]) {
    throw new Error('Unsupported FHIR version. Versions currently supported are: ' + Object.keys(qnConverterMap).join(', '));
  }
  const convertFunc = getConverter(vFrom, vTo);
  return convertFunc(qnJson);
}

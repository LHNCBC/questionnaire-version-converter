import { strict as assert } from 'assert';
import * as fs from 'fs';
import * as path from "path";
import { getConverter } from '../../src/qnvconv.js';
import { newPathFrom } from "../../src/cli_util.js";

// A map of the supported FHIR versions (mapped to itself)
const FHIR_V = ['STU3', 'R4', 'R4B', 'R5'].reduce((acc, v) => {acc[v] = v; return acc;}, {});

const __dirname= import.meta.dirname;
const testFiles = {
  STU3: path.resolve(__dirname, '../data/qn-ver-conv-test-stu3base.json'),
  R4: path.resolve(__dirname, '../data/qn-ver-conv-test-r4base.json'),
  R4B: path.resolve(__dirname, '../data/qn-ver-conv-test-r4bbase.json'),
  R5: path.resolve(__dirname, '../data/qn-ver-conv-test-r5base.json'),
  output: path.resolve(__dirname, '../data/output')
}

let PROFILE = {
  STU3: 'http://hl7.org/fhir/3.0/StructureDefinition/Questionnaire',
  R4: 'http://hl7.org/fhir/4.0/StructureDefinition/Questionnaire',
  R4B: 'http://hl7.org/fhir/4.3/StructureDefinition/Questionnaire',
  R5: 'http://hl7.org/fhir/5.0/StructureDefinition/Questionnaire'
}

fs.mkdirSync(testFiles.output, {recursive: true});

/**
 * Test questionnaire conversion from the vFrom to vto.
 * @param vFrom from FHIR version
 * @param vTo to FHIR version
 * @param callback a callback function that takes 2 parameters:
 *        - converted: boolean, true if converted, false if aborted due to unexpected errors.
 *        - qnFrom: the questionnaire before the conversion
 *        - qnTo: the questionnaire after the conversion.
 */
function testQnVerConv(vFrom, vTo, callback) {
  const qnFile = testFiles[vFrom];
  const inRes = JSON.parse(fs.readFileSync(qnFile));
  const converter = getConverter(vFrom, vTo);
  if(! converter) {
    console.log('Unable to obtain converter from %s to %s', vFrom, vTo);
    callback(false);
    return;
  }
  let convRet = converter(inRes);

  // write the converted questionnaire and messages to file for possible manual inspection
  fs.writeFileSync(newPathFrom(qnFile, testFiles.output, '-' + vTo, '.json'), JSON.stringify(convRet.data, null, 4));
  fs.writeFileSync(newPathFrom(qnFile, testFiles.output, '-msg-' + vTo, '.json'), JSON.stringify(convRet.message||[], null, 4));

  callback(convRet.status > -2, inRes, convRet.data);
}


describe('FHIR Questionnaire version conversion', function() {
  it('should work from STU3 to R4', function(done) {
    testQnVerConv(FHIR_V.STU3, FHIR_V.R4, (converted, qnFrom, qnTo) => {
      assert(!!converted);
      assert.equal(qnTo.meta.profile[0], PROFILE.R4);
      assert(qnTo.meta?.tag?.find(t => t.code === 'lhc-qnvconv-STU3-to-R4')); // the conversion is tagged

      let x002 = qnTo.item.find(t => t.linkId === '/X-002');
      assert(x002);
      assert.equal(x002.enableWhen[0].operator, '=');
      assert.equal(x002.initial[0].valueString, 'Mint');

      let x003 = qnTo.item.find(t => t.linkId === '/X-003');
      assert(x003);
      assert.equal(x003.answerOption[0].valueCoding.code, 'c');

      let x011 = qnTo.item.find(t => t.linkId === '/X-011');
      assert(x011);
      assert.equal(x011.enableWhen[0].operator, 'exists');
      assert.equal(x011.enableWhen[0].answerBoolean, true);

      done();
    });
  });


  it('should work from R4 to STU3', function(done) {
    testQnVerConv(FHIR_V.R4, FHIR_V.STU3, (converted, qnFrom, qnTo) => {
      assert(!!converted);
      assert(qnTo.meta?.tag?.find(t => t.code === 'lhc-qnvconv-R4-to-STU3')); // the conversion is tagged
      assert(!qnTo.derivedFrom);

      let x002 = qnTo.item.find(t => t.linkId === '/X-002');
      assert(x002);
      assert(!x002.enableWhen[0].operator);
      assert.equal(x002.enableWhen[0].answerString, 'ice cream');
      assert.equal(x002.initialString, 'Mint');

      let x003 = qnTo.item.find(t => t.linkId === '/X-003');
      assert(x003);
      assert.equal(x003.option[0].valueCoding.code, 'c');
      assert.equal(Object.hasOwnProperty(x003.option[0].initialSelected), false);
      assert.equal(x003.initialCoding.code, "c");

      let x006 = qnTo.item.find(t => t.linkId === '/X-006');
      assert(x006);
      assert(!x006.enableWhen); // unable to convert operator > to STU3

      let x011 = qnTo.item.find(t => t.linkId === '/X-011');
      assert(x011);
      assert(x011.enableWhen[0].hasOwnProperty('hasAnswer'));

      done();
    });
  });

  it('should work from R4 to R5', function(done) {
    testQnVerConv(FHIR_V.R4, FHIR_V.R5, (converted, qnFrom, qnTo) => {
      assert(!!converted);
      assert(qnTo.meta?.tag?.find(t => t.code === 'lhc-qnvconv-R4-to-R5')); // the conversion is tagged

      let x003 = qnTo.item.find(t => t.linkId === '/X-003');
      assert(x003);
      assert.equal(x003.type, "coding"); // choice to coding

      let x010 = qnTo.item.find(t => t.linkId === '/X-010');
      assert(x010);
      assert(x010.answerConstraint, 'optionsOrString');
      assert(x010.type, 'coding');

      let x011 = qnTo.item.find(t => t.linkId === '/X-011');
      assert(x011);

      done();
    });
  });

  it('should work from R5 to R4', function(done) {
    testQnVerConv(FHIR_V.R5, FHIR_V.R4, (converted, qnFrom, qnTo) => {
      assert(!!converted);
      assert(qnTo.meta?.tag?.find(t => t.code === 'lhc-qnvconv-R5-to-R4')); // the conversion is tagged

      let x003 = qnTo.item.find(t => t.linkId === '/X-003');
      assert(x003);
      assert.equal(x003.type, "open-choice"); // coding + optionsOrString => open-choice

      let x010 = qnTo.item.find(t => t.linkId === '/X-010');
      assert(x010);
      assert(!x010.answerConstraint); // answerOption + optionsOrType => choice (with loss)

      done();
    });
  });

  // This is just to test that the chained-conversion works
  it('should work from STU3 to R5', function(done) {
    testQnVerConv(FHIR_V.STU3, FHIR_V.R5, (converted, qnFrom, qnTo) => {
      assert(!!converted);
      assert(qnTo.meta?.tag?.find(t => t.code === 'lhc-qnvconv-STU3-to-R5')); // the conversion is tagged

      let x010 = qnTo.item.find(t => t.linkId === '/X-010');
      assert(x010);
      assert(x010.answerConstraint, 'optionsOrString');
      assert(x010.type, 'coding');

      done();
    });
  });

  // The questionnaires are the same before and after, and the conversion path has been tested
  // in the STU3 to R5 conversion above. Only need to test the changes in meta.
  it('should work from R4 to R4B', function(done) {
    testQnVerConv(FHIR_V.R4, FHIR_V.R4B, (converted, qnFrom, qnTo) => {
      assert(!!converted);
      assert.equal(qnTo.meta.profile[0], PROFILE.R4B);
      assert(qnTo.meta?.tag?.find(t => t.code === 'lhc-qnvconv-R4-to-R4B')); // the conversion is tagged
      done();
    });
  });

  // The questionnaires are the same before and after, and the conversion path has been tested
  // in the STU3 to R5 conversion above. Only need to test the changes in meta.
  it('should work from R4B to R4', function(done) {
    testQnVerConv(FHIR_V.R4B, FHIR_V.R4, (converted, qnFrom, qnTo) => {
      assert(!!converted);
      assert.equal(qnTo.meta.profile[0], PROFILE.R4);
      assert(qnTo.meta?.tag?.find(t => t.code === 'lhc-qnvconv-R4B-to-R4')); // the conversion is tagged
      done();
    });
  });
});

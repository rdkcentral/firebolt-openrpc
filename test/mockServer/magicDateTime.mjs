/*
* Copyright 2021 Comcast Cable Communications Management, LLC
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
* http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*
* SPDX-License-Identifier: Apache-2.0
*/

// Magic Date/Time Strings

'use strict';

import moment from 'moment';
import { logger } from './logger.mjs';

/**
 * Converts any/all "magic date/time" strings into strings, epochs, etc.
 * within a body of text (a string). Returns a new string with the replacements performed.
 *
 * Useful, say, within a fake data JSON response that can "live on" and have date/time values
 * relative to "now" (when a test runs).
 *
 * Note, though, this this is just the "core" routine. See replaceDynamicDateTimeVariablesStr
 * and replaceDynamicDateTimeVariablesObj below that are the ones to use if you need to deal
 * with surrounding quotes (either wanting them or not wanting them).
 *
 * The syntax of "magic date/times" (assuming prefix '{{' and suffix '}}') looks like:
 *     {{<relativeDateTime>|<moment-style formatting string>}}
 *     -OR-
 *     {{timeSpecificRelativeDateTime|<moment-style formatting string>}}
 * where:
 *     <relativeDateTime> is of the form {+|-}{n}{<moment-style date add key or shorthand key>}
 *     <timeSpecificRelativeDateTime> is of the form HH:MM[:SS][{+|-}{n}{moment-style date add key or shorthand key>}]
 *
 * Examples:
 *     {{+15s|X}}                       15 seconds from "now" as a Unix timestamp in seconds (capital X)
 *     {{+10m|x}}                       10 minutes from "now" as a Unix timestamp in milliseconds (lowercase x)
 *     {{-2h|YYYY-MM-DD HH:mm:ssZ}}     2 hours "ago" as a string like 2015-06-15T14:22:35Z
 *     {{20:00|x}}                      8PM today as a Unix timestamp in milliseconds
 *     {{19:00+1d|x}}                   7PM tomorrow as a Unix timestamp in milliseconds
 *
 * @param {string} theString
 * @param {string} prefix   E.g., '{', '{{', '$'
 * @param {string} suffix   E.g., '}', '}}', '$'
 */
/*eslint no-unreachable: 1*/
var replaceDynamicDateTimeVariables = function(theString, prefix, suffix) {
  var done, re, found, fullDynamicDateTimeString, parts,
      part0, firstCharOfPart0, relativeDateTime, timeSpecificRelativeDateTime,
      formatString, sign, num, unitKey, hh, mm, ss, givenTimeToday,
      newRelativeDateTime, realDateString;

  // Escape special characters. E.g., '{{' becomes '\{\{'
  prefix = prefix.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
  suffix = suffix.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');

  done = false;
  while ( !done ) {
    re = new RegExp(prefix + '(.*?)' + suffix);
    found = re.exec(theString);
    if ( found ) {
      // found[0] is now something like "{{+15s|X}}" or {{20:00+1d|X}}.
      // found[1] is now something like "+15s|X" or "20:00+1d".
      fullDynamicDateTimeString = found[0];
      parts = found[1].split('|');
      if ( !parts || parts.length !== 2 ) {
        throw new Error(`Invalid dynamic date/time string: ${found[1]}`);
      }

      part0 = parts[0];
      formatString = parts[1];

      firstCharOfPart0 = part0.substr(0, 1);

      if ( firstCharOfPart0 === '+' || firstCharOfPart0 === '-' ) {
        // relativeDateTime string like "+15s"
        relativeDateTime = part0;

        // Separate relativeDateTime into the sign (1 char), the number (<n> digits), and the unit key (remainder)
        re = /^([+-])(\d+)([a-z]+)$/;
        found = re.exec(relativeDateTime);
        if ( !found || found.length < 4 ) {
          throw new Error(`Invalid relative date/time string: ${relativeDateTime}`);
        }
        sign    = found[1];
        num     = found[2];
        unitKey = found[3];

        try {
          num = parseInt(num, 10);
        } catch (ex) {
          /* istanbul ignore next */
          throw new Error(`Invalid relative date/time string (numeric portion): ${relativeDateTime}`);
        }

        // Construct the real date
        if ( sign === '+' ) {
          try {
            newRelativeDateTime = moment().add(num, unitKey);
          } catch (ex) {
            /* istanbul ignore next */
            throw new Error('Internal error 1');
          }
        /* istanbul ignore else */
        } else if ( sign === '-' ) {
          try {
            newRelativeDateTime = moment().subtract(num, unitKey);
          } catch (ex) {
            /* istanbul ignore next */
            throw new Error('Internal error 2');
          }
        } else {
          /* istanbul ignore next */
          throw new Error(`Invalid relative date/time string (+/-): ${relativeDateTime}`);
        }

        try {
          realDateString = newRelativeDateTime.format(formatString);
        } catch (ex) {
          /* istanbul ignore next */
          throw new Error('Internal error 3');
        }

      } else {

        // timeSpecificRelativeDateTime string like "20:00" or "20:00:00" or "20:00+1d" or "20:00:00+1d"
        timeSpecificRelativeDateTime = part0;

        // Separate timeSpecificRelativeDateTime into the time portion and the optional sign, num, and unitKey
        re = /^(\d+):(\d+)$/;
        found = re.exec(timeSpecificRelativeDateTime);
        if ( found && found.length >= 3 ) {
          // timeSpecificRelativeDateTime string like "20:00"
          hh          = found[1];
          mm          = found[2];
          ss          = 0;
          sign        = null;
          num          = null;
          unitKey = null;
        } else {
          re = /^(\d+):(\d+):(\d+)$/;
          found = re.exec(timeSpecificRelativeDateTime);
          if ( found && found.length >= 4 ) {
            // timeSpecificRelativeDateTime string like "19:00:05"
            hh      = found[1];
            mm      = found[2];
            ss      = found[3];
            sign    = null;
            num     = null;
            unitKey = null;
          } else {
            re = /^(\d+):(\d+)([+-])(\d+)([a-z]+)$/;
            found = re.exec(timeSpecificRelativeDateTime);
            if ( found && found.length >= 6 ) {
              // timeSpecificRelativeDateTime string like "19:00+1d"
              hh          = found[1];
              mm          = found[2];
              ss          = 0;
              sign        = found[3];
              num         = found[4];
              unitKey     = found[5];
              if ( unitKey.toLowerCase() !== 'd' ) {
                throw new Error(`Invalid relative date/time string (d only): ${timeSpecificRelativeDateTime}`);
              }
            } else {
              re = /^(\d+):(\d+):(\d+)([+-])(\d+)([a-z]+)$/;
              found = re.exec(timeSpecificRelativeDateTime);
              if ( found && found.length >= 7) {
                // timeSpecificRelativeDateTime string like 19:00:05+1d"
                hh      = found[1];
                mm      = found[2];
                ss      = found[3];
                sign    = found[4];
                num     = found[5];
                unitKey = found[6];
                if ( unitKey.toLowerCase() !== 'd' ) {
                  throw new Error(`Invalid relative date/time string (d only): ${timeSpecificRelativeDateTime}`);
                }
              } else {
                throw new Error(`Invalid relative date/time string: ${timeSpecificRelativeDateTime}`);
              }
            }
          }
        }

        try {
          if ( num ) { num = parseInt(num, 10); }
        } catch (ex) {
          /* istanbul ignore next */
          throw new Error(`Invalid relative date/time string (numeric portion): ${timeSpecificRelativeDateTime}`);
        }

        try {
          /* istanbul ignore else */
          if ( hh ) { hh = parseInt(hh, 10); }
        } catch (ex) {
          /* istanbul ignore next */
          throw new Error(`Invalid relative date/time string (hh portion): ${timeSpecificRelativeDateTime}`);
        }
  
        try {
          /* istanbul ignore else */
          if ( mm ) { mm = parseInt(mm, 10); }
        } catch (ex) {
          /* istanbul ignore next */
          throw new Error(`Invalid relative date/time string (mm portion): ${timeSpecificRelativeDateTime}`);
        }
  
        try {
          if ( ss && typeof ss === 'string' ) { ss = parseInt(ss, 10); }
        } catch (ex) {
          /* istanbul ignore next */
          throw new Error(`Invalid relative date/time string (ss portion): ${timeSpecificRelativeDateTime}`);
        }

        // Construct the real date

        // First get moment date for given time today
        givenTimeToday = moment({ hours:hh, minutes: mm, seconds: ss });

        // Now add/subtract days if asked to do so
        if ( sign === '+' ) {
          try {
            newRelativeDateTime = givenTimeToday.add(num, unitKey);
          } catch (ex) {
            /* istanbul ignore next */
            throw new Error('Internal error 4');
          }
        } else if ( sign === '-' ) {
          try {
            newRelativeDateTime = givenTimeToday.subtract(num, unitKey);
          } catch (ex) {
            /* istanbul ignore next */
            throw new Error('Internal error 5');
          }
        } else {
          newRelativeDateTime = givenTimeToday;
        }

        try {
          realDateString = newRelativeDateTime.format(formatString);
        } catch (ex) {
          /* istanbul ignore next */
          throw new Error('Internal error 6');
        }
      }

      // Replace the dynamic date/time string with the real deal
      theString = theString.replace(fullDynamicDateTimeString, realDateString);
    } else {
      done = true;
    }
  }

  return theString;
};


// Given a serialized JSON object (string), replace any/all {{+2h|x}}, etc. values with appropriately
// translated date/time strings/epochs/etc and then return the translated string object.
var replaceDynamicDateTimeVariablesStr = function(ss, prefix, suffix) {
  try {
    // If the JSON contains "foo": "\"{{+1h|x}}\"", then this will translate into "foo": "123456789000"
    ss = replaceDynamicDateTimeVariables(ss, '\\"' + prefix, suffix + '\\"');
    // If the JSON contains "foo": "{{+1h|x}}", then this will translate into "foo": 123456789000
    ss = replaceDynamicDateTimeVariables(ss, '"' + prefix, suffix + '"');
    return ss;
  } catch (ex) {
    logger.error('replaceDynamicDateTimeVariablesStr: Exception:');
    logger.error(ex);
    return ss; // Unchanged (probably)... we'll hope for the best
  }
};



// Given a JS object, replace any/all {{+2h|x}}, etc. values with appropriately
// translated date/time strings/epochs/etc and then return the traslated JSON object.
var replaceDynamicDateTimeVariablesObj = function(oJson, prefix, suffix) {
  var ss;
  try {
    ss = JSON.stringify(oJson);
    // If the object contains "foo": "\"{{+1h|x}}\"", then this will translate into "foo": "123456789000"
    ss = replaceDynamicDateTimeVariables(ss, '\\"' + prefix, suffix + '\\"');
    // If the object contains "foo": "{{+1h|x}}", then this will translate into "foo": 123456789000
    ss = replaceDynamicDateTimeVariables(ss, '"' + prefix, suffix + '"');
    // If the object contains {{+1h|x}} anywhere, then this will translate in place into 123456789000
    ss = replaceDynamicDateTimeVariables(ss, prefix, suffix);
    oJson = JSON.parse(ss);
    return oJson;
  } catch (ex) {
    logger.error('replaceDynamicDateTimeVariablesJson: Exception:');
    logger.error(ex);
    return oJson; // Unchanged... we'll hope for the best
  }
};

// --- Exports ---

export {
  replaceDynamicDateTimeVariablesStr, replaceDynamicDateTimeVariablesObj
};

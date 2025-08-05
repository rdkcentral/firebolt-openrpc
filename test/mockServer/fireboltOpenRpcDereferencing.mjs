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

// Dereferencing Logic

'use strict';

import { config } from './config.mjs';
import { getOpenRPCSources } from './util.mjs'

function isObject(thing) { return ( thing === Object(thing) ); }
function isArray(thing)  { return ( Array.isArray(thing) );    }

function ref2schemaName(ref) {
  return ref.substring(ref.lastIndexOf('/') + 1);
}

function lookupSchema(metaForSdk, ref, xSchema) {
  const schemaName = ref2schemaName(ref);
  if (xSchema) {
    return metaForSdk['x-schemas'][xSchema][schemaName]
  } else {
    return metaForSdk.components.schemas[schemaName];
  }
}

// For { foo: { '$ref': 'xxx' } }, change to { foo: <lookedUpSchema> }
function replaceRefObj(parentOfObjWithRef, keyWithinObjWithRef, lookedUpSchema) {
  parentOfObjWithRef[keyWithinObjWithRef] = Object.assign({}, lookedUpSchema, parentOfObjWithRef[keyWithinObjWithRef]);
  delete parentOfObjWithRef[keyWithinObjWithRef]['$ref'];
}

// For [ { '$ref': 'xxx' }, ... ], change to [ <lookedUpSchema>, ... ]
function replaceRefArr(arrWithItemWithRef, posInArrWithRef, lookedUpSchema) {
  arrWithItemWithRef[posInArrWithRef] = lookedUpSchema;
}

/**
 * Recursively searches through the provided schema object to detect self-referencing schemas by comparing $ref values against a provided path.
 * 
 * @param {object} schemaObj - The schema object to be checked for self-referencing.
 * @param {string} path - The reference path to compare against for self-referencing.
 * @returns {boolean} Returns true if a self-reference is detected, false otherwise.
 */
function selfReferenceSchemaCheck(schemaObj, path) {
  if (typeof schemaObj !== 'object' || schemaObj === null) {
    return false;
  }
  // check if self-refernce is present in current schema object
  if ('$ref' in schemaObj && schemaObj['$ref'] == path) {
    return true;
  }
  // check if self-reference is present in any nested objects
  for (const key in schemaObj) {
    const refValue = selfReferenceSchemaCheck(schemaObj[key], path);
    if (refValue === true) {
      return true;
    }
  }
  return false;
}

/**
 * Recursively replaces $ref keys in an object with their corresponding schemas to resolve references.
 * It avoids infinite recursion by tracking replaced references using a set. This function handles nested
 * objects and arrays but does not handle arrays of arrays. It also accounts for schemas defined under
 * "x-schemas" and "components" in the OpenRPC.
 * 
 * @param {object} metaForSdk - The metadata object which may contain the schemas for replacement.
 * @param {object|array} thing - The object or array where the replacement should occur.
 * @param {string|number} key - The key in the 'thing' object that needs to be checked and potentially replaced.
 * @param {Set} [replacedRefs] - A set to keep track of replaced references to prevent recursion. Defaults to a new Set.
 * @returns {void} This function does not return a value. It mutates the 'thing' object by reference.
 */
function replaceRefs(metaForSdk, thing, key, replacedRefs = new Set()) {
  let xSchema, lookedUpSchema;

  if (isObject(thing[key])) {
    const refKey = thing[key]['$ref'];

    if (refKey) {
      // Check if this reference was already replaced to prevent recursion.
      if (replacedRefs.has(refKey)) {
        // If already replaced, remove the $ref to avoid recursion.
        delete thing[key]['$ref'];
      } else {
        // If schema resides under x-schemas object in openRPC.
        if (refKey.includes("x-schemas")) {
          let xSchemaArray = refKey.split("/");
          xSchema = xSchemaArray.filter(element => element !== "#" && element !== "x-schemas")[0];
          lookedUpSchema = lookupSchema(metaForSdk, ref2schemaName(refKey), xSchema);
        } else {
          // Else if schema resides under components object in openRPC.
          lookedUpSchema = lookupSchema(metaForSdk, ref2schemaName(refKey));
        }

        if (lookedUpSchema && selfReferenceSchemaCheck(lookedUpSchema, refKey)) {
          // If it's a self-reference, mark it as replaced.
          replacedRefs.add(refKey);
        }

        // Replace the reference with the actual schema.
        thing[key] = lookedUpSchema || thing[key];
      }
    }

    // Recursively call replaceRefs on nested objects, passing the replacedRefs set forward.
    Object.keys(thing[key]).forEach((nestedKey) => {
      replaceRefs(metaForSdk, thing[key], nestedKey, replacedRefs);
    });
  } else if (isArray(thing[key])) {
    thing[key].forEach((item, idx) => {
      if (isObject(item)) {
        replaceRefs(metaForSdk, thing[key], idx, replacedRefs);
      }
    });
  }
}

function dereferenceSchemas(metaForSdk, methodName) {
  const methods = metaForSdk.methods;
  const matchMethods = methods.filter((method) => method.name === methodName);
  const matchMethod = matchMethods[0];
 
  replaceRefs(metaForSdk, matchMethod, 'result');
  replaceRefs(metaForSdk, matchMethod, 'params');
  replaceRefs(metaForSdk, matchMethod, 'tags');
}

function dereferenceMeta(_meta) {
  const meta = JSON.parse(JSON.stringify(_meta)); // Deep copy

  // Merge supportedOpenRPCs and supportedToAppOpenRPCs if bidirectional is enabled
  const allSdks = getOpenRPCSources();

  allSdks.forEach(({ name: sdkName }) => {
    if (sdkName in meta) {
      const metaForSdk = meta[sdkName];
      metaForSdk.methods.forEach(({ name }) => {
        dereferenceSchemas(metaForSdk, name);
      });
      delete metaForSdk.components;
    }
  });

  return meta;
}

// --- Exports ---
export const testExports = {
  replaceRefArr,
  replaceRefObj,
  isObject,
  isArray,
  ref2schemaName,
  lookupSchema,
  selfReferenceSchemaCheck,
  replaceRefs
};

export {
  dereferenceMeta
};

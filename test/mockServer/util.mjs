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

// Utilities

'use strict';

import { config } from './config.mjs';

import { fileURLToPath } from 'url';

import path from 'path';

import fs from 'fs';

// Use: await delay(2000);
function delay(ms) {
  return new Promise(res => setTimeout(res, ms));
}

// Return random in between min and max, inclusive ( [min, max] )
function randomIntFromInterval(min, max) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

// Get userId from NodeJS Express request object
function getUserIdFromReq(req) {
  const userId = req.get('x-mockfirebolt-userid') || config.app.defaultUserId;
  return userId;
}

function mergeArrayOfStrings(originalFlags, overrideFlags, denyFlags) {
  //all three are arrays of strings, which returns newFlags (array of strings)
  let newFlags = null
  if ( overrideFlags ) {
    newFlags = JSON.parse(JSON.stringify(overrideFlags)); // deep copy
  } else {
    newFlags = JSON.parse(JSON.stringify(originalFlags)); // deep copy
  }
  for(const string in denyFlags) {
    //remove that string from newFlags
    newFlags = newFlags.filter(item => item !== denyFlags[string])
  }
  return newFlags
}

/* 
* @function:createAbsoluteFilePath
* @Description: Create absolute filepath from given file name
* @param {String} fileName - file name ex: .mf.config.SAMPLE.jsons
* @Return: Absolute file path ex: D:\mock-firebolt\server\src\.mf.config.SAMPLE.json
*/
function createAbsoluteFilePath(fileName) {
  let filePath, __dirname, __filename
  __filename = fileURLToPath(import.meta.url).replace("build", "src");
  __dirname = path.dirname(__filename);
  filePath = path.resolve(__dirname, fileName);
  return filePath
}

/* 
* @function:getCreationDate
* @Description: To get creation date of file in seconds
* @param {String} fileName - Name of file whose creation time needs to be retrieved in seconds
* @Return: creation time in seconds ex: 1687860231
*/

function getCreationDate(fileName) {
  let cFile = createAbsoluteFilePath (fileName)
  const creationTimeSec = Math.floor(fs.statSync(cFile).birthtimeMs / 1000);
  return creationTimeSec
}

/* 
* @function:getModificationDate
* @Description: To get modification date of file in seconds
* @param {String} fileName - Name of file whose modification time needs to be retrieved in seconds
* @Return: modification time in seconds ex: 1687860232
*/
function  getModificationDate(fileName) {
  let mFile = createAbsoluteFilePath (fileName)
  const modificationTimeSec = Math.floor(fs.statSync(mFile).mtimeMs / 1000);
  return modificationTimeSec
}

/* 
* @function:searchObjectForKey
* @Description: To recursively search if any of the keys in JSON object is equal to the param passed  
* @param {Object} obj - JSON object
* @param {String} param - parameter/name against which search is performed
* @Return: If search successful, return true. Else return false
*/
function searchObjectForKey(obj, param) {
  for (const key in obj) {
    if (typeof obj[key] === 'object') {
      if (key === param || searchObjectForKey(obj[key], param)) {
        return true;
      }
    } else {
      if (key === param) {
        return true;
      }
    }
  }
  return false
}

/* 
* @function:replaceKeyInObject
* @Description: To replace old key with new key by iterating recursively through json
* @param {Object} obj - JSON object
* @param {String} oldKey - old key to be replaced
* @param {String} newKey - new replaced key
* @Return: Return json object with updated keys
*/
function replaceKeyInObject(obj, oldKey, newKey) {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(item => replaceKeyInObject(item, oldKey, newKey));
  }
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      obj[key === oldKey ? newKey : key] = replaceKeyInObject(obj[key], oldKey, newKey);
      if (key == oldKey) {
        delete obj[oldKey]
      }
    }
  }
  return obj;
}

/* 
* @function:createCaseAgnosticMethod
* @Description: Convert a provided full method (moduleName.methodName) to be case insensitive for the module name
* @param {String} method - String containing module and method names delimited by '.'
* @Return: Return string in the format (moduleName.methodName) with only the moduleName having been converted to lowercase
*/
function createCaseAgnosticMethod(method){
  if (method.includes(".")){
    let splitArray = method.split('.');
    let moduleName = splitArray[0].toLowerCase();
    let methodName = splitArray[1];
    method = moduleName.concat(".", methodName);
  }
  return method;
}

/**
 * @function: getOpenRPCSources
 * @description: Combines supportedOpenRPCs and (if bidirectional is enabled) supportedToAppOpenRPCs 
 *               from the dotConfig to produce a complete list of OpenRPC sources.
 * @returns {Array} Array of OpenRPC source definitions.
 */
function getOpenRPCSources() {
  return [
    ...config.dotConfig.supportedOpenRPCs,
    ...(config.dotConfig.bidirectional ? config.dotConfig.supportedToAppOpenRPCs : [])
  ];
}

// --- Exports ---

export { delay, randomIntFromInterval, getUserIdFromReq, mergeArrayOfStrings, createAbsoluteFilePath, getCreationDate, getModificationDate, searchObjectForKey, replaceKeyInObject, createCaseAgnosticMethod, getOpenRPCSources };
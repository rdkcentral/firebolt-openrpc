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

// Configuration Via .mf.config.json Files

'use strict';

import path from 'path';
import fs from 'fs';
import { logger } from './logger.mjs';
import { createAbsoluteFilePath, getCreationDate, getModificationDate } from './util.mjs';


function handleError(fileName, __dirname) {
  logger.error(
    `ERROR: Could not read Mock Firebolt configuration from ${fileName}`
  );

  fileName = path.resolve(__dirname, "../src", ".mf.config.SAMPLE.json");
  if (fs.existsSync(fileName)) {
    logger.error(
      'You probably want to "cp src/.mf.config.SAMPLE.json src/.mf.config.json && npm run build:mf"'
    );
  }
}

function loadDotConfig() {
  let fileName, dotConfig;
  try {
    fileName = createAbsoluteFilePath ('.mf.config.json');

    dotConfig = JSON.parse(
      fs.readFileSync(fileName, 'UTF-8')
    );
    logger.info(`Read Mock Firebolt configuration from ${fileName}`);
  } catch ( ex ) {
    handleError(fileName, __dirname);

    process.exit(1);
  }
  return dotConfig;
}

const creationTimeSec = getCreationDate('.mf.config.SAMPLE.json')
const modificationTimeSec = getModificationDate('.mf.config.json')

if (creationTimeSec >= modificationTimeSec) {
  logger.importantWarning("The .mf.config.SAMPLE.json file in your repo is newer than your .mf.config.json file. Changes to the config file format may have occurred since you created or edited your file, and you may need to merge your changes within the changes to the sample file. Refer to the release notes for more information.")
}

const dotConfig = loadDotConfig();

// --- Exports ---

export const testExports = {
  handleError
};

export {
  dotConfig
};

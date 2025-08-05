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

// Logger

'use strict';

// Escape sequences (\x1b is the code for the non-printable control character escape)
const colors = {
    reset: "\x1b[0m",
    bright: "\x1b[1m",
    dim: "\x1b[2m",
    underscore: "\x1b[4m",
    blink: "\x1b[5m",
    reverse: "\x1b[7m",
    hidden: "\x1b[8m",
    
    fg: {
        black: "\x1b[30m",
        red: "\x1b[31m",
        green: "\x1b[32m",
        yellow: "\x1b[33m",
        blue: "\x1b[34m",
        magenta: "\x1b[35m",
        cyan: "\x1b[36m",
        white: "\x1b[37m"
    },
    bg: {
        black: "\x1b[40m",
        red: "\x1b[41m",
        green: "\x1b[42m",
        yellow: "\x1b[43m",
        blue: "\x1b[44m",
        magenta: "\x1b[45m",
        cyan: "\x1b[46m",
        white: "\x1b[47m"
    }
};

function _log(args) {
  console.log(...arguments);
}

const logger = {
  debug: function(msg) {
    _log(colors.dim + msg + colors.reset);
  },
  info: function(msg) {
    _log(msg);
  },
  important: function(msg) {
    _log(colors.bright + colors.fg.blue + msg + colors.reset + colors.reset);
  },
  warn: function(msg) {
    _log(colors.fg.cyan + msg + colors.reset);
  },
  warning: function(msg) {
    _log(colors.fg.cyan + msg + colors.reset);
  },
  err: function(msg) {
    _log(colors.bright + colors.fg.red + msg + colors.reset + colors.reset);
  },
  error: function(msg) {
    _log(colors.bright + colors.fg.red + msg + colors.reset + colors.reset);
  },
  importantWarning: function(msg) {
    _log(colors.bright + colors.fg.red + colors.reverse + msg + colors.reset + colors.reset);
  },
};

// --- Exports ---

export { logger };

# Copyright 2023 Comcast Cable Communications Management, LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
# http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#
# SPDX-License-Identifier: Apache-2.0

set(SERVER_PORT 9998 CACHE STRING "The port of the server")
set(SERVER_ADDRESS "127.0.0.1" CACHE STRING "The address of the server")

    #[[ ================================ Add additional config above this line  ================================ ]]


find_package(ConfigGenerator REQUIRED)

write_config(
    SKIP_COMPARE
    SKIP_CLASSNAME
    SKIP_LOCATOR
    DISABLE_LEGACY_GENERATOR
    CUSTOM_PARAMS_WHITELIST "${CMAKE_CURRENT_LIST_DIR}/Params.config"
    INSTALL_PATH "${CMAKE_INSTALL_PREFIX}/../etc/"
    INSTALL_NAME "config.json"
)


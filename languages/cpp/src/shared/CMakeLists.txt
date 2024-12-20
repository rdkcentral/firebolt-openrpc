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

cmake_minimum_required(VERSION 3.3)

project(Firebolt)

# set(CMAKE_VERBOSE_MAKEFILE ON)
set(FIREBOLT_TRANSPORT_WAITTIME 1000 CACHE STRING "Maximum time to wait for Transport layer to get response")
set(FIREBOLT_LOGLEVEL "Info" CACHE STRING  "Log level to be enabled")

# Default options
option(FIREBOLT_ENABLE_STATIC_LIB "Create Firebolt library as Static library" OFF)
option(ENABLE_BIDIRECTIONAL "Enable bidirectional communication over WS" OFF)
option(ENABLE_TESTS "Build openrpc native test" ON)
option(ENABLE_UNIT_TESTS "Enable unit test" ON)
option(ENABLE_COVERAGE "Enable code coverage build." ON)
option(FIREBOLT_PLAIN_LOG "Disable log coloring" OFF)

if (ENABLE_BIDIRECTIONAL)
    message("Using bidirectional gateway")
    add_compile_definitions(GATEWAY_BIDIRECTIONAL)
else ()
    message("Using unidirectional gateway")
endif ()

if (FIREBOLT_PLAIN_LOG)
    add_compile_definitions(LOGGER_NO_COLOR)
endif ()


if (FIREBOLT_ENABLE_STATIC_LIB)
    set(FIREBOLT_LIBRARY_TYPE STATIC)
else ()
    set(FIREBOLT_LIBRARY_TYPE SHARED)
endif ()

include(FetchContent)

message("Fetching nlohmann json... ")
set(nlohmann_json_VERSION v3.11.3 CACHE STRING "Fetch nlohmann::json version")
FetchContent_Declare(
    nlohmann_json
    GIT_REPOSITORY https://github.com/nlohmann/json
    GIT_TAG ${nlohmann_json_VERSION}
)
FetchContent_GetProperties(nlohmann_json)
if(NOT nlohmann_json)
    FetchContent_Populate(nlohmann_json)
    add_subdirectory(${nlohmann_json_SOURCE_DIR} ${nlohmann_json_BUILD_DIR})
endif()
FetchContent_MakeAvailable(nlohmann_json)

message("Fetching nlohmann json-schema-validator... ")
FetchContent_Declare(
    nlohmann_json_schema_validator
    GIT_REPOSITORY https://github.com/pboettch/json-schema-validator.git
    GIT_TAG 2.3.0
)
FetchContent_GetProperties(nlohmann_json_schema_validator)
if(NOT nlohmann_json_schema_validator)
    FetchContent_Populate(nlohmann_json_schema_validator)
    add_subdirectory(${nlohmann_json_schema_validator_SOURCE_DIR} ${nlohmann_json_schema_validator_BUILD_DIR})
endif()
FetchContent_MakeAvailable(nlohmann_json_schema_validator)

message("Fetching googletest... ")
FetchContent_Declare(
    googletest
    GIT_REPOSITORY https://github.com/google/googletest
    GIT_TAG v1.15.2
)
FetchContent_GetProperties(googletest)
if(NOT googletest_POPULATED)
    FetchContent_Populate(googletest)
    add_subdirectory(${googletest_SOURCE_DIR} ${google_BUILD_DIR})
endif()
FetchContent_MakeAvailable(googletest)

include_directories(
    ${nlohmann_json_SOURCE_DIR}/include
    ${nlohmann_json_schema_validator_SOURCE_DIR}/src
    ${googletest_SOURCE_DIR}/googletest/include
    ${googletest_SOURCE_DIR}/googlemock/include
)

# if (CMAKE_INSTALL_PREFIX_INITIALIZED_TO_DEFAULT)
    set(CMAKE_INSTALL_PREFIX ${SYSROOT_PATH}/usr CACHE INTERNAL "" FORCE)
    set(CMAKE_PREFIX_PATH ${SYSROOT_PATH}/usr/lib/cmake CACHE INTERNAL "" FORCE)
# endif()

list(APPEND CMAKE_MODULE_PATH
        "${CMAKE_SOURCE_DIR}/cmake"
        "${SYSROOT_PATH}/usr/lib/cmake"
        "${SYSROOT_PATH}/tools/cmake")
include(HelperFunctions)

set(FIREBOLT_NAMESPACE ${PROJECT_NAME} CACHE STRING "Namespace of the project")

message("CMAKE_PREFIX_PATH: " ${CMAKE_PREFIX_PATH})

find_package(WPEFramework CONFIG REQUIRED)

if (ENABLE_UNIT_TESTS AND ENABLE_COVERAGE)
    include(CodeCoverage)
    append_coverage_compiler_flags()
endif()

add_subdirectory(src)

if (ENABLE_TESTS OR ENABLE_UNIT_TESTS)
    enable_testing()
    add_subdirectory(test)
endif()



# make sure others can make use cmake settings of Firebolt OpenRPC
configure_file( "${CMAKE_SOURCE_DIR}/cmake/project.cmake.in"
        "${CMAKE_BINARY_DIR}/${FIREBOLT_NAMESPACE}Config.cmake"
    @ONLY)

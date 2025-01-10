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

project(FireboltSDK)
project_version(1.0.0)
set(TARGET ${PROJECT_NAME})
message("Setup ${TARGET} v${PROJECT_VERSION}")

file(GLOB SOURCES *.cpp)
list(APPEND SOURCES
    Logger/Logger.cpp
    Gateway/Gateway.cpp
    Transport/Transport.cpp
    Accessor/Accessor.cpp
    Async/Async.cpp
)

if (ENABLE_BIDIRECTIONAL)
    list(APPEND SOURCES Event/bidi/Event.cpp)
else ()
    list(APPEND SOURCES Event/unidi/Event.cpp)
endif ()

add_library(${TARGET} ${FIREBOLT_LIBRARY_TYPE} ${SOURCES})

if(ENABLE_UNIT_TESTS)
    target_compile_definitions(FireboltSDK PRIVATE UNIT_TEST)
endif()

set(CMAKE_POSITION_INDEPENDENT_CODE ON)

find_package(${NAMESPACE}WebSocket CONFIG REQUIRED)
find_package(${NAMESPACE}WebSocket CONFIG REQUIRED)
find_package(${NAMESPACE}Core CONFIG REQUIRED)
find_package(${NAMESPACE}Cryptalgo CONFIG REQUIRED)

target_link_libraries(${TARGET}
    PUBLIC
        ${NAMESPACE}WebSocket::${NAMESPACE}WebSocket
        ${NAMESPACE}Core::${NAMESPACE}Core
        ${NAMESPACE}WebSocket::${NAMESPACE}WebSocket
        ${NAMESPACE}Cryptalgo::${NAMESPACE}Cryptalgo
)

target_include_directories(${TARGET}
    PRIVATE
        $<BUILD_INTERFACE:${CMAKE_CURRENT_SOURCE_DIR}/../include>
        $<BUILD_INTERFACE:${CMAKE_CURRENT_LIST_DIR}>
)

set_target_properties(${TARGET} PROPERTIES
    CXX_STANDARD 17
    CXX_STANDARD_REQUIRED YES
    FRAMEWORK FALSE
    LINK_WHAT_YOU_USE TRUE
    VERSION ${PROJECT_VERSION}
    SOVERSION ${PROJECT_VERSION_MAJOR}
)

install(
    TARGETS ${TARGET} EXPORT ${TARGET}Targets
    ARCHIVE DESTINATION lib COMPONENT libs  # static lib
    LIBRARY DESTINATION lib COMPONENT libs  # shared lib
)

install(
    DIRECTORY ${CMAKE_SOURCE_DIR}/include/
    DESTINATION include/${FIREBOLT_NAMESPACE}SDK
    FILES_MATCHING PATTERN "*.h")

install(
    FILES ${CMAKE_BINARY_DIR}/FireboltConfig.cmake
    DESTINATION lib/cmake/${FIREBOLT_NAMESPACE})

InstallHeaders(TARGET ${TARGET} HEADERS . NAMESPACE ${FIREBOLT_NAMESPACE} DESTINATION ${FIREBOLT_NAMESPACE}SDK)
InstallCMakeConfig(TARGETS ${TARGET})
InstallPackageConfig(TARGETS ${TARGET} DESCRIPTION "Firebolt SDK Library")

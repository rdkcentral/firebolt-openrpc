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
file(GLOB GENERATED_SOURCES "${GENERATED_CODE_PATH}/src/*.cpp")

file(GLOB SOURCES *.cpp)
add_library(${TARGET} ${FIREBOLT_LIBRARY_TYPE}
    ${SOURCES}
    Logger/Logger.cpp
    Transport/Transport.cpp
    Accessor/Accessor.cpp
    Event/Event.cpp
)

set(CMAKE_POSITION_INDEPENDENT_CODE ON)
find_package(${NAMESPACE}WebSocket CONFIG REQUIRED)

target_link_libraries(${TARGET}
    PUBLIC
        ${NAMESPACE}WebSocket::${NAMESPACE}WebSocket
)

target_include_directories(${TARGET}
    PRIVATE
        $<BUILD_INTERFACE:${GENERATED_CODE_PATH}/include>
        $<BUILD_INTERFACE:${GENERATED_CODE_PATH}/src>
        $<BUILD_INTERFACE:${CMAKE_CURRENT_SOURCE_DIR}/../include>
        $<BUILD_INTERFACE:${CMAKE_CURRENT_LIST_DIR}>
)

set_target_properties(${TARGET} PROPERTIES
    CXX_STANDARD 11
    CXX_STANDARD_REQUIRED YES
    FRAMEWORK FALSE
    LINK_WHAT_YOU_USE TRUE
    VERSION ${PROJECT_VERSION}
    SOVERSION ${PROJECT_VERSION_MAJOR}
)

install(
    TARGETS ${TARGET} EXPORT ${TARGET}Targets
    LIBRARY DESTINATION lib COMPONENT libs
     PUBLIC_HEADER DESTINATION include/${TARGET} COMPONENT devel   # headers for mac (note the different component -> different package)
        INCLUDES DESTINATION include/${TARGET} # headers
)

InstallHeaders(TARGET ${TARGET} HEADERS . NAMESPACE ${FIREBOLT_NAMESPACE} DESTINATION ${FIREBOLT_NAMESPACE}SDK)
InstallHeaders(TARGET ${TARGET} EXCLUDE_ROOT_DIR HEADERS . NAMESPACE ${FIREBOLT_NAMESPACE}
    SOURCE ${GENERATED_CODE_PATH}/include DESTINATION ${FIREBOLT_NAMESPACE}/generated)
InstallHeaders(TARGET ${TARGET} HEADERS . NAMESPACE ${FIREBOLT_NAMESPACE}
    SOURCE ${CMAKE_CURRENT_SOURCE_DIR}/../include DESTINATION ${FIREBOLT_NAMESPACE})

InstallLibraries(TARGET ${TARGET} ${FIREBOLT_LIBRARY_TYPE} LIBDIR ${LIBDIR} LIBRARIES ${TARGET} DESTINATION ${FIREBOLT_NAMESPACE})
InstallCMakeConfig(TARGETS ${TARGET})
InstallPackageConfig(TARGETS ${TARGET} DESCRIPTION "Firebolt SDK Library")
InstallCMakeConfigs(TARGET ${TARGET} DESTINATION ${FIREBOLT_NAMESPACE})

add_custom_command(
    TARGET ${TARGET}
    POST_BUILD
    COMMENT "=================== Installing FireboltConfig & Helper CMakes ======================"
    COMMAND ${CMAKE_COMMAND} -E make_directory ${CMAKE_BINARY_DIR}/${FIREBOLT_NAMESPACE}/usr/lib/cmake/${FIREBOLT_NAMESPACE}
    COMMAND ${CMAKE_COMMAND} -E copy ${CMAKE_BINARY_DIR}/${FIREBOLT_NAMESPACE}Config.cmake ${CMAKE_BINARY_DIR}/${FIREBOLT_NAMESPACE}/usr/lib/cmake/${FIREBOLT_NAMESPACE}
    COMMAND ${CMAKE_COMMAND} -E copy ${CMAKE_SOURCE_DIR}/cmake/*.cmake ${CMAKE_BINARY_DIR}/${FIREBOLT_NAMESPACE}/usr/lib/cmake/${FIREBOLT_NAMESPACE}
)

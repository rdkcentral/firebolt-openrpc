/*
 * Copyright 2023 Comcast Cable Communications Management, LLC
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

#ifndef _OPENRPC_C_TESTS_H
#define _OPENRPC_C_TESTS_H

#include "TestUtils.h"

#ifdef __cplusplus
extern "C" {
#endif

uint32_t test_firebolt_create_instance();
uint32_t test_firebolt_dispose_instance();

uint32_t test_firebolt_main();
uint32_t test_properties_get_device_id();
uint32_t test_properties_set();
uint32_t test_eventregister();
uint32_t test_eventregister_by_providing_callback();
uint32_t test_string_set_get_value();

#ifdef __cplusplus
}
#endif

#endif // _OPENRPC_C_TESTS_H

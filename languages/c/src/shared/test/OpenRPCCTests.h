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

#ifndef OPENRPC_C_TESTS_H
#define OPENRPC_C_TESTS_H

#include "TestUtils.h"

#ifdef __cplusplus
extern "C" {
#endif

void test_firebolt_create_instance();
void test_firebolt_dispose_instance();

int32_t test_firebolt_main();
int32_t test_properties_get_device_id();
int32_t test_properties_set();
int32_t test_eventregister();
int32_t test_eventregister_with_same_callback();
int32_t test_eventregister_by_providing_callback();
int32_t test_string_set_get_value();

#ifdef __cplusplus
}
#endif

#endif // OPENRPC_C_TESTS_H

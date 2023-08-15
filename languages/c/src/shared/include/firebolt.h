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

#ifndef FIREBOLT_H
#define FIREBOLT_H

#include "error.h"
#include "types.h"

#ifdef __cplusplus
extern "C" {
#endif

#define IN
#define OUT

/**
 * @brief Intitialize the Firebolt SDK
 *
 * @param configLine JSON String with configuration options
 *
 * CONFIG Format:
 *  {
 *     "waitTime": 1000,
 *     "logLevel": "Info",
 *     "workerPool":{
 *       "queueSize": 8,
 *       "threadCount": 3
 *      },
 *     "wsUrl": "ws://127.0.0.1:9998"
 *  }
 *
 *
 * @return FireboltSDKErrorNone if success, appropriate error otherwise.
 *
 */
uint32_t FireboltSDK_Initialize(char* configLine);


/**
 * @brief Deintitialize the Firebolt SDK
 *
 * @return FireboltSDKErrorNone if success, appropriate error otherwise.
 *
 */
uint32_t FireboltSDK_Deinitialize(void);

#ifdef __cplusplus
}
#endif


#endif // FIREBOLT_H

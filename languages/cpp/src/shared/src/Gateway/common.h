/*
 * Copyright 2024 Comcast Cable Communications Management, LLC
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
#pragma once

#include <chrono>
#include <functional>

namespace FireboltSDK
{
    using Timestamp = std::chrono::time_point<std::chrono::steady_clock>;
    using MessageID = uint32_t;

    struct Config
    {
        static constexpr uint64_t watchdogThreshold_ms = 3000;
        static constexpr uint64_t watchdogCycle_ms = 500;
        static constexpr uint32_t DefaultWaitTime = WPEFramework::Core::infinite;
    };
}


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

#include "Module.h"
#include "Error.h"
#include "Logger.h"

namespace WPEFramework {

ENUM_CONVERSION_BEGIN(FireboltSDK::Logger::LogLevel)

    { FireboltSDK::Logger::LogLevel::Error, _TXT("Error") },
    { FireboltSDK::Logger::LogLevel::Warning, _TXT("Warning") },
    { FireboltSDK::Logger::LogLevel::Info, _TXT("Info") },
    { FireboltSDK::Logger::LogLevel::Debug, _TXT("Debug") },

ENUM_CONVERSION_END(FireboltSDK::Logger::LogLevel)

ENUM_CONVERSION_BEGIN(FireboltSDK::Logger::Category)

    { FireboltSDK::Logger::Category::OpenRPC, _TXT("FireboltSDK::OpenRPC") },
    { FireboltSDK::Logger::Category::Core, _TXT("FireboltSDK::Core") },
    { FireboltSDK::Logger::Category::Management, _TXT("FireboltSDK::Management") },
    { FireboltSDK::Logger::Category::Discovery, _TXT("FireboltSDK::Discovery") },

ENUM_CONVERSION_END(FireboltSDK::Logger::Category)

}

namespace FireboltSDK {
    /* static */  Logger::LogLevel Logger::_logLevel = Logger::LogLevel::Error;

    uint32_t Logger::SetLogLevel(Logger::LogLevel logLevel)
    {
        ASSERT(logLevel < Logger::LogLevel::MaxLevel);
        uint32_t status = FireboltSDKErrorNotSupported;
        if (logLevel < Logger::LogLevel::MaxLevel) {
            _logLevel = logLevel;
            status = FireboltSDKErrorNone;
        }
        return status;
    }

    void Logger::Log(LogLevel logLevel, Category category, const std::string& module, const std::string file, const std::string function, const uint16_t line, const std::string& format, ...)
    {
        if (logLevel <= _logLevel) {
            va_list arg;
            char msg[Logger::MaxBufSize];
            va_start(arg, format);
            int length = vsnprintf(msg, Logger::MaxBufSize, format.c_str(), arg);
            va_end(arg);

            uint32_t position = (length >= Logger::MaxBufSize) ? (Logger::MaxBufSize - 1) : length;
            msg[position] = '\0';

            char formattedMsg[Logger::MaxBufSize];
            const string time = WPEFramework::Core::Time::Now().ToTimeOnly(true);
            const string categoryName =  WPEFramework::Core::EnumerateType<Logger::Category>(category).Data();
            if (categoryName.empty() != true) {
                sprintf(formattedMsg, "--->\033[1;32m[%s]:[%s]:[%s][%s:%d](%s)<PID:%d><TID:%ld> : %s\n", time.c_str(), categoryName.c_str(), module.c_str(), WPEFramework::Core::File::FileName(file).c_str(), line, function.c_str(), TRACE_PROCESS_ID, TRACE_THREAD_ID, msg);
            } else {
                sprintf(formattedMsg, "--->\033[1;32m[%s]:[%s][%s:%d](%s)<PID:%d><TID:%ld> : %s\n", time.c_str(), module.c_str(), WPEFramework::Core::File::FileName(file).c_str(), line, function.c_str(), TRACE_PROCESS_ID, TRACE_THREAD_ID, msg);
            }
            LOG_MESSAGE(formattedMsg);
        }
    }
}


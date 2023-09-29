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

#include "FireboltSDK.h"
/* ${IMPORTS} */
#include "${info.title.lowercase}.h"

${if.implementations}
namespace Firebolt {
namespace ${info.Title} {
${if.enums}

/* ${ENUMS:json-types} */${end.if.enums}
${if.types}
    // Types
/* ${TYPES:json-types} */${end.if.types}

    ${if.methods}class ${info.Title}Impl : public I${info.Title} {

    private:
        ${info.Title}Impl()
        {
            ASSERT(_singleton == nullptr);
            _singleton = this;
        }

    public:
        ${info.Title}Impl(const ${info.Title}Impl&) = delete;
        ${info.Title}Impl& operator=(const ${info.Title}Impl&) = delete;

        ~${info.Title}Impl()
        {
            ASSERT(_singleton != nullptr);
            _singleton = nullptr;
        }

        static ${info.Title}Impl& Instance()
        {
            static ${info.Title}Impl* instance = new ${info.Title}Impl();
            ASSERT(instance != nullptr);
            return *instance;
        }

        static void Dispose()
        {
            if (_singleton != nullptr) {
                delete _singleton;
            }
        }


        // Methods
        /* ${METHODS} */

        // Events
        /* ${EVENTS} */

    private:
        static ${info.Title}Impl* _singleton;
    };

    ${info.Title}Impl* ${info.Title}Impl::_singleton = nullptr;

    /* static */ I${info.Title}& I${info.Title}::Instance()
    {
         return (${info.Title}Impl::Instance());
    }
    /* static */ void I${info.Title}::Dispose()
    {
         ${info.Title}Impl::Dispose();
    }${end.if.methods}

}//namespace ${info.Title}
}${end.if.implementations}

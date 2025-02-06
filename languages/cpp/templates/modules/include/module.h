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

#pragma once

#include "error.h"
/* ${IMPORTS:h} */
${if.callsmetrics}#include "metrics.h"
${end.if.callsmetrics}

${if.declarations}namespace Firebolt {
namespace ${info.Title} {
${if.enums}

// Enums
/* ${ENUMS} */${end.if.enums}
${if.types}
// Types
/* ${TYPES} */${end.if.types}
${if.providers}// Provider Interfaces
struct IProviderSession {
    virtual ~IProviderSession() = default;

    virtual std::string correlationId() const = 0;
};

struct IFocussableProviderSession : virtual public IProviderSession {
    virtual ~IFocussableProviderSession() override = default;

    virtual void focus( Firebolt::Error *err = nullptr ) = 0;
};
/* ${PROVIDER_INTERFACES} */${end.if.providers}${if.xuses}/* ${XUSES} */${end.if.xuses}
${if.methods}struct I${info.Title} {

    virtual ~I${info.Title}() = default;

    // Methods & Events
    /* ${METHODS:declarations} */
};${end.if.methods}

} //namespace ${info.Title}
}${end.if.declarations}

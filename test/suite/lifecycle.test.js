/*
 * Copyright 2021 Comcast Cable Communications Management, LLC
 *
 * Licensed under the Apache License, Version 2.0 (the 'License');
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an 'AS IS' BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * SPDX-License-Identifier: Apache-2.0
 */
import { transport } from '../TransportHarness.js';
import MockTransport from '../../build/sdk/javascript/src/Transport/MockTransport.mjs'
import { jest, test, expect, beforeAll } from "@jest/globals";
import { Lifecycle } from '../../build/sdk/javascript/src/sdk.mjs'

let readyResolved = false;
let readyCalled = false;
let readyMetricCalled = false;
let readyMetricCalledAfterResolve = false;
transport.onSend((json) => {
    if (json && json.method) {
        let [module, method] = json.method.split('.');
        
        console.log("Vlad message:", json);

        if (module === "Lifecycle" && method === "ready") {
            setTimeout(() => { 
                //MockTransport.receiveMessage(JSON.stringify({ jsonrpc: "2.0", result: { }, id: json.id }))
            }, 0);
            readyCalled = true;
        }
        else if (module === "Metrics" && method === "ready") {
            readyMetricCalled = true;
            if (readyResolved) {
                readyMetricCalledAfterResolve = true;
            }
        }
      
    } else {
        console.log("Received  message:", json);
    }
})

const callback = jest.fn();

beforeAll(() => {
    Lifecycle.listen('inactive', (value) => {
        callback('inactive');
    })
    Lifecycle.listen('background', (value) => {
        callback('background');
    })
    Lifecycle.listen('foreground', (value) => {
        Lifecycle.close(Lifecycle.CloseReason.USER_EXIT);
        callback('foreground');
    })
    Lifecycle.listen('unloading', (value) => {
        callback('unloading');
    })
    Lifecycle.listen('suspended', (value) => {
        callback('suspended');
    })

    //MockTransport.event("Lifecycle","inactive",  null);
    MockTransport.receiveMessage(JSON.stringify({ jsonrpc: "2.0", method: "Lifecycle.inactive", params: [] }))

    Lifecycle.ready().then((_) => {
        readyResolved = true;
    });

   MockTransport.receiveMessage(JSON.stringify({ jsonrpc: "2.0", method: "Lifecycle.foreground", params: [] }))

    let p = new Promise((resolve, reject) => {
        Lifecycle.once("unloading", (_) => {
            Lifecycle.finished();
            setTimeout(resolve, 100)
        });
    });

    MockTransport.receiveMessage(JSON.stringify({ jsonrpc: "2.0", method: "Lifecycle.unloading", params: [] }))

    return p
});
test("Lifecycle.ready Promise resolved", () => {
    expect(readyCalled).toBe(true);
    expect(readyResolved).toBe(true);
});
test("Lifecycle.ready calls Metrics.ready", () => {
    // currently we do not have Metrics/index.js in the build, so this test is disabled
    //expect(readyMetricCalled).toBe(true);
    //expect(readyMetricCalledAfterResolve).toBe(true);
});

test('App moves to the "unloading" state next', () => {
    expect(callback).nthCalledWith(1, "inactive");
});
test('App moves to the "foreground" state next', () => {
    expect(callback).nthCalledWith(2, "foreground");
});
test('App moves to the "unloading" state next', () => {
    expect(callback).nthCalledWith(3, "unloading");
});
test("listen() background event.", () => {
    return Lifecycle.listen("background", () => { }).then((res) => {
        expect(res > 0).toBe(true);
    });
});
test("once() background event.", () => {
    return Lifecycle.once("background", () => { }).then((res) => {
        expect(res > 0).toBe(true);
    });
});
test("listen() foreground event.", () => {
    return Lifecycle.listen("foreground", () => { }).then((res) => {
        expect(res > 0).toBe(true);
    });
});
test("once() foreground event.", () => {
    return Lifecycle.once("foreground", () => { }).then((res) => {
        expect(res > 0).toBe(true);
    });
});
test("listen() inactive event.", () => {
    return Lifecycle.listen("inactive", () => { }).then((res) => {
        expect(res > 0).toBe(true);
    });
});
test("once() inactive event.", () => {
    return Lifecycle.once("inactive", () => { }).then((res) => {
        expect(res > 0).toBe(true);
    });
});
test("listen() suspended event.", () => {
    return Lifecycle.listen("suspended", () => { }).then((res) => {
        expect(res > 0).toBe(true);
    });
});
test("once() suspended event.", () => {
    return Lifecycle.once("suspended", () => { }).then((res) => {
        expect(res > 0).toBe(true);
    });
});
test("listen() unloading event.", () => {
    return Lifecycle.listen("unloading", () => { }).then((res) => {
        expect(res > 0).toBe(true);
    });
});
test("once() unloading event.", () => {
    return Lifecycle.once("unloading", () => { }).then((res) => {
        expect(res > 0).toBe(true);
    });
});
test("clear()", () => {
    const result = Lifecycle.clear(-1000);
    expect(result).toBeFalsy();
});

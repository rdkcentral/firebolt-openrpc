import "./utils/bootstrap.mjs";

import { test, expect, describe } from "@jest/globals";
import { EventExtension } from "../../../build/sdk/javascript/src/sdk.mjs";

import { triggerRaw } from './utils/httpClientHelper.js';

let result = null;

test('EventExtension.onBasicEvent subscription', async () => {
  result = await new Promise((resolve) => {
    let listenerId = null;

    EventExtension.once("onBasicEvent", (data) => {
      console.log("Subscribe callback:", data);
      expect(data).toEqual("foo param");
      EventExtension.clear(listenerId);
      resolve(data);
    }).then((id) => {
      listenerId = id;
      console.log("Subscribe ID:", listenerId);
      triggerRaw('{"jsonrpc":"2.0","method":"EventExtension.onBasicEvent","params":{ "value": "foo param"}}');
    });
  });

  console.log("Final Result:", result);
  return result
});

test('EventExtension.onEventWithTwoParams subscription', async () => {
  result = await new Promise((resolve) => {
    let listenerId = null;

    EventExtension.once("onEventWithTwoParams", (param1, param2) => {
      console.log("Subscribe callback:", param1, param2);
      expect(param1).toEqual("someAppId");
      expect(param2).toEqual("foo param");
      EventExtension.clear(listenerId);
      resolve({ param1, param2 });
    }).then((id) => {
      listenerId = id;
      console.log("Subscribe ID:", listenerId);
      triggerRaw('{"jsonrpc":"2.0","method":"EventExtension.onEventWithTwoParams","params":{"appId": "someAppId", "value": "foo param"}}');
    });
  });

  console.log("Final Result:", result);
  return result
});

test('EventExtension.onEventWithThreeParams subscription', async () => {
  result = await new Promise((resolve) => {
    let listenerId = null;

    EventExtension.once("onEventWithThreeParams", (param1, param2, param3) => {
      console.log("Subscribe callback:", param1, param2, param3);
      expect(param1).toEqual("someAppId");
      expect(param2).toEqual("foo param");
      expect(param3).toEqual({ "foo": "bar" });
      EventExtension.clear(listenerId);
      resolve({ param1, param2, param3 });
    }).then((id) => {
      listenerId = id;
      console.log("Subscribe ID:", listenerId);
      triggerRaw('{"jsonrpc":"2.0","method":"EventExtension.onEventWithThreeParams","params":{"appId": "someAppId", "value": "foo param", "extra": {"foo":"bar"}}}');
    });
  });

  console.log("Final Result:", result);
  return result
});

test('EventExtension.onEventWithContext subscription', async () => {
  result = await new Promise((resolve) => {
    let listenerId = null;

    EventExtension.once("onEventWithContext", "appContext1", (data) => {
      console.log("Subscribe callback:", data);
      expect(data).toEqual({ "foo": "bar" });
      EventExtension.clear(listenerId);
      resolve(data);
    }).then((id) => {
      listenerId = id;
      console.log("Subscribe ID:", listenerId);
      triggerRaw('{"jsonrpc":"2.0","method":"EventExtension.onEventWithContext","params":{ "value": {"foo":"bar"}}}');
    });
  });

  console.log("Final Result:", result);
  return result
});

test('EventExtension.onEventWithTwoContextParams subscription', async () => {
  result = await new Promise((resolve) => {
    let listenerId = null;

    EventExtension.once("onEventWithTwoContextParams", "appContext1", "appContext2", (data) => {
      console.log("Subscribe callback:", data);
      expect(data).toEqual({ "foo": "bar" });
      EventExtension.clear(listenerId);
      resolve(data);
    }).then((id) => {
      listenerId = id;
      console.log("Subscribe ID:", listenerId);
      triggerRaw('{"jsonrpc":"2.0","method":"EventExtension.onEventWithTwoContextParams","params":{ "value": {"foo":"bar"}}}');
    });
  });

  console.log("Final Result:", result);
  return result
});
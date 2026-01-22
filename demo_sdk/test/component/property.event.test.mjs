import "./utils/bootstrap.mjs";

import { test, expect } from "@jest/globals";
import { PropertyExtension } from "../../../build/sdk/javascript/src/sdk.mjs";


import { triggerRaw } from './utils/httpClientHelper.js';

let result = null;

test('PropertyExtension.basicPropertyChanged subscription', async () => {
  result = await new Promise((resolve) => {
    let listenerId = null;

    PropertyExtension.once("onBasicPropertyChanged", (data) => {
      console.log("Subscribe callback:", data);
      expect(data).toBe("Living Room");
      PropertyExtension.clear(listenerId);
      resolve(data);
    }).then((id) => {
      listenerId = id;
      console.log("Subscribe ID:", listenerId);
      triggerRaw('{"jsonrpc":"2.0","method":"PropertyExtension.onBasicPropertyChanged","params":{ "value": "Living Room"}}');
    });
  });

  console.log("Final Result:", result);
  return result
});

test('PropertyExtension.readOnlyPropertyChanged subscription', async () => {
  result = await new Promise((resolve) => {
    let listenerId = null;

    PropertyExtension.once("readOnlyPropertyChanged", (data) => {
      console.log("Subscribe callback:", data);
      expect(data).toBe(true);
      PropertyExtension.clear(listenerId);
      resolve(data);
    }).then((id) => {
      listenerId = id;
      console.log("Subscribe ID:", listenerId);
      triggerRaw('{"jsonrpc":"2.0","method":"PropertyExtension.onReadOnlyPropertyChanged","params":{ "value": true}}');
    });
  });

  console.log("Final Result:", result);
  return result
});


test('PropertyExtension.propertyWithContextChanged subscription by calling once', async () => {
  result = await new Promise((resolve) => {
    let listenerId = null;

    //TODO Currently we have an issue when the property has a context param and we use once to subscribe to changes. 
    // In that case we must use "on" prefix in the event name without it the subscription with not send the context param!
    PropertyExtension.once("onPropertyWithContextChanged", "appContext1", (data) => {
      console.log("Subscribe callback:", data);
      expect(data).toBe(false);
      PropertyExtension.clear(listenerId);
      resolve(data);
    }).then((id) => {
      listenerId = id;
      console.log("Subscribe ID:", listenerId);
      triggerRaw('{"jsonrpc":"2.0","method":"PropertyExtension.onPropertyWithContextChanged","params":{ "value": false}}');
    });
  });

  console.log("Final Result:", result);
  return result
});

test('PropertyExtension.propertyWithContextChanged subscription', async () => {
  result = await new Promise((resolve) => {
    let listenerId = null;

    PropertyExtension.propertyWithContext("appContext1", (data) => {
      console.log("Subscribe callback:", data);
      expect(data).toBe(false);
      PropertyExtension.clear(listenerId);
      resolve(data);
    }).then((id) => {
      listenerId = id;
      console.log("Subscribe ID:", listenerId);
      triggerRaw('{"jsonrpc":"2.0","method":"PropertyExtension.onPropertyWithContextChanged","params":{ "value": false}}');
    });
  });

  console.log("Final Result:", result);
  return result
});

test('PropertyExtension.propertyWithNotifierParamsFlattened call', async () => {
  result = await new Promise((resolve) => {
    let listenerId = null;

    PropertyExtension.propertyWithNotifierParamsFlattened((foo, bar) => {
      console.log("Subscribe callback:", foo, bar);
      expect(foo).toBe("test");
      expect(bar).toBe(123);
      PropertyExtension.clear(listenerId);
      resolve([foo, bar]);
    }).then((id) => {
      listenerId = id;
      console.log("Subscribe ID:", listenerId);
      triggerRaw('{"jsonrpc":"2.0","method":"PropertyExtension.onPropertyWithNotifierParamsFlattenedChanged","params":{ "foo": "test", "bar": 123}}');
    });
  });

  console.log("Final Result:", result);
  return result
});

import "./utils/bootstrap.mjs";


import { PropertyExtension, Simple, EventExtension } from "../../../build/sdk/javascript/src/sdk.mjs";


import { triggerRaw } from './utils/httpClientHelper.js';

let result = null;


result = await new Promise((resolve) => {
  let listenerId = null;

    EventExtension.once("onEventWithThreeParams", (param1, param2, param3) => {
      console.log("Subscribe callback:", param1, param2, param3);

      EventExtension.clear(listenerId);
      resolve({ param1, param2, param3 });
    }).then((id) => {
      listenerId = id;
      console.log("Subscribe ID:", listenerId);
      triggerRaw('{"jsonrpc":"2.0","method":"EventExtension.onEventWithThreeParams","params":{"appId": "someAppId", "value": "foo param", "extra": {"foo":"bar"}}}');
    });
});

console.log("Final Result:", result);

result = await new Promise((resolve) => {
  let listenerId = null;
  PropertyExtension.once("onPropertyWithContextChanged", "appContext1", (data) => {
    //PropertyExtension.propertyWithContext("appContext1", (data) => {
    console.log("Subscribe callback:", data);

    PropertyExtension.clear(listenerId);
    resolve(data);
  }).then((id) => {
    listenerId = id;
    console.log("Subscribe ID:", listenerId);
    triggerRaw('{"jsonrpc":"2.0","method":"PropertyExtension.onPropertyWithContextChanged","params":{ "value": false}}');
  });
});

console.log("Final Result:", result);



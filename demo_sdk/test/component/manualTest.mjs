import "./utils/bootstrap.mjs";


import Advanced from "../../build/sdk/javascript/src/Advanced/index.mjs";

//import Simple from "../../build/sdk/javascript/src/Simple/index.mjs";

import { triggerRaw } from './utils/httpClientHelper.js';

let result = null;

/*
result = await new Promise((resolve) => {
  let listenerId = null;

  Simple.once("basicPropertyChanged", (data) => {
    console.log("Subscribe callback:", data);

    Simple.clear(listenerId);
    resolve(data);
  }).then((id) => {
    listenerId = id;
    console.log("Subscribe ID:", listenerId);
    triggerRaw('{"jsonrpc":"2.0","method":"Simple.onBasicPropertyChanged","params":{ "value": "Living Room"}}');
  });
});

console.log("Final Result:", result);
*/

await Advanced.propertyWithContext("app12");

await new Promise((resolve) => {
  let listenerId = null;
  Advanced.listen( (event, data) => {
    console.log("Subscribe callback:",event, data);

    Advanced.clear(listenerId);
    resolve(data);
  }).then((id) => {
    listenerId = id;
    console.log("Subscribe ID:", listenerId);
    triggerRaw('{"jsonrpc":"2.0","method":"Advanced.onEventWithContext","params":["foo", "bar"]}');
  });
});
console.log("Final Result:", result);
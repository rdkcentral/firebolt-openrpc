'use strict';

import { logger } from './logger.mjs';
import * as fireboltOpenRpc from './fireboltOpenRpc.mjs';
import { config } from './config.mjs';


let id = 1;
const { dotConfig: { eventConfig } } = config;

function logSuccess(onMethod, result, msg) {
  logger.info(
    `${msg}: Sent event ${onMethod} with result ${JSON.stringify(result)}`
  );
};

function logErr(onMethod, eventErrorType) {
  switch (eventErrorType) {
    case 'validationError':
      logger.info(`Event validation failed for ${onMethod}. Please ensure the event data meets the required format and try again`);
      break;
    case 'registrationError':
      logger.info(`${onMethod} event not registered`);
      break;
    default:
      logger.info(`Error of unknown error type occurred for ${onMethod} event (type: ${eventErrorType})`);
      break;
  }
}
function logFatalErr() {
  logger.info(`Internal error`);
};

function createBidirectionalPayload(method, params) {
  return {
    id: id++,  // Increment and return `id` in one step
    jsonrpc: "2.0",
    method,
    params
  };
}

function callAppApi(ws, method, params) {

  //const { metadata, wsArr } = listener;

  let payload = createBidirectionalPayload(method, params);

  //wsArr.forEach((ws) => {
  ws.send(JSON.stringify(payload)); // Send bidirectional event
  logger.info(`Sent bidirectional API call: ${JSON.stringify(payload)}`);
  //});

}

function testAppApiMethods(ws, methodToCall) {

  setTimeout(() => {
    //get biderctial method exaple params 
    const paramsArray = fireboltOpenRpc.getFirstExampleParamsForMethod(methodToCall);
    // Emit a response to the client app indicating that the event listener has been registered      
    callAppApi(ws, methodToCall, paramsArray);
  }, 10);
}

function testAllAppApiMethods(ws) {
  // Test all app API methods
  /*
  const methods = fireboltOpenRpc.getAllMethods();
  methods.forEach(method => {
    const params = fireboltOpenRpc.getFirstExampleParamsForMethod(method);
    callAppApi(null, method, params);
  });
*/

  //testAppApiMethods(ws, "PinChallenge.challenge");
  //testAppApiMethods(ws, "Keyboard.standard");

}



// --- Exports ---

export {
  callAppApi,
  testAllAppApiMethods
};

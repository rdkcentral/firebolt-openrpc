'use strict';

import { logger } from './logger.mjs';
import * as magicDateTime from './magicDateTime.mjs';
import * as fireboltOpenRpc from './fireboltOpenRpc.mjs';
import * as events from './wsServerEvents.mjs';
import * as wsServerAppApiCaller from './wsServerAppApiCaller.mjs';
import { config } from './config.mjs';
import { set } from 'lodash-es';

const { dotConfig: { eventConfig } } = config;

async function getMethodResponse(methodName, params, ws) {
  let resp;

  // No mock override info in our userState data structure... return first example
  // value from OpenRPC specification, if available
  let val = fireboltOpenRpc.getFirstExampleValueForMethod(methodName);
  if (typeof val === 'undefined') {
    // No examples for this method in the Open RPC specification
    logger.warning(`WARNING: Method ${methodName} called, but there is no example response for the method in the Firebolt API OpenRPC specification`);
    resp = {
      result: undefined
    };
  } else {
    // Send back the first example from the Open RPC specification for this method
    resp = {
      result: val
    };
  }

  // Evaluate magic date/time strings if we have a (non-undefined) resp object
  if (resp) {
    try {
      const prefix = config.app.magicDateTime.prefix;
      const suffix = config.app.magicDateTime.suffix;
      resp = magicDateTime.replaceDynamicDateTimeVariablesObj(resp, prefix, suffix);
    } catch (ex) {
      logger.error('ERROR: An error occurred trying to evaluate magic date/time strings');
      logger.error(ex);
    }
  }
  return resp;
}


// Process given message and send any ack/reply to given web socket connection
async function handleMessage(message, ws) {
  let response, newResponse;

  logger.debug(`Received message: ${message}`);

  const oMsg = JSON.parse(message);
  if (!oMsg || !('jsonrpc' in oMsg) || oMsg.jsonrpc !== '2.0' || (!(oMsg.method) && !('result' in oMsg))) {
    logger.error(`ERROR: Missing method or result field in message`);
    const oResponseMessage = {
      jsonrpc: '2.0',
      id: oMsg.id,
      error: {
        message: 'ERROR: Missing method result field in message'
      }
    };
    const responseMessage = JSON.stringify(oResponseMessage);
    ws.send(responseMessage);
    logger.debug(`Sent message for user: ${responseMessage}`);
    return;
  }

  // check if result is defined
  if ('result' in oMsg) {
    // This is a response message, not a request
    logger.debug(`Received result for AppAPI message: ${JSON.stringify(oMsg)}`);
    return;
  }



  // record the message if we are recording
  //addCall(oMsg.method, oMsg.params, userId);

  // Handle JSON-RPC notifications (w/ no id in request)
  // - Don't send reply message over socket back to SDK
  if (!('id' in oMsg)) {
    logger.info('Not responding, since that message was a notification with no id');
    return;
  }

  // Handle JSON-RPC message that is somehow for an unknown method
  //if (!fireboltOpenRpc.isMethodKnown(oMsg.method)) 
  if (oMsg.method == "Simple.plainProperty") 
  {
    // Somehow, we got a socket message representing a Firebolt method call for a method name we don't recognize!
    logger.error(`ERROR: Method ${oMsg.method} called, but there is no such method in the Firebolt API OpenRPC specification`);
    const oResponseMessage = {
      jsonrpc: '2.0',
      id: oMsg.id,
      error: {
        code: -32601,
        message: 'Method not found'
      }
    };
    const responseMessage = JSON.stringify(oResponseMessage);
    // No delay
    ws.send(responseMessage);
    logger.info(`Sent "method not found" message: ${responseMessage}`);
    return;
  }

  // Handle JSON-RPC messages that are event listener enable requests
  // First we extract event data from the message using the registrationMessage config
  // Then we register the event listener for the specified user and WebSocket with the extracted metadata

  if (events.isEventListenerOnMessage(oMsg)) {
    const eventMetadata = events.extractEventData(oMsg, eventConfig.registrationMessage, true);

    events.registerEventListener(eventMetadata, ws);

    if (eventConfig.registrationAck) {
      events.sendEventListenerAck(ws, eventMetadata);

      //send an event after 100 milliseconds
      setTimeout(() => {

        if (config.dotConfig.bidirectional) {
          const bidirectionalMethod = events.unidirectionalEventToBiDirectional(eventMetadata.method);
          //get biderctial method exaple params 
          const exampleParams = fireboltOpenRpc.getFirstExampleParamsForMethod(bidirectionalMethod);

          // Emit a response to the client app indicating that the event listener has been registered      
          events.emitResponse(eventMetadata.method, exampleParams);
        }
        else {

          const exampleParams = fireboltOpenRpc.getFirstExampleParamsForMethod(eventMetadata.method);
          // Emit a response to the client app indicating that the event listener has been registered      
          events.emitResponse(eventMetadata.method, exampleParams);

        }
      }, 100);




    }
  }

  // Handle JSON-RPC messages that are event listener disable requests
  // First we extract event data from the message using the unRegistrationMessage config
  // Then we deregister the event listener for the specified user and WebSocket with the extracted metadata
  /*
    if (events.isEventListenerOffMessage(oMsg)) {
      const eventMetadata = events.extractEventData(oMsg, eventConfig.unRegistrationMessage, false);
  
      events.deregisterEventListener(userId, eventMetadata, ws);
  
      // Only perform additional actions if not in proxy mode
      if (!process.env.proxy) {
        // If unRegistrationAck config is included, send ack message
        if (eventConfig.unRegistrationAck) {
          events.sendUnRegistrationAck(userId, ws, eventMetadata);
        }
        return;
      }
    }
  */
  // We got a socket message representing a Firebolt method call for a method name we know about

  // Handle JSON-RPC message representing a bad "call" (params invalid)
  const callErrors = fireboltOpenRpc.validateMethodCall(oMsg.method, oMsg.params);
  if (callErrors && callErrors.length > 0) {
    // We got a socket message representing an invalid Firebolt method call (bad params)
    logger.error(`ERROR: Method ${oMsg.method} called, but caller's params are invalid`);
    logger.error(JSON.stringify(callErrors, null, 4));
    const oResponseMessage = {
      jsonrpc: '2.0',
      id: oMsg.id,
      error: {
        code: -32400,                  // @TODO: Ensure we're returning the right value and message
        message: 'Invalid parameters', // @TODO: Ensure we're returning the right value and message
        data: {
          errors: callErrors           // @TODO: Ensure we're formally defining this schema / data value
        }
      }
    };
    const responseMessage = JSON.stringify(oResponseMessage);
    // No delay
    ws.send(responseMessage);
    logger.info(`Sent "invalid params" message: ${responseMessage}`);
    return;
  }

  // Handle Firebolt Method call using default defaults (from the examples in the Open RPC specification)
  logger.debug(`Returning default mock value for method ${oMsg.method}`);
  response = await getMethodResponse(oMsg.method, oMsg.params, ws); // Could be optimized cuz we know we want a static response

  // Send client app back a message with the response to their Firebolt method call
  logger.debug(`Sending response for method ${oMsg.method}`);

  let finalResponse = (newResponse ? newResponse : response);
  const oResponseMessage = {
    jsonrpc: '2.0',
    id: oMsg.id,
    ...finalResponse  // layer in either a 'result' key and value or an 'error' key and a value like { code: xxx, message: xxx }
  };
  finalResponse = JSON.stringify(oResponseMessage);



  ws.send(finalResponse);
  logger.debug(`Sent message for user: ${finalResponse}`);
}

// --- Exports ---

export {
  handleMessage
};
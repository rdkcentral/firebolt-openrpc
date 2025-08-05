
// Event-related state and utility functions

'use strict';

import JSONPath from 'jsonpath';
import hbs from 'handlebars';
import { logger } from './logger.mjs';
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

// Maps full userIds to maps which map event listner request method
// name (e.g., lifecycle.onInactive) to message id (e.g., 17)
const eventListenerMap = {};

/**
 * Associate this message ID with this method so if/when events are sent, we know which message ID to use
 * @param {Object} metadata - The metadata object containing information about the event listener registration
 * @param {WebSocket} ws - The WebSocket object associated with the event listener
 * @returns {void}
*/
function registerEventListener(metadata, ws) {
  const { method } = metadata;

  if (!eventListenerMap) {
    eventListenerMap = {};
  }

  if (!eventListenerMap[method]) {
    eventListenerMap[method] = { wsArr: [], metadata };
  } else {
    // Update the metadata if the method is already registered
    // If the same event is subscribed to twice, the response will be sent back to the second subscription
    eventListenerMap[method].metadata = metadata;
  }

  // Check if ws is already in the wsArr before pushing
  if (!eventListenerMap[method].wsArr.includes(ws)) {
    eventListenerMap[method].wsArr.push(ws);
  }

  logger.debug(`Registered event listener mapping: ${method}`);
}

function isRegisteredEventListener(method) {
  if (!eventListenerMap) { return false; }
  return (method in eventListenerMap);
}

function getRegisteredEventListener(method) {
  if (!eventListenerMap) { return undefined; }
  return eventListenerMap[method];
}

/**
 * Removes the mapping from the event listener request method name from eventListenerMap. 
 * Attempts to send events to this listener going forward will fail.
 * @param {Object} metadata - An object containing metadata for the event.
 * @param {WebSocket} ws - The WebSocket object.
 * @returns {void}
*/
function deregisterEventListener(metadata, ws) {
  const { method } = metadata;
  if (!eventListenerMap || !eventListenerMap[method]) {
    return;
  }

  const wsArr = eventListenerMap[method].wsArr;
  const wsIndex = wsArr.findIndex((item) => item === ws);

  if (wsIndex !== -1) {
    wsArr.splice(wsIndex, 1);
    logger.debug(`Deregistered event listener mapping: ${method}`);
  }

  if (wsArr.length === 0) {
    delete eventListenerMap[method];
  }
}

/**
 * Extracts event data from a given message object based on provided configuration.
 * @param {object} oMsg - The message object to extract event data from.
 * @param {object} config - The configuration object for the event data extraction.
 * @param {boolean} isEnabled - Whether eventListener enable or disable request
 * @returns {object | false} - An object containing the extracted event data or false if the extraction fails.
*/
function extractEventData(oMsg, config, isEnabled) {
  const searchRegex = config.searchRegex;
  const method = config.method || '$.method';

  if (!new RegExp(searchRegex).test(JSON.stringify(oMsg))) {
    return false;
  }

  const extractedMethod = JSONPath.query(oMsg, method);

  if (extractedMethod.length === 0) {
    logger.debug(`Error occurred while extracting event data: No method found in the provided message.`);
    return false;
  }

  const methodName = extractedMethod[0];
  const metadata = {
    registration: {},
    unRegistration: {},
    method: methodName
  };

  // If isEnabled is true, add oMsg to metadata.registration
  if (isEnabled) {
    metadata.registration = oMsg;
  } else {
    // If isEnabled is false, add oMsg to metadata.unRegistration
    metadata.unRegistration = oMsg;
  }

  return metadata;
}


/**
 * Determines if the given object message is an event listener message.
 * @param {object} oMsg - The object message to check.
 * @param {object} config - The configuration object to use.
 * @returns {boolean} - True if the message is an event listener message, false otherwise.
*/
function isEventListenerMessage(oMsg, config) {
  // Call extractEventData and store the result
  const eventData = extractEventData(oMsg, config);

  return (eventData !== false);
}

/**
 * Determines whether the given message is intended to enable an event listener.
 * A regex pattern and JSON path are provided in config to check whether the event listener is on.
 * @param {Object} oMsg - The incoming message to check.
 * @return {boolean} - Returns `true` if the message is intended to enable an event listener, `false` otherwise.
 */
function isEventListenerOnMessage(oMsg) {
  return isEventListenerMessage(oMsg, eventConfig.registrationMessage);
}

/**
 * Determines whether the given message is intended to disable an event listener.
 * A regex pattern and JSON path are provided in config to check whether the event listener is off.
 * @param {Object} oMsg - The incoming message to check.
 * @return {boolean} - Returns `true` if the message is intended to disable an event listener, `false` otherwise.
 */
function isEventListenerOffMessage(oMsg) {
  return isEventListenerMessage(oMsg, eventConfig.unRegistrationMessage);
}

/**
 * Respond to an event listener request with an ack
 * @param {WebSocket} ws - The WebSocket instance to which the ack message will be sent.
 * @param {object} metadata - The metadata associated with the event listener request.
 * @returns {void}
 * @example
   For request:
   {"jsonrpc":"2.0","method":"lifecycle.onInactive","params":{"listen":true},"id":1}
   Send ack response:
   {"jsonrpc":"2.0","result":{"listening":true, "event":"lifecycle.onInactive"},"id":1}
*/
function sendEventListenerAck(ws, metadata) {
  const template = hbs.compile(eventConfig.registrationAck);
  const ackMessage = template(metadata);
  const parsedAckMessage = JSON.parse(ackMessage);

  ws.send(ackMessage);
  logger.debug(`Sent registration event ack message for user  ${ackMessage}`);

}

/**
 * Respond to an unregistration event with an ack
 * @param {WebSocket} ws - The WebSocket instance to which the ack message will be sent.
 * @param {object} metadata - The metadata associated with the unregistration event.
 * @returns {void}
 * @example
   For request:
   {"jsonrpc":"2.0","method":"lifecycle.onInactive","params":{"listen":true},"id":1}
   Send ack response:
   {"jsonrpc":"2.0","result":{"listening":true, "event":"lifecycle.onInactive"},"id":1}
*/
function sendUnRegistrationAck(ws, metadata) {
  const template = hbs.compile(eventConfig.unRegistrationAck);
  const ackMessage = template(metadata);

  ws.send(ackMessage);
  logger.debug(`Sent unregistration event ack message for user  ${ackMessage}`)
}

function sendEvent(ws, method, result, msg, fSuccess, fErr, fFatalErr) {
  coreSendEvent(false, ws, method, result, msg, fSuccess, fErr, fFatalErr);
}

function sendBroadcastEvent(ws, method, result, msg, fSuccess, fErr, fFatalErr) {
  coreSendEvent(true, ws, method, result, msg, fSuccess, fErr, fFatalErr);
}

/**
 * Creates a JSON-RPC 2.0-compliant payload for bidirectional communication.
 * 
 * - Assigns a unique `id` to each request by incrementing a global `id` counter.
 * - Structures the payload according to the JSON-RPC 2.0 specification.
 * 
 * @param {string} method - The method name for the request.
 * @param {any} params - The parameters to be sent with the request.
 * @returns {Object} - The formatted JSON-RPC 2.0 payload.
 */

function createBidirectionalPayload(method, params) {
  return {
    id: id++,  // Increment and return `id` in one step
    jsonrpc: "2.0",
    method,
    params
  };
}

function createBidirectionalEventPayload(method, params) {
  return {
    // send sending an event we dont add an id 
    //id: id++,  
    jsonrpc: "2.0",
    method,
    params
  };
}

/**
 * Converts a unidirectional event method name to its bidirectional equivalent.
 * 
 * - If the method follows the "module.onEvent" pattern (FB 1.0), it removes the "on" prefix 
 *   and converts the first letter of the event name to lowercase.
 * - If the method does not contain a dot (`.`), it is returned as is.
 * 
 * @param {string} method - The original unidirectional event method (e.g., "module.onEvent").
 * @returns {string} - The bidirectional-compatible method name (e.g., "module.event").
 */
function unidirectionalEventToBiDirectional(method) {
  if (!method.includes(".")) return method;

  const [moduleName, methodName] = method.split(".", 2);

  // Remove "on" prefix if present (FB 1.0 Events)
  const cleanedMethod = methodName.startsWith("on")
    ? methodName.charAt(2).toLowerCase() + methodName.slice(3)
    : methodName;

  return `${moduleName}.${cleanedMethod}`;
}


/**
 * Emits a response to the registered event listener.
 * 
 * If bidirectional mode is enabled, it transforms the method to its bidirectional equivalent 
 * and sends a structured payload. Otherwise, it sends a unidirectional event message.
 * 
 * @param {any} finalResult - The result to be included in the response, formatted accordingly.

 * @param {string} method - The original event method name.
 * @returns {void}
 */
function emitResponse( method, params) {
  const listener = getRegisteredEventListener(method);
  if (!listener) {
    logger.debug('Event message could not be sent because a listener was not found');
    return;
  }

  const { metadata, wsArr } = listener;

  // Defines the data object that will be inputted into handlebars
  const templateData = {
    ...metadata,
    result: params,
    resultAsJson: JSON.stringify(params)
  };

  let eventMessage;

  // If event template config exists, use it
  if (eventConfig.event) {
    const template = hbs.compile(eventConfig.event);
    eventMessage = template(templateData);
  } else {
    // If event template config does not exist, just send the raw params
    eventMessage = params;
  }

  // Check if bidirectional mode is enabled
  if (config.dotConfig.bidirectional) {
    const bidirectionalMethod = unidirectionalEventToBiDirectional(method);
    let payload = createBidirectionalEventPayload(bidirectionalMethod, params);

    wsArr.forEach((ws) => {
      ws.send(JSON.stringify(payload)); // Send bidirectional event
      logger.info(`Sent bidirectional event ${JSON.stringify(payload)}`);
    });
  } else {
    // Unidirectional mode (Default behavior)

    wsArr.forEach((ws) => {
      ws.send(eventMessage);
      if (eventConfig.eventType) {
        logger.info(`Sent Unidirectional ${eventConfig.eventType} message to user  ${eventMessage}`);
      } else {
        logger.info(`Sent Unidirectional event message to user  ${eventMessage}`);
      }
    });
  }
}

// --- Exports ---

export const testExports = {
  eventListenerMap,
  isRegisteredEventListener,
  getRegisteredEventListener,
  sendBroadcastEvent,

  extractEventData,
  isEventListenerOnMessage,
  isEventListenerOffMessage
}

export {
  unidirectionalEventToBiDirectional,
  emitResponse, registerEventListener, deregisterEventListener,
  isEventListenerOnMessage, isEventListenerOffMessage,
  sendEventListenerAck, sendUnRegistrationAck,
  sendEvent, sendBroadcastEvent, logSuccess, logErr,
  logFatalErr, extractEventData
};

/*
* Copyright 2021 Comcast Cable Communications Management, LLC
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

// User management

'use strict';

import  { WebSocketServer } from 'ws';
import * as messageHandler from './wsServerMessageHandler.mjs';
import * as wsServerAppApiCaller from './wsServerAppApiCaller.mjs';
import { logger } from './logger.mjs';
import { config } from './config.mjs';


// If timer goes off, we didn't get a ping from the server, so terminate the socket
function heartbeat(socket) {
  if ( socket.pingTimeout ) { clearTimeout(socket.pingTimeout); }

  // Use `WebSocket#terminate()`, which immediately destroys the connection,
  // instead of `WebSocket#close()`, which waits for the close timer.
  // Delay should be equal to the interval at which your server
  // sends out pings plus a conservative assumption of the latency.
  socket.pingTimeout = setTimeout(() => {
    socket.terminate();
  }, 30000 + 1000);
}

// Helper function to close the current WebSocket connection for the user and remove it from the user's WebSocket array
function closeConnection(ws) {
  logger.info(`Closing ws connection`);
  if (ws) {
    ws.terminate();
  }
}

export function startWsServer() {

  console.info(`Starting WebSocket server on port ${config.app.socketPort}`);
  const wss = new WebSocketServer({  port: config.app.socketPort}); 

  wss.on('connection', function connection(ws) {
    ws.isAlive = true;
    ws.on('pong', async hb => {
      heartbeat(ws)
    });

    // Remove ws connection of user
    ws.on('close', function close() {
      closeConnection( ws);
    });

    ws.on('message', async message => {
      messageHandler.handleMessage(message,  ws);
    });
    setTimeout(() => {
        wsServerAppApiCaller.testAllAppApiMethods(ws);
      }, 100);
  });

  const interval = setInterval(function ping() {
    wss.clients.forEach(function each(ws) {
      if (ws.isAlive === false) return ws.terminate();
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on('close', function close() {
    clearInterval(interval);
  });
  return true;
}


startWsServer();

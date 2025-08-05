
'use strict';

import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);

//import { startWsServer } from './mockServer/wsServer.mjs';
import './bootstrap.mjs'; // This ensures the global.window is set up
import { Simple } from '../build/sdk/javascript/src/sdk.mjs'
//import { Advanced } from '../build/sdk/javascript/src/sdk.mjs'


import { Worker, isMainThread, parentPort } from 'node:worker_threads';

if (isMainThread) {
    // This code is executed in the main thread and not in the worker.

    // Create the worker.
    const worker = new Worker(__filename);
    // Listen for messages from the worker and print them.
    worker.on('message', (msg) => { console.log(msg); });

    /*
    Simple.method('Hello World')
        .then((result) => {
            console.log('Simple method result:', result);
        })
        .catch((error) => {
            console.error('Error calling simple method:', error);
        });

    Advanced.propertyWithContext("some-app").then((result, result2) => {
        console.log('Advanced property with context result:', result, result2);
    });


    Advanced.propertyWithContext( ( val2 , val3, val4) => {
        console.log('Advanced property event context result:',   val2, val3, val4);
    })

    Advanced.listen("eventWithContext", (appId, value) => {
        console.log('Advanced eventWithContext result:', appId, value);
    })

    Advanced.listen("eventWithTwoContext", "some-app", ( state, value) => {
        console.log('Advanced eventWithTwoContext result:', state, value);
    })

    Advanced.listen("plainEvent", (data) => {
        console.log('Advanced plainEvent result:', data);
    })
    */

    Simple.plainProperty().then((result) => {
        console.log('Simple readonly property result:', result);
    }).catch((error) => {
        console.error('Error calling simple readonly property: ', error);
    });

   // Simple.readonlyProperty((value) => {
   //     console.log('Simple readonly property event result:', value);
   // });

   // Simple.listen("readonlyPropertyChanged", (value) => {
   //     console.log('Simple readonly property event result:', value);
   // });


} else {
    // This code is executed in the worker and not in the main thread.


    // Send a message to the main thread.
    //startWsServer();

}

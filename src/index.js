/*
 *          M""""""""`M            dP
 *          Mmmmmm   .M            88
 *          MMMMP  .MMM  dP    dP  88  .dP   .d8888b.
 *          MMP  .MMMMM  88    88  88888"    88'  `88
 *          M' .MMMMMMM  88.  .88  88  `8b.  88.  .88
 *          M         M  `88888P'  dP   `YP  `88888P'
 *          MMMMMMMMMMM    -*-  Created by Zuko  -*-
 *
 *          * * * * * * * * * * * * * * * * * * * * *
 *          * -    - -   F.R.E.E.M.I.N.D   - -    - *
 *          * -  Copyright © 2025 (Z) Programing  - *
 *          *    -  -  All Rights Reserved  -  -    *
 *          * * * * * * * * * * * * * * * * * * * * *
 */

import {router} from './flaregram/utils/router';
import {
  bulkStoreCommand,
  handleCallbackQuery,
  handleCustomLabelInput,
  handleDeleteCommand,
  handleInlineQuery,
  handleIPMessage,
  startCommand,
  handleJsonCommand,
  handleAuthCheckCommand,
  handleQueryCommand,
  handleDepositCommand,
  handleOutCommand,
  handleNoteCommand,
  handleBetCommand,
  handleStatsCommand,
  generalStatsResponse,
  handleFetchCommand
} from './messageHandlers';
import {
  deleteByIP,
  deleteByLabelCount,
  getChatIdFromUpdateObj,
  getLabelsWithLastIncrements,
  isValidIPv4,
  isValidUser,
  parseOpenVPNConfig, trimString
} from './utils';
import {getConfig} from "./configProvider";
import {bot} from "./flaregram/bot";

// Function to handle OVPN file
async function handleOVPNFile(obj) {
  const document = obj.message.document;
  const chatId = getChatIdFromUpdateObj(obj);
  const messageId = obj.message.message_id;

  if (document.file_name.endsWith('.ovpn')) {
    try {
      const fileContent = await bot.getFileContentById(document.file_id);
      const postData = {fileContent: fileContent};
      if (obj.message?.caption) {
        postData.label = ` ${obj.message.caption}`;
      }

      const response = await fetch(`${API_BASE_URL}/tools/ovpn`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(postData),
      });
      const clone = response.clone();
      const result = await response.json();

      if (!response.ok) {
        // Delete the original message first
        await bot.message.deleteMessages({
          chat_id: chatId,
          message_id: messageId
        });
        let txt = 'handleOVPNFile: Failed to contacting server.\n';
        txt += `Status: ${response.status}\n`;
        try {
          const data = trimString(await clone.text(), 560, ' __TRIMMED__');
          txt += `Body: 
\`\`\`
${data}
\`\`\``;
        } catch (e) {
          txt += 'BODY_ERR: ' + e.message;
        }
        await bot.sendMessage({
          chat_id: chatId,
          text: txt,
        });
        return;
      }

      if (result.ok) {
        const {availability, latency, speed} = result;
        const config = parseOpenVPNConfig(fileContent);
        const {host: remoteHost, port: remotePort} = config.remoteInfo;

        obj.message.note = `Connected to ${remoteHost}:${remotePort} via ${config.protocol}. Availability: ${availability}, Latency: ${latency}, Speed: ${speed}`;
        obj.message.text = `${remoteHost}`;
        if (obj.message?.caption) {
          obj.message.text += ` ${obj.message.caption}`;
        }

        // Add message_id to obj for deletion in handleIPMessage
        obj.ovpn_message_id = messageId;

        // Handle as IP message
        await handleIPMessage(obj, true);
      } else {
        // Delete the original message before sending error
        await bot.message.deleteMessages({
          chat_id: chatId,
          message_id: messageId
        });

        await bot.sendMessage({
          chat_id: chatId,
          text: `Error: ${result.error}`,
        });
      }
    } catch (e) {
      // Delete the original message before sending error
      await bot.message.deleteMessages({
        chat_id: chatId,
        message_id: messageId
      });

      console.error(e);
      await bot.sendMessage({
        chat_id: chatId,
        text: 'handleOVPNFile: Error occurred \n' + e.message,
      });
    }
  }
}
// Main update handler for Telegram webhook
export async function updateHandler(obj) {
  if (obj.message) {
    if (obj.message?.document?.file_name.endsWith('.ovpn')) {
      return await handleOVPNFile(obj);
    }
    if (obj.message?.reply_to_message && obj?.message?.reply_to_message?.text?.startsWith(getConfig('labels.askForCustomAcc'))) {
      await handleCustomLabelInput(obj.message);
    } else if (obj.message?.text) {
      const command = obj.message.text.split(/\s+/)[0].toLowerCase();
      switch (true) {
        case command === '/delete' || command === '/del':
          await handleDeleteCommand(obj);
          break;
        case command.includes('/hook'):
          await hookCommand(obj);
          break;
        case command.includes('/start'):
          await startCommand(obj);
          break;
        case command === '/bulk' || command === '/bulkstore' || command === '/bulk-store':
          await bulkStoreCommand(obj);
          break;
        case command === '/json':
          await handleJsonCommand(obj);
          break;
        case command === '/auth_check':
          await handleAuthCheckCommand(obj);
          break;
        case command === '/query':
          await handleQueryCommand(obj);
          break;
        case command === '/fetch':
          await handleFetchCommand(obj);
          break;
        case command === '/dep' || command === '/add':
          await handleDepositCommand(obj);
          break;
        case command === '/out':
          await handleOutCommand(obj);
          break;
        case command === '/note':
          await handleNoteCommand(obj);
          break;
        case command === '/bet':
          await handleBetCommand(obj);
          break;
        case command === '/stats':
          await handleStatsCommand(obj);
          break;
        default:
          await handleIPMessage(obj);
          break;
      }
    }
  } else if (obj.callback_query) {
    await handleCallbackQuery(obj.callback_query);
  } else if (obj.inline_query) {
    await handleInlineQuery(obj.inline_query);
  }
}

// TODO: move to utils
export function getApiKeyFromRequest(request) {
  const apiKey = request.headers.get('X-API-Key');
  if (!apiKey) {
    return request.url?.searchParams?.get('apiKey');
  }
  return apiKey;
}

// API endpoint handler
async function apiHandler(request) {
  const { method } = request;
  const url = (new URL(request.url)).pathname.replace(/^\/api/, '');
  // Implement authentication for API requests
  const apiKey = getApiKeyFromRequest(request);
  if (!apiKey || !isValidUser(apiKey)) {
    return new Response('Unauthorized', { status: 401 });
  }

  switch (method) {
    case 'GET':
      if (url.startsWith('/labels')) {
        await handleGetLabels();
        return new Response(JSON.stringify({ok: true}), { status: 200 });
      }
      break;
    case 'POST':
      const asw = request.clone();
      const wdd = await asw.json();
      console.log('request body', wdd);
      const body = await request.json();
      if (url.startsWith('/ip')) {
        await handleIPMessage(body);
        return new Response(JSON.stringify({ok: true}), { status: 200 });
      } else if (url.startsWith('/bulk')) {
        await bulkStoreCommand(body);
        return new Response(JSON.stringify({ok: true}), { status: 200 });
      }
      break;
    case 'DELETE':
      if (url.startsWith('/delete')) {
        const params = new URL(request.url).searchParams;
        const input = params.get('input');
        await handleDelete(input);
        return new Response(JSON.stringify({ok: true}), { status: 200 });
      }
      break;
    default:
      return new Response('Method Not Allowed', { status: 405 });
  }

  return new Response('Not Found', { status: 404 });
}

async function handleDelete(input) {
  let result;
  if (isValidIPv4(input)) {
    result = await deleteByIP(input);
  } else {
    const match = input.match(/^([a-zA-Z]+)(\d+)$/);
    if (match) {
      const [, label, count] = match;
      result = await deleteByLabelCount(label, parseInt(count));
    } else {
      result = { success: false, message: 'Invalid input format. Use label with count (e.g., bl2) or an IP address.' };
    }
  }

  return new Response(JSON.stringify(result), {
    status: result.success ? 200 : 400,
    headers: { 'Content-Type': 'application/json' }
  });
}

async function handleGetLabels() {
  try {
    const labels = await getLabelsWithLastIncrements();
    return new Response(JSON.stringify(labels), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error fetching labels:', error);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
router.any('/dev', async function (request) {
  if (!request.headers.has('X-Zuko-Debug')) {
      return new Response('Unauthorized', { status: 401 });
  }
    const body = {
        "update_id": 535673359,
    "message": {
        "message_id": 3020,
      "from": {
        "id": 1276300124,
        "is_bot": false,
        "first_name": "Ƶ𝔲𝔨𝔬",
        "last_name": "🔥",
        "username": "zukotnn",
        "language_code": "en"
      },
      "chat": {
          "id": -1002300997698,
          "title": "Ƶ𝔲𝔨𝔬 and ipdbz",
        "type": "supergroup"
      },
        "date": 1745734484,
        "text": "/stats i9",
        "entities": [["Object"]]
    }
  };
    await handleStatsCommand(body)
    return new Response(JSON.stringify({ok: true}), {status: 200});
})
router.any('/api/*', apiHandler);

// Adding Event Listener to handle incoming requests
addEventListener('fetch', (event) => {
  const startTime = Date.now();
  const {request} = event;
  console.log(`[${new Date().toISOString()}] ${request.method} ${request?.url?.pathname}`);
  // console.info('EVENT: ', event);
  try {
    const response = router.handle(request);
    // event.waitUntil(logRequestDetails(event.request, response, startTime));
    console.info('END -----------------------------');
    console.info('---------------------------------');
    event.respondWith(response);
  } catch (error) {
    console.error('Error processing request:', error);
    // event.waitUntil(logError(event.request, error, startTime));
    console.trace();
    event.respondWith(new Response('Internal Server Error', { status: 500 }));
  }
});





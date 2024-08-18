import { router } from './flaregram/utils/router';
import { bot } from './flaregram/bot';
import { setWebhook } from "./flaregram/utils/webhook";
import { startCommand, handleIPMessage, bulkStoreCommand, handleCallbackQuery, handleCustomLabelInput, handleDeleteCommand, handleInlineQuery } from './messageHandlers';
import { isValidUser, getLabelsWithLastIncrements, deleteByLabelCount, deleteByIP, isValidIPv4 } from './utils';

// Main update handler for Telegram webhook
export async function updateHandler(obj) {
  console.log('incoming update', obj);
  if (obj.message) {
    console.log('-----------------------------');
    console.info("Incoming msg", obj.message.text);
    console.info("Incoming msg obj", obj.message);
    console.log(obj)
    console.log('-----------------------------');
    console.log('');

    if (obj.message.reply_to_message && obj.message.reply_to_message.text.startsWith('Please enter a custom label for IP')) {
      await handleCustomLabelInput(obj.message);
    } else {
      switch (true) {
        case obj.message.text.startsWith('/delete'):
        case obj.message.text.startsWith('/del'):
          await handleDeleteCommand(obj);
          break;
        case obj.message.text.includes('/hook'):
          await hookCommand(obj);
          break;
        case obj.message.text.includes('/start'):
          await startCommand(obj);
          break;
        case obj.message.text.startsWith('/bulk'):
        case obj.message.text.includes('/bulkStore'):
        case obj.message.text.includes('/bulk-store'):
          await bulkStoreCommand(obj);
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
  const { headers, method, url } = request;

  // Implement authentication for API requests
  const apiKey = getApiKeyFromRequest(request);
  if (!apiKey || !isValidUser(apiKey)) {
    return new Response('Unauthorized', { status: 401 });
  }

  switch (method) {
    case 'GET':
      if (url.includes('/labels')) {
        return await handleGetLabels();
      }
      break;
    case 'POST':
      const body = await request.json();
      if (url.includes('/ip')) {
        return await handleIPMessage(body);
      } else if (url.includes('/bulk')) {
        return await bulkStoreCommand(body);
      }
      break;
    case 'DELETE':
      if (url.includes('/delete')) {
        const params = new URL(request.url).searchParams;
        const input = params.get('input');
        return await handleDelete(input);
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

router.any('/api/*', apiHandler);

// Adding Event Listener to handle incoming requests
addEventListener('fetch', (event) => {
  const startTime = Date.now();
  try {
    const response = router.handle(event.request);
    event.waitUntil(logRequestDetails(event.request, response, startTime));
    event.respondWith(response);
  } catch (error) {
    event.waitUntil(logError(event.request, error, startTime));
    event.respondWith(new Response('Internal Server Error', { status: 500 }));
  }
});


//<editor-fold desc="For Debug" defaultstate="collapsed">
// Logging helper functions
async function logRequestDetails(request, response, startTime) {
  const endTime = Date.now();
  const duration = endTime - startTime;
  const { pathname } = new URL(request.url);

  console.log(`[${new Date().toISOString()}] ${request.method} ${pathname} - (${duration}ms)`);
  console.log('response', JSON.stringify(await response));
  // try {
  //   if (request instanceof Request) {
  //     request = request.clone();
  //     const obj = {
  //       headers: {},
  //       method: request.method,
  //       url: request.url,
  //       body: null,
  //       json: null,
  //     };
  //
  //     if (request.headers) {
  //       for (const pair of request.headers.entries()) {
  //         obj['headers'][pair[0]] = pair[1];
  //       }
  //     }
  //     if (request.body) {
  //       obj['body'] = await request.clone().body.text();
  //       obj['json'] = await request.clone().body.json();
  //     }
  //     console.info('Process request', obj);
  //     // response['orgReq'] = JSON.stringify(obj, null, 2);
  //   }
  // } catch (e) {
  //   console.error('deo hieu loi j', e);
  // }
}

async function logError(request, error, startTime) {
  const endTime = Date.now();
  const duration = endTime - startTime;
  const { pathname } = new URL(request.url);

  console.error(`[${new Date().toISOString()}] ${request.method} ${pathname} - Error: ${error.message} (${duration}ms)`);
}

// Debug HTML handler
async function debugHandler(request) {
  if (!request.headers.has('X-Zuko-Debug')){
    return new Response('Unauthorized', { status: 401 });
  }
  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Telegram Bot Debug</title>
      <script>
        // Expose bot instance to window object
        window.bot = ${JSON.stringify(bot)};
        
        async function testBot() {
          const chatId = document.getElementById('chatId').value;
          const message = document.getElementById('message').value;
          
          try {
            const response = await fetch('/test-bot', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ chatId, message }),
            });
            const result = await response.json();
            document.getElementById('result').textContent = JSON.stringify(result, null, 2);
          } catch (error) {
            document.getElementById('result').textContent = 'Error: ' + error.message;
          }
        }
      </script>
    </head>
    <body>
      <h1>Telegram Bot Debug</h1>
      <div>
        <label for="chatId">Chat ID:</label>
        <input type="text" id="chatId" />
      </div>
      <div>
        <label for="message">Message:</label>
        <input type="text" id="message" />
      </div>
      <button onclick="testBot()">Test Bot</button>
      <pre id="result"></pre>
    </body>
    </html>
  `;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html' },
  });
}

// Test bot endpoint
async function testBotHandler(request) {
  if (!request.headers.has('X-Zuko-Debug')){
    return new Response('Unauthorized', { status: 401 });
  }
  const { chatId, message } = await request.json();

  try {
    const messageParams = {
      chat_id: chatId,
      text: message,
    };
    const result = await bot.message.sendMessage(messageParams);
    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// Add debug routes
router.get('/debug', debugHandler);
router.post('/test-bot', testBotHandler);

// Expose bot instance globally (for Cloudflare Workers environment)
globalThis.bot = bot;
//</editor-fold>

import { router } from './flaregram/utils/router';
import { bulkStoreCommand, handleCallbackQuery, handleCustomLabelInput, handleDeleteCommand, handleInlineQuery, handleIPMessage, startCommand } from './messageHandlers';
import {
  deleteByIP,
  deleteByLabelCount,
  getLabelsWithLastIncrements,
  isValidIPv4,
  isValidUser
} from './utils';
import {getConfig} from "./configProvider";


// Function to handle OVPN file

// Main update handler for Telegram webhook
export async function updateHandler(obj) {
  console.log('incoming update', obj);
  if (obj.message) {
    if (obj.message.reply_to_message && obj.message.reply_to_message.text.startsWith(getConfig('labels.askForCustomAcc'))) {
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
  const obj = {
    "update_id": 535670323,
    "message": {
      "message_id": 607,
      "from": {
        "id": 1276300124,
        "is_bot": false,
        "first_name": "Ƶ𝔲𝔨𝔬",
        "last_name": "🔥",
        "username": "zukotnn",
        "language_code": "vi"
      },
      "chat": {
        "id": -1002213557605,
        "title": "IPDB",
        "type": "supergroup"
      },
      "date": 1726719367,
      "document": {
        "file_name": "VN_vpn213108604.ovpn",
        "mime_type": "application/octet-stream",
        "file_id": "BQACAgUAAyEFAASD8DVlAAICX2brpYdfeDT0LPU35E2_VqRAzI1lAAKvDwACik5gVwMjL97HkqzBNgQ",
        "file_unique_id": "AgADrw8AAopOYFc",
        "file_size": 9431
      }
    }
  };
  await updateHandler(obj);
  return new Response(JSON.stringify({ ok: true ,input: obj}), { status: 200 });
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





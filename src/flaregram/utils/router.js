//// flaregram © 2024 by Aditya Sharma is licensed under Attribution-NonCommercial 4.0 International. To view a copy of this license, visit http://creativecommons.org/licenses/by-nc/4.0/

import {updateHandler} from '../../index';
import {getChatIdFromUpdateObj, isValidUser} from '../../utils';
import { setWebhook } from './webhook';
import {  colors, status_good, status_bad } from './strings.js';

async function appendRequest(response, request) {
  if (typeof response !== 'object') {
    return response;
  }
  try {
    if (request instanceof Request) {
      request = request.clone();
      const obj = {
        headers: {},
        method: request.method,
        url: request.url,
        body: null,
        json: null,
      };

      if (request.clone().headers) {
        for (const pair of request.headers.entries()) {
          obj['headers'][pair[0]] = pair[1];
        }
      }
      if (request.clone().body) {
        obj['body'] = await request.clone().body.text();
        obj['json'] = await request.clone().body.json();
      }
      console.info('Process request', obj);
      response['orgReq'] = JSON.stringify(obj, null, 2);
    }
  } catch (e) {
    console.error('Error in  appendRequestData ', e);
  }
  if (request){
    try {
      response['orgReq'] = JSON.stringify(request, null, 2);
    } catch (e) {
    }
  }
  return JSON.stringify(response, null, 4);
}

// Create a new router instance
const router = {
  routes: [],
  post(path, handler) {
    this.routes.push({ method: 'POST', path, handler });
  },
  get(path, handler) {
    this.routes.push({ method: 'GET', path, handler });
  },
  any(path, handler) {
    this.routes.push({ method: 'POST', path, handler });
    this.routes.push({ method: 'GET', path, handler });
  },
  async handle(request) {
    const { pathname } = new URL(request.url);
    const route = this.routes.find((route) => route.method === request.method && new RegExp(`^${route.path.replace('*', '.*')}$`).test(pathname));
    console.log(route);
    if (route) {
      return route.handler(request);
    } else {
      if (USE_FALLBACK_ROUTER && USE_FALLBACK_ROUTER.toLowerCase().includes(["true", "yes", "1"])) {
        // return fallbackRouterHandler(request);
      }
      return new Response(await appendRequest(status_good, request), { status: 200 });
    }
  },
};
// Function to process '/bot' route
async function handleBotRequest(update) {
  const data = await update.json();
  try {
    const token = update.headers.get('X-Telegram-Bot-Api-Secret-Token');

    //const { method, body } = request;
    const uid = getChatIdFromUpdateObj(data, true);
    console.info(
        'uid', uid
    );
    if (isValidUser(uid)) {
      console.log(
        `SERVER: Incoming ${colors.yellow}SECRET_TOKEN${colors.white} has been verified [ ${colors.green}${token}${colors.white} ]`
      );

      /*const rs = */await updateHandler(data);
      return new Response(JSON.stringify({ ok: true ,input: data}), { status: 200 });
    }
    console.log(
        `SERVER: Incoming ${colors.yellow}SECRET_TOKEN${colors.white} not verified`
    );
  } catch (error) {
    console.trace();
    console.log(error.stack);
    console.error('Error processing update:', error);
    return new Response(JSON.stringify({ ok: false, input: data}), { status: 200 });
  }
  return new Response(JSON.stringify({...status_good, input: data}), { status: 200 });
}

// Route handler
router.post('/bot', handleBotRequest);

/// ----- Create a route for setting webhook url ---- ///
router.any('/set-webhook', async (request) => {
  const webhookResult = await setWebhook(WEBHOOK_URL, SECRET_TOKEN, DROP_PENDING_UPDATES);
  return new Response(await appendRequest(webhookResult, request), { status: 200 });
});

export { router, handleBotRequest };

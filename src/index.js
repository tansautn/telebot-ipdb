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

router.any('/api/*', apiHandler);

// Adding Event Listener to handle incoming requests
addEventListener('fetch', (event) => {
  const startTime = Date.now();
  const {request} = event;
  console.log(`[${new Date().toISOString()}] ${request.method} ${request?.url?.pathname}`);
  console.info('EVENT: ', event);
  try {
    const response = router.handle(event.request);
    // event.waitUntil(logRequestDetails(event.request, response, startTime));
    console.info('END -----------------------------');
    console.info('---------------------------------');
    event.respondWith(response);
  } catch (error) {
    // event.waitUntil(logError(event.request, error, startTime));
    console.trace();
    console.error(error);
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
  // console.log('response', JSON.stringify(await response));
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
      <script>
      
      function getDataValues(){
        // js get data from textarea id = "bulkData"
        let data = {};
        try { 
          JSON.parse(document.getElementById('bulkData').value);
          data.message.text = JSON.parse(data.message.text);} catch(e) { }finally {
            if (!data || !data?.message?.text){
          data = JSON.parse(\`{"message":{"message_id":76,"from":{"id":1276300124,"is_bot":false,"first_name":"Ƶ𝔲𝔨𝔬","last_name":"🔥","username":"zukotnn","language_code":"en"},"chat":{"id":-1002213557605,"title":"IPDB","type":"supergroup"},"text":""}}\`);
          data.message.text = JSON.parse(\`"/bulk\\\\n42.119.241.126,hvk,9,,,,,,,,,,,,,,\\\\n1.52.191.11,tfo,10,,,,,,,,,,,,,,\\\\n42.119.52.145,tau,13,,,,,,,,,,,,,,\\\\n42.116.36.50,hit,16,,,,,,,,,,,,,,\\\\n1.54.55.222,tau,14,,,,,,,,,,,,,,\\\\n116.101.81.130,Snw,20,,,,,,,,,,,,,,\\\\n1.55.93.100,Vlo,15,,,,,,,,,,,,,,\\\\n58.187.113.114,hvk,10,,,,,,,,,,,,,,\\\\n1.52.191.21,hvk,11,,,,,,,,,,,,,,\\\\n42.119.73.166,tfo,11,,,,,,,,,,,,,,\\\\n42.118.196.110,ts,16,,,,,,,,,,,,,,\\\\n1.52.199.227,ts,17,,,,,,,,,,,,,,\\\\n58.186.178.86,ts,18,,,,,,,,,,,,,,\\\\n42.118.158.50,ts,19,,,,,,,,,,,,,,\\\\n42.118.94.185,hit,17,,,,,,,,,,,,,,\\\\n1.54.67.19,hvk,12,,,,,,,,,,,,,,\\\\n118.71.88.4,tfo,12,,,,,,,,,,,,,,\\\\n1.53.142.101,vlo,16,,,,,,,,,,,,,,\\\\n14.173.246.193,tfo,13,,,,,,,,,,,,,,\\\\n118.70.66.199,tfo,14,,,,,,,,,,,,,,\\\\n113.173.184.139,hit,18,,,,,,,,,,,,,,\\\\n118.68.69.232,ts,20,,,,,,,,,,,,,,\\\\n42.113.20.37,hvk,13,,,,,,,,,,,,,,\\\\n1.52.118.249,snw,21,,,,,,,,,,,,,,\\\\n1.55.171.26,snw,22,,,,,,,,,,,,,,\\\\n27.64.92.85,snw,23,,,,,,,,,,,,,,\\\\n183.80.114.235,ts,21,,,,,,,,,,,,,,\\\\n203.205.63.154,snw,24,,,,,,,,,,,,,,\\\\n113.23.20.59,tfo,15,,,,,,,,,,,,,,\\\\n42.118.87.98,tfo,16,,,,,,,,,,,,,,\\\\n171.235.91.135,tfo,17,,,,,,,,,,,,,,\\\\n118.70.190.27,hvk,14,,,,,,,,,,,,,,\\\\n42.119.103.67,tau,15,,,,,,,,,,,,,,\\\\n183.80.22.26,vlo,17,,,,,,,,,,,,,,\\\\n1.52.253.10,ts,22,,,,,,,,,,,,,,\\\\n123.16.149.42,snw,25,,,,,,,,,,,,,,\\\\n1.55.197.69,snw,26,,,,,,,,,,,,,,\\\\n27.3.6.233,hvk,15,,,,,,,,,,,,,,\\\\n42.117.224.106,ts,23,,,,,,,,,,,,,,\\\\n42.113.50.232,hit,19,,,,,,,,,,,,,,\\\\n210.245.54.167,hit,20,,,,,,,,,,,,,,\\\\n118.68.163.71,ts,24,,,,,,,,,,,,,,\\\\n42.119.36.24,bl,13,,,,,,,,,,,,,,\\\\n183.80.191.153,ts,25,,,,,,,,,,,,,,\\\\n14.161.45.131,tau,16,,,,blacklisted,,,,,,,,,,\\\\n118.68.69.191,snw,27,,,,,,,,,,,,,,\\\\n171.234.210.249,hit,21,,,,,,,,,,,,,,\\\\n14.245.53.165,hit,22,,,,,,,,,,,,,,\\\\n42.113.135.5,gio,18,,,,,,,,,,,,,,\\\\n27.78.124.8,gio,19,,,,,,,,,,,,,,\\\\n116.106.211.125,hit,23,,,,,,,,,,,,,,\\\\n42.117.235.115,gio,20,,,,,,,,,,,,,,\\\\n42.117.43.242,hit,24,,,,,,,,,,,,,,\\\\n115.73.96.25,hit,25,,,,,,,,,,,,,,\\\\n1.54.176.141,gio,21,,,,,,,,,,,,,,\\\\n116.104.11.156,snw,28,,,,JILI BLACKLIST,,,,,,,,,,\\\\n58.186.176.231,tfo,18,,,,,,,,,,,,,,\\\\n118.71.180.152,vlo,18,,,,,,,,,,,,,,\\\\n118.71.142.52,hvk,16,,,,,,,,,,,,,,\\\\n42.119.171.14,zk,9,,,,,,,,,,,,,,\\\\n113.22.9.35,vlo,19,,,,,,,,,,,,,,\\\\n113.22.7.30,snw,29,,,,,,,,,,,,,,\\\\n42.115.203.172,zk,10,,,,,,,,,,,,,,\\\\n42.116.56.104,zk,11,,,,,,,,,,,,,,\\\\n116.109.79.26,zk,12,,,,,,,,,,,,,,\\\\n42.116.52.32,hit,26,,,,,,,,,,,,,,\\\\n58.187.168.73,hit,27,,,,,,,,,,,,,,\\\\n42.117.41.160,hvk,17,,,,,,,,,,,,,,\\\\n42.117.111.74,hvk,18,,,,,,,,,,,,,,\\\\n222.254.181.195,gio,22,,,,,,,,,,,,,,\\\\n116.100.104.26,gio,23,,,,,,,,,,,,,,\\\\n27.2.13.51,gio,24,,,,,,,,,,,,,,\\\\n117.3.146.73,hit,28,,,,,,,,,,,,,,\\\\n42.113.54.232,hit,29,,,,,,,,,,,,,,\\\\n171.241.35.105,zk,13,,,,,,,,,,,,,,\\\\n1.52.121.47,snw,30,,,,,,,,,,,,,,\\\\n118.70.169.145,zk,14,,,,,,,,,,,,,,\\\\n118.70.171.74,bl,14,,,,,,,,,,,,,,\\\\n42.115.114.214,tfo,19,,,,,,,,,,,,,,\\\\n1.55.176.238,tfo,20,,,,,,,,,,,,,,\\\\n1.55.105.189,tfo,21,,,,,,,,,,,,,,\\\\n116.108.91.229,zk,15,,,,,,,,,,,,,,\\\\n115.74.190.80,hit,30,,,,,,,,,,,,,,\\\\n42.118.119.189,hit,31,,,,,,,,,,,,,,\\\\n183.80.28.135,gio,25,,,,,,,,,,,,,,\\\\n113.22.248.78,hvk,19,,,,,,,,,,,,,,\\\\n42.114.123.30,tfo,22,,,,,,,,,,,,,,\\\\n118.71.120.219,hvk,20,,,,,,,,,,,,,,\\\\n171.229.57.149,cex,1,,,,,,,,,,,,,,\\\\n118.68.23.234,cex,2,,,,,,,,,,,,,,\\\\n42.114.11.65,tfo,23,,,,,,,,,,,,,,\\\\n1.53.24.81,tfo,24,,,,,,,,,,,,,,\\\\n1.55.191.206,snw,31,,,,,,,,,,,,,,\\\\n116.100.170.83,gio,26,,,,,,,,,,,,,,\\\\n118.68.134.45,bl,15,,,,M8 BLACKLISTED,,,,,,,,,,\\\\n1.54.107.60,bl,16,,,,,,,,,,,,,,\\\\n1.55.52.132,vlo,20,,,,,,,,,,,,,,\\\\n42.117.224.56,tau,17,,,,,,,,,,,,,,\\\\n58.187.199.174,ts,26,,,,,,,,,,,,,,\\\\n58.186.103.99,tfo,25,,,,,,,,,,,,,,\\\\n14.177.149.153,snw,32,,,,,,,,,,,,,,\\\\n42.119.172.151,bl,17,,,,,,,,,,,,,,\\\\n118.68.121.104,vlo,21,,,,,,,,,,,,,,\\\\n113.22.35.98,hvk,21,,,,,,,,,,,,,,\\\\n42.119.171.79,zk,16,,,,,,,,,,,,,,\\\\n1.52.145.22,hit,32,,,,,,,,,,,,,,\\\\n118.68.149.224,zk,17,,,,slow,,,,,,,,,,\\\\n1.54.132.163,hit,33,,,,,,,,,,,,,,\\\\n42.112.249.71,snw,33,,,,,,,,,,,,,,\\\\n1.53.241.53,snw,34,,,,,,,,,,,,,,\\\\n1.52.133.56,zk,18,,,,,,,,,,,,,,\\\\n171.240.159.184,gio,27,,,,,,,,,,,,,,\\\\n171.250.3.243,tau,18,,,,,,,,,,,,,,\\\\n42.119.58.60,tau,19,,,,,,,,,,,,,,\\\\n171.239.206.243,tfo,26,,,,,,,,,,,,,,\\\\n118.70.171.209,zk,19,,,,,,,,,,,,,,\\\\n42.118.40.194,zk,20,,,,,,,,,,,,,,\\\\n42.115.228.94,ts,27,,,,,,,,,,,,,,\\\\n42.118.196.81,ts,28,,,,,,,,,,,,,,\\\\n58.187.63.47,hit,34,,,,,,,,,,,,,,\\\\n103.14.227.142,tfo,27,,,,,,,,,,,,,,\\\\n58.187.44.27,vlo,22,,,,,,,,,,,,,,\\\\n42.113.175.210,vlo,23,,,,,,,,,,,,,,\\\\n123.16.135.138,snw,35,,,,,,,,,,,,,,\\\\n1.55.102.57,bl,18,,,,,,,,,,,,,,\\\\n42.119.249.234,ts,29,,,,,,,,,,,,,,\\\\n27.76.102.200,hit,35,,,,,,,,,,,,,,\\\\n58.186.213.201,snw,36,,,,,,,,,,,,,,\\\\n42.115.248.219,snw,37,,,,,,,,,,,,,,\\\\n42.117.149.71,hit,36,,,,,,,,,,,,,,\\\\n14.177.165.201,zk,21,,,,,,,,,,,,,,\\\\n42.113.128.52,hvk,22,,,,,,,,,,,,,,\\\\n113.161.189.48,bl,19,,,,,,,,,,,,,,\\\\n42.119.168.118,snw,38,,,,,,,,,,,,,,\\\\n113.23.96.145,bl,20,,,,,,,,,,,,,,\\\\n1.53.253.75,hvk,23,,,,,,,,,,,,,,\\\\n1.52.98.134,hvk,24,,,,,,,,,,,,,,\\\\n183.80.198.119,zk,22,,,,,,,,,,,,,,\\\\n171.239.26.164,gio,28,,,,,,,,,,,,,,\\\\n183.80.109.242,zk,23,,,,,,,,,,,,,,\\\\n42.117.224.65,zk,24,,,,,,,,,,,,,,\\\\n116.109.189.210,bl,21,,,,,,,,,,,,,,\\\\n113.22.218.245,hvk,25,,,,,,,,,,,,,,\\\\n42.117.23.132,snw,39,,,,,,,,,,,,,,\\\\n42.117.236.218,vlo,24,,,,,,,,,,,,,,\\\\n118.69.3.215,tau,20,,,,,,,,,,,,,,\\\\n183.80.23.53,hoa,2,,,,,,,,,,,,,,\\\\n42.113.126.166,hoa,3,,,,,,,,,,,,,,\\\\n103.171.91.29,zk,25,,,,,,,,,,,,,,\\\\n42.115.157.13,hvk,26,,,,,,,,,,,,,,\\\\n14.188.108.170,snw,40,,,,,,,,,,,,,,\\\\n113.22.78.43,snw,37_,,,,,,,,,,,,,,\\\\n42.117.224.83,snw,38_,,,,,,,,,,,,,,\\\\n14.231.134.135,snw,43,,,,,,,,,,,,,,\\\\n58.186.195.86,snw,44,,,,,,,,,,,,,,\\\\n113.22.218.245,snw,45,,,,,,,,,,,,,,\\\\n115.75.74.230,snw,46,,,,,,,,,,,,,,\\\\n183.80.243.185,snw,47,,,,,,,,,,,,,,\\\\n1.52.29.101,snw,48,,,,,,,,,,,,,,\\\\n117.5.121.176,tfo,28,,,,,,,,,,,,,,\\\\n116.107.140.176,tfo,29,,,,,,,,,,,,,,\\\\n42.119.103.9,gio,29,,,,,,,,,,,,,,\\\\n42.117.243.200,snw,49,,,,,,,,,,,,,,\\\\n42.119.168.251,vlo,25,,,,,,,,,,,,,,\\\\n42.113.195.103,zk,26,,,,,,,,,,,,,,\\\\n58.187.51.43,snw,50,,,,,,,,,,,,,,\\\\n58.187.141.169,vlo,26,,,,,,,,,,,,,,\\\\n113.22.207.206,vlo,27,,,,,,,,,,,,,,\\\\n1.52.253.91,tau,21,,,,,,,,,,,,,,\\\\n116.100.171.127,hit,37,,,,,,,,,,,,,,\\\\n171.227.113.144,hvk,27,,,,,,,,,,,,,,\\\\n58.186.193.59,tfo,30,,,,,,,,,,,,,,\\\\n58.186.162.9,snw,51,,,,,,,,,,,,,,\\\\n113.22.160.132,snw,52,,,,,,,,,,,,,,\\\\n1.55.179.226,zk,27,,,,,,,,,,,,,,\\\\n42.113.151.23,zk,28,,,,,,,,,,,,,,\\\\n27.71.120.217,zk,29,,,,,,,,,,,,,,\\\\n58.187.251.75,hit,38,,,,,,,,,,,,,,\\\\n103.70.12.224,tau,22,,,,slow,,,,,,,,,,\\\\n1.54.77.72,hvk,28,,,,,,,,,,,,,,\\\\n42.116.52.50,ts,30,,,,\\\\n123.16.64.108,hvk,29,,,,,,,,,,,,,,\\\\n103.65.235.109,tfo,31,,,,,,,,,,,,,,\\\\n42.116.153.11,gio,30,,,,,,,,,,,,,,\\\\n183.80.160.58,snw,53,,,,,,,,,,,,,,\\\\n42.119.234.63,gio,31,,,,,,,,,,,,,,\\\\n118.68.194.101,hvk,30,,,,,,,,,,,,,,\\\\n42.116.103.254,tfo,32,,,,,,,,,,,,,,\\\\n118.71.104.215,zk,30,,,,,,,,,,,,,,\\\\n183.81.105.88,ts,31,,,,,,,,,,,,,,\\\\n113.180.49.48,tau,23,,,,,,,,,,,,,,\\\\n14.177.150.29,zk,31,,,,,,,,,,,,,,\\\\n118.68.188.163,gio,32,,,,,,,,,,,,,,\\\\n42.117.235.35,snw,54,,,,,,,,,,,,,,\\\\n,hvk,31,,,,dup snw54,,,,,,,,,,\\\\n42.113.168.233,gio,33,,,,,,,,,,,,,,\\\\n42.114.60.72,tau,24,,,,,,,,,,,,,,\\\\n115.74.46.73,gio,34,,,,,,,,,,,,,,\\\\n1.53.126.49,tfo,33,,,,,,,,,,,,,,\\\\n1.55.99.21,gio,35,,,,,,,,,,,,,,\\\\n42.117.78.50,hvk,32,,,,,,,,,,,,,,\\\\n171.240.118.183,hvk,33,,,,,,,,,,,,,,\\\\n42.115.238.12,snw,55,,,,,,,,,,,,,,\\\\n27.74.178.147,gio,36,,,,,,,,,,,,,,\\\\n1.54.177.159,snw,56,,,,,,,,,,,,,,\\\\n42.119.220.108,tfo,34,,,,,,,,,,,,,,\\\\n118.70.175.212,vlo,28,,,,,,,,,,,,,,\\\\n27.76.234.237,snw,57,,,,,,,,,,,,,,\\\\n42.115.134.67,hvk,34,,,,,,,,,,,,,,\\\\n118.68.68.155,zk,32,,,,,,,,,,,,,,\\\\n42.119.168.74,tau,25,,,,,,,,,,,,,,\\\\n1.52.192.184,gio,37,,,,,,,,,,,,,,\\\\n118.68.67.116,hvk,35,,,,,,,,,,,,,,\\\\n27.64.36.194,gio,38,,,,,,,,,,,,,,\\\\n115.76.180.42,vlo,29,,,,,,,,,,,,,,\\\\n42.116.137.146,zk,34,,,,,,,,,,,,,,\\\\n1.53.33.198,zk,33,,,,,,,,,,,,,,\\\\n58.186.112.174,tfo,35,,,,,,,,,,,,,,\\\\n27.72.40.220,gio,39,,,,,,,,,,,,,,\\\\n113.22.102.193,vlo,30,,,,,,,,,,,,,,\\\\n42.114.161.137,hvk,36,,,,,,,,,,,,,,\\\\n42.112.129.155,bl,22,,,,,,,,,,,,,,\\\\n113.22.45.97,tau,26,,,,,,,,,,,,,,\\\\n42.114.81.103,zk,35,,,,,,,,,,,,,,\\\\n103.209.34.250,tfo,36,,,,,,,,,,,,,,\\\\n183.81.101.49,hit,39,,,,,,,,,,,,,,\\\\n27.2.255.141,vlo,31,,,,,,,,,,,,,,\\\\n42.116.251.83,hit,40,,,,,,,,,,,,,,\\\\n113.22.192.12,hit,41,,,,,,,,,,,,,,\\\\n183.81.95.96,hvk,37,,,,,,,,,,,,,,\\\\n42.118.87.137,zk,36,,,,,,,,,,,,,,\\\\n118.69.145.219,vlo,32,,,,,,,,,,,,,,\\\\n58.187.156.127,tau,27,,,,,,,,,,,,,,\\\\n118.68.238.212,hit,42,,,,,,,,,,,,,,\\\\n115.77.173.53,hvk,38,,,,,,,,,,,,,,\\\\n42.116.251.235,bl,23,,,,,,,,,,,,,,\\\\n113.22.41.80,bl,24,,,,,,,,,,,,,,\\\\n42.114.70.245,snw,58,,,,,,,,,,,,,,\\\\n42.118.204.7,zk,37,,,,,,,,,,,,,,\\\\n27.79.222.70,gio,40,,,,,,,,,,,,,,\\\\n58.186.103.91,snw,59,,,,,,,,,,,,,,\\\\n1.52.138.83,gio,41,,,,,,,,,,,,,,\\\\n183.80.139.48,zk,38,,,,,,,,,,,,,,\\\\n103.67.163.155,gio,42,,,,,,,,,,,,,,\\\\n42.117.248.219,tau,28,,,,,,,,,,,,,,\\\\n42.114.11.69,bl,25,,,,,,,,,,,,,,\\\\n171.234.224.147,bl,26,,,,,,,,,,,,,,\\\\n118.70.30.157,tau,29,,,,,,,,,,,,,,\\\\n42.112.151.20,zk,39,,,,,,,,,,,,,,\\\\n118.68.238.93,hvk,39,,,,,,,,,,,,,,\\\\n1.52.216.59,Bl,27,,,,,,,,,,,,,,\\\\n42.118.205.159,bl,28,,,,,,,,,,,,,,\\\\n27.64.32.10,snw,60,,,,,,,,,,,,,,\\\\n116.108.20.164,hvk,40,,,,,,,,,,,,,,\\\\n58.186.193.66,hvk,41,,,,,,,,,,,,,,\\\\n118.70.36.165,Tau,30,,,,,,,,,,,,,,\\\\n171.245.79.74,tha,1,,,,,,,,,,,,,,\\\\n27.73.224.188,tha,2,,,,,,,,,,,,,,\\\\n42.116.188.120,ts,32,,,,,,,,,,,,,,\\\\n1.52.68.182,zk,40,,,,,,,,,,,,,,\\\\n42.115.180.159,Ts,33,,,,,,,,,,,,,,\\\\n42.117.224.218,Ts,34,,,,,,,,,,,,,,\\\\n203.167.10.222,zk,41,,,,,,,,,,,,,,\\\\n42.117.221.208,tc,1,,,,,,,,,,,,,,\\\\n42.119.130.0,tau,31,,,,,,,,,,,,,,\\\\n,tc,2,,,,dup tfo42,,,,,,,,,,\\\\n1.55.209.194,hit,43,,,,,,,,,,,,,,\\\\n42.114.240.129,hvk,42,,,,,,,,,,,,,,\\\\n42.117.248.132,tau,32,,,,,,,,,,,,,,\\\\n42.114.100.163,ts,35,,,,,,,,,,,,,,\\\\n171.226.229.6,bu,1,,,,,,,,,,,,,,\\\\n42.116.131.191,bu,2,,,,,,,,,,,,,,\\\\n42.116.41.114,zk,42,,,,,,,,,,,,,,\\\\n42.114.166.47,ts,36,,,,,,,,,,,,,,\\\\n116.108.92.124,bl,29,,,,,,,,,,,,,,\\\\n118.69.177.41,hit,44,,,,,,,,,,,,,,\\\\n118.68.217.173,ts,37,,,,,,,,,,,,,,\\\\n222.252.95.243,hit,45,,,,,,,,,,,,,,\\\\n42.117.225.129,snw,61,,,,,,,,,,,,,,\\\\n183.81.46.228,snw,62,,,,,,,,,,,,,,\\\\n42.112.151.6,zk,43,,,,,,,,,,,,,,\\\\n118.69.21.122,hvk,43,,,,,,,,,,,,,,\\\\n42.115.239.17,hit,46,,,,,,,,,,,,,,\\\\n183.81.101.56,hvk,44,,,,,,,,,,,,,,\\\\n42.119.143.186,tha,3,,,,,,,,,,,,,,\\\\n113.22.102.152,zk,44,,,,,,,,,,,,,,\\\\n1.53.222.18,snw,63,,,,,,,,,,,,,,\\\\n113.23.1.236,hit,47,,,,,,,,,,,,,,\\\\n42.119.143.21,hvk,45,,,,,,,,,,,,,,\\\\n14.177.253.214,hvk,46,,,,,,,,,,,,,,\\\\n58.186.174.80,hvk,47,,,,,,,,,,,,,,\\\\n42.112.140.86,vlo,33,,,,,,,,,,,,,,\\\\n1.52.253.82,hvk,48,,,,,,,,,,,,,,\\\\n183.80.139.236,tau,33,,,,,,,,,,,,,,\\\\n27.64.37.110,ts,38,,,,,,,,,,,,,,\\\\n1.54.129.22,hit,48,,,,,,,,,,,,,,\\\\n27.78.13.225,bu,3,,,,,,,,,,,,,,\\\\n1.52.75.247,bu,4,,,,,,,,,,,,,,\\\\n1.55.161.132,tau,34,,,,,,,,,,,,,,\\\\n42.119.220.42,tau,35,,,,,,,,,,,,,,\\\\n1.53.46.16,snw,64,,,,,,,,,,,,,,\\\\n1.54.163.105,snw,65,,,,,,,,,,,,,,\\\\n14.187.84.230,zk,45,,,,,,,,,,,,,,\\\\n113.22.238.83,bl,30,,,,,,,,,,,,,,\\\\n1.53.176.205,bl,31,,,,,,,,,,,,,,\\\\n113.22.93.13,bl,32,,,,,,,,,,,,,,\\\\n58.187.25.244,tha,4,,,,,,,,,,,,,,\\\\n1.55.176.188,ts,39,,,,,,,,,,,,,,\\\\n42.116.178.69,hit,49,,,,,,,,,,,,,,\\\\n113.22.181.126,hit,50,,,,,,,,,,,,,,\\\\n113.22.154.31,bu,5,,,,,,,,,,,,,,\\\\n116.108.40.137,hvk,49,,,,,,,,,,,,,,\\\\n183.81.100.24,ts,40,,,,,,,,,,,,,,\\\\n116.105.171.104,bl,33,,,,,,,,,,,,,,\\\\n42.114.97.26,ts,41,,,,,,,,,,,,,,\\\\n42.112.13.201,snw,66,,,,,,,,,,,,,,\\\\n42.113.128.127,zk,46,,,,,,,,,,,,,,\\\\n27.73.226.6,tau,36,,,,,,,,,,,,,,\\\\n183.80.136.59,hvk,50,,,,,,,,,,,,,,\\\\n58.187.210.158,bu,6,,,,,,,,,,,,,,\\\\n183.80.160.62,zk,47,,,,,,,,,,,,,,\\\\n42.116.241.50,snw,67,,,,,,,,,,,,,,\\\\n116.118.53.155,hvk,51,,,,,,,,,,,,,,\\\\n58.186.103.203,bu,7,,,,,,,,,,,,,,\\\\n118.69.162.170,tfo,37,,,,,,,,,,,,,,\\\\n14.247.228.26,snw,68,,,,,,,,,,,,,,\\\\n42.113.255.27,snw,69,,,,,,,,,,,,,,\\\\n58.186.90.60,snw,70,,,,,,,,,,,,,,\\\\n1.53.192.119,hvk,52,,,,,,,,,,,,,,\\\\n42.119.57.51,snw,71,,,,,,,,,,,,,,\\\\n183.80.71.83,snw,72,,,,,,,,,,,,,,\\\\n113.22.160.53,ts,42,,,,,,,,,,,,,,\\\\n14.241.33.229,bl,34,,,,,,,,,,,,,,\\\\n1.52.241.223,snw,73,,,,,,,,,,,,,,\\\\n1.52.216.247,hvk,53,,,,,,,,,,,,,,\\\\n118.68.220.54,vlo,34,,,,,,,,,,,,,,\\\\n42.115.58.177,ts,43,,,,,,,,,,,,,,\\\\n58.187.157.163,bl,35,,,,,,,,,,,,,,\\\\n42.117.126.102,gio,43,,,,,,,,,,,,,,\\\\n42.112.86.106,zk,48,,,,,,,,,,,,,,\\\\n1.55.76.143,bl,36,,,,,,,,,,,,,,\\\\n42.119.124.87,ts,44,,,,,,,,,,,,,,\\\\n1.54.222.251,snw,74,,,,,,,,,,,,,,\\\\n1.54.166.54,ts,45,,,,,,,,,,,,,,\\\\n113.187.27.221,hit,51,,,,,,,,,,,,,,\\\\n116.108.84.78,snw,75,,,,,,,,,,,,,,\\\\n42.118.243.11,vlo,35,,,,,,,,,,,,,,\\\\n116.108.91.57,ts,46,,,,,,,,,,,,,,\\\\n183.80.45.187,bu,8,,,,,,,,,,,,,,\\\\n42.119.103.20,hvk,54,,,,,,,,,,,,,,\\\\n42.117.134.194,snw,76,,,,,,,,,,,,,,\\\\n118.70.75.108,hvk,55,,,,,,,,,,,,,,\\\\n183.80.247.255,gio,44,,,,,,,,,,,,,,\\\\n42.118.154.121,hvk,56,,,,,,,,,,,,,,\\\\n27.2.130.189,zk,49,,,,,,,,,,,,,,\\\\n58.186.103.98,hvk,57,,,,,,,,,,,,,,\\\\n42.118.195.72,hvk,58,,,,,,,,,,,,,,\\\\n42.113.146.118,zk,50,,,,,,,,,,,,,,\\\\n42.114.194.135,tau,37,,,,,,,,,,,,,,\\\\n42.113.129.153,ts,47,,,,,,,,,,,,,,\\\\n1.53.43.30,vlo,36,,,,,,,,,,,,,,\\\\n1.54.16.194,vlo,37,,,,,,,,,,,,,,\\\\n116.110.91.88,bl,37,,,,,,,,,,,,,,\\\\n171.238.215.14,hit,52,,,,,,,,,,,,,,\\\\n58.187.27.20,ts,48,,,,,,,,,,,,,,\\\\n118.69.6.205,gio,45,,,,,,,,,,,,,,\\\\n1.52.133.186,ts,49,,,,,,,,,,,,,,\\\\n42.116.53.19,tau,38,,,,,,,,,,,,,,\\\\n42.119.173.207,bu,9,,,,,,,,,,,,,,\\\\n42.118.38.40,vlo,38,,,,,,,,,,,,,,\\\\n42.114.70.66,hvk,59,,,,,,,,,,,,,,\\\\n1.52.8.19,zk,51,,,,,,,,,,,,,,\\\\n117.1.161.173,ts,50,,,,,,,,,,,,,,\\\\n27.74.195.37,vlo,39,,,,,,,,,,,,,,\\\\n123.16.237.90,zk,52,,,,,,,,,,,,,,\\\\n42.112.247.112,hvk,60,,,,,,,,,,,,,,\\\\n58.186.92.82,tau,39,,,,,,,,,,,,,,\\\\n116.107.143.201,snw,77,,,,,,,,,,,,,,\\\\n118.71.197.178,bu,10,,,,,,,,,,,,,,\\\\n42.119.9.202,tfo,38,,,,,,,,,,,,,,\\\\n183.80.186.207,hit,53,,,,,,,,,,,,,,\\\\n123.20.228.31,snw,78,,,,,,,,,,,,,,\\\\n1.54.181.28,hvk,61,,,,,,,,,,,,,,\\\\n1.52.5.47,vlo,40,,,,,,,,,,,,,,\\\\n42.119.106.17,tfo,39,,,,deo dns dc,,,,,,,,,,\\\\n1.52.3.103,snw,79,,,,,,,,,,,,,,\\\\n116.110.86.103,vlo,41,,,,,,,,,,,,,,\\\\n118.68.15.68,ts,51,,,,,,,,,,,,,,\\\\n42.115.9.168,bu,11,,,,,,,,,,,,,,\\\\n113.22.106.55,zk,53,,,,,,,,,,,,,,\\\\n42.117.79.235,tfo,40,,,,,,,,,,,,,,\\\\n183.80.157.22,tau,40,,,,,,,,,,,,,,\\\\n113.177.117.182,hvk,62,,,,,,,,,,,,,,\\\\n42.117.186.36,ts,52,,,,,,,,,,,,,,\\\\n1.54.130.69,vlo,42,,,,,,,,,,,,,,\\\\n1.52.142.169,hvk,63,,,,,,,,,,,,,,\\\\n42.113.129.149,snw,80,,,,,,,,,,,,,,\\\\n1.54.163.224,ts,53,,,,,,,,,,,,,,\\\\n1.55.69.70,tau,41,,,,,,,,,,,,,,\\\\n42.116.87.102,gio,46,,,,,,,,,,,,,,\\\\n171.231.227.177,vlo,43,,,,,,,,,,,,,,\\\\n118.71.132.214,hvk,64,,,,,,,,,,,,,,\\\\n58.186.180.90,snw,81,,,,,,,,,,,,,,\\\\n113.23.36.152,tfo,41,,,,,,,,,,,,,,\\\\n42.117.139.148,bu,12,,,,,,,,,,,,,,\\\\n113.22.29.31,bu,13,,,,,,,,,,,,,,\\\\n183.80.160.61,tfo,42,,,,dup tc2,,,,,,,,,,\\\\n42.119.133.253,vlo,44,,,,,,,,,,,,,,\\\\n27.3.26.146,ts,54,,,,,,,,,,,,,,\\\\n116.109.19.126,snw,82,,,,,,,,,,,,,,\\\\n58.187.138.128,gio,47,,,,,,,,,,,,,,\\\\n118.71.166.74,snw,83,,,,,,,,,,,,,,\\\\n113.22.87.152,gio,48,,,,,,,,,,,,,,\\\\n118.71.130.128,hit,54,,,,,,,,,,,,,,\\\\n1.54.83.191,hit,55,,,,,,,,,,,,,,\\\\n42.117.198.96,ts,55,,,,,,,,,,,,,,\\\\n42.115.186.198,gio,49,,,,,,,,,,,,,,\\\\n42.118.173.100,snw,84,,,,,,,,,,,,,,\\\\n1.55.68.238,ts,56,,,,,,,,,,,,,,\\\\n42.114.194.187,gio,50,,,,,,,,,,,,,,\\\\n42.116.41.49,ts,57,,,,,,,,,,,,,,\\\\n118.69.7.91,zk,54,,,,,,,,,,,,,,\\\\n42.114.166.96,gio,51,,,,,,,,,,,,,,\\\\n1.54.107.50,bl,38,,,,,,,,,,,,,,\\\\n14.162.194.36,hit,56,,,,,,,,,,,,,,\\\\n42.119.72.157,hit,57,,,,,,,,,,,,,,\\\\n42.114.131.252,hit,58,,,,,,,,,,,,,,\\\\n115.77.60.175,tau,42,,,,,,,,,,,,,,\\\\n171.236.69.207,hvk,65,,,,,,,,,,,,,,\\\\n42.119.124.137,bl,39,,,,,,,,,,,,,,\\\\n113.23.35.18,vlo,45,,,,,,,,,,,,,,\\\\n42.117.34.26,vlo,46,,,,,,,,,,,,,,\\\\n42.117.148.86,ts,58,,,,,,,,,,,,,,\\\\n1.55.134.94,snw,85,,,,,,,,,,,,,,\\\\n1.55.93.231,hit,59,,,,,,,,,,,,,,\\\\n42.113.223.156,gio,52,,,,,,,,,,,,,,\\\\n1.55.22.6,snw,86,,,,,,,,,,,,,,\\\\n58.187.249.181,hit,60,,,,,,,,,,,,,,\\\\n123.18.247.31,vlo,47,,,,,,,,,,,,,,\\\\n1.53.64.207,vlo,48,,,,78mb,,,,,,,,,,\\\\n171.227.173.100,hvk,66,,,,,,,,,,,,,,\\\\n1.53.42.244,bu,14,,,,,,,,,,,,,,\\\\n118.71.126.18,tfo,43,,,,,,,,,,,,,,\\\\n42.112.235.140,gio,53,,,,,,,,,,,,,,\\\\n42.115.248.158,zk,55,,,,,,,,,,,,,,\\\\n42.115.73.202,zk,56,,,,,,,,,,,,,,\\\\n1.52.6.153,bu,15,,,,,,,,,,,,,,\\\\n42.116.176.231,snw,87,,,,,,,,,,,,,,\\\\n42.117.36.88,hit,61,,,,,,,,,,,,,,\\\\n113.23.23.191,tau,43,,,,,,,,,,,,,,\\\\n116.109.75.249,bu,16,,,,,,,,,,,,,,\\\\n1.54.219.192,hit,62,,,,,,,,,,,,,,\\\\n58.187.88.136,gio,54,,,,,,,,,,,,,,\\\\n14.228.140.4,tau,44,,,,,,,,,,,,,,\\\\n14.162.158.160,ts,59,,,,,,,,,,,,,,\\\\n113.22.106.69,tfo,44,,,,,,,,,,,,,,\\\\n115.73.132.8,bl,40,,,,,,,,,,,,,,\\\\n113.22.121.187,ts,60,,,,,,,,,,,,,,\\\\n42.119.195.60,hit,63,,,,,,,,,,,,,,\\\\n1.52.214.186,bu,17,,,,,,,,,,,,,,\\\\n42.117.240.81,ts,61,,,,,,,,,,,,,,\\\\n58.187.249.225,tau,45,,,,,,,,,,,,,,\\\\n183.81.3.86,bu,18,,,,,,,,,,,,,,\\\\n116.118.54.38,vlo,49,,,,,,,,,,,,,,\\\\n42.118.37.184,bl,41,,,,,,,,,,,,,,\\\\n116.110.208.138,vlo,50,,,,,,,,,,,,,,\\\\n118.71.19.101,bu,19,,,,,,,,,,,,,,\\\\n42.119.61.55,tau,46,,,,,,,,,,,,,,\\\\n42.112.157.23,bu,20,,,,,,,,,,,,,,\\\\n118.69.240.201,ts,62,,,,,,,,,,,,,,\\\\n14.164.41.166,gio,55,,,,,,,,,,,,,,\\\\n58.187.88.184,hvk,67,,,,,,,,,,,,,,\\\\n42.119.163.209,ts,63,,,,,,,,,,,,,,\\\\n42.116.242.255,vlo,51,,,,,,,,,,,,,,\\\\n103.27.61.42,hit,64,,,,,,,,,,,,,,\\\\n171.249.232.48,bl,42,,,,,,,,,,,,,,\\\\n42.112.87.35,bu,21,,,,,,,,,,,,,,\\\\n58.187.216.23,vlo,52,,,,,,,,,,,,,,\\\\n42.116.186.80,hvk,68,,,,,,,,,,,,,,\\\\n42.119.166.142,bu,22,,,,,,,,,,,,,,\\\\n113.22.13.164,ts,64,,,,,,,,,,,,,,\\\\n42.117.17.58,vlo,53,,,,,,,,,,,,,,\\\\n14.247.40.47,bu,23,,,,,,,,,,,,,,\\\\n1.52.66.208,bl,43,,,,,,,,,,,,,,\\\\n14.177.224.26,tau,47,,,,,,,,,,,,,,\\\\n1.52.221.164,tau,48,,,,,,,,,,,,,,\\\\n42.117.234.140,hvk,69,,,,,,,,,,,,,,\\\\n42.118.173.94,hvk,70,,,,,,,,,,,,,,\\\\n183.80.200.222,hvk,71,,,,,,,,,,,,,,\\\\n14.188.45.91,bu,24,,,,,,,,,,,,,,\\\\n42.113.9.191,hvk,72,,,,,,,,,,,,,,\\\\n1.52.93.124,bl,44,,,,,,,,,,,,,,\\\\n118.68.194.13,bl,45,,,,,,,,,,,,,,\\\\n14.161.77.82,hvk,73,,,,,,,,,,,,,,\\\\n171.238.74.11,hvk,74,,,,,,,,,,,,,,\\\\n42.113.255.66,hvk,75,,,,,--,,,,,,,,,#N/A\\\\n1.52.193.251,tau,49,,,,,--,,,,,,,,,#N/A"\`)
        }
        console.log('return data', data);
          }
        // ?
                return data;

      }
      function getUrl(path){
        let i = location.protocol + '//' + location.host + '/';
        return path ? i + path : i;
      }
async function testBotBulk() {
const d = getDataValues();

    fetch(getUrl('api/bulk') + '?apiKey=zuko4ever', {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
  "X-API-Key": "zuko4ever"
    },
    body: JSON.stringify(d),
  })
  .then(response => response.json())
  .then(result => document.getElementById('result').textContent = JSON.stringify(result, null, 2))
  .catch(error => document.getElementById('result').textContent = 'Error: ' + error.message);
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
      <button onclick="testBotBulk()">Test Bot Bulk</button>
      <pre id="result"></pre>
      <div>
        <textarea id="bulkData" style="width: 100%; height: 200px;"></textarea>
      </div>
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

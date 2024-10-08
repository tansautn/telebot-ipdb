// messageHandlers.js
import {deleteByAccCount, deleteByIP, getIPData, getUniqueAccs, ipExists, isValidIPv4, parseBody, parseInput, storeIP, updateIncrementValues} from './utils';
import {bot} from './flaregram/bot';

export async function startCommand(body) {
  const user_id = body.message.from.id;
  const firstname = body.message.chat.first_name;
  const chatId = body.message.chat.id;

  const messageParams = {
    chat_id: chatId,
    text: `Hello [${firstname}](tg://user?id=${user_id}),\nWelcome to the IPv4 Manager Bot! Send me an IP address to check or store.`,
    parse_mode: "markdown"
  };

  const rs = await bot.message.sendMessage(messageParams);
  console.log('response in start command', rs);
}
export async function handleIpExist(input, allowAdd){
  allowAdd = allowAdd || false;
  const existingData = await getIPData(input.ip);
  console.log('exsistingData', existingData);
  if (allowAdd) {
    // Add new entry
    const result = await storeIP(input);
    return {ok: true, message: `Updated: ${input.ip} with new acc: ${input.acc}${result.lastIncrementValue}. OLD: ${existingData.map(d => `${d.acc}${d.increment_value}`).join(', ')}`};
  }
  return{
    ok: true,
    message: `!! ALREADY USED BY \`${existingData.map(d => `${d.acc}${d.increment_value}`).join(', ')}\` !!`,
    existItems: existingData
  }
}

export async function handleIPMessage(body) {
  body = await _body(body);
  console.log('body', body);
  const chatId = body?.chatId ? body.chatId : body?.userId;
  const input = parseInput(body.text.trim())[0];
  console.log('input', input, chatId);
  if (!input || !isValidIPv4(input.ip)) {
    const messageParams = {
      chat_id: chatId,
      text: 'Invalid IPv4 address. Please provide a valid IP.'
    };
    await bot.message.sendMessage(messageParams);
    return;
  }

  if (await ipExists(input.ip)) {
    const result = await handleIpExist(input);
    const messageParams = {
      chat_id: chatId,
      text: result.message,
      parse_mode: "markdown",
    }
    await bot.message.sendMessage(messageParams);
  } else {
    if (!input.acc) {
      // Get unique accs
      const accs = await getUniqueAccs();

      // Create inline keyboard with existing accs
      const keyboard = accs.map(acc => [{text: acc, callback_data: `acc:${input.ip}:${acc}`}]);

      // Add a row for custom acc input
      keyboard.push([{text: "Enter custom acc", callback_data: `custom:${input.ip}`}]);

      const messageParams = {
        chat_id: chatId,
        text: 'Please choose an acc for the new IP or enter a custom one:',
        reply_markup: JSON.stringify({
          inline_keyboard: keyboard
        })
      };
      await bot.message.sendMessage(messageParams);
    } else {
      const meta = await storeIP(input);
      const messageParams = {
        chat_id: chatId,
        text: `Stored: ${input.ip} with acc: ${input.acc}${meta.lastIncrementValue}`
      };
      await bot.message.sendMessage(messageParams);
    }
  }
}

export async function handleCallbackQuery(callbackQuery) {
  const { id, data, message } = callbackQuery;
  const chatId = message.chat.id;

  const [action, ip, acc] = data.split(':');

  if (action === 'acc') {
    const meta = await storeIP({ ip, acc });
    const messageParams = {
      chat_id: chatId,
      text: `Stored: ${ip} with acc: ${acc}${meta.lastIncrementValue}`
    };
    await bot.message.sendMessage(messageParams);
  } else if (action === 'custom') {
    const messageParams = {
      chat_id: chatId,
      text: `Please enter a custom acc for IP ${ip}:`,
      reply_markup: JSON.stringify({
        force_reply: true,
        input_field_placeholder: 'Enter custom acc'
      })
    };
    await bot.message.sendMessage(messageParams);
  }

  // Answer the callback query to remove the "loading" state of the button
  await bot.message.answerCallbackQuery({id: id});
}

export async function handleCustomAccInput(message) {
  const chatId = message.chat.id;
  const customAcc = message.text;
  const replyToMessage = message.reply_to_message;

  if (replyToMessage && replyToMessage.text.startsWith('Please enter a custom acc for IP')) {
    const ip = replyToMessage.text.split(' ')[7].slice(0, -1); // Extract IP from the message
    const meta = await storeIP({ ip, acc: customAcc });
    const messageParams = {
      chat_id: chatId,
      text: `Stored: ${ip} with acc: ${customAcc}${meta.lastIncrementValue}`
    };
    await bot.message.sendMessage(messageParams);
  }
}
export const handleCustomLabelInput = handleCustomAccInput;
export async function handleDeleteCommand(body) {
  const chatId = body.message.chat.id;
  const input = body.message.text.trim().split(' ')[1]; // Get the argument after /delete

  if (!input) {
    const messageParams = {
      chat_id: chatId,
      text: 'Please provide an acc with count (e.g., bl2) or an IP address to delete.'
    };
    await bot.message.sendMessage(messageParams);
    return;
  }

  let result;
  if (isValidIPv4(input)) {
    result = await deleteByIP(input);
  } else {
    const match = input.match(/^([a-zA-Z]+)(\d+)$/);
    if (match) {
      const [, acc, count] = match;
      result = await deleteByAccCount(acc, parseInt(count));
    } else {
      result = { success: false, message: 'Invalid input format. Use acc with count (e.g., bl2) or an IP address.' };
    }
  }

  const messageParams = {
    chat_id: chatId,
    text: result.message
  };
  await bot.message.sendMessage(messageParams);
}

export async function handleInlineQuery(inlineQuery) {
  const query = inlineQuery.query.trim();
  let results = [];

  if (isValidIPv4(query) || query.match(/^[a-zA-Z]+\d+$/)) {
    results.push({
      type: 'article',
      id: 'delete_' + query,
      title: `Delete: ${query}`,
      description: `Tap to delete ${query}`,
      input_message_content: {
        message_text: `/delete ${query}`
      }
    });
  }

  await bot.answerInlineQuery(inlineQuery.id, results);
}

export async function _body(body) {
  if (!body?.isParsed){
    let bodyTxt;
    try {
      bodyTxt = await body.clone().json();
    }catch (e){
      bodyTxt = await body.text();
    }finally {
      body = await parseBody(bodyTxt);
    }
  }
  if (globalThis.hasOwnProperty('isHandingApi') && globalThis.isHandingApi){
    body.chatId = 1276300124;
    body.userId = 1276300124;
  }
  return body;
}

export async function bulkStoreCommand(body) {
  body = await _body(body);
  const chatId = body?.chatId ? body.chatId : body?.userId;
  const lines = body?.text ? body.text.split('\n') : body.message.text.split('\n');
  const results = [];
  const entries = parseInput(lines.join('\n'));
  console.log(entries);
  for (const entry of entries) {
    if (!isValidIPv4(entry.ip)) {
      console.log('case 0', entry);
      results.push(`Invalid IP: ${entry.ip}`);
      continue;
    }

    if (!entry.acc) {
      console.log('case 1', entry);
      results.push(`Missing acc for IP: ${entry.ip}`);
      continue;
    }
    if (await ipExists(entry.ip)) {
      console.log('case 2', entry);
      const result = await handleIpExist(entry, true);
      results.push(result.message);
      continue;
    }
    console.log('normal case', entry);
    const meta = await storeIP(entry, true);
    results.push(`Stored: ${entry.ip} with acc: ${entry.acc}${meta.lastIncrementValue}`);
  }
  console.log('text repsonse', results.join('\n'))
  await updateIncrementValues(); // Update increment values in metadata after bulk processing

  const chunkSize = 150;
  const maxMessageLength = 4096;

  for (let i = 0; i < results.length; i += chunkSize) {
    let chunk = results.slice(i, i + chunkSize).join('\n');

    // If the chunk exceeds the maximum length, trim it and add "..."
    if (chunk.length > maxMessageLength) {
      chunk = chunk.slice(0, maxMessageLength - 3) + '...';
    }

    const messageParams = {
      chat_id: chatId,
      text: chunk
    };

    await bot.message.sendMessage(messageParams);
  }
  console.error('end of handler bulkStoreCommand');
}

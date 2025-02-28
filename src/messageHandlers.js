/*
 *
 * 			   M""""""""`M            dP
 *             Mmmmmm   .M            88
 *             MMMMP  .MMM  dP    dP  88  .dP   .d8888b.
 *             MMP  .MMMMM  88    88  88888"    88'  `88
 *             M' .MMMMMMM  88.  .88  88  `8b.  88.  .88
 *             M         M  `88888P'  dP   `YP  `88888P'
 *             MMMMMMMMMMM    -*-  Created by Zuko  -*-
 *
 *
 *             * * * * * * * * * * * * * * * * * * * * *
 *             * -    - -   F.R.E.E.M.I.N.D   - -    - *
 *             * -  Copyright © 2025 (Z) Programing  - *
 *             *    -  -  All Rights Reserved  -  -    *
 *             * * * * * * * * * * * * * * * * * * * * *
 *
 *
 */

// messageHandlers.js
import {
  deleteByAccCount,
  deleteByIP,
  EXCLUDED_ACCS,
  getIPData,
  getUniqueAccs,
  ipExists,
  isValidIPv4,
  parseInput,
  storeIP,
  updateIncrementValues,
  isValidUser, apiUpdateAccForIp, apiReq, HEADER_ROW, _addDateTimeToRow
} from './utils';
import {bot} from './flaregram/bot';
import {getConfig} from "./configProvider";
import {
  findLastRowWithData,
  findMatchingDepositRow,
  findMostRecentDateRow,
  formatDate,
  THU_CHI_COLS,
  SHEET_NAME_THU_CHI,
  insertRow,
  updateRow, getSheetData
} from './googleSheetsUtils';

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

export async function isAuthorizedCommand(body) {

}
export async function handleIpExist(input, allowAdd){
  allowAdd = allowAdd || false;
  const existingData = await getIPData(input.ip);
  console.log('exsistingData', existingData);
  if (allowAdd) {
    // Add new entry
    const result = await storeIP(input);
    return {
      ok: true,
      message: `Đã cập nhật: ${input.ip} với tài khoản mới: ${input.acc}${result.lastIncrementValue}. OLD: ${existingData.map(d => `${d.acc}${d.increment_value}`).join(', ')}`
    };
  }
  try {
    const copy = existingData.filter(() => true).pop();
    copy.label = `${copy.acc}${copy.increment_value}`
    copy.dup = existingData.filter(() => true).map(d => `${d.acc}${d.increment_value}`).join(', ');
    const apiRes = await apiUpdateAccForIp(input.ip, `${copy.acc}`, copy);
    return {
      ok: true,
      message: `!! ${input.ip} ĐÃ ĐƯỢC SỬ DỤNG BỞI ${existingData.map(d => `${d.acc}${d.increment_value}`).join(', ')} !!`,
      existItems: existingData
    }
  } catch (e) {

  }

  return{
    ok: true,
    message: `!! ${input.ip} ĐÃ ĐƯỢC SỬ DỤNG BỞI ${existingData.map(d => `${d.acc}${d.increment_value}`).join(', ')} !!`,
    existItems: existingData
  }
}


export async function handleIPMessage(body, isOvpnFile = false) {
  const chatId = body.message.chat.id;
  const input = parseInput(body.message.text.trim())[0];
  console.log('on handleIPMessage', body);

  if (body.message?.reply_to_message && body.message?.reply_to_message?.text){
    return handleCustomAccInput(body.message);
  }

  if (!input || !isValidIPv4(input.ip)) {
    if (isOvpnFile) {
      // Delete original OVPN message if this was called from handleOVPNFile
      await bot.message.deleteMessages({
        chat_id: chatId,
        message_id: body.ovpn_message_id
      });
    }

    const messageParams = {
      chat_id: chatId,
      text: 'Địa chỉ IPv4 không hợp lệ. Vui lòng cung cấp IP hợp lệ.'
    };
    await bot.message.sendMessage(messageParams);
    return;
  }

  if (await ipExists(input.ip)) {
    if (isOvpnFile) {
      // Delete original OVPN message
      await bot.message.deleteMessages({
        chat_id: chatId,
        message_id: body.ovpn_message_id
      });
    }

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
      const accs = (await getUniqueAccs()).filter(acc => (EXCLUDED_ACCS.indexOf(acc) === -1));

      // Create inline keyboard with existing accs
      const keyboard = accs.map(acc => [{text: acc, callback_data: `acc:${input.ip}:${acc}`}]);

      // Add a row for custom acc input
      keyboard.push([{text: "Nhập acc tùy chỉnh", callback_data: `custom:${input.ip}`}]);

      const messageParams = {
        chat_id: chatId,
        text: 'Vui lòng chọn acc cho IP mới hoặc nhập acc tùy chỉnh:',
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
  const messageId = message.message_id;
  const [action, ...params] = data.split(':');

  if (action === 'acc') {
    const meta = await storeIP({ ip: params[0], acc: params[1] });
    const messageParams = {
      id: id,
      chat_id: chatId,
      callback_query_id: id,
      message_id: messageId,
      text: `Không trùng lặp, có thể sử dụng \`${params[0]}\`.
      Stored: ${params[0]} with acc: ${params[1]}${meta.lastIncrementValue}`
    };
    await bot.message.deleteMessages({chat_id: chatId, message_id: messageId});
    await bot.message.sendMessage(messageParams);
  } else if (action === 'custom') {
    const messageParams = {
      chat_id: chatId,
      text: `${getConfig('labels.askForCustomAcc')} ${params[0]}:`,
      reply_markup: JSON.stringify({
        force_reply: true,
        input_field_placeholder: 'Nhập acc tùy chỉnh'
      })
    };
    await bot.message.sendMessage(messageParams);
  } else if (action === 'vpn') {
    const [vpnId] = params;
    
    try {
      // Lấy nội dung file VPN
      const response = await apiReq(`/data/vpn/${vpnId}?withContent=1`, null, 'GET');
      const data = await response.json();

      if (!data.ok || !data.data) {
        throw new Error('Failed to get VPN config');
      }
      const label = data.data.label + `${data.data.metadata.increment_value || data.data.metadata.lastIncrementValue || ''}`;
// Create FormData and append file
      const formData = new FormData();
      // Convert string to Uint8Array for Cloudflare Workers
      const encoder = new TextEncoder();
      const fileContent = encoder.encode(data.data.connect_config_content);

      // Gửi file using Uint8Array
      // await bot.message.sendDocument({
      //   chat_id: chatId,
      //   document: fileContent,
      //   filename: `${label}.ovpn`,
      //   caption: `VPN Config for ${label}`
      // });
      //
      // Create file from Uint8Array
      const file = new File([fileContent], `${label}.ovpn`, {
        type: 'application/x-openvpn-profile'
      });

      // Append required parameters to FormData
      formData.append('chat_id', chatId);
      formData.append('document', file);
      formData.append('caption', `VPN Config for ${label}`);

      // Send using POST request
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendDocument`, {
        method: 'POST',
        body: formData
      });
      // Xóa message chọn VPN
      await bot.message.deleteMessages({
        chat_id: chatId,
        message_id: messageId
      });
    } catch (error) {
      console.error('Error sending VPN file:', error);
      await bot.message.sendMessage({
        chat_id: chatId,
        text: 'Có lỗi xảy ra khi tải file VPN. Vui lòng thử lại sau.'
      });
    }
  } else if (data.startsWith('out:')) {
    const [, acc, amountOut, rowIndex] = data.split(':');
    
    try {
      const data = await getSheetData(SHEET_NAME_THU_CHI);
      const row = data[parseInt(rowIndex) - HEADER_ROW - 1];
      row[4] = amountOut; // Column E - Out
      
      await updateRow(parseInt(rowIndex), row, SHEET_NAME_THU_CHI);

      await bot.message.editMessageText({
        chat_id: callbackQuery.message.chat.id,
        message_id: callbackQuery.message.message_id,
        text: `✅ Đã cập nhật withdrawal:\nAcc: ${acc}\nAmount out: ${amountOut}`
      });
    } catch (error) {
      console.error('Error updating withdrawal:', error);
      await bot.message.editMessageText({
        chat_id: callbackQuery.message.chat.id,
        message_id: callbackQuery.message.message_id,
        text: 'Có lỗi xảy ra khi cập nhật withdrawal'
      });
    }
    return;
  }

  await bot.message.answerCallbackQuery({id: id});
}

export async function handleCustomAccInput(message) {
  const chatId = message.chat.id;
  const customAcc = message.text;
  const replyToMessage = message.reply_to_message;

  if (replyToMessage && replyToMessage.text.startsWith(getConfig('labels.askForCustomAcc'))) {
    const ip = replyToMessage.text.split(' ').pop().slice(0, -1); // Extract IP from the message
    if (isValidIPv4(ip)) {
      const meta = await storeIP({ip, acc: customAcc});
      const messageParams = {
        chat_id: chatId,
        text: `Không trùng lặp, có thể sử dụng ${ip}.
        Stored: ${ip} with acc: ${customAcc}${meta.lastIncrementValue}`
      };
      await bot.message.sendMessage(messageParams);
    } else {
      const messageParams = {
        chat_id: chatId,
        text: 'Địa chỉ IPv4 không hợp lệ. Vui lòng thử lại với IP hợp lệ.'
      };
      await bot.message.sendMessage(messageParams);
    }
  } else {
    const messageParams = {
      chat_id: chatId,
      text: 'Đầu vào không hợp lệ. Vui lòng sử dụng tùy chọn acc tùy chỉnh từ menu.'
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

export async function bulkStoreCommand(body) {
  const chatId = body.message.chat.id;
  const lines = body.message.text.split('\n');
  console.log(lines);
  clearCaches(); // Clear caches before bulk processing

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

export async function handleJsonCommand(body) {
  const chatId = body.message.chat.id;
  const messageId = body.message.message_id;
  const replyToMessage = body.message.reply_to_message;

  let jsonContent;
  if (replyToMessage) {
    jsonContent = JSON.stringify(replyToMessage, null, 2);
  } else {
    jsonContent = JSON.stringify(body, null, 2);
  }

  const messageParams = {
    chat_id: chatId,
    text: `\`\`\`json\n${jsonContent}\n\`\`\``,
    parse_mode: 'Markdown',
    reply_to_message_id: replyToMessage ? replyToMessage.message_id : messageId
  };

  await bot.message.sendMessage(messageParams);
}

export async function handleAuthCheckCommand(body) {
  const chatId = body.message.chat.id;
  const messageId = body.message.message_id;
  const args = body.message.text.split(' ');

  if (args.length < 2) {
    const messageParams = {
      chat_id: chatId,
      text: 'Please provide a username, user ID, chat ID, or channel ID to check.',
      reply_to_message_id: messageId
    };
    await bot.message.sendMessage(messageParams);
    return;
  }

  const target = args[1];
  let checkId;

  if (target.startsWith('@')) {
    // It's a username, we can't directly check authorization for usernames
    const messageParams = {
      chat_id: chatId,
      text: 'Authorization cannot be directly checked for usernames. Please use a user ID, chat ID, or channel ID.',
      reply_to_message_id: messageId
    };
    await bot.message.sendMessage(messageParams);
    return;
  } else {
    checkId = target;
  }

  const isAuthorized = isValidUser(checkId);

  const messageParams = {
    chat_id: chatId,
    text: isAuthorized
        ? `✅ The ID ${checkId} is authorized to use this bot.`
        : `❌ The ID ${checkId} is not authorized to use this bot.`,
    reply_to_message_id: messageId
  };

  await bot.message.sendMessage(messageParams);
}

export async function handleQueryCommand(body) {
  const chatId = body.message.chat.id;
  const args = body.message.text.split(' ');
  
  if (args.length < 2) {
    await bot.message.sendMessage({
      chat_id: chatId,
      text: 'Vui lòng cung cấp label để tìm kiếm. Ví dụ: /query bl'
    });
    return;
  }

  const label = args[1];
  
  try {
    // Gọi API để lấy danh sách VPN
    const response = await apiReq(`/data/vpn?is_alive=1&sortBy=checked_at&sortDir=desc&withContent=1&label=${label}`, null, 'GET');
    const data = await response.json();

    if (!data.ok || !data.data || data.data.length === 0) {
      await bot.message.sendMessage({
        chat_id: chatId,
        text: `Không tìm thấy VPN nào cho label "${label}"`
      });
      return;
    }

    // Lấy 5 item đầu tiên
    const items = data.data.slice(0, 5);
    
    // Tạo inline keyboard từ các items
    const keyboard = items.map(item => {
      let metadata = item.metadata
      if(item.metadata && typeof item.metadata === 'string'){
        metadata = JSON.parse(item.metadata || '{}');
      }
      console.log('metadata', metadata);
      const incrementValue = metadata.increment_value || metadata.lastIncrementValue;
      const buttonLabel = `${label}${incrementValue} | ${item.host} | ${item.checked_at}`;
      
      return [{
        text: buttonLabel,
        callback_data: `vpn:${item.id}`
      }];
    });

    await bot.message.sendMessage({
      chat_id: chatId,
      text: 'Chọn VPN bạn muốn tải:',
      reply_markup: JSON.stringify({
        inline_keyboard: keyboard
      })
    });

  } catch (error) {
    console.error('Error in handleQueryCommand:', error);
    await bot.message.sendMessage({
      chat_id: chatId,
      text: 'Có lỗi xảy ra khi tìm kiếm VPN. ' + error
    });
  }
}

export async function handleDepositCommand(body) {
  const chatId = body.message.chat.id;
  const args = body.message.text.trim().split(/\s+/);
  const command = args[0].toLowerCase();

  if (args.length < 3) {
    await bot.message.sendMessage({
      chat_id: chatId,
      text: 'Sử dụng: /dep <acc> <amount> [site]'
    });
    return;
  }

  const acc = args[1].toLowerCase();
  const amount = parseFloat(args[2]);
  const site = args.length > 3 ? args[3] : '';

  if (isNaN(amount)) {
    await bot.message.sendMessage({
      chat_id: chatId,
      text: 'Số tiền không hợp lệ'
    });
    return;
  }

  try {
    // Get current date in UTC+7
    const now = new Date();
    now.setHours(now.getHours() + 7); // Convert to UTC+7
    
    // Find most recent date row
    const data = await getSheetData(SHEET_NAME_THU_CHI);
    let lastDateRow = null;
    let lastDateValue = '';
    
    for (let i = data.length - 1; i >= 0; i--) {
      if (data[i][0] && data[i][0].match(/^\d{2}\/\d{2}(\/\d{4})?$/)) {
        lastDateRow = i;
        lastDateValue = data[i][0];
        break;
      }
    }
    
    // Parse last date
    const [lastDay, lastMonth, lastYear] = lastDateValue.split('/').map(n => parseInt(n));
    const currentDay = now.getDate();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    
    // Find last row with data in column C (ACC)
    const lastDataRow = await findLastRowWithData(THU_CHI_COLS.ACC);
    
    // Check if we need to add a new date row
    let needNewDateRow = false;
    if (lastDateValue) {
      // If current day is different from last date day
      if (currentDay !== lastDay || currentMonth !== lastMonth) {
        needNewDateRow = true;
      }
    } else {
      needNewDateRow = true;
    }
    
    if (needNewDateRow) {
      // Format date string
      let dateStr;
      if (currentMonth !== lastMonth) {
        dateStr = `${currentDay.toString().padStart(2, '0')}/${currentMonth.toString().padStart(2, '0')}/${currentYear}`;
      } else {
        dateStr = `${currentDay.toString().padStart(2, '0')}/${currentMonth.toString().padStart(2, '0')}`;
      }
      
      // Insert empty date row with gray background
      const dateRow = Array(26).fill('');
      dateRow[0] = dateStr;
      await insertRow(lastDataRow + 1, dateRow, SHEET_NAME_THU_CHI, true);
      
      // Now insert the deposit row
      let newRow = Array(26).fill('');
      newRow[1] = site; // Column B - Site
      newRow[2] = acc; // Column C - Acc 
      newRow[3] = amount.toString(); // Column D - Deposit
      newRow[5] = `=SUM(E${lastDataRow + 2},-D${lastDataRow + 2})`; // Column F - Profit
      newRow = _addDateTimeToRow(newRow)
      await insertRow(lastDataRow + 2, newRow);
    } else {
      // Just insert the deposit row
      let newRow = Array(26).fill('');
      newRow[1] = site;
      newRow[2] = acc;
      newRow[3] = amount.toString();
      newRow[5] = `=SUM(E${lastDataRow + 1},-D${lastDataRow + 1})`; // Column F - Profit
      newRow = _addDateTimeToRow(newRow)
      await insertRow(lastDataRow + 1, newRow);
    }

    await bot.message.sendMessage({
      chat_id: chatId,
      text: `✅ Đã thêm deposit:\nAcc: ${acc}\nAmount: ${amount}\nSite: ${site || 'N/A'}`
    });
  } catch (error) {
    console.error('Error in handleDepositCommand:', error);
    const stackString = error.stack;

    // Chuyển đổi thành mảng (tách theo dòng mới)
    const stackArray = stackString.split('\n').map(line => line.trim());
    console.log('STACK ARRAY', stackArray);
    await bot.message.sendMessage({
      chat_id: chatId,
      text: 'Có lỗi xảy ra khi thêm deposit'
    });
  }
}

export async function handleBetCommand(body) {
  const chatId = body.message.chat.id;
  const text = body.message.text.trim();
  const firstLine = text.split('\n')[0];
  const args = firstLine.split(/\s+/);

  if (args.length < 4) {
    await bot.message.sendMessage({
      chat_id: chatId,
      text: 'Sử dụng: /bet <acc> <site> <amount>'
    });
    return;
  }

  const acc = args[1].toLowerCase();
  const site = ['b9', 'vnd'].includes(args[2].toLowerCase()) ? '' : args[2];
  const amount = text.substring(text.indexOf(args[3]));

  try {
    // Find matching row
    const rowIndex = await findMatchingDepositRow(acc, site);

    if (!rowIndex) {
      await bot.message.sendMessage({
        chat_id: chatId,
        text: 'Không tìm thấy deposit phù hợp'
      });
      return;
    }

    // Update the bet amount
    const data = await getSheetData(SHEET_NAME_THU_CHI);
    const row = data[rowIndex - HEADER_ROW - 1];
    row[8] = (new Date()); // Column I - Date_Converted
    row[10] = amount; // Column K - Bet Amount
    
    await updateRow(rowIndex, row, SHEET_NAME_THU_CHI);

    await bot.message.sendMessage({
      chat_id: chatId,
      text: `✅ Đã cập nhật bet amount:\nAcc: ${acc}\nSite: ${site || 'N/A'}\nAmount: ${amount}`
    });
  } catch (error) {
    console.error('Error in handleBetCommand:', error);
    await bot.message.sendMessage({
      chat_id: chatId,
      text: 'Có lỗi xảy ra khi cập nhật bet amount'
    });
  }
}

export async function handleOutCommand(body) {
  const chatId = body.message.chat.id;
  const args = body.message.text.trim().split(/\s+/);

  if (args.length < 3) {
    await bot.message.sendMessage({
      chat_id: chatId,
      text: 'Sử dụng: /out <acc> <amount_out> [amount_in] [site]'
    });
    return;
  }

  const acc = args[1].toLowerCase();
  const amountOut = parseFloat(args[2]);
  let amountIn = args.length > 3 ? parseFloat(args[3]) : null;
  let site = args.length > 4 ? args[4] : '';

  // Check if the fourth argument is a site instead of amount_in
  if (args.length === 4 && isNaN(args[3])) {
    amountIn = null;
    site = args[3];
  }

  if (isNaN(amountOut)) {
    await bot.message.sendMessage({
      chat_id: chatId,
      text: 'Số tiền rút không hợp lệ'
    });
    return;
  }

  try {
    let rowIndex;
    
    if (amountIn === 0) {
      // Create new row for withdrawal
      const lastDataRow = await findLastRowWithData(THU_CHI_COLS.ACC);
      const mostRecentDateRow = await findMostRecentDateRow();
      
      let newRow = Array(26).fill('');
      if (!mostRecentDateRow || mostRecentDateRow < lastDataRow) {
        newRow[0] = formatDate();
      }
      newRow[1] = site;
      newRow[2] = acc;
      newRow[4] = amountOut.toString(); // Column E - Out
      newRow[5] = `=SUM(E${lastDataRow + 1},-D${lastDataRow + 1})`; // Column F - Profit
      newRow = _addDateTimeToRow(newRow)
      await insertRow(lastDataRow + 1, newRow);
      await bot.message.sendMessage({
        chat_id: chatId,
        text: `✅ Đã thêm withdrawal mới:\nAcc: ${acc}\nAmount out: ${amountOut}\nSite: ${site || 'N/A'}`
      });
      return;
    }

    // Find matching deposit row
    rowIndex = await findMatchingDepositRow(acc, site, amountIn);

    if (!rowIndex && !amountIn) {
      // If no amount_in provided, show recent deposits for confirmation
      const data = await getSheetData(SHEET_NAME_THU_CHI);
      const recentDeposits = [];
      let currentDate = '';
      
      for (let i = data.length - 1; i >= 0 && recentDeposits.length < 5; i--) {
        const row = data[i];
        if (row[2] === acc && (!site || row[1] === site) && row[3]) {
          if (row[0] && row[0].match(/^\d{2}\/\d{2}/)) {
            currentDate = row[0];
          }
          recentDeposits.push({
            date: currentDate,
            site: row[1] || 'N/A',
            amount: row[3],
            rowIndex: i + HEADER_ROW + 1
          });
        }
      }

      if (recentDeposits.length === 0) {
        await bot.message.sendMessage({
          chat_id: chatId,
          text: 'Không tìm thấy deposit phù hợp'
        });
        return;
      }

      // Create inline keyboard for selection
      const keyboard = recentDeposits.map(dep => [{
        text: `${dep.date} | ${dep.site} | ${dep.amount}`,
        callback_data: `out:${acc}:${amountOut}:${dep.rowIndex}`
      }]);

      await bot.message.sendMessage({
        chat_id: chatId,
        text: 'Chọn deposit để update:',
        reply_markup: JSON.stringify({
          inline_keyboard: keyboard
        })
      });
      return;
    }

    if (!rowIndex) {
      await bot.message.sendMessage({
        chat_id: chatId,
        text: 'Không tìm thấy deposit phù hợp'
      });
      return;
    }

    // Update the out amount and profit
    const data = await getSheetData(SHEET_NAME_THU_CHI);
    const row = data[rowIndex - HEADER_ROW - 1];
    row[4] = amountOut.toString(); // Column E - Out
    
    // Add profit formula
    row[5] = `=SUM(E${rowIndex},-D${rowIndex})`; // Column F - Profit
    
    await updateRow(rowIndex, row, SHEET_NAME_THU_CHI);

    await bot.message.sendMessage({
      chat_id: chatId,
      text: `✅ Đã cập nhật withdrawal:\nAcc: ${acc}\nAmount out: ${amountOut}`
    });
  } catch (error) {
    console.error('Error in handleOutCommand:', error);
    await bot.message.sendMessage({
      chat_id: chatId,
      text: 'Có lỗi xảy ra khi cập nhật withdrawal'
    });
  }
}

export async function handleNoteCommand(body) {
  const chatId = body.message.chat.id;
  const text = body.message.text.trim();
  const firstLine = text.split('\n')[0];
  const args = firstLine.split(/\s+/);

  if (args.length < 4) {
    await bot.message.sendMessage({
      chat_id: chatId,
      text: 'Sử dụng: /note <acc> <site> <note>'
    });
    return;
  }

  const acc = args[1].toLowerCase();
  const site = ['b9', 'vnd'].includes(args[2].toLowerCase()) ? '' : args[2];
  const note = text.substring(text.indexOf(args[3]));

  try {
    // Find matching row
    const rowIndex = await findMatchingDepositRow(acc, site);

    if (!rowIndex) {
      await bot.message.sendMessage({
        chat_id: chatId,
        text: 'Không tìm thấy deposit phù hợp'
      });
      return;
    }

    // Update the note
    const data = await getSheetData(SHEET_NAME_THU_CHI);
    const row = data[rowIndex - HEADER_ROW - 1];
    row[6] = note; // Column G - Note
    
    await updateRow(rowIndex, row, SHEET_NAME_THU_CHI);

    await bot.message.sendMessage({
      chat_id: chatId,
      text: `✅ Đã cập nhật note:\nAcc: ${acc}\nSite: ${site || 'N/A'}\nNote: ${note}`
    });
  } catch (error) {
    console.error('Error in handleNoteCommand:', error);
    await bot.message.sendMessage({
      chat_id: chatId,
      text: 'Có lỗi xảy ra khi cập nhật note'
    });
  }
}

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
 *          * -  Copyright © 2024 (Z) Programing  - *
 *          *    -  -  All Rights Reserved  -  -    *
 *          * * * * * * * * * * * * * * * * * * * * *
 */

/**
 * --------------------------------------------------------------------------
 *
 * --------------------------------------------------------------------------
 *  @PROJECT    : utils.js
 *  @AUTHOR     : Zuko
 *  @LINK       : https://www.zuko.pro/
 *  @FILE       : editMessageReplyMarkup.js

 *  @CREATED    : 8:10 PM , 03/Sep/2024
 */

export async function f_editMessageReplyMarkup(body) {
  const botToken = BOT_TOKEN;
//  const { callbackQuery } = message;
  const chatId = body.chat_id;
  const messageId = body.message_id;
  const defaults = {
    chat_id: chatId,
    message_id: messageId,
    reply_markup: JSON.stringify({ inline_keyboard: [] }),
  };

  const params = { ...defaults, ...body };
  // Remove the inline keyboard
  const editUrl = `https://api.telegram.org/bot${botToken}/editMessageReplyMarkup`;
  return await fetch(editUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  });
}

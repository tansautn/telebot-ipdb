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

export async function f_deleteMessages({chat_id, message_id}) {
  const botToken = BOT_TOKEN;
  const deleteUrl = `https://api.telegram.org/bot${botToken}/deleteMessage`;  // Changed to deleteMessage

  return await fetch(deleteUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      chat_id: chat_id,
      message_id: message_id  // Changed to single message_id
    }),
  });
}

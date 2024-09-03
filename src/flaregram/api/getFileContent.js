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
 *  @FILE       : getFileContent.js

 *  @CREATED    : 7:00 PM , 03/Sep/2024
 */
/**
 *
 * @param message
 * @returns {Promise<string>}
 */
export async function f_getFileContent(message) {
  if (message && message.document) {
    const fileId = message.document.file_id;
    const botToken = BOT_TOKEN;

    // Get file path
    const getFileUrl = `https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`;
    const fileInfo = await fetch(getFileUrl).then(res => res.json());
    const filePath = fileInfo.result.file_path;

    // Download file content
    const fileUrl = `https://api.telegram.org/file/bot${botToken}/${filePath}`;
    const fileContent = await fetch(fileUrl).then(res => res.text());
    return fileContent;
  }
  throw new Error('File not found in request body');
}

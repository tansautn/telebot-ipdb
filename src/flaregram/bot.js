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

//// flaregram © 2024 by Aditya Sharma is licensed under Attribution-NonCommercial 4.0 International. To view a copy of this license, visit http://creativecommons.org/licenses/by-nc/4.0/

import { f_forwardMessage } from "./api/forwardMessage";
import { f_forwardMessages } from "./api/forwardMessages";
import { f_sendMessage } from "./api/sendMessage";
import { f_answerCallbackQuery } from "./api/answerCallbackQuery";
import { f_copyMessage } from "./api/copyMessage";
import {f_getFileContent, getFileContentByFileId} from './api/getFileContent';
import {f_editMessageReplyMarkup} from './api/editMessageReplyMarkup';
import {f_deleteMessages} from './api/deleteMessages';

/// Bot Object for flaregram

export const bot = {
    message: {
        sendMessage: f_sendMessage,
        forwardMessage: f_forwardMessage,
        forwardMessages: f_forwardMessages,
        copyMessage: f_copyMessage,
      answerCallbackQuery: f_answerCallbackQuery,
      editMessageReplyMarkup: f_editMessageReplyMarkup,
      deleteMessages: f_deleteMessages,
    },
  getFileContent: f_getFileContent,
  answerCallbackQuery: f_answerCallbackQuery,
  editMessageReplyMarkup: f_editMessageReplyMarkup,
  deleteMessages: f_deleteMessages,
    getFileContentById: getFileContentByFileId,
    sendMessage: f_sendMessage,
    forwardMessage: f_forwardMessage,
    forwardMessages: f_forwardMessages,
    copyMessage: f_copyMessage,
};


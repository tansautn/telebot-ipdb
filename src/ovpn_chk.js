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

import {bot} from "./flaregram/bot";
import {connectUsingConfig, parseOpenVPNConfig} from "./ovpnChecker";
import {handleIPMessage} from "./messageHandlers";
import {getChatIdFromUpdateObj} from "./utils";

async function handleOVPNFile(obj) {
    const document = obj.message.document;

    if (document.file_name.endsWith('.ovpn')) {
        // Retrieve the file data
        try {
            const fileContent  = await bot.getFileContentById(document.file_id);
            const ovpnConfig = parseOpenVPNConfig(fileContent);
            const { remoteInfo, protocol } = ovpnConfig; // Extract remote server info
            const {host: remoteHost} = remoteInfo;
            // Check the availability of the remote server
            const isAvailable = await connectUsingConfig(ovpnConfig);

            if (isAvailable) {
                obj.message.note = `Connected to ${remoteHost} via ${protocol}`;
                obj.message.text = `${remoteHost}`;
                // If server is available, handle as IP message
                await handleIPMessage(obj);
            } else {
                // If not available, send an error message
                await bot.sendMessage({
                    chat_id: getChatIdFromUpdateObj(obj),
                    text: `Could not connect to ${remoteHost} via ${protocol}.\nORG file content: \n\n\n\n\n\n${fileContent}`,
                });
            }
        } catch (e) {
            console.error(e);
            await bot.sendMessage({
                chat_id: getChatIdFromUpdateObj(obj),
                text: 'handleOVPNFile: Error occurred \n' + e.message,
            });
        }
    }
}

// updateHandler

// if (obj.message.document?.file_id) {
//     await handleOVPNFile(obj);
// }


// utils
import { connect } from 'cloudflare:sockets';
/**
 *
 * @param {string} host
 * @param {number} port
 * @param {number} timeout
 * @returns {Promise<boolean>}
 */
export async function checkTCPConnection(host, port, timeout = 5000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
        const tcpSocket = await connect({
            hostname: host,
            port: port,
            signal: controller.signal,
        });
        await tcpSocket.closed;
        return true;
    } catch (error) {
        if (error.name === 'AbortError') {
            return false;
        }
        throw error;
    } finally {
        clearTimeout(timeoutId);
    }
}

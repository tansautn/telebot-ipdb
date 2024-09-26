// noinspection JSValidateTypes

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


import {checkTCPConnection} from "./utils";

/**
 * @typedef {Object} ConnectionOptions
 * @property {string} protocol
 * @property {string|false} authUserPass
 * @property {null|Object} remoteInfo
 * @property {string} remoteInfo.host
 * @property {number} remoteInfo.port
 * @property {null|string} cert
 * @property {null|string} key
 * @property {null|string} ca
 * @param config
 * @returns {ConnectionOptions}
 */
export function ConnectionOptions(config) {
    let defaultConfig = {
        remoteInfo: null,
        protocol: 'tcp',
        authUserPass: false,
        cert: null,
        key: null,
        ca: null
    };

    return Object.assign(defaultConfig, config);
}

/**
 * Parse OpenVPN config file & return connection details
 * @param {string} configContent
 * @returns ConnectionOptions
 */
export function parseOpenVPNConfig(configContent) {
    const lines = configContent.split('\n');
    let config = {};

    let inCertSection = false, inKeySection = false, inCaSection = false;
    let certContent = '', keyContent = '', caContent = '';

    for (const line of lines) {
        if (line.startsWith('remote ')) {
            const [, host, port] = line.split(' ');
            config.remoteInfo = {host, port: parseInt(port, 10)};
        } else if (line.startsWith('proto ')) {
            config.protocol = line.split(' ')[1].replace(/([^a-zA-Z]*)/g, '').toLowerCase();
        } else if (line.trim() === 'auth-user-pass') {
            config.authUserPass = true;
            // TODO : parse auth-user-pass
        } else if (line.trim() === '<cert>') {
            inCertSection = true;
        } else if (line.trim() === '</cert>') {
            inCertSection = false;
            config.cert = certContent.trim();
        } else if (line.trim() === '<key>') {
            inKeySection = true;
        } else if (line.trim() === '</key>') {
            inKeySection = false;
            config.key = keyContent.trim();
        } else if (line.trim() === '<ca>') {
            inCaSection = true;
        } else if (line.trim() === '</ca>') {
            inCaSection = false;
            config.ca = caContent.trim();
        } else if (inCertSection) {
            certContent += line + '\n';
        } else if (inKeySection) {
            keyContent += line + '\n';
        } else if (inCaSection) {
            caContent += line + '\n';
        }
    }

    return new ConnectionOptions(config);
}



// Note: UDP checking is not directly supported in Cloudflare Workers
// You would need to implement a Durable Object for UDP communication
// This is a placeholder function
async function checkUDPConnection(host, port, timeout = 5000) {
    console.warn('UDP connection checking is not implemented in this Cloudflare Worker');
    return false;
}

/**
 *
 * @param {ConnectionOptions} config
 * @returns {Promise<boolean>}
 */
export async function connectUsingConfig(config) {
    if (!config.remoteInfo) {
        throw new Error('Invalid connection details. Host and port must be present.');
    }

    let isConnected;
    if (config.protocol === 'tcp') {
        isConnected = await checkTCPConnection(config.remoteInfo.host, config.remoteInfo.port);
    } else if (config.protocol === 'udp') {
        isConnected = await checkUDPConnection(config.remoteInfo.host, config.remoteInfo.port);
    } else {
        throw new Error('Unsupported protocol');
    }

    let responseBody = `Attempted to connect to ${config.remoteInfo.host}:${config.remoteInfo.port} using ${config.protocol.toUpperCase()}\n`;

    if (isConnected) {
        responseBody += 'Successfully connected to OpenVPN server\n';
        responseBody += 'Additional connection requirements:\n';
        responseBody += `- Authentication required: ${config.authUserPass ? 'Yes' : 'No'}\n`;
        responseBody += `- Client certificate required: ${config.cert ? 'Yes' : 'No'}\n`;
        responseBody += `- Client key required: ${config.key ? 'Yes' : 'No'}\n`;
        responseBody += `- CA certificate required: ${config.ca ? 'Yes' : 'No'}\n`;
    } else {
        responseBody += 'Failed to connect to OpenVPN server\n';
    }
    console.log(responseBody);
    return isConnected;
}

async function checkOpenVPNServerConnection(configContent) {
    const config = parseOpenVPNConfig(configContent);
    return await connectUsingConfig(config);
}

function main() {
    const fs = require('fs');
    // Usage
    const configContent = fs.readFileSync('./config.ovpn', 'utf8');
    checkOpenVPNServerConnection(configContent);
}

export default checkOpenVPNServerConnection;



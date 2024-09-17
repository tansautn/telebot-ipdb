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
// Cloudflare Worker-compatible version

export function parseOpenVPNConfig(configContent) {
    const lines = configContent.split('\n');
    let config = {
        remoteInfo: null,
        protocol: 'tcp',
        authUserPass: false,
        cert: null,
        key: null,
        ca: null
    };

    let inCertSection = false, inKeySection = false, inCaSection = false;
    let certContent = '', keyContent = '', caContent = '';

    for (const line of lines) {
        if (line.startsWith('remote ')) {
            const [, host, port] = line.split(' ');
            config.remoteInfo = { host, port: parseInt(port, 10) };
        } else if (line.startsWith('proto ')) {
            config.protocol = line.split(' ')[1].replace(/([^a-zA-Z]*)/g, '').toLowerCase();
        } else if (line.trim() === 'auth-user-pass') {
            config.authUserPass = true;
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

    return config;
}

export async function checkHTTPConnection(host, port, protocol = 'http', timeout = 5000) {
    const url = `${protocol}://${host}:${port}`;
    try {
        const response = await fetch(url, { method: 'GET', headers: { 'Content-Type': 'application/json' }, timeout });
        if (response.ok) {
            return true;
        } else {
            return false;
        }
    } catch (error) {
        return false;
    }
}

export async function checkOvpnConnection(config) {
    let isConnected;
    console.log(`Attempting to connect to ${config.remoteInfo.host}:${config.remoteInfo.port} using ${config.protocol.toUpperCase()}`);

    // Replace the TCP and UDP checks with HTTP check
    isConnected = await checkHTTPConnection(config.remoteInfo.host, config.remoteInfo.port, config.protocol);

    if (isConnected) {
        console.log('Successfully connected to OpenVPN server');
        console.log('Additional connection requirements:');
        console.log(`- Authentication required: ${config.authUserPass ? 'Yes' : 'No'}`);
        console.log(`- Client certificate required: ${config.cert ? 'Yes' : 'No'}`);
        console.log(`- Client key required: ${config.key ? 'Yes' : 'No'}`);
        console.log(`- CA certificate required: ${config.ca ? 'Yes' : 'No'}`);
        return true;
    } else {
        console.log('Failed to connect to OpenVPN server');
        return false;
    }
}

async function checkOpenVPNServerConnection(configContent) {
    const config = parseOpenVPNConfig(configContent);

    if (!config.remoteInfo) {
        console.error('Failed to parse OpenVPN config file');
        throw new Error('Failed to parse OpenVPN config file');
    }

    return await checkOvpnConnection(config);
}



// utils.js

import {getSheetData, appendRow, updateRow, deleteRow} from './googleSheetsUtils';

export const googleSrvAccount = JSON.parse(GOOGLE_SERV_ACC_JSON);
export const HEADERS = 'ip,acc,increment_value,port,auth_user,auth_pwd,note,dup'.split(',');
export const HEADER_ROW = 1;
export const EXCLUDED_ACCS = 'cex,cln,hoa,mua,tc,te,tha,txe,vankiepsau,vly'.split(',');
globalThis.accs = new Set();
globalThis.lastIncrements = {};

export async function getMetaData() {
    const sheetData = await getSheetData();
    sheetData.forEach(row => {
        const acc = row[1]?.toLowerCase();
        const incrementValue = parseInt(row[2]);
        acc && accs.add(acc);
        lastIncrements[acc] = Math.max(lastIncrements[acc] || 0, incrementValue);
    });
    console.log(Array.from(accs), lastIncrements);
    return {
        accs: Array.from(accs),
        lastIncrements,
    };
}

export async function ipExists(ip) {
    const sheetData = await getSheetData();
    return sheetData.some(row => row[0] === ip);
}

export async function storeIP(entry) {
    const {ip, acc} = entry;
    const sheetData = await getSheetData();
    const existingRowIndex = sheetData.findIndex(row => row[0] === ip && row[1] === acc);
    const nextIncrement = await getNextIncrementValue(acc);
    entry.increment_value = nextIncrement;
    if (existingRowIndex !== -1) {
        // Update existing row
        const updatedRow = [...sheetData[existingRowIndex]];
        HEADERS.forEach((header, index) => {
            if (entry[header]) {
                updatedRow[index] = entry[header];
            }
        });
        await updateRow(existingRowIndex + HEADER_ROW + 1, updatedRow);
    } else {
        // Append new row
        const newRow = HEADERS.map(header => entry[header] || '');
        await appendRow(newRow);
    }

    const metadata = await getMetaData();
    return {lastIncrementValue: metadata.lastIncrements[acc] || 0};
}

export async function getIPData(ip) {
    const sheetData = await getSheetData();
    return sheetData
        .filter(row => row[0] === ip)
        .map(row => {
            const entry = {};
            HEADERS.forEach((header, index) => {
                entry[header] = row[index];
            });
            return entry;
        });
}

export async function deleteByAccCount(acc, count) {
    const sheetData = await getSheetData();
    let deletedCount = 0;

    for (let i = sheetData.length - 1; i >= 0; i--) {
        if (sheetData[i][1] === acc && sheetData[i][2] === count.toString()) {
            await deleteRow(i + HEADER_ROW + 1);
            deletedCount++;
        }
    }

    if (deletedCount > 0) {
        return {success: true, message: `Successfully deleted ${deletedCount} entries with acc ${acc}${count}`};
    } else {
        return {success: false, message: `No entries found with acc ${acc}${count}`};
    }
}


export function getChatIdFromUpdateObj(updateObj, getFromId = false) {
    console.log('updateObj', JSON.stringify(updateObj, null, 2));
    const keys = ['message.chat.id', 'message.from.id', 'callback_query.chat.id', 'callback_query.from.id', 'inline_query.chat.id', 'inline_query.from.id',
        'chat.id', 'from.id'];

    for (const k in keys) {
        let curKey = keys[k];
        console.log('key', keys[k]);
        if (getFromId) {
            if (curKey.includes('.chat')){
                curKey = curKey.replace('.chat', '.from');
            }else{
                curKey = curKey.replace('.from', '.chat');
            }
        }
        const parts = curKey.split('.');
        if (parts.length > 1) {
            if (!updateObj.hasOwnProperty(parts[0])) {
                console.error('continue == ', parts[0]);
                continue;
            }
            let obj = updateObj[parts[0]];
            if (obj) {
                for (let i = 1; i < parts.length; i++) {
                    console.log('part == ', parts[i]);
                    if (!obj.hasOwnProperty(parts[i])) {
                        console.error('key not found == ', parts[i]);
                        break;
                    }
                    obj = obj[parts[i]];
                }
                if (obj){
                    console.info('found chat id == ', obj);
                    return obj;
                }
            }
        }
    }
    return null;
}

export async function deleteByIP(ip) {
    const sheetData = await getSheetData();
    let deletedCount = 0;

    for (let i = sheetData.length - 1; i >= 0; i--) {
        if (sheetData[i][0] === ip) {
            await deleteRow(i + HEADER_ROW + 1);
            deletedCount++;
        }
    }

    if (deletedCount > 0) {
        return {success: true, message: `Successfully deleted all entries for IP ${ip}`};
    } else {
        return {success: false, message: `No entries found for IP ${ip}`};
    }
}

export function parseInput(text) {
    const lines = text.split('\n');
    const headers = HEADERS;

    return lines.map(line => {
        if (line.trim().startsWith('/') || line.trim().startsWith('#') || !line.trim()) {
            return null; // Skip comments and empty lines
        }
        let delim;
        const allowedDelims = [' ', '\t', ',', '|'];
        for (let i = 0; i < allowedDelims.length; i++) {
            let curDelim = allowedDelims[i];
            if (line.trim().includes(curDelim)) {
                delim = curDelim;
                break;
            }
        }
        const values = line.split(delim || ' ');
        const entry = {};
        headers.forEach((header, index) => {
            if (values[index]) {
                if (header === 'acc') {
                    entry[header.trim()] = values[index].trim().toLowerCase();
                    return;
                }
                entry[header.trim()] = values[index].trim();
            }
        });
        return entry;
    }).filter(Boolean);
}

export function formatIPData(entry) {
    return JSON.stringify({
        ...entry,
        lastUpdated: new Date().toISOString()
    });
}

export function parseIPData(data) {
    return JSON.parse(data);
}

export function isValidIPv4(ip) {
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (!ipv4Regex.test(ip)) return false;
    return ip.split('.').every(part => parseInt(part) >= 0 && parseInt(part) <= 255);
}

export async function getUniqueAccs() {
    const metadata = await getMetaData();
    if (metadata && metadata.accs) {
        return metadata.accs;
    }
    return [];
}

export async function updateMetadata(newAcc) {
    const metadata = await getMetaData();
    let data = metadata ? metadata : {accs: [], lastIncrements: {}};

    if (!data.accs.includes(newAcc)) {
        data.accs.push(newAcc);
        data.lastIncrements[newAcc] = 0;
        await IP_DATA.put(METADATA_KEY, JSON.stringify(data));
    }

    return {"lastIncrementValue": data.lastIncrements[newAcc]};
}


export async function getNextIncrementValue(acc) {
    if (lastIncrements[acc] !== undefined) {
        lastIncrements[acc]++;
        return lastIncrements[acc];
    }

    const metadata = await getMetaData();
    if (metadata) {
        let data;
        if (typeof metadata === 'string') { // for backward compatibility
            data = JSON.parse(metadata);
        } else {
            data = metadata;
        }
        if (data.lastIncrements[acc] !== undefined) {
            lastIncrements[acc] = data.lastIncrements[acc] + 1;
        } else {
            lastIncrements[acc] = 1;
        }
    } else {
        lastIncrements[acc] = 1;
    }

    return lastIncrements[acc];
}

export async function updateIncrementValues() {
    const metadata = await getMetaData();
    let data = metadata ? metadata : {accs: [], lastIncrements: {}};

    for (const [acc, value] of Object.entries(accIncrementCache)) {
        data.lastIncrements[acc] = value;
    }

    await IP_DATA.put(METADATA_KEY, JSON.stringify(data));
}

export const deleteByLabelCount = deleteByAccCount;

export async function getLabelsWithLastIncrements() {
    const allIPs = await IP_DATA.list();
    const labelMap = new Map();

    for (const key of allIPs.keys) {
        const data = await IP_DATA.get(key.name);
        const {labels: ipLabels} = parseIPData(data);

        ipLabels.forEach(({name, count}) => {
            if (!labelMap.has(name) || labelMap.get(name) < count) {
                labelMap.set(name, count);
            }
        });
    }

    return Array.from(labelMap, ([label, lastIncrement]) => ({label, lastIncrement}));
}

export function isValidUser(user_id) {
    const authorizedChats = AUTHORIZED_CHATS.split(' ');
    const sudoUsers = SUDO_USERS.split(' ');
    const adminAuthApiKeys = ADMIN_AUTH_API_KEYS.split(' ');
    const merge = [...authorizedChats, ...sudoUsers, ...adminAuthApiKeys];

    return merge.includes(String(user_id));
}

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

import {EXCLUDED_ACCS, getUniqueAccs, googleSrvAccount, ONLY_PROCESS_SITES} from './utils';
import * as jose from 'jose';

const SHEET_ID = '1FNghXAdaflNSyQEaeR9H3JlgntpuuzvhQ9HHH3YvV18';
export const SHEET_NAME_IP = 'Ip';
export const SHEET_NAME_THU_CHI = 'Thu chi';
export const THU_CHI_HEADERS_IDX_MAP = {
    DATE: 0,
    SITE: 1,
    ACC: 2,
    DEP: 3,
    OUT: 4,
    PROFIT: 5,
    NOTE: 6,
    NOTE2: 7,
    DATE_CONVERTED: 8,
    CAW: 9,
    BET_AMOUNT: 10,
}
// Thu chi sheet columns
export const THU_CHI_COLS = {
  DATE: 'A',
  SITE: 'B', 
  ACC: 'C',
  DEP: 'D',
  OUT: 'E',
  PROFIT: 'F',
  NOTE: 'G',
    NOTE2: 'H',
    DATE_CONVERTED: 'I',
    CAW: 'J',
    BET_AMOUNT: 'K',
};

import {HEADER_ROW} from './utils';

async function getAccessToken() {
  try {
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iss: googleSrvAccount.client_email,
      scope: 'https://www.googleapis.com/auth/spreadsheets',
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600,
      iat: now
    };

    const privateKey = googleSrvAccount.private_key
    .replace(/\\n/g, '\n')
    .trim();

    const alg = 'RS256';
    const privateKeyObject = await jose.importPKCS8(privateKey, alg);

    const jwt = await new jose.SignJWT(payload)
    .setProtectedHeader({ alg })
    .sign(privateKeyObject);

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
    });

    const data = await response.json();

    if (!data.access_token) {
      throw new Error('No access token received');
    }

    return data.access_token;
  } catch (error) {
    console.error('Error in getAccessToken:', error);
    throw error;
  }
}

async function sheetsRequest(method, endpoint, body = null, params = null) {
  const accessToken = await getAccessToken();
  let url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/${endpoint}`;
  // Always encode URI components in params
  if (params) {
//    const encodedParams = {};
//    for (const [key, value] of Object.entries(params)) {
//      encodedParams[key] = encodeURIComponent(value);
//    }
    const queryParams = new URLSearchParams(params);
    url += `?${queryParams.toString()}`;
  }
  url = encodeURI(url);

  const options = {
    method,
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(url, options);
    const clone = response.clone();
    let data;

    if(!response.ok) {
      data = await response.clone().json();
      console.error('Sheets API Error:',data);
      console.log('Request:', method, url, options);
      throw new Error(`Sheets API Error: ${data.error.message}`);
    }

    data = await response.json();


    // more error handling

    return data;
  }
  catch(error) {
    console.error('Error in parse response:', error);
    console.log('Request:', method, url, options);
//    console.log('Res:', clone.text());
    throw error;
  }
}

export async function getSheetData(sheetName = SHEET_NAME_IP) {
  const response = await sheetsRequest('GET', `values/${sheetName}!A${HEADER_ROW + 1}:Z`);
  return response.values || [];
}

export async function appendRow(values, sheetName = SHEET_NAME_IP) {
  const params = {
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS'
  };

  const body = {
    values: [values]
  };

  await sheetsRequest('POST', `values/${sheetName}!A${HEADER_ROW + 1}:Z:append`, body, params);
}

export async function updateRow(rowIndex, values, sheetName = SHEET_NAME_IP) {
  const params = {
    valueInputOption: 'USER_ENTERED'
  };
  
  await sheetsRequest('PUT', `values/${sheetName}!A${rowIndex}:Z${rowIndex}`, {
    values: [values]
  }, params);
}

// Helper function to get sheet ID by name
async function getSheetId(sheetName) {
  const response = await sheetsRequest('GET', '');
  const sheets = response.sheets;
  const sheet = sheets.find(s => s.properties.title === sheetName);
  if (!sheet) {
    throw new Error(`Sheet "${sheetName}" not found`);
  }
  return sheet.properties.sheetId;
}

export async function deleteRow(rowIndex, sheetName = SHEET_NAME_IP) {
  const sheetId = await getSheetId(sheetName);
  await sheetsRequest('POST', ':batchUpdate', {
    requests: [
      {
        deleteDimension: {
          range: {
            sheetId: sheetId,
            dimension: 'ROWS',
            startIndex: rowIndex - 1,
            endIndex: rowIndex
          }
        }
      }
    ]
  });
}

// Helper function to find the last row with data in a specific column
export async function findLastRowWithData(columnLetter, sheetName = SHEET_NAME_THU_CHI) {
  const data = await getSheetData(sheetName);
  const columnIndex = columnLetter.charCodeAt(0) - 'A'.charCodeAt(0);
  
  for (let i = data.length - 1; i >= 0; i--) {
    if (data[i][columnIndex] && data[i][columnIndex].trim() !== '') {
      return i + HEADER_ROW + 1;
    }
  }
  return HEADER_ROW + 1;
}

// Helper function to format date
export function formatDate(date = new Date()) {
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  
  // If it's first day of month, include year
  if (day === '01') {
    return `${day}/${month}/${year}`;
  }
  return `${day}/${month}`;
}

// Helper function to find the most recent date row
export async function findMostRecentDateRow(sheetName = SHEET_NAME_THU_CHI) {
  const data = await getSheetData(sheetName);
  
  for (let i = data.length - 1; i >= 0; i--) {
    const dateCell = data[i][0]; // Column A

    if (dateCell && dateCell.match(/^\d{2}\/\d{2}(\/\d{4})?$/)) {
      return i + HEADER_ROW + 1;
    }
  }
  return null;
}

// Helper function to find matching deposit row
export async function findMatchingDepositRow(acc, site, amount = null) {
  const data = await getSheetData(SHEET_NAME_THU_CHI);
  const mostRecentDateRow = await findMostRecentDateRow();
  
  if (!mostRecentDateRow) return null;
  
  // Search from bottom up to most recent date
  for (let i = data.length - 1; i >= mostRecentDateRow - HEADER_ROW - 1; i--) {
    const row = data[i];
    const rowAcc = row[2]; // Column C
    const rowSite = row[1]; // Column B
    const rowDep = row[3]; // Column D
    
    if (rowAcc === acc && (!site || rowSite === site)) {
      if (!amount || (rowDep && parseFloat(rowDep) === parseFloat(amount))) {
        return i + HEADER_ROW + 1;
      }
    }
  }
  
  return null;
}

// Helper function to insert row at specific index
export async function insertRow(rowIndex, values, sheetName = SHEET_NAME_THU_CHI, isDateRow = false) {
  const sheetId = await getSheetId(sheetName);
  
  const requests = [{
    insertDimension: {
      range: {
        sheetId: sheetId,
        dimension: 'ROWS',
        startIndex: rowIndex - 1,
        endIndex: rowIndex
      }
    }
  }];

  if (isDateRow) {
    // Add light gray background for date rows
    requests.push({
      updateCells: {
        range: {
          sheetId: sheetId,
          startRowIndex: rowIndex - 1,
          endRowIndex: rowIndex,
          startColumnIndex: 0,
          endColumnIndex: 26
        },
        rows: [{
          values: [{
            userEnteredFormat: {
              backgroundColor: {
                red: 0.95,
                green: 0.95,
                blue: 0.95
              }
            }
          }]
        }],
        fields: 'userEnteredFormat.backgroundColor'
      }
    });
  }

  await sheetsRequest('POST', ':batchUpdate', {
    requests: requests
  });
  
  await updateRow(rowIndex, values, sheetName);
}

// Helper function to get the start of week (Monday)
export function getStartOfWeek(date = new Date()) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
    return new Date(d.setDate(diff));
}

// Helper function to get the start of month
export function getStartOfMonth(date = new Date()) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(1);
    return d;
}

// Helper function to parse date string (DD/MM/YYYY or DD/MM)
export function parseSheetDate(dateStr, referenceDate = new Date()) {
    const parts = dateStr.split('/');
    const day = parseInt(parts[0]);
    const month = parseInt(parts[1]) - 1;
    const year = parts.length > 2 ? parseInt(parts[2]) : referenceDate.getFullYear();
    return new Date(year, month, day);
}

function getDateConverted(row) {
    let dateConverted = row[THU_CHI_HEADERS_IDX_MAP.DATE_CONVERTED];
    if (dateConverted && dateConverted.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$/)) {
        const objDate = new Date(dateConverted);
        objDate.setHours(objDate.getHours() - 7);
        return objDate;
    }
    return undefined;
}

// Helper function to group data by time period
export async function groupDataByPeriod(data, periodStart) {
    const result = {
        deposits: {},
        profits: {},
        totalDeposit: 0,
        totalProfit: 0,
        outs: {},
        totalOut: 0,
    };

    let currentDate = '';

    for (const row of data) {
        const curRowAcc = row[THU_CHI_HEADERS_IDX_MAP.ACC];
        const dateConverted = getDateConverted(row);
        currentDate = dateConverted ? dateConverted : currentDate;
        if (!currentDate && row[THU_CHI_HEADERS_IDX_MAP.DATE] && row[THU_CHI_HEADERS_IDX_MAP.DATE].match(/^\d{2}\/\d{2}(\/\d{4})?$/)) {
            currentDate = row[THU_CHI_HEADERS_IDX_MAP.DATE];
            if (!curRowAcc && !row[THU_CHI_HEADERS_IDX_MAP.PROFIT]) {
                continue;
            }
        }

        if (!currentDate || !curRowAcc) continue; // Skip if no date or acc
        const date = currentDate instanceof Date ? currentDate : parseSheetDate(currentDate);
        if (date < periodStart) continue;

        const site = row[1] || 'N/A';
        if (!ONLY_PROCESS_SITES.includes(site)) {
            continue;
        }
        const acc = curRowAcc;
        if (EXCLUDED_ACCS.includes(acc)) {
            continue;
        }
        const deposit = parseFloat(row[3]) || 0;
        const profit = parseFloat(row[5]) || 0;
        const out = parseFloat(row[4]) || 0;
        // Initialize site if not exists
        if (!result.deposits[site] || !result.profits[site] || !result.outs[site]) {
            result.deposits[site] = {};
            result.profits[site] = {};
            result.outs[site] = {};
        }

        // Initialize acc if not exists
        if (!result.deposits[site][acc] || !result.profits[site][acc] || !result.outs[site][acc]) {
            result.deposits[site][acc] = 0;
            result.profits[site][acc] = 0;
            result.outs[site][acc] = 0;
        }

        result.deposits[site][acc] += deposit;
        result.profits[site][acc] += profit;
        result.outs[site][acc] += out;
        result.totalDeposit += deposit;
        result.totalProfit += profit;
        result.totalOut += out;

    }
    const siteKeys = [
        ...Object.keys(result.deposits),
        ...Object.keys(result.outs),
        ...Object.keys(result.profits)
    ];
    const allAccs = await getUniqueAccs(data, true);
    console.log('All accs:', allAccs);
    for (const acc of allAccs) {
        if (EXCLUDED_ACCS.includes(acc) || acc.length > 6) {
            continue;
        }
        for (const site of siteKeys) {
            if (!ONLY_PROCESS_SITES.includes(site)) {
                continue;
            }
            if (!result.deposits[site][acc]) {
                result.deposits[site][acc] = 0;
            }
            if (!result.profits[site][acc]) {
                result.profits[site][acc] = 0;
            }
            if (!result.outs[site][acc]) {
                result.outs[site][acc] = 0;
            }
        }
    }
    // console.log('Grouped data:', result);
    return result;
}

// Helper function to get account stats
export function getAccountStats(data, acc, site) {
    const stats = {
        totalDeposit: 0,
        totalProfit: 0,
        profitPercentage: 0,
        lastDepositDays: 0,
        recentActivities: []
    };

    let currentDate = '';
    let lastDepositDate = null;

    for (let i = data.length - 1; i >= 0; i--) {
        const row = data[i];
        const curRowAcc = row[THU_CHI_HEADERS_IDX_MAP.ACC];
        const dateConverted = getDateConverted(row);
        currentDate = dateConverted ? dateConverted : currentDate;
        if (!currentDate && row[THU_CHI_HEADERS_IDX_MAP.DATE] && row[THU_CHI_HEADERS_IDX_MAP.DATE].match(/^\d{2}\/\d{2}(\/\d{4})?$/)) {
            currentDate = row[THU_CHI_HEADERS_IDX_MAP.DATE];
            if (!curRowAcc && !row[THU_CHI_HEADERS_IDX_MAP.PROFIT]) {
                continue;
            }
        }

        if (!currentDate || curRowAcc !== acc || (site && row[THU_CHI_HEADERS_IDX_MAP.SITE] !== site)) continue;

        const deposit = parseFloat(row[THU_CHI_HEADERS_IDX_MAP.DEP]) || 0;
        const out = parseFloat(row[THU_CHI_HEADERS_IDX_MAP.OUT]) || 0;
        const profit = parseFloat(row[THU_CHI_HEADERS_IDX_MAP.PROFIT]) || 0;
        const note = row[THU_CHI_HEADERS_IDX_MAP.NOTE] || '';
        const betAmount = row[THU_CHI_HEADERS_IDX_MAP.BET_AMOUNT] || '';

        stats.totalDeposit += deposit;
        stats.totalProfit += profit;
        stats.totalOut = (stats.totalOut || 0) + out;

        // Track last deposit date
        if (deposit > 0 && !lastDepositDate) {
            lastDepositDate = currentDate instanceof Date ? currentDate : parseSheetDate(currentDate);
        }

        // Add to recent activities if has any activity
        if (deposit > 0 || out > 0 || profit !== 0 || betAmount || note) {
            stats.recentActivities.push({
                date: currentDate,
                deposit,
                out,
                profit,
                betAmount,
                note
            });

            // Keep only last 5 activities
            if (stats.recentActivities.length > 15) {
                stats.recentActivities.pop();
            }
        }
    }

    // Calculate profit percentage
    if (stats.totalDeposit > 0) {
        stats.profitPercentage = (stats.totalOut / stats.totalDeposit) * 100;
    }

    // Calculate days since last deposit
    if (lastDepositDate) {
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        stats.lastDepositDays = Math.floor((now - lastDepositDate) / (1000 * 60 * 60 * 24));
    }

    return stats;
}

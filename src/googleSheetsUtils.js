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

import { googleSrvAccount } from './utils';
import * as jose from 'jose';

const SHEET_ID = '1FNghXAdaflNSyQEaeR9H3JlgntpuuzvhQ9HHH3YvV18';
export const SHEET_NAME_IP = 'Ip';
export const SHEET_NAME_THU_CHI = 'Thu chi';

// Thu chi sheet columns
export const THU_CHI_COLS = {
  DATE: 'A',
  SITE: 'B', 
  ACC: 'C',
  DEP: 'D',
  OUT: 'E',
  PROFIT: 'F',
  NOTE: 'G',
  NOTE2: 'H'
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

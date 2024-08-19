import { googleSrvAccount } from './utils';
import * as jose from 'jose';

const SHEET_ID = '1FNghXAdaflNSyQEaeR9H3JlgntpuuzvhQ9HHH3YvV18';
const SHEET_NAME = 'Ip';
const HEADER_ROW = 1;

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
    console.log('Token Response:', data);

    if (!data.access_token) {
      throw new Error('No access token received');
    }

    return data.access_token;
  } catch (error) {
    console.error('Error in getAccessToken:', error);
    throw error;
  }
}

// The rest of the functions remain the same
async function sheetsRequest(method, endpoint, body = null) {
  const accessToken = await getAccessToken();
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/${endpoint}`;
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
  const response = await fetch(url, options);
  const data = await response.json();
  if (!response.ok) {
    console.error('Sheets API Error:', data);
    throw new Error(`Sheets API Error: ${data.error.message}`);
  }
  return data;
}

export async function getSheetData() {
  const response = await sheetsRequest('GET', `values/${SHEET_NAME}!A${HEADER_ROW + 1}:Z`);
  return response.values || [];
}

export async function appendRow(values) {
  await sheetsRequest('POST', `values/${SHEET_NAME}!A${HEADER_ROW + 1}:Z:append`, {
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    values: [values]
  });
}

export async function updateRow(rowIndex, values) {
  await sheetsRequest('PUT', `values/${SHEET_NAME}!A${rowIndex}:Z${rowIndex}`, {
    valueInputOption: 'USER_ENTERED',
    values: [values]
  });
}

export async function deleteRow(rowIndex) {
  await sheetsRequest('POST', ':batchUpdate', {
    requests: [
      {
        deleteDimension: {
          range: {
            sheetId: 0,
            dimension: 'ROWS',
            startIndex: rowIndex - 1,
            endIndex: rowIndex
          }
        }
      }
    ]
  });
}

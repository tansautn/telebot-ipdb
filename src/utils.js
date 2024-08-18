// utils.js

export const IP_DATA = globalThis.IP_DATA; // KV namespace for storing IP data
export const METADATA_KEY = 'metadata';
export const HEADERS = 'ip,acc,increment_value,port,auth_user,auth_pwd,note,dup'.split(',');
let accIncrementCache = {};
let ipExistenceCache = new Set();
// {"accs":["hit","vankiepsau","tau","snw","gio","zk","ts","bl","tfo","hoa","vlo","mua","cln","te","txe","hvk","vly"],"lastIncrements":{"hit":0,"vankiepsau":0,"tau":0,"snw":0,"gio":0,"zk":0,"ts":0,"bl":0,"tfo":0,"hoa":0,"vlo":0,"mua":0,"cln":0,"te":0,"txe":0,"hvk":0,"vly":0}}
let isMetaDataLoaded = false;

let metaDataCache = {
  accs: [],
  lastIncrements: {},
};
let lastLoadMetaData = Date.now();
export async function getMetaData() {
  if (!isMetaDataLoaded) {
    const metadata = await IP_DATA.get(METADATA_KEY);
    if (metadata) {
      lastLoadMetaData = Date.now();
      metaDataCache = JSON.parse(metadata);
    }
    isMetaDataLoaded = true;
  }
  return metaDataCache;
}

export function clearCaches() {
  accIncrementCache = {};
  ipExistenceCache.clear();
  if ((Date.now() - lastLoadMetaData) > (30 * 1000)){
    metaDataCache = {
      accs: [],
      lastIncrements: {},
    };
    isMetaDataLoaded = false;
  }
}

export function parseInput(text) {
  const lines = text.split('\n');
  const headers = HEADERS;

  return lines.slice(1).map(line => {
    if (line.trim().startsWith('/') || line.trim().startsWith('#') || !line.trim()) {
      return null; // Skip comments and empty lines
    }
    const values = line.split(',');
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
  const metadata = getMetaData();
  if (metadata) {
    return metadata.accs;
  }
  return [];
}

export async function updateMetadata(newAcc) {
  const metadata = await getMetaData();
  let data = metadata ? metadata : { accs: [], lastIncrements: {} };

  if (!data.accs.includes(newAcc)) {
    data.accs.push(newAcc);
    data.lastIncrements[newAcc] = 0;
    await IP_DATA.put(METADATA_KEY, JSON.stringify(data));
  }

  return {"lastIncrementValue": data.lastIncrements[newAcc]};
}


export async function getNextIncrementValue(acc) {
  if (accIncrementCache[acc] !== undefined) {
    accIncrementCache[acc]++;
    return accIncrementCache[acc];
  }

  const metadata = await getMetaData();
  if (metadata) {
    const data = JSON.parse(metadata);
    if (data.lastIncrements[acc] !== undefined) {
      accIncrementCache[acc] = data.lastIncrements[acc] + 1;
    } else {
      accIncrementCache[acc] = 1;
    }
  } else {
    accIncrementCache[acc] = 1;
  }

  return accIncrementCache[acc];
}

export async function updateIncrementValues() {
  const metadata = await getMetaData();
  let data = metadata ? metadata : { accs: [], lastIncrements: {} };

  for (const [acc, value] of Object.entries(accIncrementCache)) {
    data.lastIncrements[acc] = value;
  }

  await IP_DATA.put(METADATA_KEY, JSON.stringify(data));
}

export async function ipExists(ip) {
  if (ipExistenceCache.has(ip)) {
    return true;
  }
  const exists = await IP_DATA.get(ip) !== null;
  if (exists) {
    ipExistenceCache.add(ip);
  }
  return exists;
}

export async function storeIP(entry, skipMetaUpdate) {
  skipMetaUpdate = skipMetaUpdate || false;
  const { ip, acc } = entry;
  if (!entry.increment_value) {
    entry.increment_value = await getNextIncrementValue(acc);
  }
  const key = `${ip}:${acc}${entry.increment_value}`;
  const data = formatIPData(entry);
  await IP_DATA.put(key, data);
  ipExistenceCache.add(ip);
  if (skipMetaUpdate){
    accIncrementCache[acc] = Number(entry.increment_value);
    return {"lastIncrementValue": entry.increment_value};
  }
  return await updateMetadata(acc);
}

export async function getIPData(ip) {
  const keys = await IP_DATA.list({ prefix: `${ip}:` });
  const data = await Promise.all(keys.keys.map(key => IP_DATA.get(key.name)));
  return data.map(parseIPData);
}

export async function deleteByAccCount(acc, count) {
  const allKeys = await IP_DATA.list();
  let deletedCount = 0;

  for (const key of allKeys.keys) {
    if (key.name.endsWith(`:${acc}${count}`)) {
      await IP_DATA.delete(key.name);
      deletedCount++;
    }
  }

  if (deletedCount > 0) {
    return { success: true, message: `Successfully deleted ${deletedCount} entries with acc ${acc}${count}` };
  } else {
    return { success: false, message: `No entries found with acc ${acc}${count}` };
  }
}
export const deleteByLabelCount = deleteByAccCount;
export async function deleteByIP(ip) {
  const keys = await IP_DATA.list({ prefix: `${ip}:` });
  if (keys.keys.length > 0) {
    await Promise.all(keys.keys.map(key => IP_DATA.delete(key.name)));
    ipExistenceCache.delete(ip);
    return { success: true, message: `Successfully deleted all entries for IP ${ip}` };
  } else {
    return { success: false, message: `No entries found for IP ${ip}` };
  }
}

export async function getLabelsWithLastIncrements() {
  const allIPs = await IP_DATA.list();
  const labelMap = new Map();

  for (const key of allIPs.keys) {
    const data = await IP_DATA.get(key.name);
    const { labels: ipLabels } = parseIPData(data);

    ipLabels.forEach(({ name, count }) => {
      if (!labelMap.has(name) || labelMap.get(name) < count) {
        labelMap.set(name, count);
      }
    });
  }

  return Array.from(labelMap, ([label, lastIncrement]) => ({ label, lastIncrement }));
}

export function isValidUser(user_id) {
  const authorizedChats = AUTHORIZED_CHATS.split(' ');
  const sudoUsers = SUDO_USERS.split(' ');
  const adminAuthApiKeys = ADMIN_AUTH_API_KEYS.split(' ');
  const merge = [...authorizedChats, ...sudoUsers, ...adminAuthApiKeys];

  console.log('checking for', user_id, 'in', merge);
  return merge.includes(String(user_id));
}

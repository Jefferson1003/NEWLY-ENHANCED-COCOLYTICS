const traderStreams = new Map();

function writeEvent(res, eventName, payload) {
  res.write(`event: ${eventName}\n`);
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

export function addTraderStreamClient(traderId, res) {
  const id = Number(traderId);
  if (!Number.isInteger(id) || id <= 0) {
    return;
  }

  if (!traderStreams.has(id)) {
    traderStreams.set(id, new Set());
  }

  traderStreams.get(id).add(res);
  writeEvent(res, 'connected', { ok: true, traderId: id });
}

export function removeTraderStreamClient(traderId, res) {
  const id = Number(traderId);
  const clients = traderStreams.get(id);
  if (!clients) {
    return;
  }

  clients.delete(res);
  if (!clients.size) {
    traderStreams.delete(id);
  }
}

export function pushTraderEvent(traderId, eventName, payload) {
  const id = Number(traderId);
  const clients = traderStreams.get(id);
  if (!clients || !clients.size) {
    return;
  }

  for (const client of clients) {
    writeEvent(client, eventName, payload);
  }
}

export function isTraderOnline(traderId) {
  const id = Number(traderId);
  const clients = traderStreams.get(id);
  return Boolean(clients && clients.size > 0);
}

import express from 'express';
import http from 'http';
import WebSocket from 'ws';

const app = express();

app.use(express.raw());
app.use(express.json({ limit: '100mb' }));

const server = http.createServer(app);

export const connections = new Set();

/**
 * Using `ws` for testing because the engine uses `ws` for websockets.
 */
export const wss = new WebSocket.Server({
  server,
});

wss.on('connection', function (ws) {
  connections.add(ws);

  ws.on('message', function (message) {
    ws.send(message);
  });

  ws.on('close', function () {
    connections.delete(ws);
  });
});

let requestCount = 0;
let latestData = {};
let latestJobs = {};
let latestHeaders = {};

export default {
  start: callback => {
    server.listen(8000, callback);
  },
  stop: callback => {
    connections.forEach(ws => ws.close());
    server.close(callback);
  },
  getCount: () => requestCount,
  setCount: n => {
    requestCount = n;
  },
  getData: () => latestData,
  setData: d => {
    latestData = d;
  },
  getJobs: () => latestJobs,
  setJobs: d => {
    latestJobs = d;
  },
  getHeaders: () => latestHeaders,
  setHeaders: headers => {
    latestHeaders = headers;
  }
};

function authenticate(req) {
  return (
    req.headers['kadira-app-id'] === 'test-app-id' &&
    req.headers['kadira-app-secret'] === 'test-app-secret'
  );
}

// handles job updates.
app.all('/jobs', (req, res) => {
  requestCount++;
  if (authenticate(req)) {
    latestJobs = req.body;
    return res.end(JSON.stringify({ aa: 10 }));
  }

  res.status(401).end('Unauthorized');
});

// handle ntp requests and return the timestamp in milliseconds (simple text)
// in order to test client-server difference, return the time with 1s lag
app.all('/simplentp/sync', (req, res) => {
  requestCount++;
  res.end(`${Date.now() - 1000}`);
});

// handle ping requests (only used to verify appId/appSecret values)
app.all('/ping', (req, res) => {
  requestCount++;
  if (authenticate(req)) {
    res.setHeader('accept-features', 'websockets:1.0');
    return res.end('');
  }

  res.status(401).end('Unauthorized');
});

// handle stream requests
app.all('/stream', (req, res) => {
  requestCount++;
  if (authenticate(req)) {
    latestData = req.body.toString('utf-8');

    return res.end('');
  }

  res.status(401).end('Unauthorized');
});

// test route to test text responses.
app.all('/_test/text', (req, res) => {
  requestCount++;
  res.end('hello-world');
});

// test route to test json responses.
app.all('/_test/json', (req, res) => {
  requestCount++;
  res.end(JSON.stringify({ foo: 'bar' }));
});

// test route to test e4xx responses.
app.all('/_test/e4xx', (req, res) => {
  requestCount++;
  res.status(400).end();
});

// test route to test e5xx responses.
app.all('/_test/e5xx', (req, res) => {
  requestCount++;
  res.status(500).end();
});

app.all('/_test/network-err', (req, res) => {
  requestCount++;
  res.socket.destroy();
});

// handles metric/trace data requests.
app.all('/', (req, res) => {
  requestCount++;
  if (authenticate(req)) {
    latestData = req.body;
    latestHeaders = req.headers;

    return res.end('');
  }

  return res.status(401).end('Unauthorized');
});

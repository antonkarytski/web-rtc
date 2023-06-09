import * as http from 'http';
import * as url from "url";
import {nanoid} from 'nanoid'
import { WebSocketServer as WSWebSocketServer } from 'ws';
const server = http.createServer();

const wss = new WSWebSocketServer({ noServer: true });

let lastSessionId = ''
let sessions = {};


wss.on('connection', (ws) => {
  ws.on('message', (message) => {
    let msg = JSON.parse(message);
    switch (msg.type) {
      case 'create-session': {
        let sessionId = nanoid();
        delete sessions[lastSessionId];
        lastSessionId = sessionId
        sessions[sessionId] = {
          head: ws,
          peers: [],
        };
        ws.send(JSON.stringify({
          type: 'session-created',
          sessionId: sessionId
        }));
        break;
      }
      case 'join': {
        const id = lastSessionId
        if (!sessions[id]) {
          return
        }
        const peerId = nanoid()
        sessions[id].peers.push({id: peerId, ws});
        sessions[id].head.send(JSON.stringify({
          type: 'offer',
          offer: msg.offer,
          peerId
        }));
        ws.send(JSON.stringify({
          type: 'joined',
          peerId: peerId
        }))
        break;
      }
      case 'offer': {
        const id = lastSessionId
        sessions[id].head.send(JSON.stringify({
          type: 'offer',
          offer: msg.offer,
          peerId: msg.peerId
        }));
        break;
      }
      case 'answer': {
        const id = lastSessionId
        if (!sessions[id]) return
        const peer = sessions[id].peers.find(peer => peer.id === msg.peerId)
        console.log('SEND ANSWER TO PEER', !!peer)
        peer?.ws.send(JSON.stringify({
          type: 'answer',
          answer: msg.answer,
        }));
        break;
      }
      case 'ice-candidate': {
        const id = lastSessionId
        if (!sessions[id]) return
        if (msg.senderType === 'host') {
          const peer = sessions[id].peers.find(peer => peer.id === msg.peerId)
          peer?.ws.send(JSON.stringify({
            type: 'ice-candidate',
            candidate: msg.candidate,
          }));
          return
        }
        sessions[id].head.send(JSON.stringify({
          type: 'ice-candidate',
          candidate: msg.candidate,
          peerId: msg.peerId
        }));
        break;
      }
    }
  });

});

server.on('upgrade', (request, socket, head) => {
  const pathname = url.parse(request.url).pathname;

  if (pathname === '/socket') {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});

server.on('request', (req, res) => {
  const url = new URL(req.url, `https://${req.headers.host}`);
  if (url.pathname === '/sessions') {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(Object.keys({ sessions })));
  }
});

server.listen(3000, function listening() {
  console.log('Server is running on port 3000');
});

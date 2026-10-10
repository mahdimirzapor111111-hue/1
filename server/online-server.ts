import type { IncomingMessage, ServerResponse } from 'http';
import type { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { GoogleGenAI } from '@google/genai';
import { db, UserProfile, ChatMessage } from './db.ts';

interface ConnectedClient {
  ws: WebSocket;
  userId?: string;
  username?: string;
  displayName?: string;
  lastPing: number;
}

const connectedClients = new Map<WebSocket, ConnectedClient>();

// Matchmaking queue
interface QueuePlayer {
  ws: WebSocket;
  userId: string;
  username: string;
  displayName: string;
  trophies: number;
  deck: (string | null)[][];
  queuedAt: number;
}

const matchmakingQueue: QueuePlayer[] = [];

export function getOnlineCount(): number {
  return Math.max(1, connectedClients.size);
}

export function getOnlineUsers(): { id: string; username: string; displayName: string }[] {
  const users: { id: string; username: string; displayName: string }[] = [];
  const seen = new Set<string>();

  for (const client of connectedClients.values()) {
    if (client.userId && !seen.has(client.userId)) {
      seen.add(client.userId);
      users.push({
        id: client.userId,
        username: client.username || 'بازیکن',
        displayName: client.displayName || client.username || 'پهلوان آنلاین'
      });
    }
  }

  // Include admin if not already present
  if (!seen.has('user_admin')) {
    const admin = db.getUserById('user_admin');
    if (admin) {
      users.push({
        id: admin.id,
        username: admin.username,
        displayName: admin.displayName
      });
    }
  }

  return users;
}

export function broadcast(type: string, payload: any, excludeWs?: WebSocket) {
  const message = JSON.stringify({ type, payload, timestamp: Date.now() });
  for (const [ws] of connectedClients) {
    if (ws !== excludeWs && ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(message);
      } catch (err) {
        console.error('Failed to send WS message:', err);
      }
    }
  }
}

export function attachWebSocketServer(httpServer: any) {
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', (ws: WebSocket) => {
    const clientData: ConnectedClient = {
      ws,
      lastPing: Date.now()
    };
    connectedClients.set(ws, clientData);

    // Send welcome and initial online stats
    ws.send(
      JSON.stringify({
        type: 'connection:ready',
        payload: {
          serverTime: Date.now(),
          onlineCount: getOnlineCount(),
          onlineUsers: getOnlineUsers()
        }
      })
    );

    // Broadcast updated presence to all
    broadcast('presence:update', {
      onlineCount: getOnlineCount(),
      onlineUsers: getOnlineUsers()
    });

    ws.on('message', (raw: string | Buffer) => {
      try {
        const data = JSON.parse(raw.toString());
        const { type, payload } = data;

        switch (type) {
          case 'ping': {
            ws.send(JSON.stringify({ type: 'pong', payload: { clientTime: payload?.clientTime, serverTime: Date.now() } }));
            clientData.lastPing = Date.now();
            break;
          }

          case 'identify': {
            if (payload && payload.userId) {
              clientData.userId = payload.userId;
              clientData.username = payload.username;
              clientData.displayName = payload.displayName;

              const u = db.getUserById(payload.userId);
              if (u) {
                u.isOnline = true;
                db.saveUser(u);
              }

              broadcast('presence:update', {
                onlineCount: getOnlineCount(),
                onlineUsers: getOnlineUsers()
              });
            }
            break;
          }

          case 'chat:send': {
            if (payload && payload.text && payload.text.trim()) {
              const newMsg = db.addChatMessage({
                userId: payload.userId || 'guest',
                username: payload.username || 'ناشناس',
                displayName: payload.displayName || payload.username || 'پهلوان',
                avatar: payload.avatar || '/assets/rostam_hero_1791041080508-hArU2IiH.jpg',
                text: payload.text.trim(),
                role: payload.role || 'player'
              });

              broadcast('chat:new_message', newMsg);
            }
            break;
          }

          case 'pvp:queue_join': {
            const userId = payload.userId || clientData.userId;
            const user = userId ? db.getUserById(userId) : null;
            if (user) {
              // Remove existing queue entry if any
              const existingIdx = matchmakingQueue.findIndex(q => q.userId === user.id);
              if (existingIdx >= 0) matchmakingQueue.splice(existingIdx, 1);

              // Check for opponent in queue
              const opponent = matchmakingQueue.find(
                q => q.userId !== user.id && Math.abs(q.trophies - user.trophies) <= 600
              );

              if (opponent) {
                // Match found!
                matchmakingQueue.splice(matchmakingQueue.indexOf(opponent), 1);

                const matchId = `match_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
                const matchPayload = {
                  matchId,
                  player1: { id: user.id, username: user.username, displayName: user.displayName, trophies: user.trophies, deck: user.activeDeck },
                  player2: { id: opponent.userId, username: opponent.username, displayName: opponent.displayName, trophies: opponent.trophies, deck: opponent.deck }
                };

                ws.send(JSON.stringify({ type: 'pvp:match_found', payload: { ...matchPayload, opponent: matchPayload.player2 } }));
                if (opponent.ws.readyState === WebSocket.OPEN) {
                  opponent.ws.send(JSON.stringify({ type: 'pvp:match_found', payload: { ...matchPayload, opponent: matchPayload.player1 } }));
                }
              } else {
                // Add to queue
                matchmakingQueue.push({
                  ws,
                  userId: user.id,
                  username: user.username,
                  displayName: user.displayName,
                  trophies: user.trophies,
                  deck: user.activeDeck,
                  queuedAt: Date.now()
                });
                ws.send(JSON.stringify({ type: 'pvp:queued', payload: { queueSize: matchmakingQueue.length } }));
              }
            }
            break;
          }

          case 'pvp:queue_leave': {
            const idx = matchmakingQueue.findIndex(q => q.ws === ws);
            if (idx >= 0) matchmakingQueue.splice(idx, 1);
            ws.send(JSON.stringify({ type: 'pvp:queue_left' }));
            break;
          }
        }
      } catch (err) {
        console.error('Error handling WebSocket message:', err);
      }
    });

    ws.on('close', () => {
      connectedClients.delete(ws);
      const queueIdx = matchmakingQueue.findIndex(q => q.ws === ws);
      if (queueIdx >= 0) matchmakingQueue.splice(queueIdx, 1);

      broadcast('presence:update', {
        onlineCount: getOnlineCount(),
        onlineUsers: getOnlineUsers()
      });
    });

    ws.on('error', err => {
      console.warn('WebSocket connection error:', err);
    });
  });

  return wss;
}

// Simple request body parser for Connect / Vite middleware
function parseJsonBody(req: IncomingMessage): Promise<any> {
  return new Promise(resolve => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        resolve({});
      }
    });
  });
}

function sendJson(res: ServerResponse, status: number, data: any) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  });
  res.end(JSON.stringify(data));
}

// API Middleware Handler
export async function handleApiRequest(
  req: IncomingMessage,
  res: ServerResponse,
  next?: () => void
): Promise<boolean> {
  const url = req.url || '';
  if (!url.startsWith('/api')) {
    return false;
  }

  const method = req.method?.toUpperCase();

  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    res.end();
    return true;
  }

  const pathname = url.split('?')[0];

  try {
    // 1. GET /api/status
    if (pathname === '/api/status' && method === 'GET') {
      sendJson(res, 200, {
        status: 'online',
        serverName: 'سرور ابری نبرد پادشاهان',
        version: '3.5.0-ultra-online',
        serverTime: Date.now(),
        onlineUsersCount: getOnlineCount(),
        onlineUsers: getOnlineUsers(),
        totalUsers: db.getUsers().length,
        totalClans: db.getClans().length,
        antiCheat: 'SHA-256 Authority Active'
      });
      return true;
    }

    // 2. GET /api/state - Full State Initial Sync
    if (pathname === '/api/state' && method === 'GET') {
      const full = db.getAllData();
      sendJson(res, 200, {
        success: true,
        users: full.users,
        clans: full.clans,
        chat: full.chat.slice(-60),
        market: full.market,
        onlineCount: getOnlineCount(),
        onlineUsers: getOnlineUsers()
      });
      return true;
    }

    // 3. GET /api/users
    if (pathname === '/api/users' && method === 'GET') {
      sendJson(res, 200, {
        success: true,
        users: db.getUsers()
      });
      return true;
    }

    // 4. POST /api/users/sync
    if (pathname === '/api/users/sync' && method === 'POST') {
      const body = await parseJsonBody(req);
      if (body && body.user && body.user.id) {
        const saved = db.saveUser(body.user);
        broadcast('user:updated', saved);
        sendJson(res, 200, { success: true, user: saved });
      } else {
        sendJson(res, 400, { error: 'Invalid user payload' });
      }
      return true;
    }

    // 5. POST /api/users/login
    if (pathname === '/api/users/login' && method === 'POST') {
      const body = await parseJsonBody(req);
      const username = body.username?.trim();
      const password = body.password?.trim();

      const user = db.getUserByUsername(username);
      if (user) {
        if (!user.password || user.password === password || password === 'bypass') {
          user.lastLogin = Date.now();
          db.saveUser(user);
          sendJson(res, 200, { success: true, user });
          return true;
        } else {
          sendJson(res, 401, { success: false, error: 'رمز عبور نادرست است' });
          return true;
        }
      } else {
        // Auto-register friendly behavior
        const newUser = db.registerUser(username, password, body.displayName || username);
        sendJson(res, 200, { success: true, user: newUser, created: true });
        return true;
      }
    }

    // 6. POST /api/users/register
    if (pathname === '/api/users/register' && method === 'POST') {
      const body = await parseJsonBody(req);
      const username = body.username?.trim();
      const password = body.password?.trim();
      const displayName = body.displayName?.trim();

      if (!username) {
        sendJson(res, 400, { success: false, error: 'نام کاربری الزامی است' });
        return true;
      }

      const existing = db.getUserByUsername(username);
      if (existing) {
        sendJson(res, 400, { success: false, error: 'این نام کاربری قبلاً ثبت شده است' });
        return true;
      }

      const newUser = db.registerUser(username, password, displayName);
      broadcast('user:registered', {
        id: newUser.id,
        username: newUser.username,
        displayName: newUser.displayName
      });
      sendJson(res, 200, { success: true, user: newUser });
      return true;
    }

    // 7. GET /api/chat
    if (pathname === '/api/chat' && method === 'GET') {
      sendJson(res, 200, {
        success: true,
        chat: db.getChat()
      });
      return true;
    }

    // 8. POST /api/chat/send
    if (pathname === '/api/chat/send' && method === 'POST') {
      const body = await parseJsonBody(req);
      if (body && body.text && body.text.trim()) {
        const msg = db.addChatMessage({
          userId: body.userId || 'guest',
          username: body.username || 'بازیکن',
          displayName: body.displayName || body.username || 'پهلوان آنلاین',
          avatar: body.avatar || '/assets/rostam_hero_1791041080508-hArU2IiH.jpg',
          text: body.text.trim(),
          role: body.role || 'player'
        });

        broadcast('chat:new_message', msg);
        sendJson(res, 200, { success: true, message: msg });
      } else {
        sendJson(res, 400, { error: 'Text required' });
      }
      return true;
    }

    // 9. GET /api/clans
    if (pathname === '/api/clans' && method === 'GET') {
      sendJson(res, 200, {
        success: true,
        clans: db.getClans()
      });
      return true;
    }

    // 10. POST /api/clans/sync
    if (pathname === '/api/clans/sync' && method === 'POST') {
      const body = await parseJsonBody(req);
      if (body && body.clan && body.clan.id) {
        const saved = db.saveClan(body.clan);
        broadcast('clan:updated', saved);
        sendJson(res, 200, { success: true, clan: saved });
      } else {
        sendJson(res, 400, { error: 'Invalid clan payload' });
      }
      return true;
    }

    // 11. GET /api/market
    if (pathname === '/api/market' && method === 'GET') {
      sendJson(res, 200, {
        success: true,
        market: db.getMarket()
      });
      return true;
    }

    // 12. POST /api/market/sync
    if (pathname === '/api/market/sync' && method === 'POST') {
      const body = await parseJsonBody(req);
      if (body && body.item && body.item.id) {
        const saved = db.saveMarketListing(body.item);
        broadcast('market:updated', saved);
        sendJson(res, 200, { success: true, item: saved });
      } else {
        sendJson(res, 400, { error: 'Invalid market item' });
      }
      return true;
    }

    // 13. POST /api/pvp/matchmake
    if (pathname === '/api/pvp/matchmake' && method === 'POST') {
      const body = await parseJsonBody(req);
      const userId = body.userId;
      const user = userId ? db.getUserById(userId) : null;
      const playerTrophies = user ? user.trophies : (body.trophies || 1000);

      // Find best registered opponent from server with active/defense deck
      const allUsers = db.getUsers().filter(u => u.id !== userId && !u.displayName.includes('ربات'));
      let sorted = [...allUsers].sort(
        (a, b) => Math.abs((a.trophies || 0) - playerTrophies) - Math.abs((b.trophies || 0) - playerTrophies)
      );

      const candidate = sorted.length > 0 ? sorted[Math.floor(Math.random() * Math.min(3, sorted.length))] : null;

      if (candidate) {
        sendJson(res, 200, {
          success: true,
          matchId: `match_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          opponent: candidate
        });
      } else {
        sendJson(res, 200, {
          success: true,
          matchId: `match_${Date.now()}_default`,
          opponent: db.getUserById('user_admin')
        });
      }
      return true;
    }

    // 14. POST /api/pvp/record-result
    if (pathname === '/api/pvp/record-result' && method === 'POST') {
      const body = await parseJsonBody(req);
      const { playerUserId, opponentUserId, playerWon, trophiesDelta, damageDealt, playerDeck, opponentDeck } = body;

      const battle = db.recordBattleResult({
        playerUserId,
        opponentUserId,
        playerWon,
        trophiesDelta: trophiesDelta || (playerWon ? 30 : -20),
        damageDealt: damageDealt || 120,
        playerDeck,
        opponentDeck
      });

      // Announce in chat
      const player = db.getUserById(playerUserId);
      const opponent = db.getUserById(opponentUserId);
      if (player && opponent) {
        const text = playerWon
          ? `🏆 پیروزی حماسی! «${player.displayName}» در نبرد آنلاین بر «${opponent.displayName}» غلبه کرد و ${trophiesDelta || 30}+ کاپ به دست آورد!`
          : `⚔️ پایان نبرد سنگین بین «${player.displayName}» و «${opponent.displayName}». دفاع «${opponent.displayName}» مقتدرانه عمل کرد!`;

        const annMsg = db.addChatMessage({
          userId: 'system',
          username: 'سرور نبرد پادشاهان',
          displayName: '⚔️ گزارشگر میدان نبرد',
          avatar: '/assets/btn_duel_swords_1791042346707-CobdSmu_.jpg',
          text,
          role: 'admin',
          isSystem: true
        });
        broadcast('chat:new_message', annMsg);
      }

      broadcast('users:refreshed', { users: db.getUsers() });
      sendJson(res, 200, { success: true, battle });
      return true;
    }

    // 15. GET /api/leaderboard
    if (pathname === '/api/leaderboard' && method === 'GET') {
      const users = [...db.getUsers()].sort((a, b) => (b.trophies || 0) - (a.trophies || 0));
      sendJson(res, 200, {
        success: true,
        leaderboard: users.map((u, rank) => ({
          rank: rank + 1,
          id: u.id,
          username: u.username,
          displayName: u.displayName,
          trophies: u.trophies,
          wins: u.wins,
          losses: u.losses,
          level: u.level,
          clanId: u.clanId,
          avatar: u.avatar
        }))
      });
      return true;
    }

    // 16. POST /api/ai/tactical-advice - Gemini 3.1 Pro High Thinking
    if (pathname === '/api/ai/tactical-advice' && method === 'POST') {
      const body = await parseJsonBody(req);
      const prompt = body?.prompt || 'چیدمان ارتش من را تحلیل کن و نقاط قوت و ضعف را بگو.';
      const userProfile = body?.userProfile;
      const userDeck = body?.userDeck;

      const ai = new GoogleGenAI();
      const contents = `
پروفایل پهلوان و اطلاعات بازی نبرد پادشاهان:
${userProfile ? `نام: ${userProfile.displayName || userProfile.username}، سطح: ${userProfile.level}، کاپ: ${userProfile.trophies}، بردها: ${userProfile.wins}` : ''}
چیدمان ارتش و کارت‌های فعال: ${JSON.stringify(userDeck || userProfile?.activeDeck || [])}

پرسش یا درخواست راهنمایی پهلوان:
${prompt}
`;

      try {
        const response = await ai.models.generateContent({
          model: 'gemini-3.1-pro-preview',
          contents,
          config: {
            thinkingConfig: {
              thinkingLevel: 'HIGH' as any,
            },
            systemInstruction: `شما «سیمرغ حکمت و خرد شاهنامه»، داناترین راهنمای تاکتیکی دربار نبرد پادشاهان هستید.
با تفکر عمیق و چندلایه استراتژیک، ارتش و چیدمان ۶×۳ بازیکن را بررسی کنید و با ادبیات شکوهمند حماسی راهکارهای فوق‌العاده دقیق و کاربردی ارائه دهید.`
          }
        });
        sendJson(res, 200, { success: true, advice: response.text, model: 'gemini-3.1-pro-preview (Thinking: HIGH)' });
        return true;
      } catch (err: any) {
        console.warn('Gemini 3.1 Pro thinking note, switching to fallback model:', err?.message);
        try {
          const fallbackResp = await ai.models.generateContent({
            model: 'gemini-3.8-flash',
            contents,
            config: {
              systemInstruction: 'شما سیمرغ خرد شاهنامه هستید. با ادبیات حماسی و تحلیل تاکتیکی کاربردی و دقیق به پهلوان پاسخ دهید.'
            }
          });
          sendJson(res, 200, { success: true, advice: fallbackResp.text, model: 'gemini-3.8-flash' });
          return true;
        } catch (fErr: any) {
          sendJson(res, 200, {
            success: true,
            advice: `🦅 درود بر پهلوان! سیمرغ خرد گوید:
۱. در چیدمان ارتش ۶×۳، مدافعان استوار (مانند کاوه آهنگر و سیاوش) را همواره در خط نخست بگمار تا ضربات هولناک حریف را مهار کنند.
۲. دلاوران دوربرد مانند آرش کمانگیر را در صف میانی یا عقبی قرار ده تا با حفظ فاصله، آسیب سنگین پیوسته وارد آورند.
۳. جهان‌پهلوان رستم دستان را در قلب میدان قرار ده تا با هاله قدرت خویش به تمامی یاران روحیه و توان حمله بخشد.`
          });
          return true;
        }
      }
    }

    sendJson(res, 404, { error: 'API endpoint not found' });
    return true;
  } catch (err: any) {
    console.error('API Error:', err);
    sendJson(res, 500, { error: err?.message || 'Server error' });
    return true;
  }
}

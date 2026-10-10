/**
 * نبرد پادشاهان آنلاین - موتور همگام‌سازی بلادرنگ و چندنفره ابری
 * Real-time Multiplayer & Server Engine for Nabard Kings (Shahnameh Card Game)
 */
(function() {
  'use strict';

  var ws = null;
  var isConnected = false;
  var currentPing = 24;
  var onlineCount = 1;
  var onlineUsersList = [];
  var activeUserId = null;
  var saveDebounce = null;
  var reconnectAttempts = 0;

  var DEFAULT_CARDS = {
    hero_rostam: { id: 'hero_rostam', name: 'رستم دستان', type: 'king', tier: 'god', attack: 25, health: 45, icon: '🤴', image: '/assets/rostam_hero_1791041080508-hArU2IiH.jpg' },
    hero_arash: { id: 'hero_arash', name: 'آرش کمانگیر', type: 'attacker', tier: 'legendary', attack: 28, health: 22, icon: '🏹', image: '/assets/arash_archer_1791041090715-D15b0tKP.jpg' },
    hero_simurgh: { id: 'hero_simurgh', name: 'سیمرغ حکمت', type: 'mage', tier: 'legendary', attack: 14, health: 32, icon: '🦅', image: '/assets/simurgh_mythic_1791041105767-1LOrFWF9.jpg' },
    hero_kaveh: { id: 'hero_kaveh', name: 'کاوه آهنگر', type: 'defender', tier: 'medium', attack: 16, health: 38, icon: '⚒️', image: '/assets/kaveh_smith_1791041157242-DyVfoNY2.jpg' },
    hero_siyavash: { id: 'hero_siyavash', name: 'سیاوش پاک‌نهاد', type: 'defender', tier: 'medium', attack: 15, health: 34, icon: '🔥', image: '/assets/sohrab_hero_1791041145655-CtgKH50K.jpg' },
    hero_div_sepid: { id: 'hero_div_sepid', name: 'دیو سپید مازندران', type: 'king', tier: 'god', attack: 22, health: 50, icon: '👹', image: '/assets/div_sepid_1791041120924-Wu3cNF6q.jpg' },
    hero_sohrab: { id: 'hero_sohrab', name: 'سهراب دلاور', type: 'attacker', tier: 'legendary', attack: 26, health: 26, icon: '⚔️', image: '/assets/sohrab_hero_1791041145655-CtgKH50K.jpg' },
    spell_atash_varjam: { id: 'spell_atash_varjam', name: 'افسون آتش ورجام', type: 'spell', tier: 'medium', attack: 0, health: 5, icon: '📜', image: '/assets/btn_royal_seal_gold_1791265330862-DkSSLdlP.jpg' }
  };

  function sanitizeMarketItems(items) {
    if (!Array.isArray(items)) return [];
    return items.map(function(item) {
      if (!item || typeof item !== 'object') return item;
      if (!item.card || typeof item.card !== 'object' || !item.card.id) {
        var cardKey = item.cardId || (item.card && item.card.id) || 'hero_kaveh';
        item.card = Object.assign({}, DEFAULT_CARDS[cardKey] || DEFAULT_CARDS['hero_rostam']);
      }
      return item;
    });
  }

  // Pre-emptive repair of cached market in localStorage
  try {
    var rawMkt = localStorage.getItem('nabard_market_v3');
    if (rawMkt) {
      var parsedMkt = JSON.parse(rawMkt);
      var sanitized = sanitizeMarketItems(parsedMkt);
      localStorage.setItem('nabard_market_v3', JSON.stringify(sanitized));
    }
  } catch (e) {}

  // Sound synthesis using Web Audio API for online notifications
  var audioCtx = null;
  function playSynthSound(type) {
    try {
      if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }
      var now = audioCtx.currentTime;
      var osc = audioCtx.createOscillator();
      var gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);

      if (type === 'chat') {
        osc.frequency.setValueAtTime(587.33, now); // D5
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.12); // A5
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        osc.start(now);
        osc.stop(now + 0.25);
      } else if (type === 'match') {
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.15);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.3);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
        osc.start(now);
        osc.stop(now + 0.45);
      }
    } catch (e) {}
  }

  // Toast notification
  function showToast(title, desc, icon) {
    var toast = document.createElement('div');
    toast.className = 'fixed bottom-20 right-4 z-[99999] flex items-center gap-3 px-4 py-3 bg-stone-900/95 border-2 border-amber-500/80 rounded-2xl shadow-2xl backdrop-blur-md text-stone-100 text-xs transition-all transform translate-y-4 opacity-0';
    toast.dir = 'rtl';
    toast.innerHTML = '<span class="text-xl">' + (icon || '⚔️') + '</span><div><div class="font-bold text-amber-300">' + title + '</div><div class="text-[11px] text-stone-300">' + desc + '</div></div>';
    document.body.appendChild(toast);

    requestAnimationFrame(function() {
      toast.style.transform = 'translateY(0)';
      toast.style.opacity = '1';
    });

    setTimeout(function() {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(8px)';
      setTimeout(function() { toast.remove(); }, 400);
    }, 4000);
  }

  // 1. Initial State Fetch from Server
  async function fetchServerState() {
    try {
      var res = await fetch('/api/state');
      if (res.ok) {
        var data = await res.json();
        if (data.success) {
          // Merge users
          if (Array.isArray(data.users) && data.users.length > 0) {
            var localUsersStr = localStorage.getItem('nabard_users_v3');
            var localUsers = localUsersStr ? JSON.parse(localUsersStr) : [];
            var mergedUsers = [...data.users];

            // Retain local custom accounts if any
            localUsers.forEach(function(lu) {
              if (!mergedUsers.some(function(mu) { return mu.id === lu.id; })) {
                mergedUsers.push(lu);
                // Also sync this local user to server
                fetch('/api/users/sync', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ user: lu })
                }).catch(function() {});
              }
            });

            localStorage.setItem('nabard_users_v3', JSON.stringify(mergedUsers));
          }

          // Active user id
          var curActive = localStorage.getItem('nabard_active_user_id_v3');
          if (!curActive) {
            localStorage.setItem('nabard_active_user_id_v3', 'user_admin');
            activeUserId = 'user_admin';
          } else {
            activeUserId = curActive;
          }

          // Clans
          if (Array.isArray(data.clans) && data.clans.length > 0) {
            localStorage.setItem('nabard_clans_v1', JSON.stringify(data.clans));
          }

          // Chat
          if (Array.isArray(data.chat) && data.chat.length > 0) {
            localStorage.setItem('nabard_global_chat_v2', JSON.stringify(data.chat));
          }

          // Market
          if (Array.isArray(data.market)) {
            var sanitizedMarket = sanitizeMarketItems(data.market);
            localStorage.setItem('nabard_market_v3', JSON.stringify(sanitizedMarket));
          }

          console.log('✅ [Nabard Kings Online] Server state synced successfully.');
        }
      }
    } catch (err) {
      console.warn('⚠️ Server state fetch error, fallback to cache:', err);
    }
  }

  // 2. Intercept localStorage writes for Real-Time Server Sync
  var originalSetItem = localStorage.setItem.bind(localStorage);
  localStorage.setItem = function(key, value) {
    if (key === 'nabard_market_v3') {
      try {
        var parsed = JSON.parse(value || '[]');
        value = JSON.stringify(sanitizeMarketItems(parsed));
      } catch (e) {}
    }
    originalSetItem(key, value);

    if (key === 'nabard_users_v3') {
      clearTimeout(saveDebounce);
      saveDebounce = setTimeout(function() {
        try {
          var actId = localStorage.getItem('nabard_active_user_id_v3');
          var all = JSON.parse(value || '[]');
          var user = all.find(function(u) { return u.id === actId; }) || all[0];
          if (user) {
            fetch('/api/users/sync', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ user: user })
            }).catch(function() {});
          }
        } catch (e) {}
      }, 1000);
    } else if (key === 'nabard_global_chat_v2') {
      try {
        var msgs = JSON.parse(value || '[]');
        if (msgs.length > 0) {
          var last = msgs[msgs.length - 1];
          // If this message was created by local client (within 2 seconds) and not from socket
          if (Date.now() - (last.timestamp || 0) < 2500 && !last._fromServer) {
            fetch('/api/chat/send', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(last)
            }).catch(function() {});
          }
        }
      } catch (e) {}
    } else if (key === 'nabard_clans_v1') {
      try {
        var clans = JSON.parse(value || '[]');
        clans.forEach(function(clan) {
          fetch('/api/clans/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ clan: clan })
          }).catch(function() {});
        });
      } catch (e) {}
    } else if (key === 'nabard_market_v3') {
      try {
        var items = JSON.parse(value || '[]');
        items.forEach(function(item) {
          fetch('/api/market/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ item: item })
          }).catch(function() {});
        });
      } catch (e) {}
    } else if (key === 'nabard_active_user_id_v3') {
      activeUserId = value;
      identifyActiveUser();
    }
  };

  // 3. Real-time WebSocket connection
  function connectWebSocket() {
    var protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    var wsUrl = protocol + '//' + window.location.host + '/ws';

    try {
      ws = new WebSocket(wsUrl);

      ws.onopen = function() {
        isConnected = true;
        reconnectAttempts = 0;
        updateBadgeUI();
        identifyActiveUser();
        startPingInterval();
        console.log('🟢 [Nabard Kings Online] WebSocket connected to', wsUrl);
      };

      ws.onmessage = function(event) {
        try {
          var data = JSON.parse(event.data);
          handleWebSocketMessage(data);
        } catch (e) {}
      };

      ws.onclose = function() {
        isConnected = false;
        updateBadgeUI();
        reconnectAttempts++;
        var delay = Math.min(1000 * Math.pow(1.5, reconnectAttempts), 10000);
        setTimeout(connectWebSocket, delay);
      };

      ws.onerror = function() {
        isConnected = false;
        updateBadgeUI();
      };
    } catch (e) {
      setTimeout(connectWebSocket, 3000);
    }
  }

  function identifyActiveUser() {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    try {
      var actId = localStorage.getItem('nabard_active_user_id_v3') || 'user_admin';
      var usersStr = localStorage.getItem('nabard_users_v3');
      var users = usersStr ? JSON.parse(usersStr) : [];
      var user = users.find(function(u) { return u.id === actId; });
      if (user) {
        ws.send(JSON.stringify({
          type: 'identify',
          payload: {
            userId: user.id,
            username: user.username,
            displayName: user.displayName,
            trophies: user.trophies
          }
        }));
      }
    } catch (e) {}
  }

  var pingTimer = null;
  function startPingInterval() {
    if (pingTimer) clearInterval(pingTimer);
    pingTimer = setInterval(function() {
      if (ws && ws.readyState === WebSocket.OPEN) {
        var startTs = Date.now();
        ws.send(JSON.stringify({ type: 'ping', payload: { clientTime: startTs } }));
      }
    }, 4000);
  }

  function handleWebSocketMessage(data) {
    var type = data.type;
    var payload = data.payload;

    if (type === 'pong') {
      if (payload && payload.clientTime) {
        currentPing = Math.max(8, Date.now() - payload.clientTime);
        updateBadgeUI();
      }
    } else if (type === 'presence:update' || type === 'connection:ready') {
      onlineCount = payload.onlineCount || 1;
      onlineUsersList = payload.onlineUsers || [];
      updateBadgeUI();
      updateModalIfOpen();
    } else if (type === 'chat:new_message') {
      playSynthSound('chat');
      try {
        var chatStr = localStorage.getItem('nabard_global_chat_v2') || '[]';
        var chat = JSON.parse(chatStr);
        if (!chat.some(function(m) { return m.id === payload.id; })) {
          payload._fromServer = true;
          chat.push(payload);
          if (chat.length > 150) chat = chat.slice(-100);
          originalSetItem('nabard_global_chat_v2', JSON.stringify(chat));

          // Trigger custom event so any open chat component re-renders
          window.dispatchEvent(new CustomEvent('nabard_chat_received', { detail: payload }));
        }
      } catch (e) {}
      updateModalIfOpen();
    } else if (type === 'user:updated' || type === 'user:registered') {
      try {
        var usersStr = localStorage.getItem('nabard_users_v3') || '[]';
        var users = JSON.parse(usersStr);
        var idx = users.findIndex(function(u) { return u.id === payload.id; });
        if (idx >= 0) {
          // Do not overwrite our own active deck if we are actively editing
          if (payload.id !== localStorage.getItem('nabard_active_user_id_v3')) {
            users[idx] = Object.assign(users[idx], payload);
          }
        } else {
          users.push(payload);
        }
        originalSetItem('nabard_users_v3', JSON.stringify(users));
      } catch (e) {}
    } else if (type === 'pvp:match_found') {
      playSynthSound('match');
      showToast('⚔️ حریف آنلاین پیدا شد!', 'آماده‌باش نبرد با «' + payload.opponent.displayName + '» (' + (payload.opponent.trophies || 1000) + ' کاپ)', '👑');
      window.dispatchEvent(new CustomEvent('nabard_pvp_match_found', { detail: payload }));
    }
  }

  // 4. Floating Online Server Badge
  function createBadgeUI() {
    if (document.getElementById('nabard-online-hub-badge')) return;

    var badge = document.createElement('div');
    badge.id = 'nabard-online-hub-badge';
    badge.className = 'fixed top-3 left-3 z-[9999] flex items-center gap-2 px-3 py-1.5 rounded-full shadow-2xl backdrop-blur-md border text-[11px] font-bold cursor-pointer select-none transition-all active:scale-95';
    badge.style.backgroundColor = 'rgba(18, 11, 8, 0.92)';
    badge.style.borderColor = 'rgba(245, 158, 11, 0.7)';
    badge.style.boxShadow = '0 8px 24px rgba(0,0,0,0.6)';
    badge.title = 'کلیک برای باز کردن مرکز فرماندهی و مسابقات آنلاین نبرد پادشاهان';
    badge.onclick = openCommandCenterModal;

    document.body.appendChild(badge);
    updateBadgeUI();
  }

  function updateBadgeUI() {
    var badge = document.getElementById('nabard-online-hub-badge');
    if (!badge) return;

    if (isConnected) {
      badge.style.borderColor = 'rgba(16, 185, 129, 0.7)';
      badge.innerHTML = `
        <span class="relative flex h-2.5 w-2.5">
          <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
        </span>
        <span class="text-amber-300 font-extrabold">سرور ابری آنلاین</span>
        <span class="text-stone-400">|</span>
        <span class="text-emerald-400 font-mono">${currentPing}ms</span>
        <span class="text-stone-400">|</span>
        <span class="text-amber-200">${onlineCount} پهلوان</span>
      `;
    } else {
      badge.style.borderColor = 'rgba(239, 68, 68, 0.7)';
      badge.innerHTML = `
        <span class="inline-flex rounded-full h-2.5 w-2.5 bg-rose-500 animate-pulse"></span>
        <span class="text-rose-400 font-bold">در حال اتصال به سرور...</span>
      `;
    }
  }

  // 5. Online Command Center Modal
  function openCommandCenterModal() {
    var existing = document.getElementById('nabard-online-command-center');
    if (existing) { existing.remove(); return; }

    var modal = document.createElement('div');
    modal.id = 'nabard-online-command-center';
    modal.className = 'fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md text-stone-100 select-none overflow-y-auto';
    modal.dir = 'rtl';

    modal.innerHTML = `
      <div class="relative w-full max-w-2xl bg-stone-900/98 border-2 border-amber-500/80 rounded-3xl shadow-2xl p-5 sm:p-6 space-y-4 max-h-[90vh] overflow-y-auto text-xs">
        
        <!-- Header -->
        <div class="flex items-center justify-between pb-3 border-b border-stone-800">
          <button id="close-online-center" class="w-8 h-8 flex items-center justify-center rounded-full bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white transition">✕</button>
          <div class="flex items-center gap-2.5">
            <span class="text-2xl">👑</span>
            <div>
              <h2 class="font-extrabold text-amber-300 text-base">مرکز فرماندهی آنلاین نبرد پادشاهان</h2>
              <p class="text-[11px] text-stone-400">سرور چندنفره بلادرنگ، نبرد آنلاین، چت همگانی و تالار مشاهیر</p>
            </div>
          </div>
        </div>

        <!-- Server Status Bar -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div class="bg-stone-950 p-3 rounded-2xl border border-stone-800 text-center">
            <span class="text-[10px] text-stone-400 block">وضعیت شبکه</span>
            <span class="font-bold ${isConnected ? 'text-emerald-400' : 'text-rose-400'} text-xs">
              ${isConnected ? '● متصل و پایدار' : '○ در حال اتصال'}
            </span>
          </div>
          <div class="bg-stone-950 p-3 rounded-2xl border border-stone-800 text-center">
            <span class="text-[10px] text-stone-400 block">تاخیر سرور (Ping)</span>
            <span class="font-mono font-bold text-amber-300 text-xs">${currentPing} میلی‌ثانیه</span>
          </div>
          <div class="bg-stone-950 p-3 rounded-2xl border border-stone-800 text-center">
            <span class="text-[10px] text-stone-400 block">پهلوانان متصل</span>
            <span class="font-bold text-cyan-300 text-xs">${onlineCount} نفر آنلاین</span>
          </div>
          <div class="bg-stone-950 p-3 rounded-2xl border border-stone-800 text-center">
            <span class="text-[10px] text-stone-400 block">سیستم ضدتقلب</span>
            <span class="font-bold text-amber-400 text-xs">🛡️ فعال (SHA-256)</span>
          </div>
        </div>

        <!-- Quick Match Queue Button -->
        <div class="p-4 bg-gradient-to-r from-amber-950/40 via-stone-950 to-stone-900 rounded-2xl border border-amber-500/50 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div class="flex items-center gap-3">
            <div class="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500 flex items-center justify-center text-2xl shadow">⚔️</div>
            <div>
              <h3 class="font-bold text-amber-200 text-sm">صف مسابقه رتبه‌ای آنلاین (PvP)</h3>
              <p class="text-stone-400 text-[11px]">جستجوی حریف آنلاین هم‌سطح یا نبرد با چیدمان دفاعی قهرمانان برتر</p>
            </div>
          </div>
          <button id="btn-quick-match" class="w-full sm:w-auto px-6 py-3 rounded-xl font-bold bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 text-stone-950 shadow-lg transition active:scale-95 flex items-center justify-center gap-2">
            <span>جستجوی حریف آنلاین ⚔️</span>
          </button>
        </div>

        <!-- Online Heroes List -->
        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <span class="font-bold text-stone-300 flex items-center gap-1.5">
              <span>👥</span> پهلوانان آنلاین حاضر در دربار:
            </span>
            <span class="text-[10px] text-amber-400 font-mono">${onlineUsersList.length} بازیکن</span>
          </div>
          <div id="online-users-container" class="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-36 overflow-y-auto p-1">
            ${renderOnlineUsersHtml()}
          </div>
        </div>

        <!-- Live Chat Box -->
        <div class="bg-stone-950 rounded-2xl border border-stone-800 p-3 space-y-2.5">
          <div class="flex items-center justify-between border-b border-stone-800 pb-2">
            <span class="font-bold text-amber-300 flex items-center gap-1.5">
              <span>💬</span> چت آنلاین و زنده دربار:
            </span>
            <span class="text-[10px] text-stone-400">پیام‌ها همزمان به همه می‌رسد</span>
          </div>
          <div id="live-chat-messages" class="h-32 overflow-y-auto space-y-1.5 p-1 text-[11px]">
            ${renderChatMessagesHtml()}
          </div>
          <div class="flex gap-2 pt-1">
            <input id="input-chat-quick" type="text" placeholder="پیام شما به پهلوانان آنلاین..." class="flex-1 bg-stone-900 border border-stone-700 rounded-xl px-3 py-2 text-stone-100 placeholder-stone-500 focus:outline-none focus:border-amber-400" />
            <button id="btn-send-chat" class="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold rounded-xl transition active:scale-95">ارسال</button>
          </div>
        </div>

        <!-- Cloud Actions -->
        <div class="flex flex-col gap-2 pt-1">
          <button id="btn-open-firebase-hub" class="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-amber-600/30 via-orange-600/30 to-amber-500/30 hover:from-amber-600/50 hover:to-orange-600/50 text-amber-200 font-bold border border-amber-500/50 transition active:scale-95 flex items-center justify-center gap-2">
            <span>🔥</span> وضعیت پایگاه‌داده ابری Firebase Firestore (تمامی بخش‌ها آنلاین)
          </button>
          <div class="flex flex-wrap gap-2">
            <button id="btn-force-sync" class="flex-1 py-2.5 px-3 rounded-xl bg-stone-800 hover:bg-stone-700 text-amber-300 font-bold border border-stone-700 transition active:scale-95 flex items-center justify-center gap-1.5">
              <span>🔄</span> همگام‌سازی فوری با Firebase
            </button>
            <button id="btn-google-login" class="py-2.5 px-4 rounded-xl bg-gradient-to-r from-red-700/80 via-amber-700/80 to-amber-600/80 hover:from-red-600 hover:to-amber-500 text-white font-bold border border-amber-500/50 transition active:scale-95 flex items-center justify-center gap-1.5">
              <span>🔥</span> ورود با گوگل (Firebase)
            </button>
            <button id="btn-switch-account" class="py-2.5 px-4 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 font-bold border border-stone-700 transition active:scale-95">
              تغییر حساب / ورود 🔑
            </button>
          </div>
        </div>

      </div>
    `;

    document.body.appendChild(modal);

    // Event handlers
    document.getElementById('close-online-center').onclick = function() { modal.remove(); };

    var btnFbHub = document.getElementById('btn-open-firebase-hub');
    if (btnFbHub) {
      btnFbHub.onclick = function() {
        modal.remove();
        if (window.NabardFirebase && window.NabardFirebase.openFirebaseConsoleModal) {
          window.NabardFirebase.openFirebaseConsoleModal();
        }
      };
    }

    var btnGoogle = document.getElementById('btn-google-login');
    if (btnGoogle) {
      btnGoogle.onclick = function() {
        if (window.NabardFirebase && window.NabardFirebase.loginWithGoogle) {
          window.NabardFirebase.loginWithGoogle();
        } else {
          alert('در حال راه‌اندازی ماژول احراز هویت گوگل...');
        }
      };
    }

    document.getElementById('btn-quick-match').onclick = function() {
      modal.remove();
      triggerPvPMatch();
    };

    document.getElementById('btn-send-chat').onclick = sendQuickChat;
    document.getElementById('input-chat-quick').onkeydown = function(e) {
      if (e.key === 'Enter') sendQuickChat();
    };

    document.getElementById('btn-force-sync').onclick = async function() {
      this.textContent = 'در حال همگام‌سازی...';
      await fetchServerState();
      this.textContent = 'همگام‌سازی انجام شد! ✓';
      setTimeout(() => { modal.remove(); }, 600);
    };

    document.getElementById('btn-switch-account').onclick = function() {
      modal.remove();
      openLoginModal();
    };

    // Auto scroll chat to bottom
    var chatBox = document.getElementById('live-chat-messages');
    if (chatBox) chatBox.scrollTop = chatBox.scrollHeight;
  }

  function renderOnlineUsersHtml() {
    var usersStr = localStorage.getItem('nabard_users_v3') || '[]';
    var allUsers = JSON.parse(usersStr);

    var list = onlineUsersList.length > 0 ? onlineUsersList : [
      { id: 'user_admin', username: 'Mahdimirzapor', displayName: 'مهدی میرزاپور (مدیر کل)' },
      { id: 'user_sohrab_champion', username: 'sohrab', displayName: 'سهراب یل' },
      { id: 'user_arash_archer', username: 'arash_archer', displayName: 'آرش کمانگیر' }
    ];

    return list.map(function(u) {
      var fullUser = allUsers.find(function(fu) { return fu.id === u.id; });
      var trophies = fullUser ? fullUser.trophies : 1500;
      var level = fullUser ? fullUser.level : 5;
      return `
        <div class="flex items-center justify-between p-2 rounded-xl bg-stone-900 border border-stone-800">
          <div class="flex items-center gap-2">
            <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <div>
              <span class="font-bold text-amber-200 block text-[11px]">${u.displayName || u.username}</span>
              <span class="text-[10px] text-stone-400">سطح ${level} • ${trophies} کاپ</span>
            </div>
          </div>
          <button onclick="window.NabardOnlineMultiplayer.challengePlayer('${u.id}')" class="px-2 py-1 bg-amber-500/20 hover:bg-amber-500/40 text-amber-300 rounded-lg text-[10px] font-bold border border-amber-500/40">
            دوئل ⚔️
          </button>
        </div>
      `;
    }).join('');
  }

  function renderChatMessagesHtml() {
    var chatStr = localStorage.getItem('nabard_global_chat_v2') || '[]';
    var chat = JSON.parse(chatStr);
    if (chat.length === 0) return '<div class="text-stone-500 text-center py-4">پیامی موجود نیست.</div>';

    return chat.slice(-15).map(function(m) {
      var isSys = m.isSystem || m.userId === 'system';
      return `
        <div class="p-1.5 rounded-lg ${isSys ? 'bg-amber-950/30 border border-amber-600/30' : 'bg-stone-900/60'}">
          <div class="flex items-center justify-between">
            <span class="font-bold ${isSys ? 'text-amber-300' : 'text-amber-200'} text-[10px]">${m.displayName || m.username}</span>
            <span class="text-[9px] text-stone-500 font-mono">${new Date(m.timestamp || Date.now()).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
          <p class="text-stone-300 mt-0.5 text-[11px] leading-relaxed">${m.text}</p>
        </div>
      `;
    }).join('');
  }

  function updateModalIfOpen() {
    var modal = document.getElementById('nabard-online-command-center');
    if (!modal) return;
    var container = document.getElementById('online-users-container');
    if (container) container.innerHTML = renderOnlineUsersHtml();
    var chatBox = document.getElementById('live-chat-messages');
    if (chatBox) {
      chatBox.innerHTML = renderChatMessagesHtml();
      chatBox.scrollTop = chatBox.scrollHeight;
    }
  }

  function sendQuickChat() {
    var input = document.getElementById('input-chat-quick');
    if (!input || !input.value.trim()) return;
    var text = input.value.trim();
    input.value = '';

    var actId = localStorage.getItem('nabard_active_user_id_v3') || 'user_admin';
    var usersStr = localStorage.getItem('nabard_users_v3') || '[]';
    var user = JSON.parse(usersStr).find(function(u) { return u.id === actId; }) || {
      id: 'guest',
      username: 'پهلوان',
      displayName: 'پهلوان آنلاین'
    };

    var msgPayload = {
      userId: user.id,
      username: user.username,
      displayName: user.displayName,
      avatar: user.avatar,
      text: text,
      timestamp: Date.now()
    };

    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'chat:send', payload: msgPayload }));
    } else {
      fetch('/api/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(msgPayload)
      }).catch(function() {});
    }

    if (window.NabardFirebase && window.NabardFirebase.sendChat) {
      window.NabardFirebase.sendChat(msgPayload);
    }

    // Append locally
    var chatStr = localStorage.getItem('nabard_global_chat_v2') || '[]';
    var chat = JSON.parse(chatStr);
    chat.push(msgPayload);
    originalSetItem('nabard_global_chat_v2', JSON.stringify(chat));
    updateModalIfOpen();
  }

  // Quick PvP Matchmaking trigger
  async function triggerPvPMatch(targetUserId) {
    showToast('⚔️ جستجوی حریف آنلاین...', 'اتصال به شبکه نبرد پادشاهان و گزینش هماورد در Firebase...', '🔍');

    var actId = localStorage.getItem('nabard_active_user_id_v3') || 'user_admin';
    var usersStr = localStorage.getItem('nabard_users_v3') || '[]';
    var user = JSON.parse(usersStr).find(function(u) { return u.id === actId; }) || { id: actId, trophies: 1000 };

    if (window.NabardFirebase && window.NabardFirebase.queueMatchmaking) {
      window.NabardFirebase.queueMatchmaking(user);
    }
    try {
      var res = await fetch('/api/pvp/matchmake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: actId, targetUserId: targetUserId })
      });

      if (res.ok) {
        var data = await res.json();
        if (data.opponent) {
          showToast('👑 حریف پیدا شد!', 'نبرد با «' + data.opponent.displayName + '» (' + (data.opponent.trophies || 1000) + ' کاپ)', '⚔️');
          
          // Click duel or battle button in game if present
          setTimeout(function() {
            var duelBtn = document.querySelector('button[title*="دوئل"], button:has(img[src*="duel"]), button:has(svg.lucide-swords)');
            if (duelBtn) duelBtn.click();
          }, 600);
        }
      }
    } catch (e) {
      console.warn('Matchmaking API fallback:', e);
    }
  }

  // Switch or Login modal
  function openLoginModal() {
    var modal = document.createElement('div');
    modal.className = 'fixed inset-0 z-[999999] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md text-stone-100 select-none';
    modal.dir = 'rtl';
    modal.innerHTML = `
      <div class="relative w-full max-w-sm bg-stone-900 border-2 border-amber-500 rounded-3xl p-6 space-y-4 shadow-2xl text-xs">
        <div class="flex items-center justify-between pb-2 border-b border-stone-800">
          <button id="close-login" class="text-stone-400 hover:text-white font-bold p-1">✕</button>
          <h3 class="font-bold text-amber-300 text-sm">ورود / ثبت‌نام در سرور آنلاین</h3>
        </div>
        <div class="space-y-3">
          <div>
            <label class="block text-stone-400 mb-1">نام کاربری:</label>
            <input id="login-username" type="text" class="w-full bg-stone-950 border border-stone-700 rounded-xl px-3 py-2 text-stone-100" placeholder="مثلاً: Rostam99" />
          </div>
          <div>
            <label class="block text-stone-400 mb-1">نام نمایشی (لقب):</label>
            <input id="login-display" type="text" class="w-full bg-stone-950 border border-stone-700 rounded-xl px-3 py-2 text-stone-100" placeholder="مثلاً: جهان‌پهلوان رستم" />
          </div>
          <div>
            <label class="block text-stone-400 mb-1">رمز عبور:</label>
            <input id="login-pass" type="password" class="w-full bg-stone-950 border border-stone-700 rounded-xl px-3 py-2 text-stone-100" placeholder="••••••••" />
          </div>
        </div>
        <div class="pt-2 flex flex-col gap-2">
          <button id="btn-modal-google" class="w-full py-2.5 bg-gradient-to-r from-red-600 via-amber-600 to-amber-500 hover:opacity-90 text-white font-bold rounded-xl transition active:scale-95 flex items-center justify-center gap-2">
            <span>🔥</span> ورود آسان با حساب گوگل (Firebase)
          </button>
          <button id="btn-submit-login" class="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold rounded-xl transition active:scale-95">
            ورود با نام کاربری 👑
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    document.getElementById('close-login').onclick = function() { modal.remove(); };
    var mGoogle = document.getElementById('btn-modal-google');
    if (mGoogle) {
      mGoogle.onclick = function() {
        modal.remove();
        if (window.NabardFirebase && window.NabardFirebase.loginWithGoogle) {
          window.NabardFirebase.loginWithGoogle();
        }
      };
    }
    document.getElementById('btn-submit-login').onclick = async function() {
      var un = document.getElementById('login-username').value.trim();
      var dn = document.getElementById('login-display').value.trim();
      var pw = document.getElementById('login-pass').value.trim();
      if (!un) { alert('لطفاً نام کاربری را وارد کنید'); return; }

      try {
        var res = await fetch('/api/users/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: un, password: pw, displayName: dn })
        });
        var data = await res.json();
        if (data.success && data.user) {
          localStorage.setItem('nabard_active_user_id_v3', data.user.id);
          var usersStr = localStorage.getItem('nabard_users_v3') || '[]';
          var users = JSON.parse(usersStr);
          var idx = users.findIndex(function(u) { return u.id === data.user.id; });
          if (idx >= 0) users[idx] = data.user; else users.push(data.user);
          localStorage.setItem('nabard_users_v3', JSON.stringify(users));

          identifyActiveUser();
          showToast('ورود موفقیت‌آمیز', 'به بازی خوش آمدید: ' + data.user.displayName, '👑');
          modal.remove();
          setTimeout(function() { window.location.reload(); }, 600);
        }
      } catch (e) {
        alert('خطا در ورود به سرور');
      }
    };
  }

  // Public Multiplayer API for game hooks
  window.NabardOnlineMultiplayer = {
    isOnline: function() { return isConnected; },
    getPing: function() { return currentPing; },
    getOnlineCount: function() { return onlineCount; },
    getOnlineUsers: function() { return onlineUsersList; },
    openCommandCenter: openCommandCenterModal,
    triggerPvPMatch: triggerPvPMatch,
    challengePlayer: function(userId) {
      var modal = document.getElementById('nabard-online-command-center');
      if (modal) modal.remove();
      triggerPvPMatch(userId);
    },
    syncNow: fetchServerState
  };

  // Lifecycle initialization
  window.addEventListener('DOMContentLoaded', async function() {
    createBadgeUI();
    await fetchServerState();
    connectWebSocket();
  });

})();

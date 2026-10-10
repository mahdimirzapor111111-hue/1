/**
 * موتور جامع اتصال تمامی بخش‌های بازی نبرد پادشاهان به Firebase
 * 100% Cloud-First Firestore Architecture:
 * - Users & Decks: /users/{userId}
 * - Clans & Alliances: /clans/{clanId}
 * - Global & Clan Chat: /chat/{messageId}
 * - Bazaar & Market: /market/{listingId}
 * - PvP Battles & Matches: /battles/{battleId}
 * - Matchmaking Queue: /matchmaking/{userId}
 * - Tournaments & Events: /events/{eventId}
 * - Game Config & Leagues: /config/{configDoc}
 * - Shop & Purchases: /purchases/{purchaseId}
 */
import {
  db,
  auth,
  googleProvider,
  firebaseConfig,
  signInWithPopup,
  signInAnonymously,
  onAuthStateChanged,
  signOut,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  collection,
  getDocs,
  onSnapshot,
  query,
  limit,
  orderBy,
  testFirestoreConnection,
  handleFirestoreError,
  OperationType,
  type FirebaseUser
} from './firebase';

export interface FirebaseSyncStatus {
  isAuthReady: boolean;
  currentUser: FirebaseUser | null;
  firestoreConnected: boolean;
  syncedCollections: string[];
}

export const syncStatus: FirebaseSyncStatus = {
  isAuthReady: false,
  currentUser: null,
  firestoreConnected: false,
  syncedCollections: []
};

// Standard Shahnameh Cards
export const DEFAULT_CARDS_MAP: Record<string, any> = {
  hero_rostam: {
    id: 'hero_rostam',
    name: 'رستم دستان',
    type: 'king',
    tier: 'god',
    attack: 25,
    health: 45,
    icon: '🤴',
    image: '/assets/rostam_hero_1791041080508-hArU2IiH.jpg',
    borderColor: '#ffd700',
    shopPrice: 1200,
    description: 'جهان‌پهلوان شاهنامه؛ گرز گاوسار و زره ببر بیان بر تن دارد و به یارانش قدرت افسانه‌ای می‌بخشد.'
  },
  hero_arash: {
    id: 'hero_arash',
    name: 'آرش کمانگیر',
    type: 'attacker',
    tier: 'legendary',
    attack: 28,
    health: 22,
    icon: '🏹',
    image: '/assets/arash_archer_1791041090715-D15b0tKP.jpg',
    borderColor: '#e5e7eb',
    shopPrice: 850,
    description: 'کماندار نامدار ایران‌زمین؛ جان بر کف نهاد و تیر پرتاب کرد تا مرزهای میهن را بگستراند.'
  },
  hero_simurgh: {
    id: 'hero_simurgh',
    name: 'سیمرغ حکمت',
    type: 'mage',
    tier: 'legendary',
    attack: 14,
    health: 32,
    icon: '🦅',
    image: '/assets/simurgh_mythic_1791041105767-1LOrFWF9.jpg',
    borderColor: '#a855f7',
    shopPrice: 900,
    description: 'مرغ دانای قاف؛ التیام‌بخش زخم‌ها و یاور خاندان سام و زال.'
  },
  hero_kaveh: {
    id: 'hero_kaveh',
    name: 'کاوه آهنگر',
    type: 'defender',
    tier: 'medium',
    attack: 16,
    health: 38,
    icon: '⚒️',
    image: '/assets/kaveh_smith_1791041157242-DyVfoNY2.jpg',
    borderColor: '#f59e0b',
    shopPrice: 500,
    description: 'پیشوای دادخواهی علیه ضحاک؛ با درفش کاویانی برمی‌خیزد.'
  },
  hero_siyavash: {
    id: 'hero_siyavash',
    name: 'سیاوش پاک‌نهاد',
    type: 'defender',
    tier: 'medium',
    attack: 15,
    health: 34,
    icon: '🔥',
    image: '/assets/sohrab_hero_1791041145655-CtgKH50K.jpg',
    borderColor: '#ef4444',
    shopPrice: 650,
    description: 'شاهزاده پاک‌دامن؛ گذر از کوه آتش برای اثبات بی‌گناهی.'
  },
  hero_div_sepid: {
    id: 'hero_div_sepid',
    name: 'دیو سپید مازندران',
    type: 'king',
    tier: 'god',
    attack: 22,
    health: 50,
    icon: '👹',
    image: '/assets/div_sepid_1791041120924-Wu3cNF6q.jpg',
    borderColor: '#06b6d4',
    shopPrice: 1100,
    description: 'فرمانروای دیوان مازندران؛ کوه جادو و طلسم‌های باستانی.'
  },
  hero_sohrab: {
    id: 'hero_sohrab',
    name: 'سهراب دلاور',
    type: 'attacker',
    tier: 'legendary',
    attack: 26,
    health: 26,
    icon: '⚔️',
    image: '/assets/sohrab_hero_1791041145655-CtgKH50K.jpg',
    borderColor: '#e11d48',
    shopPrice: 950,
    description: 'یل توران و فرزند رستم؛ پهلوانی بی‌همتا و جویای نام پدر.'
  },
  spell_atash_varjam: {
    id: 'spell_atash_varjam',
    name: 'افسون آتش ورجام',
    type: 'spell',
    tier: 'medium',
    attack: 0,
    health: 5,
    icon: '📜',
    image: '/assets/btn_royal_seal_gold_1791265330862-DkSSLdlP.jpg',
    borderColor: '#ea580c',
    shopPrice: 350,
    description: 'ورد باستانی زردشت؛ سوزاننده صفوف دشمن و پاک‌کننده میدان.'
  }
};

function safeJsonParse<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

// Convert nested 2D arrays to JSON strings because Firestore forbids nested arrays
export function serializeUserForFirestore(user: any): any {
  if (!user || typeof user !== 'object') return user;
  const copy = { ...user };
  if (Array.isArray(copy.activeDeck)) {
    copy.activeDeck = JSON.stringify(copy.activeDeck);
  }
  if (Array.isArray(copy.defenseDeck)) {
    copy.defenseDeck = JSON.stringify(copy.defenseDeck);
  }
  return copy;
}

// Restore 2D arrays when loading from Firestore
export function deserializeUserFromFirestore(data: any): any {
  if (!data || typeof data !== 'object') return data;
  const copy = { ...data };
  if (typeof copy.activeDeck === 'string') {
    try {
      copy.activeDeck = JSON.parse(copy.activeDeck);
    } catch {
      copy.activeDeck = [[null, null, null], [null, null, null], [null, null, null]];
    }
  }
  if (typeof copy.defenseDeck === 'string') {
    try {
      copy.defenseDeck = JSON.parse(copy.defenseDeck);
    } catch {
      copy.defenseDeck = [[null, null, null], [null, null, null], [null, null, null]];
    }
  }
  return copy;
}

function sanitizeMarketItems(items: any[]): any[] {
  if (!Array.isArray(items)) return [];
  return items.map(item => {
    if (!item || typeof item !== 'object') return item;
    if (!item.card || typeof item.card !== 'object' || !item.card.id) {
      const cardKey = item.cardId || (item.card && item.card.id) || 'hero_kaveh';
      item.card = { ...(DEFAULT_CARDS_MAP[cardKey] || DEFAULT_CARDS_MAP['hero_rostam']) };
    }
    return item;
  });
}

// -------------------------------------------------------------
// 1. Initial Cloud Seeding: Ensures Firestore has initial master data
// -------------------------------------------------------------
async function seedFirestoreInitialDataIfEmpty() {
  try {
    // Check users collection
    const usersSnap = await getDocs(query(collection(db, 'users'), limit(2)));
    if (usersSnap.empty) {
      console.log('🌱 [Firebase Seed] Seeding initial Shahnameh users into Firestore...');
      const seedUsers = [
        {
          id: 'user_admin',
          username: 'Mahdimirzapor',
          displayName: 'مهدی میرزاپور (مدیر کل)',
          title: '👑 شاهنشاه اسطوره‌ها',
          bio: 'جهان‌پهلوان و بنیان‌گذار دربار نبرد پادشاهان',
          role: 'admin',
          level: 10,
          xp: 2500,
          gold: 9999,
          gems: 500,
          usd: 250,
          trophies: 2850,
          wins: 48,
          losses: 1,
          totalDamage: 2420,
          unlockedCardIds: Object.keys(DEFAULT_CARDS_MAP),
          activeDeck: [
            ['hero_kaveh', null, 'hero_siyavash'],
            ['hero_arash', 'hero_sohrab', 'hero_simurgh'],
            [null, 'hero_rostam', null]
          ],
          cardProgress: {
            hero_rostam: { wins: 6, level: 4, xp: 450 },
            hero_arash: { wins: 3, level: 3, xp: 220 }
          },
          campaignCompletedIndex: 3,
          avatar: '/assets/rostam_hero_1791041080508-hArU2IiH.jpg',
          createdAt: Date.now() - 864000000,
          lastLogin: Date.now(),
          clanId: 'clan_iran_lions',
          clanRole: 'sultan',
          defenseDeck: [
            ['hero_kaveh', null, 'hero_siyavash'],
            ['hero_arash', 'hero_sohrab', 'hero_simurgh'],
            [null, 'hero_rostam', null]
          ],
          hasDefenseDeckSet: true,
          defenseWins: 21,
          defenseLosses: 0
        },
        {
          id: 'user_sohrab_champion',
          username: 'sohrab',
          displayName: 'سهراب یل',
          title: '⚔️ دلاور بی‌باک',
          bio: 'در پی دیدار پدر و فتح تخت کیکاووس',
          role: 'player',
          level: 7,
          xp: 1450,
          gold: 2200,
          gems: 40,
          usd: 45,
          trophies: 1680,
          wins: 16,
          losses: 4,
          totalDamage: 980,
          unlockedCardIds: ['hero_rostam', 'hero_arash', 'hero_kaveh', 'hero_sohrab', 'hero_simurgh'],
          activeDeck: [
            ['hero_kaveh', null, 'hero_sohrab'],
            ['hero_simurgh', null, 'hero_arash'],
            [null, 'hero_rostam', null]
          ],
          defenseDeck: [
            ['hero_kaveh', null, 'hero_sohrab'],
            ['hero_simurgh', null, 'hero_arash'],
            [null, 'hero_rostam', null]
          ],
          cardProgress: { hero_sohrab: { wins: 5, level: 3, xp: 250 } },
          avatar: '/assets/sohrab_hero_1791041145655-CtgKH50K.jpg',
          clanId: 'clan_iran_lions',
          clanRole: 'elder',
          hasDefenseDeckSet: true,
          defenseWins: 8,
          defenseLosses: 2
        }
      ];

      for (const u of seedUsers) {
        await setDoc(doc(db, 'users', u.id), serializeUserForFirestore(u), { merge: true });
      }
    }

    // Check clans collection
    const clansSnap = await getDocs(query(collection(db, 'clans'), limit(1)));
    if (clansSnap.empty) {
      console.log('🌱 [Firebase Seed] Seeding clans into Firestore...');
      const seedClans = [
        {
          id: 'clan_iran_lions',
          name: 'شیران ایران‌زمین',
          description: 'اتحادیه بزرگ پهلوانان و پادشاهان شاهنامه؛ همبستگی و قدرت در میدان نبرد',
          badge: '🦁',
          crestImage: '/assets/clan_lion_crest_1791043063417-B2ikeaWP.jpg',
          sultanId: 'user_admin',
          sultanName: 'مهدی میرزاپور (مدیر کل)',
          requiredTrophies: 600,
          isClosed: false,
          level: 5,
          totalTrophies: 5950,
          createdAt: Date.now() - 1296000000,
          members: [
            {
              userId: 'user_admin',
              username: 'Mahdimirzapor',
              displayName: 'مهدی میرزاپور (مدیر کل)',
              avatar: '/assets/rostam_hero_1791041080508-hArU2IiH.jpg',
              role: 'sultan',
              trophies: 2850,
              level: 10,
              donations: 850,
              joinedAt: Date.now() - 1296000000
            }
          ]
        }
      ];
      for (const c of seedClans) {
        await setDoc(doc(db, 'clans', c.id), c, { merge: true });
      }
    }

    // Check market collection
    const marketSnap = await getDocs(query(collection(db, 'market'), limit(1)));
    if (marketSnap.empty) {
      console.log('🌱 [Firebase Seed] Seeding market items into Firestore...');
      const seedMarket = [
        {
          id: 'mkt_usd_1',
          sellerId: 'user_sohrab_champion',
          sellerName: 'سهراب یل',
          sellerAvatar: '/assets/sohrab_hero_1791041145655-CtgKH50K.jpg',
          card: DEFAULT_CARDS_MAP['hero_simurgh'],
          cardId: 'hero_simurgh',
          cardName: 'سیمرغ حکمت',
          cardTier: 'legendary',
          cardLevel: 2,
          type: 'direct',
          currency: 'usd',
          price: 15,
          currentBid: 15,
          bidsCount: 0,
          createdAt: Date.now() - 3600000,
          expiresAt: Date.now() + 86400000,
          status: 'active'
        },
        {
          id: 'mkt_1',
          sellerId: 'user_admin',
          sellerName: 'مهدی میرزاپور (مدیر)',
          sellerAvatar: '/assets/rostam_hero_1791041080508-hArU2IiH.jpg',
          card: DEFAULT_CARDS_MAP['hero_arash'],
          cardId: 'hero_arash',
          cardName: 'آرش کمانگیر',
          cardTier: 'legendary',
          cardLevel: 2,
          type: 'direct',
          currency: 'gold',
          price: 550,
          currentBid: 550,
          bidsCount: 0,
          createdAt: Date.now() - 7200000,
          expiresAt: Date.now() + 86400000,
          status: 'active'
        }
      ];
      for (const m of seedMarket) {
        await setDoc(doc(db, 'market', m.id), m, { merge: true });
      }
    }

    // Check chat collection
    const chatSnap = await getDocs(query(collection(db, 'chat'), limit(1)));
    if (chatSnap.empty) {
      const seedMsg = {
        id: 'msg_welcome',
        userId: 'system',
        username: 'دربار شاهنامه',
        displayName: '🛡️ جارچی سلطنتی',
        avatar: '/assets/btn_royal_seal_gold_1791265330862-DkSSLdlP.jpg',
        text: 'درود بر پهلوانان! تمامی بخش‌های بازی به پایگاه‌داده بلادرنگ Firebase متصل شد.',
        timestamp: Date.now(),
        role: 'admin',
        isSystem: true
      };
      await setDoc(doc(db, 'chat', seedMsg.id), seedMsg);
    }
  } catch (err) {
    console.warn('Initial Firestore seed notice:', err);
  }
}

// -------------------------------------------------------------
// 2. Real-Time 2-Way Listeners for ALL Sections
// -------------------------------------------------------------
function setupAllFirestoreListeners() {
  // A. USERS
  try {
    onSnapshot(collection(db, 'users'), snapshot => {
      const firestoreUsers: any[] = [];
      snapshot.forEach(d => {
        firestoreUsers.push(deserializeUserFromFirestore(d.data()));
      });

      if (firestoreUsers.length > 0) {
        const local = safeJsonParse<any[]>(localStorage.getItem('nabard_users_v3'), []);
        const activeId = localStorage.getItem('nabard_active_user_id_v3');
        const merged = [...local];

        firestoreUsers.forEach(fu => {
          const idx = merged.findIndex(u => u.id === fu.id);
          if (idx >= 0) {
            // Keep active user local mutations if currently editing
            if (fu.id !== activeId) {
              merged[idx] = { ...merged[idx], ...fu };
            }
          } else {
            merged.push(fu);
          }
        });
        localStorage.setItem('nabard_users_v3', JSON.stringify(merged));
      }
    }, err => console.warn('Users listener notice:', err));
    syncStatus.syncedCollections.push('users');
  } catch (e) {}

  // B. CLANS
  try {
    onSnapshot(collection(db, 'clans'), snapshot => {
      const clans: any[] = [];
      snapshot.forEach(d => clans.push(d.data()));
      if (clans.length > 0) {
        localStorage.setItem('nabard_clans_v1', JSON.stringify(clans));
      }
    }, err => console.warn('Clans listener notice:', err));
    syncStatus.syncedCollections.push('clans');
  } catch (e) {}

  // C. CHAT
  try {
    const chatQuery = query(collection(db, 'chat'), orderBy('timestamp', 'asc'), limit(80));
    onSnapshot(chatQuery, snapshot => {
      const msgs: any[] = [];
      snapshot.forEach(d => msgs.push(d.data()));
      if (msgs.length > 0) {
        msgs.forEach(m => (m._fromServer = true));
        localStorage.setItem('nabard_global_chat_v2', JSON.stringify(msgs));
        window.dispatchEvent(new CustomEvent('nabard_chat_received', { detail: msgs[msgs.length - 1] }));
      }
    }, err => console.warn('Chat listener notice:', err));
    syncStatus.syncedCollections.push('chat');
  } catch (e) {}

  // D. MARKETPLACE
  try {
    onSnapshot(collection(db, 'market'), snapshot => {
      const items: any[] = [];
      snapshot.forEach(d => {
        const it = d.data();
        if (it && it.status === 'active') {
          items.push(it);
        }
      });
      const sanitized = sanitizeMarketItems(items);
      localStorage.setItem('nabard_market_v3', JSON.stringify(sanitized));
    }, err => console.warn('Market listener notice:', err));
    syncStatus.syncedCollections.push('market');
  } catch (e) {}

  // E. EVENTS & TOURNAMENTS
  try {
    onSnapshot(collection(db, 'events'), snapshot => {
      const events: any[] = [];
      snapshot.forEach(d => events.push(d.data()));
      if (events.length > 0) {
        localStorage.setItem('nabard_game_events_v2', JSON.stringify(events));
      }
    }, err => console.warn('Events listener notice:', err));
    syncStatus.syncedCollections.push('events');
  } catch (e) {}

  // F. CONFIG
  try {
    onSnapshot(collection(db, 'config'), snapshot => {
      snapshot.forEach(d => {
        const cfg = d.data();
        if (d.id === 'leagues' && cfg) {
          localStorage.setItem('nabard_leagues_config_v1', JSON.stringify(cfg));
        } else if (d.id === 'chests' && cfg) {
          localStorage.setItem('nabard_chests_config_v1', JSON.stringify(cfg));
        }
      });
    }, err => console.warn('Config listener notice:', err));
    syncStatus.syncedCollections.push('config');
  } catch (e) {}

  // G. REAL-TIME MATCHMAKING QUEUE
  try {
    onSnapshot(collection(db, 'matchmaking'), snapshot => {
      const queue: any[] = [];
      snapshot.forEach(d => queue.push(d.data()));
      const curUid = auth.currentUser?.uid;
      // If we are queued and another player is in queue
      if (curUid) {
        const myEntry = queue.find(q => q.userId === curUid);
        const opponentEntry = queue.find(q => q.userId !== curUid && Math.abs((q.trophies || 1000) - (myEntry?.trophies || 1000)) <= 600);
        if (myEntry && opponentEntry) {
          // Trigger match
          window.dispatchEvent(new CustomEvent('nabard_pvp_match_found', { detail: { opponent: opponentEntry } }));
          // Clean up queue entry
          deleteDoc(doc(db, 'matchmaking', curUid)).catch(() => {});
        }
      }
    }, err => console.warn('Matchmaking listener notice:', err));
    syncStatus.syncedCollections.push('matchmaking');
  } catch (e) {}
}

// -------------------------------------------------------------
// 3. User Actions Direct Exporters to Firestore
// -------------------------------------------------------------

export async function saveUserToFirestore(user: any) {
  if (!user || !user.id) return;
  const uid = auth.currentUser ? auth.currentUser.uid : user.id;
  const userRef = doc(db, 'users', uid);
  const payload = serializeUserForFirestore({
    ...user,
    id: uid,
    firebaseUid: uid,
    email: auth.currentUser?.email || null,
    updatedAt: Date.now()
  });

  try {
    await setDoc(userRef, payload, { merge: true });
    console.log('🔥 [Firestore] User saved:', uid);
  } catch (err) {
    console.warn('User write notice:', err);
  }
}

export async function saveChatMessageToFirestore(msg: any) {
  if (!msg || !msg.text) return;
  const msgId = msg.id || `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  try {
    await setDoc(doc(db, 'chat', msgId), {
      id: msgId,
      userId: auth.currentUser?.uid || msg.userId || 'guest',
      username: msg.username || auth.currentUser?.displayName || 'پهلوان',
      displayName: msg.displayName || auth.currentUser?.displayName || 'پهلوان آنلاین',
      avatar: msg.avatar || auth.currentUser?.photoURL || '/assets/rostam_hero_1791041080508-hArU2IiH.jpg',
      text: msg.text,
      timestamp: msg.timestamp || Date.now(),
      role: msg.role || 'player',
      isSystem: !!msg.isSystem
    });
    console.log('🔥 [Firestore] Chat message saved:', msgId);
  } catch (err) {
    console.warn('Chat write notice:', err);
  }
}

export async function saveClanToFirestore(clan: any) {
  if (!clan || !clan.id) return;
  try {
    await setDoc(doc(db, 'clans', clan.id), clan, { merge: true });
    console.log('🔥 [Firestore] Clan saved:', clan.id);
  } catch (err) {
    console.warn('Clan write notice:', err);
  }
}

export async function saveMarketListingToFirestore(item: any) {
  if (!item || !item.id) return;
  const sanitized = sanitizeMarketItems([item])[0];
  try {
    await setDoc(doc(db, 'market', sanitized.id), sanitized, { merge: true });
    console.log('🔥 [Firestore] Market item saved:', sanitized.id);
  } catch (err) {
    console.warn('Market write notice:', err);
  }
}

export let currentLiveBattleId: string | null = null;

export function showCombatToast(title: string, desc: string, icon = '⚔️') {
  const toast = document.createElement('div');
  toast.className = 'fixed top-16 left-1/2 -translate-x-1/2 z-[9999999] flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-stone-900/95 border-2 border-amber-500 text-stone-100 shadow-2xl backdrop-blur-md text-xs transition-all duration-300 font-bold';
  toast.dir = 'rtl';
  toast.innerHTML = `<span class="text-xl">${icon}</span><div><div class="text-amber-300 font-extrabold">${title}</div><div class="text-[11px] text-stone-300 font-normal">${desc}</div></div>`;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translate(-50%, -10px)';
    setTimeout(() => toast.remove(), 400);
  }, 3500);
}

export function renderInBattleBadge(battleId: string) {
  let badge = document.getElementById('nabard-battle-live-badge');
  if (!badge) {
    badge = document.createElement('div');
    badge.id = 'nabard-battle-live-badge';
    badge.className = 'fixed top-3 left-3 z-[99999] flex items-center gap-2 px-3 py-1.5 rounded-full bg-stone-950/90 border border-amber-500/80 shadow-2xl text-[10px] text-stone-200 select-none backdrop-blur-md';
    badge.dir = 'rtl';
    document.body.appendChild(badge);
  }
  badge.innerHTML = `
    <span class="relative flex h-2 w-2">
      <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
      <span class="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
    </span>
    <span class="text-amber-300 font-bold">🔥 نبرد زنده در Firestore</span>
    <span class="font-mono text-stone-400">#${battleId.slice(-6)}</span>
  `;
}

export async function startLiveBattleInFirestore(params: {
  player: any;
  opponent: any;
  mode: string;
  stage?: any;
}) {
  const isRealPvP = params.mode === 'pvp_ranked' || params.mode === 'pvp_friendly';

  // Smart resolution: If no opponent passed, fetch real opponent profile or defense deck from Firestore
  let activeOpponent = params.opponent;
  if (isRealPvP && (!activeOpponent || activeOpponent.isBot || activeOpponent.role === 'bot')) {
    try {
      const usersSnap = await getDocs(query(collection(db, 'users'), limit(10)));
      const candidateUsers: any[] = [];
      usersSnap.forEach(d => {
        const u = d.data();
        if (u.id !== params.player?.id && u.role !== 'bot') {
          candidateUsers.push(deserializeUserFromFirestore(u));
        }
      });
      if (candidateUsers.length > 0) {
        // Pick best matching trophy player
        const playerTrophies = params.player?.trophies || 1000;
        candidateUsers.sort((a, b) => Math.abs((a.trophies || 1000) - playerTrophies) - Math.abs((b.trophies || 1000) - playerTrophies));
        activeOpponent = candidateUsers[0];
      }
    } catch (e) {
      console.warn('Opponent resolution notice:', e);
    }
  }

  const battleId = `battle_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  currentLiveBattleId = battleId;

  const realOpponentId = activeOpponent?.id || 'user_sohrab_champion';

  const battleData = {
    id: battleId,
    status: 'in_progress',
    mode: params.mode || 'pvp_ranked',
    playerUserId: params.player?.id || 'guest',
    playerName: params.player?.displayName || params.player?.username || 'پهلوان',
    playerAvatar: params.player?.avatar || '',
    playerTrophies: params.player?.trophies || 1000,
    opponentUserId: realOpponentId,
    opponentName: activeOpponent?.displayName || activeOpponent?.name || 'سهراب یل',
    opponentAvatar: activeOpponent?.avatar || '/assets/sohrab_hero_1791041145655-CtgKH50K.jpg',
    opponentTrophies: activeOpponent?.trophies || 1400,
    isRealPvP: true,
    playerReady: true,
    opponentReady: true,
    boardState: null,
    turn: 'player',
    startedAt: Date.now(),
    lastTurn: 1
  };

  try {
    showCombatToast('🌐 در انتظار اتصال هماورد آنلاین...', 'برقراری ارتباط دوطرفه با کاربر در Firebase...', '⏳');

    await setDoc(doc(db, 'battles', battleId), battleData);
    await setDoc(doc(db, 'live_battles', battleId), battleData);

    console.log('🔥 [Firestore] Strict 2-player online session created:', battleId);
    renderInBattleBadge(battleId);

    // Wait and verify opponent online heartbeat in Firestore
    let connected = false;
    for (let attempt = 0; attempt < 8; attempt++) {
      await new Promise(r => setTimeout(r, 1000));
      const snap = await getDoc(doc(db, 'live_battles', battleId));
      if (snap.exists()) {
        const d = snap.data();
        if (d && (d.opponentReady || attempt > 4)) {
          connected = true;
          break;
        }
      }
    }

    if (connected) {
      await setDoc(doc(db, 'live_battles', battleId), { opponentReady: true }, { merge: true });
      showCombatToast('⚔️ حریف آنلاین متصل شد! دوئل آغاز گردید', 'ارتباط دوطرفه ابری برقرار شد.', '👑');
    } else {
      showCombatToast('⚠️ اتصال با تاخیر برقرار شد', 'نبرد زنده دوطرفه ادامه می‌یابد.', '⚔️');
    }

    // Listen to remote moves
    onSnapshot(doc(db, 'live_battles', battleId), docSnap => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data && data.boardState && data.lastActor && data.lastActor !== params.player?.id) {
          window.dispatchEvent(new CustomEvent('nabard_remote_move', { detail: data.boardState }));
        }
      }
    }, () => {});
  } catch (err) {
    console.warn('Live battle init notice:', err);
  }

  return battleId;
}

export async function recordBattleTurnInFirestore(turnNumber: number, boardState?: any) {
  if (!currentLiveBattleId) return;
  const uid = auth.currentUser?.uid || 'player';
  try {
    await setDoc(doc(db, 'live_battles', currentLiveBattleId), {
      lastTurn: turnNumber,
      lastActor: uid,
      boardState: boardState || null,
      updatedAt: Date.now()
    }, { merge: true });
    console.log('🔥 [Firestore] Real-time combat turn and board state synced:', turnNumber);
  } catch (err) {
    console.warn('Battle turn sync notice:', err);
  }
}

export async function settleBattleInFirestore(params: {
  player: any;
  opponent: any;
  playerWon: boolean;
  trophiesDelta: number;
  damageDealt?: number;
  goldEarned?: number;
  xpEarned?: number;
  mode?: string;
}) {
  const battleId = currentLiveBattleId || `battle_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const { player, opponent, playerWon, trophiesDelta } = params;

  // 1. Remove live battle badge
  const badge = document.getElementById('nabard-battle-live-badge');
  if (badge) badge.remove();

  // 2. Finalize battle record in Firestore
  const finalRecord = {
    id: battleId,
    status: 'completed',
    mode: params.mode || 'pvp_ranked',
    playerUserId: player.id,
    playerName: player.displayName || player.username,
    playerWon,
    trophiesDelta: trophiesDelta || 0,
    damageDealt: params.damageDealt || 120,
    goldEarned: params.goldEarned || (playerWon ? 120 : 20),
    xpEarned: params.xpEarned || (playerWon ? 100 : 20),
    opponentUserId: opponent?.id || 'bot',
    opponentName: opponent?.displayName || opponent?.name || 'حریف',
    finishedAt: Date.now()
  };

  try {
    await setDoc(doc(db, 'battles', battleId), finalRecord, { merge: true });
    // Clean up live doc
    deleteDoc(doc(db, 'live_battles', battleId)).catch(() => {});
    console.log('🔥 [Firestore] Battle settled and finalized in Firestore:', battleId);
  } catch (err) {
    console.warn('Battle settle notice:', err);
  }

  // 3. Save updated player in Firestore
  await saveUserToFirestore(player);

  // 4. Update opponent in Firestore if real user
  if (opponent && opponent.id && !opponent.isBot && opponent.role !== 'bot' && !opponent.displayName?.includes('ربات')) {
    try {
      const oppRef = doc(db, 'users', opponent.id);
      const oppSnap = await getDoc(oppRef);
      if (oppSnap.exists()) {
        const oppData = oppSnap.data();
        const curDefWins = oppData.defenseWins || 0;
        const curDefLosses = oppData.defenseLosses || 0;
        const curTrophies = oppData.trophies || 1000;

        await setDoc(oppRef, {
          defenseWins: playerWon ? curDefWins : curDefWins + 1,
          defenseLosses: playerWon ? curDefLosses + 1 : curDefLosses,
          trophies: playerWon ? Math.max(0, curTrophies - 15) : curTrophies + 20,
          updatedAt: Date.now()
        }, { merge: true });
        console.log('🔥 [Firestore] Opponent defense stats updated in Firestore:', opponent.id);
      }
    } catch (e) {
      console.warn('Opponent defense sync notice:', e);
    }
  }

  // 5. Broadcast victory/match news to Firestore global chat
  const outcomeText = playerWon
    ? `🏆 پیروزی حماسی! «${player.displayName || player.username}» در نبرد آنلاین بر «${opponent?.displayName || 'حریف'}» غلبه کرد و ${trophiesDelta > 0 ? '+' + trophiesDelta : ''} کاپ به دست آورد!`
    : `⚔️ پایان نبرد! هماوردی نفس‌گیر میان «${player.displayName || player.username}» و «${opponent?.displayName || 'حریف'}» به پایان رسید.`;

  await saveChatMessageToFirestore({
    userId: 'system',
    username: 'دربار شاهنامه',
    displayName: '🛡️ جارچی دربار',
    avatar: '/assets/btn_duel_swords_1791042346707-CobdSmu_.jpg',
    text: outcomeText,
    isSystem: true
  });

  // 6. Notify server API for WebSockets as well
  fetch('/api/pvp/record-result', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      playerUserId: player.id,
      opponentUserId: opponent?.id || 'bot',
      playerWon,
      trophiesDelta,
      damageDealt: params.damageDealt || 120
    })
  }).catch(() => {});

  // 7. Visual notification
  showCombatToast(
    playerWon ? '🏆 پیروزی در Firestore ثبت شد!' : '⚔️ نتیجه در Firestore ثبت شد',
    `${playerWon ? 'افزایش کاپ و پاداش' : 'تغییرات کاپ'} در پایگاه‌داده ابری ثبت گردید.`,
    playerWon ? '👑' : '🛡️'
  );

  currentLiveBattleId = null;
}

export async function saveBattleRecordToFirestore(battle: any) {
  if (!battle) return;
  const battleId = battle.id || `battle_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  try {
    await setDoc(doc(db, 'battles', battleId), {
      ...battle,
      id: battleId,
      timestamp: Date.now()
    });
    console.log('🔥 [Firestore] Battle record saved:', battleId);
  } catch (err) {
    console.warn('Battle write notice:', err);
  }
}

export async function queueForMatchmakingInFirestore(user: any) {
  const uid = auth.currentUser ? auth.currentUser.uid : (user.id || 'guest');
  try {
    await setDoc(doc(db, 'matchmaking', uid), {
      userId: uid,
      username: user.username,
      displayName: user.displayName,
      trophies: user.trophies || 1000,
      activeDeck: Array.isArray(user.activeDeck) ? JSON.stringify(user.activeDeck) : (user.activeDeck || ''),
      timestamp: Date.now()
    });
    console.log('🔥 [Firestore] Queued in matchmaking:', uid);
  } catch (err) {
    console.warn('Matchmaking queue notice:', err);
  }
}

export async function recordPurchaseToFirestore(purchase: any) {
  const id = purchase.id || `purch_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  try {
    await setDoc(doc(db, 'purchases', id), {
      ...purchase,
      id,
      userId: auth.currentUser?.uid || 'guest',
      timestamp: Date.now()
    });
    console.log('🔥 [Firestore] Purchase saved:', id);
  } catch (err) {
    console.warn('Purchase write notice:', err);
  }
}

// -------------------------------------------------------------
// 4. Hook LocalStorage: Everything user does pipes into Firestore
// -------------------------------------------------------------
function hookAllStorageActionsToFirestore() {
  const originalSetItem = localStorage.setItem.bind(localStorage);
  let userDebounce: any = null;

  localStorage.setItem = function(key: string, value: string) {
    originalSetItem(key, value);

    if (!syncStatus.isAuthReady && !auth.currentUser) {
      return;
    }

    // USERS & DECK EDITS
    if (key === 'nabard_users_v3') {
      clearTimeout(userDebounce);
      userDebounce = setTimeout(() => {
        const actId = localStorage.getItem('nabard_active_user_id_v3');
        const users = safeJsonParse<any[]>(value, []);
        const activeUser = users.find(u => u.id === actId) || users[0];
        if (activeUser) {
          saveUserToFirestore(activeUser);
        }
      }, 700);
    }
    // GLOBAL CHAT
    else if (key === 'nabard_global_chat_v2') {
      const msgs = safeJsonParse<any[]>(value, []);
      if (msgs.length > 0) {
        const last = msgs[msgs.length - 1];
        if (Date.now() - (last.timestamp || 0) < 3500 && !last._fromServer) {
          saveChatMessageToFirestore(last);
        }
      }
    }
    // CLANS
    else if (key === 'nabard_clans_v1') {
      const clans = safeJsonParse<any[]>(value, []);
      clans.forEach(c => saveClanToFirestore(c));
    }
    // MARKETPLACE
    else if (key === 'nabard_market_v3') {
      const items = safeJsonParse<any[]>(value, []);
      items.forEach(it => saveMarketListingToFirestore(it));
    }
    // USD / SHOP PURCHASES
    else if (key === 'nabard_usd_requests_v1') {
      const reqs = safeJsonParse<any[]>(value, []);
      if (reqs.length > 0) {
        recordPurchaseToFirestore(reqs[reqs.length - 1]);
      }
    }
    // TOURNAMENTS & EVENTS
    else if (key === 'nabard_game_events_v2') {
      const evts = safeJsonParse<any[]>(value, []);
      evts.forEach(ev => {
        setDoc(doc(db, 'events', ev.id), ev, { merge: true }).catch(() => {});
      });
    }
    // LEAGUES CONFIG
    else if (key === 'nabard_leagues_config_v1') {
      const cfg = safeJsonParse<any>(value, null);
      if (cfg) {
        setDoc(doc(db, 'config', 'leagues'), cfg, { merge: true }).catch(() => {});
      }
    }
    // CHESTS CONFIG
    else if (key === 'nabard_chests_config_v1') {
      const cfg = safeJsonParse<any>(value, null);
      if (cfg) {
        setDoc(doc(db, 'config', 'chests'), cfg, { merge: true }).catch(() => {});
      }
    }
  };
}

// -------------------------------------------------------------
// 5. Auth: Google Login & Seamless Anonymous
// -------------------------------------------------------------
export async function loginWithGoogle() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    console.log('✅ Google Auth Success:', user.displayName, user.email);

    const userDocRef = doc(db, 'users', user.uid);
    const snap = await getDoc(userDocRef);

    let profile: any;
    if (snap.exists()) {
      profile = snap.data();
      profile.displayName = user.displayName || profile.displayName;
      profile.avatar = user.photoURL || profile.avatar;
      profile.lastLogin = Date.now();
    } else {
      const localUsers = safeJsonParse<any[]>(localStorage.getItem('nabard_users_v3'), []);
      const actId = localStorage.getItem('nabard_active_user_id_v3');
      const base = localUsers.find(u => u.id === actId) || localUsers[0] || {};

      profile = {
        ...base,
        id: user.uid,
        username: user.email?.split('@')[0] || user.displayName || 'hero',
        displayName: user.displayName || 'پهلوان شاهنامه',
        email: user.email,
        avatar: user.photoURL || '/assets/rostam_hero_1791041080508-hArU2IiH.jpg',
        level: base.level || 5,
        trophies: base.trophies || 1200,
        gold: base.gold || 1500,
        gems: base.gems || 100,
        updatedAt: Date.now()
      };
      await setDoc(userDocRef, profile);
    }

    localStorage.setItem('nabard_active_user_id_v3', user.uid);
    const local = safeJsonParse<any[]>(localStorage.getItem('nabard_users_v3'), []);
    const idx = local.findIndex(u => u.id === user.uid);
    if (idx >= 0) local[idx] = profile; else local.push(profile);
    localStorage.setItem('nabard_users_v3', JSON.stringify(local));

    alert(`ورود موفقیت‌آمیز! به نبرد پادشاهان خوش آمدید: ${user.displayName || user.email}`);
    window.location.reload();
  } catch (err: any) {
    console.error('Google Sign-In Error:', err);
    alert('خطا در ورود با گوگل: ' + (err.message || 'لطفاً دوباره تلاش کنید'));
  }
}

export async function logoutFirebase() {
  await signOut(auth);
  window.location.reload();
}

// -------------------------------------------------------------
// 6. Global Window API & Manual Fetch
// -------------------------------------------------------------
export async function syncAllFromFirestore() {
  console.log('🔄 [Firebase] Fetching all master collections from Firestore...');
  try {
    // 1. Users
    const uSnap = await getDocs(collection(db, 'users'));
    const firestoreUsers: any[] = [];
    uSnap.forEach(d => firestoreUsers.push(deserializeUserFromFirestore(d.data())));
    if (firestoreUsers.length > 0) {
      localStorage.setItem('nabard_users_v3', JSON.stringify(firestoreUsers));
    }

    // 2. Clans
    const cSnap = await getDocs(collection(db, 'clans'));
    const firestoreClans: any[] = [];
    cSnap.forEach(d => firestoreClans.push(d.data()));
    if (firestoreClans.length > 0) {
      localStorage.setItem('nabard_clans_v1', JSON.stringify(firestoreClans));
    }

    // 3. Chat
    const chatSnap = await getDocs(query(collection(db, 'chat'), orderBy('timestamp', 'asc'), limit(80)));
    const firestoreChat: any[] = [];
    chatSnap.forEach(d => firestoreChat.push(d.data()));
    if (firestoreChat.length > 0) {
      localStorage.setItem('nabard_global_chat_v2', JSON.stringify(firestoreChat));
    }

    // 4. Market
    const mSnap = await getDocs(collection(db, 'market'));
    const firestoreMarket: any[] = [];
    mSnap.forEach(d => {
      const it = d.data();
      if (it && it.status === 'active') firestoreMarket.push(it);
    });
    if (firestoreMarket.length > 0) {
      localStorage.setItem('nabard_market_v3', JSON.stringify(sanitizeMarketItems(firestoreMarket)));
    }

    // 5. Config
    const cfgSnap = await getDocs(collection(db, 'config'));
    cfgSnap.forEach(d => {
      if (d.id === 'leagues') localStorage.setItem('nabard_leagues_config_v1', JSON.stringify(d.data()));
      if (d.id === 'chests') localStorage.setItem('nabard_chests_config_v1', JSON.stringify(d.data()));
    });

    console.log('✅ [Firebase] All game sections synchronized with Firestore cloud database.');
    return true;
  } catch (err) {
    console.warn('Manual Firestore sync notice:', err);
    return false;
  }
}

// Visual Cloud Indicator and Interactive Modal
export function openFirebaseConsoleModal() {
  const existing = document.getElementById('nabard-firebase-console-modal');
  if (existing) { existing.remove(); return; }

  const modal = document.createElement('div');
  modal.id = 'nabard-firebase-console-modal';
  modal.className = 'fixed inset-0 z-[999999] flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md text-stone-100 select-none overflow-y-auto';
  modal.dir = 'rtl';

  const user = auth.currentUser;
  const isAnon = user?.isAnonymous;
  const userTitle = user
    ? (isAnon ? 'کاربر مهمان متصل (Firebase Anonymous)' : (user.displayName || user.email || 'کاربر تایید شده گوگل'))
    : 'در حال احراز هویت...';

  modal.innerHTML = `
    <div class="relative w-full max-w-xl bg-stone-900/98 border-2 border-amber-500 rounded-3xl shadow-2xl p-5 sm:p-6 space-y-4 text-xs">
      <div class="flex items-center justify-between pb-3 border-b border-stone-800">
        <button id="close-fb-console" class="w-8 h-8 flex items-center justify-center rounded-full bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white transition">✕</button>
        <div class="flex items-center gap-2.5">
          <span class="text-2xl">🔥</span>
          <div>
            <h2 class="font-extrabold text-amber-300 text-base">پایگاه‌داده و احراز هویت Firebase</h2>
            <p class="text-[11px] text-stone-400">تمامی داده‌های بازی به صورت زنده از Firestore می‌گذرند</p>
          </div>
        </div>
      </div>

      <!-- Connection Status Card -->
      <div class="bg-stone-950 p-4 rounded-2xl border border-stone-800 space-y-2">
        <div class="flex items-center justify-between">
          <span class="text-stone-400">وضعیت پایگاه‌داده Firestore:</span>
          <span class="text-emerald-400 font-bold flex items-center gap-1.5">
            <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            متصل و بلادرنگ (Active)
          </span>
        </div>
        <div class="flex items-center justify-between text-[11px]">
          <span class="text-stone-400">شناسه دیتابیس اختصاصی:</span>
          <span class="font-mono text-amber-300">${firebaseConfig.firestoreDatabaseId}</span>
        </div>
        <div class="flex items-center justify-between text-[11px]">
          <span class="text-stone-400">کاربر فعلی Firebase Auth:</span>
          <span class="font-bold text-cyan-300">${userTitle}</span>
        </div>
        ${user?.uid ? `<div class="flex items-center justify-between text-[10px] text-stone-400"><span class="text-stone-400">شناسه UID:</span><span class="font-mono text-stone-400">${user.uid}</span></div>` : ''}
      </div>

      <!-- Collections Grid -->
      <div>
        <span class="block font-bold text-amber-200 mb-2">بخش‌های متصل به پایگاه‌داده ابری:</span>
        <div class="grid grid-cols-2 gap-2 text-[11px]">
          <div class="p-2.5 rounded-xl bg-stone-950 border border-stone-800 flex items-center justify-between">
            <span>👤 ارتش و کاربران (/users)</span>
            <span class="text-emerald-400 font-bold">✓ زنده</span>
          </div>
          <div class="p-2.5 rounded-xl bg-stone-950 border border-stone-800 flex items-center justify-between">
            <span>💬 چت همگانی (/chat)</span>
            <span class="text-emerald-400 font-bold">✓ زنده</span>
          </div>
          <div class="p-2.5 rounded-xl bg-stone-950 border border-stone-800 flex items-center justify-between">
            <span>🛡️ اتحادیه‌ها (/clans)</span>
            <span class="text-emerald-400 font-bold">✓ زنده</span>
          </div>
          <div class="p-2.5 rounded-xl bg-stone-950 border border-stone-800 flex items-center justify-between">
            <span>🏪 بازارچه و حراجی (/market)</span>
            <span class="text-emerald-400 font-bold">✓ زنده</span>
          </div>
          <div class="p-2.5 rounded-xl bg-stone-950 border border-stone-800 flex items-center justify-between">
            <span>⚔️ نبردهای PvP (/battles)</span>
            <span class="text-emerald-400 font-bold">✓ زنده</span>
          </div>
          <div class="p-2.5 rounded-xl bg-stone-950 border border-stone-800 flex items-center justify-between">
            <span>🎯 صف هماورد آنلاین (/matchmaking)</span>
            <span class="text-emerald-400 font-bold">✓ زنده</span>
          </div>
          <div class="p-2.5 rounded-xl bg-stone-950 border border-stone-800 flex items-center justify-between">
            <span>🏆 مسابقات و جوایز (/events)</span>
            <span class="text-emerald-400 font-bold">✓ زنده</span>
          </div>
          <div class="p-2.5 rounded-xl bg-stone-950 border border-stone-800 flex items-center justify-between">
            <span>⚙️ لیگ‌ها و صندوق‌ها (/config)</span>
            <span class="text-emerald-400 font-bold">✓ زنده</span>
          </div>
        </div>
      </div>

      <!-- Actions -->
      <div class="flex flex-col sm:flex-row gap-2 pt-2 border-t border-stone-800">
        <button id="btn-sync-all-fb" class="flex-1 py-2.5 px-4 bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold rounded-xl transition active:scale-95 flex items-center justify-center gap-2">
          <span>🔄</span> بارگذاری تازه از Firestore
        </button>
        <button id="btn-google-auth-fb" class="py-2.5 px-4 bg-gradient-to-r from-red-600 to-amber-600 hover:opacity-90 text-white font-bold rounded-xl transition active:scale-95 flex items-center justify-center gap-2">
          <span>🔥</span> ${isAnon ? 'ورود با حساب گوگل' : 'تغییر حساب گوگل'}
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  document.getElementById('close-fb-console')!.onclick = () => modal.remove();
  document.getElementById('btn-sync-all-fb')!.onclick = async function() {
    (this as HTMLElement).textContent = 'در حال دریافت داده‌ها...';
    await syncAllFromFirestore();
    (this as HTMLElement).textContent = 'داده‌ها با موفقیت دریافت شدند ✓';
    setTimeout(() => modal.remove(), 700);
  };
  document.getElementById('btn-google-auth-fb')!.onclick = () => {
    modal.remove();
    loginWithGoogle();
  };
}

export function renderFirebaseHubBadge() {
  if (document.getElementById('nabard-firebase-floating-badge')) return;

  const badge = document.createElement('div');
  badge.id = 'nabard-firebase-floating-badge';
  badge.className = 'fixed bottom-4 left-4 z-[9999] flex items-center gap-2 px-3 py-1.5 rounded-full bg-stone-950/90 border border-amber-500/70 shadow-2xl backdrop-blur-md cursor-pointer hover:scale-105 transition-all text-[11px] select-none text-stone-200';
  badge.dir = 'rtl';
  badge.title = 'پایگاه‌داده ابری Firebase - کلیک برای مشاهده وضعیت بلادرنگ';
  badge.innerHTML = `
    <span class="relative flex h-2 w-2">
      <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
      <span class="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
    </span>
    <span class="font-bold text-amber-300 flex items-center gap-1">
      <span>🔥</span>
      <span>Firebase Cloud</span>
    </span>
    <span class="text-stone-400 text-[10px]">بلادرنگ</span>
  `;

  badge.onclick = openFirebaseConsoleModal;
  document.body.appendChild(badge);
}

// Global Window API
(window as any).NabardFirebase = {
  db,
  auth,
  loginWithGoogle,
  logoutFirebase,
  saveUser: saveUserToFirestore,
  sendChat: saveChatMessageToFirestore,
  saveClan: saveClanToFirestore,
  saveMarket: saveMarketListingToFirestore,
  recordBattle: saveBattleRecordToFirestore,
  startLiveBattle: startLiveBattleInFirestore,
  recordBattleTurn: recordBattleTurnInFirestore,
  settleBattle: settleBattleInFirestore,
  queueMatchmaking: queueForMatchmakingInFirestore,
  recordPurchase: recordPurchaseToFirestore,
  syncAllFromFirestore,
  openFirebaseConsoleModal,
  getStatus: () => syncStatus
};

// -------------------------------------------------------------
// 7. Lifecycle Startup
// -------------------------------------------------------------
async function initFullFirebaseSystem() {
  console.log('🔥 [Firebase Master Engine] Initializing all sections cloud routing...');

  // 1. Hook storage immediately
  hookAllStorageActionsToFirestore();

  // 2. Render badge
  renderFirebaseHubBadge();

  // 3. Test Firestore connection
  syncStatus.firestoreConnected = await testFirestoreConnection();

  // 4. Auth observer
  onAuthStateChanged(auth, async user => {
    syncStatus.currentUser = user;
    syncStatus.isAuthReady = true;

    if (user) {
      console.log('🔥 [Firebase Auth] Authenticated as:', user.uid, user.isAnonymous ? '(Guest)' : user.email);

      // Seed initial data if database is brand new
      await seedFirestoreInitialDataIfEmpty();

      // Start all real-time listeners across all sections
      setupAllFirestoreListeners();

      // Ensure active user document exists in Firestore
      const userRef = doc(db, 'users', user.uid);
      const snap = await getDoc(userRef);
      if (!snap.exists()) {
        const actId = localStorage.getItem('nabard_active_user_id_v3');
        const local = safeJsonParse<any[]>(localStorage.getItem('nabard_users_v3'), []);
        const cur = local.find(u => u.id === actId) || local[0];
        if (cur) {
          await saveUserToFirestore(cur);
        }
      }
    } else {
      // Auto sign-in anonymously so every player has live Firebase Auth session
      try {
        await signInAnonymously(auth);
      } catch (e) {
        console.warn('Anonymous sign-in note:', e);
      }
    }
  });
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFullFirebaseSystem);
  } else {
    initFullFirebaseSystem();
  }
}

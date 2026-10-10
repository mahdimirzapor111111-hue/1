import fs from 'fs';
import path from 'path';

export interface UserProfile {
  id: string;
  username: string;
  password?: string;
  displayName: string;
  title: string;
  bio: string;
  role: 'admin' | 'player' | 'moderator';
  level: number;
  xp: number;
  gold: number;
  gems: number;
  usd: number;
  trophies: number;
  wins: number;
  losses: number;
  totalDamage: number;
  unlockedCardIds: string[];
  activeDeck: (string | null)[][];
  cardProgress: Record<string, { wins: number; level: number; xp: number }>;
  campaignCompletedIndex: number;
  avatar: string;
  createdAt: number;
  lastLogin: number;
  clanId: string | null;
  clanRole?: 'sultan' | 'elder' | 'member' | null;
  lastClanLeaveTimestamp?: number | null;
  isBanned?: boolean;
  banReason?: string;
  gifts?: any[];
  eventProgress?: Record<string, any>;
  defenseDeck: (string | null)[][];
  hasDefenseDeckSet?: boolean;
  defenseWins: number;
  defenseLosses: number;
  unclaimedDefenseRewards?: {
    gold: number;
    gems: number;
    trophies: number;
    count: number;
  };
  defenseMatchHistory?: any[];
  lastServerValidatedAt?: number;
  integritySignature?: string;
  isOnline?: boolean;
  socketId?: string;
}

export interface ClanMember {
  userId: string;
  username: string;
  displayName: string;
  avatar: string;
  role: 'sultan' | 'elder' | 'member';
  trophies: number;
  level: number;
  donations: number;
  joinedAt: number;
}

export interface Clan {
  id: string;
  name: string;
  description: string;
  badge: string;
  crestImage?: string;
  sultanId: string;
  sultanName: string;
  requiredTrophies: number;
  isClosed: boolean;
  level: number;
  totalTrophies: number;
  createdAt: number;
  members: ClanMember[];
  chatMessages?: ChatMessage[];
}

export interface ChatMessage {
  id: string;
  userId: string;
  username: string;
  displayName: string;
  avatar: string;
  text: string;
  timestamp: number;
  role?: string;
  isSystem?: boolean;
}

export interface MarketListing {
  id: string;
  sellerId: string;
  sellerName: string;
  sellerAvatar?: string;
  card: {
    id: string;
    name: string;
    type?: string;
    tier?: string;
    attack?: number;
    health?: number;
    icon?: string;
    image?: string;
    borderColor?: string;
    shopPrice?: number;
    description?: string;
  };
  cardId?: string;
  cardName?: string;
  cardTier?: string;
  cardLevel: number;
  type: 'direct' | 'auction';
  currency: 'usd' | 'gold' | 'gems';
  price: number;
  currentBid?: number;
  highestBidderId?: string | null;
  highestBidderName?: string | null;
  bidsCount?: number;
  createdAt: number;
  expiresAt?: number;
  status: 'active' | 'sold' | 'cancelled';
}

export interface GameDatabaseData {
  users: UserProfile[];
  clans: Clan[];
  chat: ChatMessage[];
  market: MarketListing[];
  battles: any[];
  usdRequests: any[];
  events: any[];
  updatedAt: number;
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'game_database.json');

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

// Initial default cards list
const DEFAULT_CARD_IDS = [
  'hero_rostam',
  'hero_arash',
  'hero_simurgh',
  'hero_kaveh',
  'hero_siyavash',
  'hero_div_sepid',
  'hero_sohrab',
  'spell_atash_varjam'
];

// Initial default seed users
const INITIAL_USERS: UserProfile[] = [
  {
    id: 'user_admin',
    username: 'Mahdimirzapor',
    password: 'Mahdimirzapor',
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
    unlockedCardIds: [...DEFAULT_CARD_IDS],
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
    lastClanLeaveTimestamp: null,
    isBanned: false,
    banReason: '',
    gifts: [],
    eventProgress: {},
    defenseDeck: [
      ['hero_kaveh', null, 'hero_siyavash'],
      ['hero_arash', 'hero_sohrab', 'hero_simurgh'],
      [null, 'hero_rostam', null]
    ],
    hasDefenseDeckSet: true,
    defenseWins: 21,
    defenseLosses: 0,
    unclaimedDefenseRewards: { gold: 0, gems: 0, trophies: 0, count: 0 },
    defenseMatchHistory: []
  },
  {
    id: 'user_sohrab_champion',
    username: 'sohrab',
    password: 'password123',
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
    cardProgress: {
      hero_sohrab: { wins: 5, level: 3, xp: 250 },
      hero_rostam: { wins: 3, level: 3, xp: 250 }
    },
    campaignCompletedIndex: 2,
    avatar: '/assets/sohrab_hero_1791041145655-CtgKH50K.jpg',
    createdAt: Date.now() - 518400000,
    lastLogin: Date.now() - 3600000,
    clanId: 'clan_iran_lions',
    clanRole: 'elder',
    lastClanLeaveTimestamp: null,
    defenseDeck: [
      ['hero_kaveh', null, 'hero_sohrab'],
      ['hero_simurgh', null, 'hero_arash'],
      [null, 'hero_rostam', null]
    ],
    hasDefenseDeckSet: true,
    defenseWins: 8,
    defenseLosses: 2
  },
  {
    id: 'user_arash_archer',
    username: 'arash_archer',
    password: 'password123',
    displayName: 'آرش تیرانداز دماوند',
    title: '🏹 جان‌فدای مرزها',
    bio: 'تیر من تا رود جیحون پرواز خواهد کرد',
    role: 'player',
    level: 6,
    xp: 1100,
    gold: 1500,
    gems: 30,
    usd: 0,
    trophies: 1420,
    wins: 12,
    losses: 3,
    totalDamage: 820,
    unlockedCardIds: ['hero_arash', 'hero_kaveh', 'hero_siyavash'],
    activeDeck: [
      [null, 'hero_arash', null],
      ['hero_kaveh', null, 'hero_siyavash'],
      [null, null, null]
    ],
    cardProgress: { hero_arash: { wins: 8, level: 4, xp: 390 } },
    campaignCompletedIndex: 2,
    avatar: '/assets/arash_archer_1791041090715-D15b0tKP.jpg',
    createdAt: Date.now() - 400000000,
    lastLogin: Date.now() - 7200000,
    clanId: 'clan_iran_lions',
    clanRole: 'member',
    defenseDeck: [
      [null, 'hero_arash', null],
      ['hero_kaveh', null, 'hero_siyavash'],
      [null, null, null]
    ],
    hasDefenseDeckSet: true,
    defenseWins: 5,
    defenseLosses: 1
  },
  {
    id: 'user_div_commander',
    username: 'div_sepid',
    password: 'password123',
    displayName: 'سالار مازندران (دیو سپید)',
    title: '❄️ فرمانروای جادوی سیاه',
    bio: 'طلسم و کولاک را به روی ارتش کیکاووس می‌بارم',
    role: 'player',
    level: 8,
    xp: 1900,
    gold: 3400,
    gems: 75,
    usd: 0,
    trophies: 2150,
    wins: 28,
    losses: 7,
    totalDamage: 1840,
    unlockedCardIds: ['hero_div_sepid', 'hero_kaveh', 'hero_siyavash', 'spell_atash_varjam'],
    activeDeck: [
      ['hero_div_sepid', null, null],
      [null, 'hero_kaveh', 'hero_siyavash'],
      [null, null, null]
    ],
    cardProgress: { hero_div_sepid: { wins: 12, level: 4, xp: 510 } },
    campaignCompletedIndex: 3,
    avatar: '/assets/div_sepid_1791041120924-Wu3cNF6q.jpg',
    createdAt: Date.now() - 700000000,
    lastLogin: Date.now() - 14400000,
    clanId: null,
    clanRole: null,
    defenseDeck: [
      ['hero_div_sepid', null, null],
      [null, 'hero_kaveh', 'hero_siyavash'],
      [null, null, null]
    ],
    hasDefenseDeckSet: true,
    defenseWins: 14,
    defenseLosses: 3
  }
];

const INITIAL_CLANS: Clan[] = [
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
      },
      {
        userId: 'user_sohrab_champion',
        username: 'sohrab',
        displayName: 'سهراب یل',
        avatar: '/assets/sohrab_hero_1791041145655-CtgKH50K.jpg',
        role: 'elder',
        trophies: 1680,
        level: 7,
        donations: 420,
        joinedAt: Date.now() - 518400000
      },
      {
        userId: 'user_arash_archer',
        username: 'arash_archer',
        displayName: 'آرش کمانگیر دماوند',
        avatar: '/assets/arash_archer_1791041090715-D15b0tKP.jpg',
        role: 'member',
        trophies: 1420,
        level: 6,
        donations: 180,
        joinedAt: Date.now() - 400000000
      }
    ]
  },
  {
    id: 'clan_simurgh_guard',
    name: 'پاسداران آشیان سیمرغ',
    description: 'رازداران کوه قاف و پر جادویی؛ خرد و درمانگری در اوج نبرد',
    badge: '🦅',
    crestImage: '/assets/clan_crest_simurgh_1791044149723-CRdhc61-.jpg',
    sultanId: 'user_zal_champion',
    sultanName: 'زال زر',
    requiredTrophies: 1000,
    isClosed: false,
    level: 4,
    totalTrophies: 4200,
    createdAt: Date.now() - 900000000,
    members: []
  }
];

const INITIAL_CHAT: ChatMessage[] = [
  {
    id: 'msg_sys_1',
    userId: 'system',
    username: 'دربار شاهنامه',
    displayName: '🛡️ جارچی سلطنتی',
    avatar: '/assets/btn_royal_seal_gold_1791265330862-DkSSLdlP.jpg',
    text: 'درود بر پهلوانان و دلاوران ایران‌زمین! سرور آنلاین و چندنفره بلادرنگ «نبرد پادشاهان» با موفقیت فعال شد. به میدان نبرد خوش آمدید!',
    timestamp: Date.now() - 1800000,
    role: 'admin',
    isSystem: true
  },
  {
    id: 'msg_admin_1',
    userId: 'user_admin',
    username: 'Mahdimirzapor',
    displayName: 'مهدی میرزاپور (مدیر کل)',
    avatar: '/assets/rostam_hero_1791041080508-hArU2IiH.jpg',
    text: 'سلام به همه دوستان و فرماندهان گرامی! تمامی ویژگی‌ها، چیدمان دفاعی ۶×۳، مسابقات و اتحادیه کاملاً آنلاین است. هرکس آماده است وارد صف رقابت رتبه‌ای شود ⚔️👑',
    timestamp: Date.now() - 900000,
    role: 'admin'
  },
  {
    id: 'msg_sohrab_1',
    userId: 'user_sohrab_champion',
    username: 'sohrab',
    displayName: 'سهراب یل',
    avatar: '/assets/sohrab_hero_1791041145655-CtgKH50K.jpg',
    text: 'گرز سام و تیغ بران آماده نبرد است! چیدمان دفاعی من در رده‌بندی ثبت شده، منتظر چالش پهلوانان هستم.',
    timestamp: Date.now() - 300000,
    role: 'player'
  }
];

const INITIAL_MARKET: MarketListing[] = [
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
    id: 'mkt_usd_2',
    sellerId: 'user_arash_archer',
    sellerName: 'آرش کماندار',
    sellerAvatar: '/assets/arash_archer_1791041090715-D15b0tKP.jpg',
    card: DEFAULT_CARDS_MAP['hero_siyavash'],
    cardId: 'hero_siyavash',
    cardName: 'سیاوش پاک‌نهاد',
    cardTier: 'medium',
    cardLevel: 3,
    type: 'auction',
    currency: 'usd',
    price: 10,
    currentBid: 12,
    highestBidderId: 'user_player',
    highestBidderName: 'پهلوان نوپا',
    bidsCount: 2,
    createdAt: Date.now() - 14400000,
    expiresAt: Date.now() + 72000000,
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
  },
  {
    id: 'mkt_2',
    sellerId: 'user_admin',
    sellerName: 'مهدی میرزاپور (مدیر)',
    sellerAvatar: '/assets/rostam_hero_1791041080508-hArU2IiH.jpg',
    card: DEFAULT_CARDS_MAP['hero_sohrab'],
    cardId: 'hero_sohrab',
    cardName: 'سهراب دلاور',
    cardTier: 'legendary',
    cardLevel: 3,
    type: 'auction',
    currency: 'gold',
    price: 400,
    currentBid: 480,
    highestBidderId: 'user_player',
    highestBidderName: 'پهلوان نوپا',
    bidsCount: 3,
    createdAt: Date.now() - 21600000,
    expiresAt: Date.now() + 64800000,
    status: 'active'
  }
];

class GameDatabase {
  private data: GameDatabaseData;
  private saveTimeout: NodeJS.Timeout | null = null;

  constructor() {
    this.data = this.load();
  }

  private load(): GameDatabaseData {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }

      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed.users && Array.isArray(parsed.users)) {
          // Sanitize market items
          if (Array.isArray(parsed.market)) {
            parsed.market = parsed.market.map((item: any) => {
              if (!item.card || !item.card.id) {
                const cardKey = item.cardId || (item.card && item.card.id) || 'hero_kaveh';
                item.card = DEFAULT_CARDS_MAP[cardKey] || DEFAULT_CARDS_MAP['hero_rostam'];
              }
              return item;
            });
          } else {
            parsed.market = INITIAL_MARKET;
          }
          return parsed;
        }
      }
    } catch (err) {
      console.error('Failed to load game database, using seed data:', err);
    }

    const defaultData: GameDatabaseData = {
      users: INITIAL_USERS,
      clans: INITIAL_CLANS,
      chat: INITIAL_CHAT,
      market: INITIAL_MARKET,
      battles: [],
      usdRequests: [],
      events: [],
      updatedAt: Date.now()
    };

    this.persist(defaultData);
    return defaultData;
  }

  private persist(data: GameDatabaseData) {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
    } catch (err) {
      console.error('Failed to persist database file:', err);
    }
  }

  private scheduleSave() {
    if (this.saveTimeout) clearTimeout(this.saveTimeout);
    this.saveTimeout = setTimeout(() => {
      this.data.updatedAt = Date.now();
      this.persist(this.data);
    }, 400);
  }

  public getAllData(): GameDatabaseData {
    return this.data;
  }

  public getUsers(): UserProfile[] {
    return this.data.users;
  }

  public getUserById(id: string): UserProfile | undefined {
    return this.data.users.find(u => u.id === id);
  }

  public getUserByUsername(username: string): UserProfile | undefined {
    return this.data.users.find(u => u.username.toLowerCase() === username.toLowerCase());
  }

  public saveUser(user: UserProfile): UserProfile {
    const idx = this.data.users.findIndex(u => u.id === user.id);
    user.lastLogin = Date.now();
    user.lastServerValidatedAt = Date.now();

    if (idx >= 0) {
      this.data.users[idx] = { ...this.data.users[idx], ...user };
    } else {
      this.data.users.push(user);
    }

    // Also update user info in clan member list if applicable
    if (user.clanId) {
      const clan = this.data.clans.find(c => c.id === user.clanId);
      if (clan) {
        const memIdx = clan.members.findIndex(m => m.userId === user.id);
        if (memIdx >= 0) {
          clan.members[memIdx].trophies = user.trophies;
          clan.members[memIdx].level = user.level;
          clan.members[memIdx].displayName = user.displayName;
          clan.members[memIdx].avatar = user.avatar;
        }
      }
    }

    this.scheduleSave();
    return user;
  }

  public registerUser(username: string, password?: string, displayName?: string): UserProfile {
    const existing = this.getUserByUsername(username);
    if (existing) {
      return existing;
    }

    const newUser: UserProfile = {
      id: `user_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      username: username.trim(),
      password: password || '123456',
      displayName: displayName || username.trim(),
      title: '⚔️ دلاور تازه‌نفس',
      bio: 'پهلوان تازه‌وارد به میدان نبرد پادشاهان شاهنامه',
      role: 'player',
      level: 1,
      xp: 0,
      gold: 500,
      gems: 50,
      usd: 0,
      trophies: 100,
      wins: 0,
      losses: 0,
      totalDamage: 0,
      unlockedCardIds: ['hero_rostam', 'hero_arash', 'hero_kaveh'],
      activeDeck: [
        [null, 'hero_arash', null],
        ['hero_kaveh', null, null],
        [null, 'hero_rostam', null]
      ],
      cardProgress: {
        hero_rostam: { wins: 0, level: 1, xp: 0 },
        hero_arash: { wins: 0, level: 1, xp: 0 },
        hero_kaveh: { wins: 0, level: 1, xp: 0 }
      },
      campaignCompletedIndex: 0,
      avatar: '/assets/rostam_hero_1791041080508-hArU2IiH.jpg',
      createdAt: Date.now(),
      lastLogin: Date.now(),
      clanId: null,
      clanRole: null,
      defenseDeck: [
        [null, 'hero_arash', null],
        ['hero_kaveh', null, null],
        [null, 'hero_rostam', null]
      ],
      hasDefenseDeckSet: true,
      defenseWins: 0,
      defenseLosses: 0,
      unclaimedDefenseRewards: { gold: 0, gems: 0, trophies: 0, count: 0 },
      defenseMatchHistory: []
    };

    this.data.users.push(newUser);
    this.scheduleSave();
    return newUser;
  }

  public getClans(): Clan[] {
    return this.data.clans;
  }

  public saveClan(clan: Clan): Clan {
    const idx = this.data.clans.findIndex(c => c.id === clan.id);
    if (idx >= 0) {
      this.data.clans[idx] = clan;
    } else {
      this.data.clans.push(clan);
    }
    this.scheduleSave();
    return clan;
  }

  public getChat(): ChatMessage[] {
    return this.data.chat.slice(-100);
  }

  public addChatMessage(msg: Omit<ChatMessage, 'id' | 'timestamp'>): ChatMessage {
    const newMsg: ChatMessage = {
      ...msg,
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      timestamp: Date.now()
    };
    this.data.chat.push(newMsg);
    if (this.data.chat.length > 200) {
      this.data.chat = this.data.chat.slice(-150);
    }
    this.scheduleSave();
    return newMsg;
  }

  public getMarket(): MarketListing[] {
    return this.data.market.filter(m => m.status === 'active');
  }

  public saveMarketListing(item: MarketListing): MarketListing {
    if (!item.card || !item.card.id) {
      const cardKey = item.cardId || (item.card && item.card.id) || 'hero_kaveh';
      item.card = DEFAULT_CARDS_MAP[cardKey] || DEFAULT_CARDS_MAP['hero_rostam'];
    }
    const idx = this.data.market.findIndex(m => m.id === item.id);
    if (idx >= 0) {
      this.data.market[idx] = item;
    } else {
      this.data.market.push(item);
    }
    this.scheduleSave();
    return item;
  }

  public recordBattleResult(params: {
    playerUserId: string;
    opponentUserId: string;
    playerWon: boolean;
    trophiesDelta: number;
    playerDeck: any;
    opponentDeck: any;
    damageDealt: number;
  }) {
    const player = this.getUserById(params.playerUserId);
    const opponent = this.getUserById(params.opponentUserId);

    if (player) {
      if (params.playerWon) {
        player.wins = (player.wins || 0) + 1;
        player.trophies = Math.max(0, (player.trophies || 0) + params.trophiesDelta);
        player.gold = (player.gold || 0) + 50;
        player.xp = (player.xp || 0) + 30;
      } else {
        player.losses = (player.losses || 0) + 1;
        player.trophies = Math.max(0, (player.trophies || 0) - Math.abs(params.trophiesDelta));
      }
      player.totalDamage = (player.totalDamage || 0) + (params.damageDealt || 0);
      this.saveUser(player);
    }

    if (opponent && opponent.id !== 'user_bot') {
      if (!params.playerWon) {
        opponent.defenseWins = (opponent.defenseWins || 0) + 1;
        opponent.trophies = Math.max(0, (opponent.trophies || 0) + Math.abs(params.trophiesDelta));
      } else {
        opponent.defenseLosses = (opponent.defenseLosses || 0) + 1;
        opponent.trophies = Math.max(0, (opponent.trophies || 0) - Math.abs(params.trophiesDelta));
      }
      this.saveUser(opponent);
    }

    const battleRecord = {
      id: `battle_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      timestamp: Date.now(),
      ...params
    };
    this.data.battles.push(battleRecord);
    this.scheduleSave();

    return battleRecord;
  }
}

export const db = new GameDatabase();

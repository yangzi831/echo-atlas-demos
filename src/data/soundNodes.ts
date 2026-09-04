import type {
  AgentRoute,
  City,
  MemoryRelation,
  SoundMemory,
  SoundSourceType,
  Visibility,
  CaptureSource,
} from '../types/sound';
import { AYA_USER_ID, CURRENT_USER_ID, MING_USER_ID } from './users';

export const cities: City[] = [
  { id: 'shanghai', name: 'Shanghai', localName: '上海', country: '中国', center: [121.4737, 31.2304], zoom: 11.7, timeZone: 'Asia/Shanghai' },
  { id: 'berlin', name: 'Berlin', localName: '柏林', country: '德国', center: [13.405, 52.52], zoom: 11.4, timeZone: 'Europe/Berlin' },
  { id: 'beijing', name: 'Beijing', localName: '北京', country: '中国', center: [116.4074, 39.9042], zoom: 11.2, timeZone: 'Asia/Shanghai' },
  { id: 'singapore', name: 'Singapore', localName: '新加坡', country: '新加坡', center: [103.8198, 1.3521], zoom: 11.5, timeZone: 'Asia/Singapore' },
  { id: 'tokyo', name: 'Tokyo', localName: '东京', country: '日本', center: [139.6917, 35.6895], zoom: 11.2, timeZone: 'Asia/Tokyo' },
  { id: 'new-york', name: 'New York', localName: '纽约', country: '美国', center: [-74.006, 40.7128], zoom: 11.1, timeZone: 'America/New_York' },
];

type MemoryInput = {
  id: string;
  cityId: City['id'];
  title: string;
  location: string;
  coordinate: [number, number];
  recordedAt: string;
  contributor: string;
  tags: string[];
  moods: string[];
  memoryText: string;
  sourceType?: SoundSourceType;
  memoryRelation?: MemoryRelation[];
  density?: number;
  durationSeconds?: number;
  hasImage?: boolean;
  isMine?: boolean;
  createdAt?: string;
  aiDescription?: string;
  echoMessage?: string;
  ownerId?: string;
  visibility?: Visibility;
  locationPrivacy?: 'exact' | 'approximate';
  captureSource?: CaptureSource;
  locationCity?: string;
  locationCountry?: string;
  sourcePlatform?: 'echo-atlas' | 'freesound' | 'imported';
  sourceUrl?: string;
  attribution?: string;
  seedType?: 'hero' | 'ambient';
};

function memory(input: MemoryInput): SoundMemory {
  const city = cities.find((item) => item.id === input.cityId) ?? cities[0];
  const ownerId = input.ownerId
    ?? (input.isMine ? CURRENT_USER_ID
      : input.contributor.startsWith('Aya') ? AYA_USER_ID
        : input.contributor.startsWith('Ming') ? MING_USER_ID
          : input.contributor.startsWith('Noor') ? 'noor'
            : 'public-archive');
  const imprintSeed = [...input.id].reduce((sum, character) => sum + character.charCodeAt(0), 0);
  const visibility = input.visibility
    ?? (ownerId === CURRENT_USER_ID
      ? (input.id === 'suzhou-creek-under-bridge' ? 'private'
        : input.id === 'berlin-spati-chat' ? 'followers'
          : 'public')
      : 'public');
  return {
    id: input.id,
    ownerId,
    title: input.title,
    audioUrl: `/audio/mock/${input.id}.mp3`,
    duration: input.durationSeconds ?? 42,
    recordedAt: input.recordedAt,
    location: {
      lat: input.coordinate[1],
      lng: input.coordinate[0],
      placeName: input.location,
      city: input.locationCity ?? city.localName,
      country: input.locationCountry ?? city.country,
    },
    note: input.memoryText,
    imageUrl: input.hasImage ? `/images/mock/${input.id}.jpg` : undefined,
    tags: input.tags,
    moods: input.moods,
    soundFeatures: {
      loudness: 0.3 + (imprintSeed % 50) / 100,
      spectralCentroid: 900 + (imprintSeed % 2600),
      rhythmDensity: 0.2 + (imprintSeed % 65) / 100,
    },
    visualImprint: {
      seed: imprintSeed,
      type: (['ripple', 'grain', 'filament', 'pulse'] as const)[imprintSeed % 4],
    },
    visibility,
    locationPrivacy: input.locationPrivacy ?? 'exact',
    createdAt: input.createdAt ?? input.recordedAt,
    captureSource: input.captureSource ?? 'phone',
    sourcePlatform: input.sourcePlatform ?? 'echo-atlas',
    sourceUrl: input.sourceUrl,
    attribution: input.attribution,
    seedType: input.seedType ?? 'hero',
    cityId: input.cityId,
    coordinate: input.coordinate,
    sourceType: input.sourceType ?? 'user_recording',
    memoryRelation: input.memoryRelation ?? ['lived_here'],
    density: input.density ?? 0.68,
    aiDescription: input.aiDescription ?? `${input.tags.join('、')}在空间中形成清晰层次，留下接近现场的城市声场。`,
    echoMessage: input.echoMessage ?? input.memoryText,
  };
}

const citySeedThemes: Record<string, Array<{ place: string; tag: string; mood: string }>> = {
  tokyo: [
    { place: 'Shibuya crossing', tag: '人行横道', mood: '流动' },
    { place: 'Yanaka lane', tag: '巷子', mood: '安静' },
    { place: 'Kanda shrine', tag: '神社', mood: '清晨' },
    { place: 'Shinjuku rain', tag: '雨', mood: '潮湿' },
  ],
  shanghai: [
    { place: '静安寺街角', tag: '街道', mood: '明亮' },
    { place: '苏州河岸', tag: '河边', mood: '缓慢' },
    { place: '菜市场入口', tag: '市场', mood: '热闹' },
    { place: '梧桐树下', tag: '雨声', mood: '熟悉' },
  ],
  beijing: [
    { place: '什刹海边', tag: '公园', mood: '开阔' },
    { place: '鼓楼胡同', tag: '胡同', mood: '日常' },
    { place: '二号线站台', tag: '地铁', mood: '移动' },
    { place: '北海风里', tag: '风', mood: '清醒' },
  ],
  singapore: [
    { place: 'Tiong Bahru', tag: '街区', mood: '潮湿' },
    { place: 'Maxwell centre', tag: '食阁', mood: '热闹' },
    { place: 'East Coast rain', tag: '热带雨', mood: '松弛' },
    { place: 'MRT platform', tag: 'MRT', mood: '流动' },
  ],
  berlin: [
    { place: 'Kreuzberg corner', tag: '街道', mood: '夜晚' },
    { place: 'Volkspark night', tag: '公园', mood: '安静' },
    { place: 'U-Bahn entrance', tag: 'U-Bahn', mood: '移动' },
    { place: 'Neukölln rain', tag: '雨', mood: '潮湿' },
  ],
  'new-york': [
    { place: 'Brooklyn avenue', tag: '街道', mood: '流动' },
    { place: 'Washington Square', tag: '公园', mood: '开阔' },
    { place: 'East Village rain', tag: '雨', mood: '夜晚' },
    { place: '14th Street station', tag: '地铁', mood: '移动' },
  ],
};

function createAmbientSeedMemories() {
  return Object.entries(citySeedThemes).flatMap(([cityId, themes]) => {
    const city = cities.find((item) => item.id === cityId);
    if (!city) return [];
    return Array.from({ length: 12 }, (_, index) => {
      const theme = themes[index % themes.length];
      const angle = index * 2.39996 + cityId.length;
      const distance = 0.012 + ((index * 17) % 9) * 0.006;
      const longitudeScale = Math.max(0.62, Math.cos(city.center[1] * Math.PI / 180));
      const coordinate: [number, number] = [
        city.center[0] + Math.cos(angle) * distance / longitudeScale,
        city.center[1] + Math.sin(angle) * distance * 0.72,
      ];
      return memory({
        id: `ambient-${cityId}-${index + 1}`,
        cityId,
        title: `${theme.place} · ambient ${String(index + 1).padStart(2, '0')}`,
        location: theme.place,
        coordinate,
        recordedAt: `202${index % 6}-0${(index % 9) + 1}-1${index % 8}T${String(7 + index).padStart(2, '0')}:2${index}:00`,
        contributor: 'Echo Atlas field layer',
        ownerId: 'public-ambient',
        visibility: 'public',
        tags: [theme.tag, 'ambient'],
        moods: [theme.mood],
        memoryText: `A small layer of ${theme.tag} around ${theme.place}.`,
        durationSeconds: 24 + (index % 5) * 7,
        seedType: 'ambient',
      });
    });
  });
}

export const soundMemories: SoundMemory[] = [
  memory({
    id: 'bus-stop-rain-night', cityId: 'shanghai', title: '《等待七分钟》',
    location: '淮海中路雨夜公交站', coordinate: [121.483, 31.229], recordedAt: '2026-08-04T22:41:00',
    contributor: 'Ming · 手机录音', tags: ['雨声', '公交', '夜晚'], moods: ['孤独', '明亮', '等待'],
    memoryText: '我也在这里等过雨。', memoryRelation: ['miss_this_place', 'lived_here'], density: 0.88,
    durationSeconds: 47, hasImage: true, isMine: true, captureSource: 'echo-device', createdAt: '2026-08-25T21:12:00',
    aiDescription: '雨水落在站牌顶棚，公交车靠站时短促泄气，湿路面把人声反射得很近。',
  }),
  memory({
    id: 'suzhou-creek-under-bridge', cityId: 'shanghai', title: '桥洞下的慢水',
    location: '苏州河桥下', coordinate: [121.461, 31.247], recordedAt: '2026-05-18T22:10:00',
    contributor: 'You', tags: ['水声', '桥洞', '夜间回响'], moods: ['安静', '潮湿', '熟悉'],
    memoryText: '住在河边的第三年，我终于能从水声里分辨季节。', density: 0.74,
    durationSeconds: 64, hasImage: true, isMine: true, createdAt: '2026-08-09T18:30:00',
    aiDescription: '缓慢水流贴着桥墩移动，远处车轮经过时像一层短暂的金属薄雾。',
  }),
  memory({
    id: 'plane-tree-rain', cityId: 'shanghai', title: '梧桐叶接住雨',
    location: '武康路梧桐树下', coordinate: [121.441, 31.207], recordedAt: '2025-09-21T16:42:00',
    contributor: 'Aya', tags: ['雨声', '梧桐', '脚步'], moods: ['柔软', '想念'],
    memoryText: '离开上海以后，才发现细雨落在梧桐叶上有自己的节奏。', durationSeconds: 38, hasImage: true,
  }),
  memory({
    id: 'shanghai-last-metro', cityId: 'shanghai', title: '末班车关门以前',
    location: '人民广场地铁站', coordinate: [121.475, 31.238], recordedAt: '2026-07-14T23:48:00',
    contributor: 'You', tags: ['地铁', '报站', '末班车'], moods: ['疲惫', '安稳'],
    memoryText: '那段加班的日子，我总能从这句报站里听见回家的方向。', density: 0.9,
    durationSeconds: 51, isMine: true, createdAt: '2026-08-10T08:40:00',
  }),
  memory({
    id: 'shanghai-market-morning', cityId: 'shanghai', title: '清晨第一把青菜',
    location: '乌中市集附近', coordinate: [121.446, 31.211], recordedAt: '2026-08-10T06:18:00',
    contributor: 'Chen', tags: ['菜市场', '叫卖', '塑料袋'], moods: ['鲜活', '日常'],
    memoryText: '小时候我不喜欢早起，现在却会为了这些声音绕路过来。', density: 0.94, durationSeconds: 72,
  }),
  memory({
    id: 'shanghai-park-insects', cityId: 'shanghai', title: '公园熄灯之后',
    location: '复兴公园', coordinate: [121.466, 31.218], recordedAt: '2024-08-02T21:36:00',
    contributor: 'Luo', tags: ['昆虫', '树叶', '远处人声'], moods: ['幽静', '夏夜'],
    memoryText: '城市安静下来以后，虫声反而让夜晚显得更大。', sourceType: 'authentic_archive', durationSeconds: 83,
  }),
  memory({
    id: 'longtang-life', cityId: 'shanghai', title: '弄堂午后',
    location: '静安老弄堂', coordinate: [121.455, 31.234], recordedAt: '1994-10-02T13:24:00',
    contributor: '家庭录音带片段', tags: ['弄堂', '收音机', '邻里'], moods: ['亲密', '温热', '旧日'],
    memoryText: '搬走很多年后，家里人仍会模仿隔壁叫我吃饭的语气。',
    sourceType: 'authentic_archive', memoryRelation: ['lived_here', 'miss_this_place'], durationSeconds: 95,
  }),
  memory({
    id: 'shanghai-cycling-street', cityId: 'shanghai', title: '骑过晚高峰的缝隙',
    location: '陕西南路', coordinate: [121.459, 31.215], recordedAt: '2025-11-08T18:04:00',
    contributor: 'Nian', tags: ['骑行', '车铃', '街道'], moods: ['流动', '轻快'],
    memoryText: '我记不清那天去哪里，只记得车铃和风把拥堵切开了一条路。', durationSeconds: 44,
  }),
  memory({
    id: 'huangpu-night-wind', cityId: 'shanghai', title: '江边夜风没有字幕',
    location: '黄浦江北外滩', coordinate: [121.507, 31.249], recordedAt: '2026-06-12T21:26:00',
    contributor: 'You', tags: ['江风', '轮船', '滨水'], moods: ['开阔', '清醒'],
    memoryText: '那晚没有发生什么，但我在风里站了很久。', density: 0.72, durationSeconds: 58, hasImage: true, isMine: true,
  }),

  memory({
    id: 'kreuzberg-winter-night', cityId: 'berlin', title: '《Kreuzberg冬夜》',
    location: 'Kreuzberg 运河边', coordinate: [13.435, 52.498], recordedAt: '2024-12-14T23:48:00',
    contributor: 'You · 手机录音', tags: ['冬夜', '运河', '自行车'], moods: ['想念', '寒冷', '缓慢'],
    memoryText: '那天我最后一次从这里走回去。', memoryRelation: ['miss_this_place'], durationSeconds: 61, hasImage: true,
    isMine: true, createdAt: '2026-07-18T20:14:00',
  }),
  memory({
    id: 'berlin-ubahn-arrival', cityId: 'berlin', title: 'U-Bahn 进站的风',
    location: 'Schönleinstraße U-Bahn', coordinate: [13.422, 52.493], recordedAt: '2024-12-15T00:16:00',
    contributor: 'Ming · Echo device', ownerId: MING_USER_ID, tags: ['列车', '广播', '脚步', '冬天'], moods: ['清醒', '匆忙', '寒冷'],
    memoryText: '冬天最冷的时候，我每天从这个出口回家。', density: 0.86,
    durationSeconds: 39, hasImage: true, captureSource: 'echo-device', createdAt: '2026-08-26T16:18:00',
  }),
  memory({
    id: 'berlin-spati-chat', cityId: 'berlin', title: 'Späti 门口的半小时',
    location: 'Weserstraße Späti', coordinate: [13.443, 52.489], recordedAt: '2024-12-15T01:37:00',
    contributor: 'You · 手机录音', tags: ['玻璃瓶', '店门', '街头聊天'], moods: ['松弛', '亲近'],
    memoryText: '凌晨一点以后，这里反而开始热闹。', durationSeconds: 76, hasImage: true,
    isMine: true, createdAt: '2026-07-18T20:10:00',
  }),
  memory({
    id: 'berlin-rain-street', cityId: 'berlin', title: '雨落在石板路上',
    location: 'Oranienstraße', coordinate: [13.421, 52.502], recordedAt: '2024-10-19T20:41:00',
    contributor: 'Jonas', tags: ['雨夜', '石板路', '电车'], moods: ['冷静', '孤独'],
    memoryText: '那条路没有变，是我已经不住在附近了。', durationSeconds: 49, hasImage: true,
  }),
  memory({
    id: 'tempelhof-open-field', cityId: 'berlin', title: '跑道尽头的风',
    location: 'Tempelhofer Feld', coordinate: [13.403, 52.473], recordedAt: '2026-04-09T18:12:00',
    contributor: 'Mara', tags: ['风', '旧机场', '轮滑'], moods: ['开阔', '自由'],
    memoryText: '我在这里学会独自生活，也学会把没有安排的下午留给风。', durationSeconds: 68,
  }),
  memory({
    id: 'berlin-courtyard-snow', cityId: 'berlin', title: '雪落进后院',
    location: 'Neukölln 后院', coordinate: [13.429, 52.481], recordedAt: '2023-01-28T21:14:00',
    contributor: 'Anke', tags: ['冬天', '积雪', '窗户'], moods: ['安静', '想念'],
    memoryText: '搬走以后，我还是会在下雪时想起这座后院突然安静下来的声音。',
    memoryRelation: ['miss_this_place'], durationSeconds: 54,
  }),

  memory({
    id: 'beijing-first-arrival', cityId: 'beijing', title: '第一次到达',
    location: '北京站出站口', coordinate: [116.427, 39.903], recordedAt: '2013-08-27T07:16:00',
    contributor: 'Qiao', tags: ['火车站', '广播', '行李轮'], moods: ['陌生', '紧张', '期待'],
    memoryText: '我对北京一无所知，只记得出站时人群很快，自己的箱子一直向左偏。', memoryRelation: ['first_arrival'], density: 0.9,
  }),
  memory({
    id: 'beijing-hutong-breakfast', cityId: 'beijing', title: '胡同早餐刚出锅',
    location: '东四胡同', coordinate: [116.417, 39.925], recordedAt: '2026-08-10T07:24:00',
    contributor: 'You', tags: ['胡同', '早餐', '自行车铃'], moods: ['温热', '熟悉'],
    memoryText: '离开家以后，我总用油锅和自行车铃判断早晨有没有真正开始。',
    durationSeconds: 57, hasImage: true, isMine: true, createdAt: '2026-08-10T09:05:00',
  }),
  memory({
    id: 'beijing-subway-transfer', cityId: 'beijing', title: '换乘通道里的潮汐',
    location: '西直门地铁站', coordinate: [116.355, 39.94], recordedAt: '2026-01-23T18:32:00',
    contributor: 'Ke', tags: ['地铁', '换乘', '脚步'], moods: ['密集', '机械'],
    memoryText: '在这里生活久了，会顺着脚步声提前知道人群要转向哪边。', density: 0.96, durationSeconds: 45,
  }),
  memory({
    id: 'beijing-night-street', cityId: 'beijing', title: '夜晚街道还没有睡',
    location: '鼓楼东大街', coordinate: [116.403, 39.943], recordedAt: '2025-10-05T23:08:00',
    contributor: 'Fei', tags: ['夜街', '电动车', '店门'], moods: ['松弛', '清醒'],
    memoryText: '白天的北京太快，只有夜里我能听见店门一扇扇关上。', durationSeconds: 66,
  }),
  memory({
    id: 'beijing-courtyard-archive', cityId: 'beijing', title: '煤炉熄灭以前',
    location: '东四老院子', coordinate: [116.414, 39.927], recordedAt: '1996-01-19T19:05:00',
    contributor: '家庭录像声音转录', tags: ['院子', '冬天', '金属声'], moods: ['克制', '怀旧'],
    memoryText: '院子已经改建了，但奶奶收煤夹时那一下金属碰撞，我一直认得。', sourceType: 'authentic_archive', durationSeconds: 88,
  }),

  memory({
    id: 'singapore-tropical-rain', cityId: 'singapore', title: 'Tropical rain arrives',
    location: 'Tiong Bahru 组屋走廊', coordinate: [103.828, 1.285], recordedAt: '2026-07-06T16:28:00',
    contributor: 'You', tags: ['tropical rain', '组屋', '走廊'], moods: ['明亮', '重新开始'],
    memoryText: '搬来的第六天，我还不认识邻居，但已经知道雨会从哪一侧飘进来。', memoryRelation: ['new_beginning'],
    durationSeconds: 53, hasImage: true, isMine: true, createdAt: '2026-08-06T11:20:00',
  }),
  memory({
    id: 'singapore-mrt', cityId: 'singapore', title: 'MRT doors closing',
    location: 'Tanjong Pagar MRT', coordinate: [103.845, 1.276], recordedAt: '2026-02-16T08:43:00',
    contributor: 'Ravi', tags: ['MRT', '提示音', '通勤'], moods: ['秩序', '清醒'],
    memoryText: '新的工作从每天听懂这段提示音开始。', durationSeconds: 35,
  }),
  memory({
    id: 'singapore-night-neighbourhood', cityId: 'singapore', title: '夜间街区的风扇声',
    location: 'Geylang 夜间街区', coordinate: [103.883, 1.313], recordedAt: '2025-12-18T23:34:00',
    contributor: 'Mei', tags: ['夜间街区', '风扇', '餐馆'], moods: ['热闹', '夜归'],
    memoryText: '工作结束得再晚，这条街总还有人在吃饭。', density: 0.91, durationSeconds: 71,
  }),
  memory({
    id: 'singapore-park-insects', cityId: 'singapore', title: '雨林边缘的夜虫',
    location: 'MacRitchie Reservoir Park', coordinate: [103.818, 1.344], recordedAt: '2024-06-28T20:12:00',
    contributor: 'Noor', tags: ['昆虫', '公园', '水边'], moods: ['幽深', '潮湿'],
    memoryText: '第一次听见这里的夜晚，我以为某种机器没有关。', durationSeconds: 92,
  }),
  memory({
    id: 'singapore-hawker-memory', cityId: 'singapore', title: '替我留一张桌子',
    location: '旧巴刹', coordinate: [103.85, 1.28], recordedAt: '2016-05-11T19:32:00',
    contributor: 'Mei', tags: ['食阁', '餐具', '多语言交谈'], moods: ['热闹', '相聚'],
    memoryText: '那几年我们没有固定的家，但每周三总能在这里找到彼此。', sourceType: 'authentic_archive', durationSeconds: 79,
  }),

  // Ming's personal collection: some entries are shared only with followers.
  memory({ id: 'ming-canal-dawn', cityId: 'berlin', title: '运河结冰以前', location: 'Landwehrkanal', coordinate: [13.429, 52.496], recordedAt: '2025-01-09T07:18:00', contributor: 'Ming', ownerId: MING_USER_ID, visibility: 'followers', tags: ['运河', '薄冰', '清晨'], moods: ['冷', '清醒'], memoryText: '天亮以前，水鸟先试探了那层很薄的冰。', durationSeconds: 58, hasImage: true }),
  memory({ id: 'ming-kotti-crossing', cityId: 'berlin', title: 'Kotti 之后的脚步', location: 'Kottbusser Tor', coordinate: [13.418, 52.499], recordedAt: '2025-02-22T22:08:00', contributor: 'Ming', ownerId: MING_USER_ID, tags: ['脚步', 'U-Bahn', '夜晚'], moods: ['流动', '熟悉'], memoryText: '我闭着眼也知道哪一段台阶快走完了。', durationSeconds: 44 }),
  memory({ id: 'ming-berlin-window-rain', cityId: 'berlin', title: '窗台上的二月雨', location: 'Graefekiez', coordinate: [13.416, 52.492], recordedAt: '2024-02-17T19:42:00', contributor: 'Ming', ownerId: MING_USER_ID, visibility: 'followers', tags: ['雨', '窗台', '室内'], moods: ['想念', '安静'], memoryText: '那间房很小，雨声却让它听起来像一个完整的世界。', durationSeconds: 72 }),
  memory({ id: 'ming-shanghai-ferry', cityId: 'shanghai', title: '回上海的第一班轮渡', location: '东昌路渡口', coordinate: [121.506, 31.238], recordedAt: '2026-04-04T06:36:00', contributor: 'Ming', ownerId: MING_USER_ID, tags: ['轮渡', '江面', '归来'], moods: ['熟悉', '迟疑'], memoryText: '离开太久以后，汽笛比街名更早让我认出上海。', durationSeconds: 63, hasImage: true }),
  memory({ id: 'ming-beijing-snow', cityId: 'beijing', title: '雪落在二环里', location: '雍和宫大街', coordinate: [116.417, 39.949], recordedAt: '2025-12-12T21:11:00', contributor: 'Ming', ownerId: MING_USER_ID, tags: ['雪', '车轮', '夜路'], moods: ['克制', '遥远'], memoryText: '车流慢下来以后，终于听见雪擦过外套。', durationSeconds: 49 }),
  memory({ id: 'singapore-storm-rooftops', cityId: 'singapore', title: '午后雷声越过屋顶', location: 'Joo Chiat', coordinate: [103.902, 1.31], recordedAt: '2026-03-26T15:03:00', contributor: 'Open Archive', ownerId: 'public-archive', tags: ['雷雨', '屋檐', '午后'], moods: ['突然', '明亮'], memoryText: '雷声到来前，整条街先安静了几秒。', durationSeconds: 55 }),

  // Aya's field notes across cities.
  memory({ id: 'aya-shanghai-laundry', cityId: 'shanghai', title: '晾衣杆碰到窗框', location: '永康路', coordinate: [121.459, 31.212], recordedAt: '2025-05-13T10:17:00', contributor: 'Aya', ownerId: AYA_USER_ID, tags: ['窗框', '弄堂', '上午'], moods: ['细小', '亲密'], memoryText: '我在陌生城市里记住的，常常是别人没有留意的小声音。', durationSeconds: 38 }),
  memory({ id: 'aya-berlin-tram', cityId: 'berlin', title: '转弯时的电车轨道', location: 'Alexanderplatz', coordinate: [13.414, 52.521], recordedAt: '2024-11-03T17:28:00', contributor: 'Aya', ownerId: AYA_USER_ID, visibility: 'followers', tags: ['电车', '轨道', '黄昏'], moods: ['金属', '移动'], memoryText: '轨道摩擦的高音，在广场转弯处停留得特别久。', durationSeconds: 46 }),
  memory({ id: 'aya-beijing-bell', cityId: 'beijing', title: '钟楼旁的鸽哨', location: '钟鼓楼广场', coordinate: [116.395, 39.94], recordedAt: '2023-10-18T09:31:00', contributor: 'Aya', ownerId: AYA_USER_ID, tags: ['鸽哨', '风', '广场'], moods: ['辽阔', '轻'], memoryText: '看不见鸟的时候，声音先从屋顶上方绕了过去。', durationSeconds: 61, hasImage: true }),
  memory({ id: 'aya-singapore-covered-walkway', cityId: 'singapore', title: '雨沿着连廊移动', location: 'Queenstown', coordinate: [103.805, 1.294], recordedAt: '2026-01-21T14:52:00', contributor: 'Aya', ownerId: AYA_USER_ID, visibility: 'followers', tags: ['雨', '连廊', '脚步'], moods: ['潮湿', '有序'], memoryText: '每个人都在躲雨，脚步却像一起排练过。', durationSeconds: 67 }),
  memory({ id: 'aya-tokyo-rain', cityId: 'tokyo', title: '东京雨停前的站台', location: 'Koenji Station', locationCity: 'Tokyo', locationCountry: 'Japan', coordinate: [139.649, 35.706], recordedAt: '2026-08-19T20:42:00', contributor: 'Aya · Echo device', ownerId: AYA_USER_ID, visibility: 'public', captureSource: 'echo-device', tags: ['Tokyo', 'rain', '站台', '晚归'], moods: ['安静', '潮湿', '想念'], memoryText: '雨还没有停，站台上的人已经开始把伞收起来了。', durationSeconds: 74, hasImage: true, createdAt: '2026-08-27T09:14:00' }),

  // Additional public records make Explore feel inhabited without duplicating personal archives.
  memory({ id: 'public-shanghai-ferry-horn', cityId: 'shanghai', title: '雾里的渡轮汽笛', location: '杨浦滨江', coordinate: [121.542, 31.267], recordedAt: '2022-12-06T06:48:00', contributor: 'Open Archive', tags: ['汽笛', '雾', '江边'], moods: ['遥远', '低沉'], memoryText: '看不清对岸的时候，只能靠汽笛判断船走到了哪里。', durationSeconds: 69 }),
  memory({ id: 'public-berlin-market', cityId: 'berlin', title: '市场收摊时', location: 'Maybachufer', coordinate: [13.432, 52.493], recordedAt: '2021-06-18T18:46:00', contributor: 'Jonas', ownerId: 'jonas', tags: ['市场', '推车', '河边'], moods: ['日常', '松弛'], memoryText: '最后一辆推车离开以后，河边才重新属于风。', durationSeconds: 57 }),
  memory({ id: 'public-singapore-hawker-cleanup', cityId: 'singapore', title: '食阁熄灯以后', location: 'Maxwell Food Centre', coordinate: [103.844, 1.28], recordedAt: '2023-03-15T22:38:00', contributor: 'Noor', ownerId: 'noor', tags: ['餐具', '清洁', '卷帘门'], moods: ['收尾', '清晰'], memoryText: '最后的声音不是聊天，而是椅子一张张回到桌下。', durationSeconds: 64 }),
  memory({ id: 'public-singapore-water-edge', cityId: 'singapore', title: '水库边的一阵风', location: 'Lower Peirce Reservoir', coordinate: [103.825, 1.37], recordedAt: '2024-09-08T18:19:00', contributor: 'Noor', ownerId: 'noor', visibility: 'followers', locationPrivacy: 'approximate', tags: ['水边', '风', '树林'], moods: ['缓慢', '隐秘'], memoryText: '我没有保存准确位置，只记得风从水面过来。', durationSeconds: 76 }),
  memory({ id: 'tokyo-station-platform', cityId: 'tokyo', title: '站台灯亮起来以后', location: 'Shinjuku Station', coordinate: [139.7006, 35.6896], recordedAt: '2025-11-02T18:12:00', contributor: 'Aya', ownerId: AYA_USER_ID, visibility: 'public', tags: ['station', 'train', 'platform'], moods: ['流动', '清醒'], memoryText: '人群散开以后，广播声在站台上留下很短的回音。', durationSeconds: 64, seedType: 'hero' }),
  memory({ id: 'tokyo-shrine-quiet', cityId: 'tokyo', title: '神社门口的雨', location: 'Kanda Shrine', coordinate: [139.7671, 35.702,], recordedAt: '2024-06-16T06:42:00', contributor: 'Open Archive', visibility: 'public', tags: ['shrine', 'rain', 'morning'], moods: ['安静', '潮湿'], memoryText: '雨把石阶擦得发亮，远处的电车仍然准时经过。', durationSeconds: 51, seedType: 'hero' }),
  memory({ id: 'new-york-subway-doors', cityId: 'new-york', title: '车门合上之前', location: '14th Street Station', coordinate: [-73.996, 40.737], recordedAt: '2025-03-09T23:18:00', contributor: 'Open Archive', visibility: 'public', tags: ['subway', 'station', 'night'], moods: ['紧张', '移动'], memoryText: '门边的提示音响了三次，整列车才终于安静下来。', durationSeconds: 59, seedType: 'hero' }),
  memory({ id: 'new-york-avenue-rain', cityId: 'new-york', title: '雨里的第七大道', location: 'Seventh Avenue', coordinate: [-73.994, 40.744], recordedAt: '2024-10-22T20:37:00', contributor: 'Mara', ownerId: 'mara', visibility: 'public', tags: ['rain', 'avenue', 'traffic'], moods: ['潮湿', '繁忙'], memoryText: '雨水把出租车的声音拉成长线，街口的人却没有停下来。', durationSeconds: 67, seedType: 'hero' }),
  memory({ id: 'new-york-park-dusk', cityId: 'new-york', title: '公园关灯前', location: 'Washington Square Park', coordinate: [-73.997, 40.7308], recordedAt: '2023-08-14T21:05:00', contributor: 'Mara', ownerId: 'mara', visibility: 'public', tags: ['park', 'crowd', 'dusk'], moods: ['松弛', '相遇'], memoryText: '最后一盏灯亮着的时候，广场上的人声还没有散。', durationSeconds: 73, seedType: 'hero' }),
  ...createAmbientSeedMemories(),
];

export const soundNodes = soundMemories;

export const agentRoutes: AgentRoute[] = [
  {
    id: 'quiet-water-night',
    prompt: '今晚带我听一条安静、有水声、不要太拥挤的上海路线。',
    nodeIds: ['suzhou-creek-under-bridge', 'huangpu-night-wind', 'plane-tree-rain'],
    summary: '从桥洞下的慢水出发，穿过梧桐叶上的细雨，最后在黄浦江边听一阵没有字幕的夜风。',
  },
];

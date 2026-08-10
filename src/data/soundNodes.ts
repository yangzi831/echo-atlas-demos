import type {
  AgentRoute,
  City,
  MemoryRelation,
  SoundNode,
  SoundSourceType,
} from '../types/sound';

export const cities: City[] = [
  { id: 'shanghai', name: 'Shanghai', localName: '上海', country: '中国', center: [121.4737, 31.2304], zoom: 11.7, timeZone: 'Asia/Shanghai' },
  { id: 'berlin', name: 'Berlin', localName: '柏林', country: '德国', center: [13.405, 52.52], zoom: 11.4, timeZone: 'Europe/Berlin' },
  { id: 'beijing', name: 'Beijing', localName: '北京', country: '中国', center: [116.4074, 39.9042], zoom: 11.2, timeZone: 'Asia/Shanghai' },
  { id: 'singapore', name: 'Singapore', localName: '新加坡', country: '新加坡', center: [103.8198, 1.3521], zoom: 11.5, timeZone: 'Asia/Singapore' },
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
};

function memory(input: MemoryInput): SoundNode {
  const city = cities.find((item) => item.id === input.cityId) ?? cities[0];
  return {
    id: input.id,
    cityId: input.cityId,
    city: city.localName,
    country: city.country,
    title: input.title,
    placeName: input.location,
    location: input.location,
    coordinate: input.coordinate,
    recordedAt: input.recordedAt,
    contributor: input.contributor,
    tags: input.tags,
    moods: input.moods,
    memoryText: input.memoryText,
    sourceType: input.sourceType ?? 'user_recording',
    memoryRelation: input.memoryRelation ?? ['lived_here'],
    density: input.density ?? 0.68,
    durationSeconds: input.durationSeconds ?? 42,
    hasImage: input.hasImage ?? false,
    isMine: input.isMine ?? false,
    createdAt: input.createdAt ?? input.recordedAt,
    aiDescription: input.aiDescription ?? `${input.tags.join('、')}在空间中形成清晰层次，留下接近现场的城市声场。`,
    echoMessage: input.echoMessage ?? input.memoryText,
  };
}

export const soundNodes: SoundNode[] = [
  memory({
    id: 'bus-stop-rain-night', cityId: 'shanghai', title: '《等待七分钟》',
    location: '淮海中路雨夜公交站', coordinate: [121.483, 31.229], recordedAt: '2026-08-04T22:41:00',
    contributor: 'Ming · 手机录音', tags: ['雨声', '公交', '夜晚'], moods: ['孤独', '明亮', '等待'],
    memoryText: '我也在这里等过雨。', memoryRelation: ['miss_this_place', 'lived_here'], density: 0.88,
    durationSeconds: 47, hasImage: true, isMine: true, createdAt: '2026-08-08T21:12:00',
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
    contributor: 'Yao', tags: ['江风', '轮船', '滨水'], moods: ['开阔', '清醒'],
    memoryText: '那晚没有发生什么，但我在风里站了很久。', density: 0.72, durationSeconds: 58, hasImage: true,
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
    contributor: 'You · 现场录音', tags: ['列车', '广播', '脚步'], moods: ['清醒', '匆忙'],
    memoryText: '冬天最冷的时候，我每天从这个出口回家。', density: 0.86,
    durationSeconds: 39, hasImage: true, isMine: true, createdAt: '2026-08-04T16:18:00',
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
];

export const agentRoutes: AgentRoute[] = [
  {
    id: 'quiet-water-night',
    prompt: '今晚带我听一条安静、有水声、不要太拥挤的上海路线。',
    nodeIds: ['suzhou-creek-under-bridge', 'huangpu-night-wind', 'plane-tree-rain'],
    summary: '从桥洞下的慢水出发，穿过梧桐叶上的细雨，最后在黄浦江边听一阵没有字幕的夜风。',
  },
];

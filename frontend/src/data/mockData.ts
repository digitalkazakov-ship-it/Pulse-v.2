export const BRANDS = ['BrandX', 'CompA', 'CompB', 'CompC', 'CompD'] as const;
export const CATEGORIES = ['Напитки', 'Молочные продукты', 'Снеки', 'Кондитерские изделия'] as const;
export const CHANNELS = ['Офлайн ритейл', 'E-commerce', 'D2C', 'HoReCa'] as const;
export const REGIONS = ['Москва', 'СПб', 'ЦФО', 'ПФО', 'УФО', 'СФО', 'ЮФО'] as const;
export const MONTHS = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];

export const BRAND_COLORS: Record<string, string> = {
  BrandX: 'hsl(217,91%,60%)',
  CompA: 'hsl(142,76%,36%)',
  CompB: 'hsl(38,92%,50%)',
  CompC: 'hsl(280,65%,60%)',
  CompD: 'hsl(0,84%,60%)',
};

const rand = (min: number, max: number) => Math.round((Math.random() * (max - min) + min) * 10) / 10;

export function generateTrend(base: number, variance: number, count = 12) {
  return MONTHS.slice(0, count).map((month, i) => ({
    month,
    value: Math.round((base + Math.sin(i / 2) * variance + (Math.random() - 0.5) * variance) * 10) / 10,
  }));
}

export function generateBrandTrends(bases: Record<string, number>, variance: number) {
  return MONTHS.map((month, i) => {
    const point: Record<string, string | number> = { month };
    Object.entries(bases).forEach(([brand, base]) => {
      point[brand] = Math.round((base + Math.sin(i / 2 + Object.keys(bases).indexOf(brand)) * variance + (Math.random() - 0.5) * variance) * 10) / 10;
    });
    return point;
  });
}

export const kpiData = [
  { label: 'Brand Awareness', value: 67.3, mom: 2.1, yoy: 5.4, unit: '%', rank: 2 },
  { label: 'Consideration', value: 42.8, mom: -0.5, yoy: 3.2, unit: '%', rank: 3 },
  { label: 'Market Share', value: 18.7, mom: 0.3, yoy: 1.1, unit: '%', rank: 2 },
  { label: 'E-com Share', value: 22.4, mom: 1.8, yoy: 4.6, unit: '%', rank: 1 },
  { label: 'SOV (Share of Voice)', value: 24.1, mom: -1.2, yoy: 2.8, unit: '%', rank: 2 },
  { label: 'NPS', value: 34, mom: 3, yoy: 7, unit: 'pts', rank: 1 },
  { label: 'Avg Price Index', value: 104.2, mom: 0.8, yoy: 2.3, unit: '', rank: 3 },
  { label: 'Distribution', value: 78.5, mom: 0.2, yoy: -1.3, unit: '%', rank: 2 },
];

export const awarenessData = {
  topOfMind: generateBrandTrends({ BrandX: 28, CompA: 22, CompB: 18, CompC: 15, CompD: 12 }, 3),
  spontaneous: generateBrandTrends({ BrandX: 52, CompA: 48, CompB: 35, CompC: 30, CompD: 25 }, 4),
  aided: generateBrandTrends({ BrandX: 78, CompA: 72, CompB: 65, CompC: 58, CompD: 50 }, 3),
  consideration: generateBrandTrends({ BrandX: 43, CompA: 38, CompB: 30, CompC: 28, CompD: 22 }, 4),
  purchase: generateBrandTrends({ BrandX: 25, CompA: 22, CompB: 16, CompC: 15, CompD: 12 }, 3),
  penetrationByAge: [
    { age: '18-24', BrandX: 45, CompA: 38, CompB: 42, CompC: 35, CompD: 28 },
    { age: '25-34', BrandX: 62, CompA: 55, CompB: 48, CompC: 40, CompD: 35 },
    { age: '35-44', BrandX: 58, CompA: 52, CompB: 45, CompC: 42, CompD: 38 },
    { age: '45-54', BrandX: 48, CompA: 50, CompB: 40, CompC: 38, CompD: 42 },
    { age: '55+', BrandX: 35, CompA: 45, CompB: 35, CompC: 32, CompD: 40 },
  ],
  consumptionFrequency: [
    { freq: 'Ежедневно', BrandX: 12, CompA: 8, CompB: 10, CompC: 6, CompD: 5 },
    { freq: '2-3 раза/нед', BrandX: 25, CompA: 22, CompB: 18, CompC: 15, CompD: 12 },
    { freq: '1 раз/нед', BrandX: 20, CompA: 18, CompB: 15, CompC: 18, CompD: 14 },
    { freq: '2-3 раза/мес', BrandX: 18, CompA: 15, CompB: 14, CompC: 12, CompD: 16 },
    { freq: 'Реже', BrandX: 25, CompA: 37, CompB: 43, CompC: 49, CompD: 53 },
  ],
  wordstatTrend: generateBrandTrends({ BrandX: 45000, CompA: 38000, CompB: 28000, CompC: 22000, CompD: 18000 }, 5000),
};

export const perceptionData = {
  assortment: [
    { brand: 'BrandX', positive: 62, neutral: 25, negative: 13 },
    { brand: 'CompA', positive: 55, neutral: 30, negative: 15 },
    { brand: 'CompB', positive: 48, neutral: 32, negative: 20 },
    { brand: 'CompC', positive: 50, neutral: 28, negative: 22 },
    { brand: 'CompD', positive: 42, neutral: 35, negative: 23 },
  ],
  product: [
    { brand: 'BrandX', positive: 68, neutral: 22, negative: 10 },
    { brand: 'CompA', positive: 60, neutral: 25, negative: 15 },
    { brand: 'CompB', positive: 52, neutral: 28, negative: 20 },
    { brand: 'CompC', positive: 55, neutral: 25, negative: 20 },
    { brand: 'CompD', positive: 45, neutral: 30, negative: 25 },
  ],
  price: [
    { brand: 'BrandX', positive: 40, neutral: 35, negative: 25 },
    { brand: 'CompA', positive: 45, neutral: 30, negative: 25 },
    { brand: 'CompB', positive: 55, neutral: 28, negative: 17 },
    { brand: 'CompC', positive: 38, neutral: 32, negative: 30 },
    { brand: 'CompD', positive: 50, neutral: 30, negative: 20 },
  ],
  imageAttributes: [
    { attr: 'Динамичный', BrandX: 72, CompA: 58, CompB: 45, CompC: 60, CompD: 38 },
    { attr: 'Прогрессивный', BrandX: 68, CompA: 52, CompB: 42, CompC: 55, CompD: 35 },
    { attr: 'Молодежный', BrandX: 75, CompA: 48, CompB: 55, CompC: 62, CompD: 30 },
    { attr: 'Желанный', BrandX: 65, CompA: 58, CompB: 48, CompC: 52, CompD: 40 },
    { attr: 'Надежный', BrandX: 60, CompA: 72, CompB: 55, CompC: 48, CompD: 65 },
    { attr: 'Инновационный', BrandX: 70, CompA: 45, CompB: 40, CompC: 58, CompD: 32 },
    { attr: 'Премиальный', BrandX: 55, CompA: 62, CompB: 38, CompC: 50, CompD: 42 },
  ],
  sentimentTrend: generateBrandTrends({ BrandX: 65, CompA: 58, CompB: 50, CompC: 55, CompD: 45 }, 5),
};

const buildMetricTrend = (base: number, variance: number, trendDir: number = 1) => {
  const last6 = MONTHS.slice(-6);
  return last6.map((month, i) => ({
    month,
    BrandX: Math.round((base + trendDir * i * variance * 0.15 + (Math.random() - 0.5) * variance) * 10) / 10,
    CompA: Math.round((base * 0.9 + trendDir * i * variance * 0.1 + (Math.random() - 0.5) * variance) * 10) / 10,
    CompB: Math.round((base * 0.65 + (Math.random() - 0.5) * variance) * 10) / 10,
    CompC: Math.round((base * 0.78 + trendDir * i * variance * 0.08 + (Math.random() - 0.5) * variance) * 10) / 10,
    CompD: Math.round((base * 0.5 + (Math.random() - 0.5) * variance) * 10) / 10,
  }));
};

const trafficSplit = (organic: number, paid: number) => ({ organic, paid, total: organic + paid });

export const digitalData = {
  metrics: [
    { key: 'visits', metric: 'Monthly Visits (M)', BrandX: 4.2, CompA: 3.8, CompB: 2.5, CompC: 3.1, CompD: 1.9, mom: 5.2, yoy: 12.3, trend: buildMetricTrend(4.2, 0.6, 1) },
    { key: 'uniques', metric: 'Unique Visitors (M)', BrandX: 2.8, CompA: 2.5, CompB: 1.7, CompC: 2.1, CompD: 1.3, mom: 3.8, yoy: 8.7, trend: buildMetricTrend(2.8, 0.4, 1) },
    { key: 'pages', metric: 'Pages/Visit', BrandX: 4.5, CompA: 3.8, CompB: 3.2, CompC: 4.1, CompD: 2.9, mom: 1.2, yoy: -2.1, trend: buildMetricTrend(4.5, 0.5, 0) },
    { key: 'duration', metric: 'Avg Duration (min)', BrandX: 3.2, CompA: 2.8, CompB: 2.1, CompC: 2.9, CompD: 1.8, mom: -0.5, yoy: 4.3, trend: buildMetricTrend(3.2, 0.4, 0) },
    { key: 'bounce', metric: 'Bounce Rate (%)', BrandX: 38.5, CompA: 42.1, CompB: 48.3, CompC: 40.2, CompD: 52.7, mom: -2.1, yoy: -5.4, trend: buildMetricTrend(38.5, 3, -1) },
    { key: 'time', metric: 'Time on Site (min)', BrandX: 5.1, CompA: 4.2, CompB: 3.5, CompC: 4.8, CompD: 2.8, mom: 0.8, yoy: 6.2, trend: buildMetricTrend(5.1, 0.6, 1) },
  ],
  visitsTrend: generateBrandTrends({ BrandX: 4200, CompA: 3800, CompB: 2500, CompC: 3100, CompD: 1900 }, 400),
  trafficSourcesDesktop: [
    { source: 'Direct', ...trafficSplit(820, 0) },
    { source: 'Search', ...trafficSplit(1450, 680) },
    { source: 'Display ads', ...trafficSplit(0, 520) },
    { source: 'Social', ...trafficSplit(310, 240) },
    { source: 'Referral', ...trafficSplit(380, 60) },
    { source: 'Mail', ...trafficSplit(210, 90) },
  ],
  trafficSourcesMobile: [
    { source: 'Direct', ...trafficSplit(640, 0) },
    { source: 'Search', ...trafficSplit(1820, 920) },
    { source: 'Display ads', ...trafficSplit(0, 780) },
    { source: 'Social', ...trafficSplit(890, 560) },
    { source: 'Referral', ...trafficSplit(220, 40) },
    { source: 'Mail', ...trafficSplit(140, 70) },
  ],
};

export const availabilityData = {
  ecomRetailers: [
    { retailer: 'Перекрёсток', BrandX: 92, CompA: 88, CompB: 75, CompC: 80, CompD: 70 },
    { retailer: 'Сбермаркет', BrandX: 88, CompA: 85, CompB: 72, CompC: 78, CompD: 65 },
    { retailer: 'Яндекс.Лавка', BrandX: 85, CompA: 80, CompB: 68, CompC: 75, CompD: 60 },
    { retailer: 'Самокат', BrandX: 90, CompA: 82, CompB: 70, CompC: 76, CompD: 62 },
    { retailer: 'Ozon Fresh', BrandX: 82, CompA: 78, CompB: 65, CompC: 72, CompD: 58 },
  ],
  marketplaceShare: [
    { platform: 'Wildberries', BrandX: 18.5, CompA: 15.2, CompB: 12.8, CompC: 14.1, CompD: 10.5 },
    { platform: 'Ozon', BrandX: 22.1, CompA: 18.7, CompB: 14.3, CompC: 16.8, CompD: 12.2 },
    { platform: 'Яндекс.Маркет', BrandX: 15.8, CompA: 13.5, CompB: 10.2, CompC: 12.1, CompD: 8.7 },
  ],
  skuCount: generateBrandTrends({ BrandX: 180, CompA: 150, CompB: 120, CompC: 140, CompD: 95 }, 15),
  revenueTrend: generateBrandTrends({ BrandX: 850, CompA: 720, CompB: 480, CompC: 580, CompD: 350 }, 80),
  salesUnits: generateBrandTrends({ BrandX: 420, CompA: 350, CompB: 230, CompC: 290, CompD: 170 }, 35),
  stockPrice: generateBrandTrends({ BrandX: 195, CompA: 178, CompB: 158, CompC: 170, CompD: 148 }, 8),
  stockUnits: generateBrandTrends({ BrandX: 1250, CompA: 1080, CompB: 760, CompC: 920, CompD: 540 }, 90),
};

export const salesMediaData = {
  priceTrend: generateBrandTrends({ BrandX: 189, CompA: 175, CompB: 155, CompC: 168, CompD: 145 }, 10),
  salesTrend: generateBrandTrends({ BrandX: 1200, CompA: 980, CompB: 650, CompC: 820, CompD: 480 }, 100),
  distributionTrend: generateBrandTrends({ BrandX: 78, CompA: 72, CompB: 58, CompC: 65, CompD: 52 }, 4),
  marketShareTrend: generateBrandTrends({ BrandX: 18.7, CompA: 15.2, CompB: 10.8, CompC: 13.5, CompD: 8.1 }, 2),
  adSpend: [
    { channel: 'ТВ', BrandX: 450, CompA: 380, CompB: 220, CompC: 310, CompD: 180 },
    { channel: 'Радио', BrandX: 85, CompA: 120, CompB: 65, CompC: 90, CompD: 45 },
    { channel: 'Наружка', BrandX: 150, CompA: 130, CompB: 95, CompC: 110, CompD: 70 },
    { channel: 'Digital OLV', BrandX: 280, CompA: 250, CompB: 180, CompC: 220, CompD: 130 },
  ],
  mediaVsSales: BRANDS.map((brand) => ({
    brand,
    mediaSpend: rand(400, 1000),
    salesVolume: rand(500, 1300),
  })),
  adSpendHistory: (() => {
    const last6 = MONTHS.slice(-6);
    const bases: Record<string, number> = { BrandX: 165, CompA: 145, CompB: 90, CompC: 120, CompD: 70 };
    return last6.map((month, i) => {
      const point: Record<string, string | number> = { month };
      Object.entries(bases).forEach(([brand, base], bi) => {
        point[brand] = Math.round(base + Math.sin(i / 1.5 + bi) * 20 + (Math.random() - 0.5) * 15);
      });
      return point;
    });
  })(),
  creatives: [
    { brand: 'BrandX', tv: { image: 7, promo: 5 }, radio: { image: 3, promo: 5 }, outdoor: { image: 9, promo: 6 }, digital: { image: 12, promo: 10 } },
    { brand: 'CompA', tv: { image: 6, promo: 4 }, radio: { image: 7, promo: 5 }, outdoor: { image: 5, promo: 5 }, digital: { image: 10, promo: 8 } },
    { brand: 'CompB', tv: { image: 3, promo: 3 }, radio: { image: 2, promo: 3 }, outdoor: { image: 4, promo: 4 }, digital: { image: 6, promo: 8 } },
    { brand: 'CompC', tv: { image: 5, promo: 3 }, radio: { image: 3, promo: 4 }, outdoor: { image: 7, promo: 5 }, digital: { image: 9, promo: 7 } },
    { brand: 'CompD', tv: { image: 2, promo: 3 }, radio: { image: 2, promo: 2 }, outdoor: { image: 3, promo: 3 }, digital: { image: 4, promo: 6 } },
  ],
  creativeStories: {
    BrandX: {
      tv: [
        '"Утро начинается с нас" — лайфстайл-ролик 30 сек: семья завтракает, продукт в кадре естественно',
        '"−30% на всю линейку" — промо-ролик 15 сек с яркой плашкой и голосом-диктором',
        'Спонсорство шоу "Голос" — интеграция 10 сек с ведущим',
      ],
      radio: [
        'Джингл "БрендX — вкус каждый день" в эфире утреннего шоу',
        'Промо-объявление о скидках в сети "Перекрёсток"',
      ],
      outdoor: [
        'Биллборды на ТТК: имиджевый визуал с продуктом крупным планом',
        'Digital-экраны в БЦ: анимация новой упаковки',
        'Сити-форматы у метро: промо "2 по цене 1"',
      ],
      digital: [
        'YouTube pre-roll 6 сек: тизер новой линейки',
        'VK Видео: серия из 5 коротких сюжетов о потребителях',
        'Programmatic-баннеры на Яндексе с промо-механикой',
        'Influencer-кампания в Telegram (12 блогеров lifestyle)',
      ],
    },
  } as Record<string, Partial<Record<'tv' | 'radio' | 'outdoor' | 'digital', string[]>>>,

};

export const prevImageAttributes = [
  { attr: 'Динамичный',    BrandX: 74, CompA: 55, CompB: 47, CompC: 57, CompD: 41 },
  { attr: 'Прогрессивный', BrandX: 65, CompA: 54, CompB: 44, CompC: 52, CompD: 37 },
  { attr: 'Молодежный',    BrandX: 73, CompA: 51, CompB: 52, CompC: 65, CompD: 33 },
  { attr: 'Желанный',      BrandX: 67, CompA: 56, CompB: 50, CompC: 49, CompD: 43 },
  { attr: 'Надежный',      BrandX: 57, CompA: 75, CompB: 53, CompC: 51, CompD: 61 },
  { attr: 'Инновационный', BrandX: 67, CompA: 47, CompB: 43, CompC: 55, CompD: 35 },
  { attr: 'Премиальный',   BrandX: 58, CompA: 60, CompB: 40, CompC: 47, CompD: 45 },
];

export const alerts = [
  { type: 'positive' as const, text: 'BrandX: Awareness выросла на +5.4 п.п. YoY — лучший результат за 2 года' },
  { type: 'negative' as const, text: 'CompB: Market Share снизилась на -1.8 п.п. MoM' },
  { type: 'positive' as const, text: 'BrandX: E-com revenue +18% MoM — максимум за категорию' },
  { type: 'warning' as const, text: 'CompA: Рост SOV при падении Sales — возможна неэффективность медиа' },
  { type: 'negative' as const, text: 'BrandX: Bounce Rate вырос на 3.2% — требуется UX-аудит' },
  { type: 'positive' as const, text: 'BrandX: NPS лидер категории — 34 pts (+7 YoY)' },
];

function buildAdHistory(bases: Record<string, number>, variance: number) {
  const last6 = MONTHS.slice(-6);
  return last6.map((month, i) => {
    const point: Record<string, string | number> = { month };
    Object.entries(bases).forEach(([brand, base], bi) => {
      point[brand] = Math.round(base + Math.sin(i / 1.5 + bi) * variance + (Math.random() - 0.5) * (variance * 0.75));
    });
    return point;
  });
}

export const adSpendChannelHistory = {
  total:   salesMediaData.adSpendHistory,
  tv:      buildAdHistory({ BrandX: 77, CompA: 63, CompB: 36, CompC: 50, CompD: 30 }, 10),
  radio:   buildAdHistory({ BrandX: 15, CompA: 20, CompB: 11, CompC: 15, CompD:  8 },  3),
  ooh:     buildAdHistory({ BrandX: 26, CompA: 22, CompB: 16, CompC: 18, CompD: 12 },  5),
  digital: buildAdHistory({ BrandX: 48, CompA: 41, CompB: 30, CompC: 36, CompD: 22 },  8),
};

export const insights = [
  'BrandX демонстрирует устойчивый рост awareness при стабильном медиадавлении — органический рост бренда.',
  'Корреляция media spend / sales у CompA ниже среднего — рекомендуется аудит медиамикса.',
  'E-com канал растёт быстрее офлайна: +18% vs +3% MoM. Рекомендуется перераспределение бюджета.',
  'Perception gap: BrandX лидирует по "инновационность", но уступает CompA по "надёжность".',
  'SKU proliferation: BrandX добавил 12 SKU за квартал — риск каннибализации.',
];

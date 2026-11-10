// Menu, recipes and item helpers. An item in the barista's hand is one of:
//   { type: 'portafilter' }
//   { type: 'cup', water, milk (0..2), choco, ice }
//   { type: 'raw', what: 'bread' | 'bacon' | 'patty' }
//   { type: 'food', parts: ['toast' | 'bacon' | 'cheese' | 'bun' | 'patty', ...] }
//   { type: 'trash' }

export const MENU = [
  { id: 'espresso', name: 'اسپرسو', icon: '☕', price: 30, day: 1, cup: {}, steps: 'آسیاب ← دستگاه اسپرسو' },
  { id: 'americano', name: 'آمریکانو', icon: '☕', price: 35, day: 1, cup: { water: 1 }, steps: 'اسپرسو + آب جوش' },
  { id: 'latte', name: 'لاته', icon: '🥛', price: 45, day: 1, cup: { milk: 1 }, steps: 'اسپرسو + شیر' },
  { id: 'toast', name: 'تست', icon: '🍞', price: 25, day: 1, food: ['toast'], steps: 'نان ← توستر' },
  { id: 'bacon_toast', name: 'تست بیکن', icon: '🥓', price: 55, day: 1, food: ['toast', 'bacon'], steps: 'تست + بیکنِ سرخ‌شده' },
  { id: 'cappuccino', name: 'کاپوچینو', icon: '☕', price: 50, day: 2, cup: { milk: 2 }, steps: 'اسپرسو + شیر + شیر (دو بار)' },
  { id: 'mocha', name: 'موکا', icon: '🍫', price: 55, day: 2, cup: { milk: 1, choco: 1 }, steps: 'اسپرسو + شیر + شکلات' },
  { id: 'cheese_toast', name: 'تست پنیر', icon: '🧀', price: 40, day: 2, food: ['toast', 'cheese'], steps: 'تست + پنیر' },
  { id: 'iced_latte', name: 'آیس لاته', icon: '🧊', price: 55, day: 3, cup: { milk: 1, ice: 1 }, steps: 'اسپرسو + شیر + یخ' },
  { id: 'iced_americano', name: 'آیس آمریکانو', icon: '🧊', price: 45, day: 3, cup: { water: 1, ice: 1 }, steps: 'اسپرسو + آب + یخ' },
  { id: 'burger', name: 'برگر', icon: '🍔', price: 70, day: 3, food: ['bun', 'patty'], steps: 'نان برگر + گوشتِ سرخ‌شده' },
  { id: 'cheeseburger', name: 'چیزبرگر', icon: '🍔', price: 85, day: 3, food: ['bun', 'patty', 'cheese'], steps: 'برگر + پنیر' },
];

const cupKey = (c) => `cup:w${c.water || 0}m${c.milk || 0}c${c.choco || 0}i${c.ice || 0}`;
const foodKey = (parts) => 'food:' + [...parts].sort().join('+');

export function itemKey(item) {
  if (!item) return '';
  if (item.type === 'cup') return cupKey(item);
  if (item.type === 'food') return foodKey(item.parts);
  return item.type + ':' + (item.what || '');
}

for (const m of MENU) m.key = m.cup ? cupKey(m.cup) : foodKey(m.food);
const BY_KEY = new Map(MENU.map((m) => [m.key, m]));

export const menuFor = (item) => BY_KEY.get(itemKey(item));
export const menuForDay = (day) => MENU.filter((m) => m.day <= day);

const PART_NAMES = { toast: 'تست', bacon: 'بیکن', cheese: 'پنیر', bun: 'نان برگر', patty: 'گوشت' };
const RAW_NAMES = { bread: 'نان خام', bacon: 'بیکن خام', patty: 'گوشت خام' };

export function describe(item) {
  if (!item) return 'دست خالی';
  const m = menuFor(item);
  if (m) return `${m.icon} ${m.name}`;
  if (item.type === 'portafilter') return '⚙️ پورتافیلتر پر از قهوه';
  if (item.type === 'raw') return RAW_NAMES[item.what];
  if (item.type === 'trash') return '🔥 سوخته!';
  if (item.type === 'food') return '🍽️ ' + item.parts.map((p) => PART_NAMES[p]).join(' + ');
  return '❓ نوشیدنی عجیب (تو منو نیست)';
}

export const fa = (n) => Math.round(n).toLocaleString('fa-IR');

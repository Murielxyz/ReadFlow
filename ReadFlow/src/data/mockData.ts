// ============================================================
// 每日名言 — 根据日期索引轮换
// ============================================================

export const MOCK_QUOTES = [
  {
    text: '读书是通往世界的窗口，也是通往内心的镜子。',
    author: '莫言',
  },
  {
    text: '一本书就是一个世界，每次阅读都是一次旅行。',
    author: '村上春树',
  },
  {
    text: '阅读是灵魂的避难所，是思想的健身房。',
    author: '毛姆',
  },
  {
    text: '不读书的人只活了一次，读书的人活了上千次。',
    author: 'George R.R. Martin',
  },
  {
    text: '读一本好书，就是和许多高尚的人谈话。',
    author: '歌德',
  },
  {
    text: '书籍是屹立在时间的汪洋大海中的灯塔。',
    author: '惠普尔',
  },
  {
    text: '读书不是为了雄辩和驳斥，而是为了思考和权衡。',
    author: '培根',
  },
  {
    text: '读书破万卷，下笔如有神。',
    author: '杜甫',
  },
  {
    text: '好书是伟大心灵的宝贵血脉。',
    author: '弥尔顿',
  },
  {
    text: '读书是在别人思想的帮助下，建立起自己的思想。',
    author: '鲁巴金',
  },
  {
    text: '读史使人明智，读诗使人灵秀。',
    author: '培根',
  },
  {
    text: '书籍是朋友，虽然没有热情，但是非常忠实。',
    author: '雨果',
  },
  {
    text: '书到用时方恨少，事非经过不知难。',
    author: '陆游',
  },
  {
    text: '读书给人以快乐、给人以光彩、给人以才干。',
    author: '培根',
  },
];

/** 根据今天的日期获取每日名言（每天固定一条，同一天所有用户看到同一条） */
export function getDailyQuote() {
  const now = new Date();
  const dayOfYear = Math.floor(
    (now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24),
  );
  return MOCK_QUOTES[dayOfYear % MOCK_QUOTES.length];
}

/**
 * 书籍搜索服务
 *
 * 优先使用 Google Books API（中文支持好），
 * 未配置 API Key 或请求失败时回退到 OpenLibrary。
 */

// ============================================================
// 配置
// ============================================================

/** Google Books API Key — 免费申请: https://console.cloud.google.com/apis/library/books.googleapis.com */
export const GOOGLE_BOOKS_API_KEY = 'AIzaSyDR0uSOlrHYbx5aar5tMDo9w4otTNLK4Ng';

// ============================================================
// 类型定义
// ============================================================

/** 搜索结果 */
export interface SearchResult {
  /** 唯一标识（Google volume ID 或 OpenLibrary key） */
  key: string;
  title: string;
  author: string | null;
  coverUrl: string | null;
  publishYear: number | null;
  isbn: string | null;
  description: string | null;
  publisher: string | null;
  /** 评分（仅 Google Books 返回），0-5 */
  rating: number | null;
  /** 页数 */
  pageCount: number | null;
}

/** 热门推荐（静态精选） */
export interface RecommendedBook {
  title: string;
  author: string;
  coverUrl: string | null;
  description: string;
  accentColor: string;
}

// ============================================================
// OpenLibrary API 类型（回退用）
// ============================================================

interface OpenLibraryDoc {
  key: string;
  title: string;
  author_name?: string[];
  first_publish_year?: number;
  isbn?: string[];
  cover_i?: number;
  first_sentence?: string[];
  subtitle?: string;
}

interface OpenLibrarySearchResponse {
  numFound: number;
  docs: OpenLibraryDoc[];
}

// ============================================================
// Google Books API 类型
// ============================================================

interface GoogleBooksVolume {
  id: string;
  volumeInfo: {
    title: string;
    authors?: string[];
    publisher?: string;
    publishedDate?: string;
    description?: string;
    averageRating?: number;
    imageLinks?: {
      thumbnail?: string;
    };
    industryIdentifiers?: Array<{
      type: string;
      identifier: string;
    }>;
  };
}

interface GoogleBooksResponse {
  items?: GoogleBooksVolume[];
  totalItems: number;
}

// ============================================================
// 主搜索函数
// ============================================================

/**
 * 搜索书籍
 * @param query 搜索关键词（书名/作者/ISBN）
 * @param limit 返回数量上限，默认 20
 */
export async function searchBooks(
  query: string,
  limit: number = 20
): Promise<SearchResult[]> {
  const q = query.trim();
  if (!q) return [];

  // 优先使用 Google Books API
  if (GOOGLE_BOOKS_API_KEY) {
    try {
      const googleResults = await searchGoogleBooks(q, limit);
      if (googleResults.length > 0) return googleResults;
      // Google 返回空结果 → 回退 OpenLibrary
      console.log('Google Books returned 0 results, falling back to OpenLibrary');
    } catch (e) {
      console.warn('Google Books search failed, falling back to OpenLibrary:', e);
    }
  }

  // 回退到 OpenLibrary
  return searchOpenLibrary(q, limit);
}

// ============================================================
// Google Books API
// ============================================================

const GOOGLE_BOOKS_URL = 'https://www.googleapis.com/books/v1/volumes';

async function searchGoogleBooks(
  query: string,
  limit: number
): Promise<SearchResult[]> {
  const params = new URLSearchParams({
    q: query,
    langRestrict: 'zh-CN',
    maxResults: String(Math.min(limit, 40)),
    key: GOOGLE_BOOKS_API_KEY,
  });

  const response = await fetch(`${GOOGLE_BOOKS_URL}?${params.toString()}`, {
    headers: { 'Accept': 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Google Books 搜索失败 (${response.status})`);
  }

  const data: GoogleBooksResponse = await response.json();
  return (data.items ?? []).map(mapGoogleBookToResult);
}

function mapGoogleBookToResult(item: GoogleBooksVolume): SearchResult {
  const info = item.volumeInfo;

  // 封面：将 http 替换为 https，去掉边缘裁剪参数
  let coverUrl: string | null = null;
  if (info.imageLinks?.thumbnail) {
    coverUrl = info.imageLinks.thumbnail
      .replace('http:', 'https:')
      .replace('&edge=curl', '');
  }

  // ISBN
  let isbn: string | null = null;
  if (info.industryIdentifiers) {
    const isbn13 = info.industryIdentifiers.find((id) => id.type === 'ISBN_13');
    const isbn10 = info.industryIdentifiers.find((id) => id.type === 'ISBN_10');
    isbn = isbn13?.identifier ?? isbn10?.identifier ?? info.industryIdentifiers[0]?.identifier ?? null;
  }

  // 出版年份
  let publishYear: number | null = null;
  if (info.publishedDate) {
    const match = info.publishedDate.match(/^(\d{4})/);
    if (match) publishYear = parseInt(match[1], 10);
  }

  return {
    key: item.id,
    title: info.title,
    author: info.authors?.[0] ?? null,
    coverUrl,
    publishYear,
    isbn,
    description: info.description ?? null,
    publisher: info.publisher ?? null,
    rating: info.averageRating ?? null,
    pageCount: (info as any).pageCount ?? null,
  };
}

// ============================================================
// OpenLibrary API（回退）
// ============================================================

const OPENLIBRARY_SEARCH_URL = 'https://openlibrary.org/search.json';

async function searchOpenLibrary(
  query: string,
  limit: number
): Promise<SearchResult[]> {
  const params = new URLSearchParams({
    q: query,
    limit: String(limit),
    fields: 'key,title,author_name,first_publish_year,isbn,cover_i,first_sentence,subtitle',
  });

  const response = await fetch(`${OPENLIBRARY_SEARCH_URL}?${params.toString()}`, {
    headers: { 'Accept': 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`搜索失败 (${response.status})`);
  }

  const data: OpenLibrarySearchResponse = await response.json();
  return (data.docs ?? []).map(mapOpenLibraryDocToResult);
}

function mapOpenLibraryDocToResult(doc: OpenLibraryDoc): SearchResult {
  const coverUrl =
    doc.cover_i != null
      ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg`
      : null;

  const author = doc.author_name?.length ? doc.author_name[0] : null;
  const isbn = doc.isbn?.length ? doc.isbn[0] : null;

  const description =
    doc.first_sentence?.length
      ? doc.first_sentence.slice(0, 2).join(' ')
      : null;

  return {
    key: doc.key,
    title: doc.title,
    author,
    coverUrl,
    publishYear: doc.first_publish_year ?? null,
    isbn,
    description,
    publisher: (doc as any).publisher ?? null,
    rating: null,
    pageCount: (doc as any).number_of_pages_median ?? (doc as any).edition_count ?? null,
  };
}

// ============================================================
// 获取封面 URL 辅助
// ============================================================

/** OpenLibrary 封面 URL 变体 */
export function getCoverUrl(
  coverId: number,
  size: 'S' | 'M' | 'L' = 'M'
): string {
  return `https://covers.openlibrary.org/b/id/${coverId}-${size}.jpg`;
}

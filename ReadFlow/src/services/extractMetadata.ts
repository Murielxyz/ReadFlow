import { Platform } from 'react-native';

// expo-file-system 仅原生可用
let FileSystem: any = null;
if (Platform.OS !== 'web') {
  try { FileSystem = require('expo-file-system'); } catch {}
}

export interface EpubMetadata {
  title?: string;
  author?: string;
  publisher?: string;
  description?: string;
  isbn?: string;
  coverDataUri?: string; // base64 data URI of cover image
  toc?: { title: string; href: string; }[];
}

/**
 * 从 EPUB 文件中提取元数据（ZIP 解压 + XML 解析）
 */
export async function extractEpubMetadata(fileUri: string): Promise<EpubMetadata | null> {
  if (!FileSystem) return null;
  try {
    const base64 = await FileSystem.readAsStringAsync(fileUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    // 解码 Base64
    const bytes = base64ToUint8Array(base64);
    const zip = parseZip(bytes);
    if (!zip) return null;

    const metadata: EpubMetadata = {};

    // 1. 找到 container.xml → OPF 路径
    const containerPath = 'META-INF/container.xml';
    const containerFile = zip.find(f => f.name === containerPath || f.name.endsWith('META-INF/container.xml'));
    let opfPath = '';
    if (containerFile) {
      const xml = decodeUTF8(containerFile.data);
      const match = xml.match(/full-path="([^"]+)"/);
      if (match) opfPath = match[1];
    }
    if (!opfPath) {
      // Fallback: 查找 .opf 文件
      const opf = zip.find(f => f.name.endsWith('.opf'));
      if (opf) opfPath = opf.name;
    }

    // 2. 解析 OPF 文件
    if (opfPath) {
      const opfFile = zip.find(f => f.name === opfPath || f.name.endsWith(opfPath.split('/').pop() || ''));
      if (opfFile) {
        const xml = decodeUTF8(opfFile.data);
        metadata.title = extractXmlTag(xml, 'dc:title');
        // 作者可能有多个
        const creators = extractXmlTags(xml, 'dc:creator');
        metadata.author = creators.join(', ') || undefined;
        metadata.publisher = extractXmlTag(xml, 'dc:publisher');
        metadata.description = extractXmlTag(xml, 'dc:description')?.slice(0, 500);
        // ISBN from dc:identifier
        const ids = extractXmlTags(xml, 'dc:identifier');
        metadata.isbn = ids.find(id => id.match(/^\d{10,13}$/) || id.startsWith('urn:isbn:'))?.replace(/^urn:isbn:/i, '') || undefined;

        // 3. 提取封面图片
        const coverId = extractXmlTag(xml, 'meta[name="cover"]', 'content');
        if (coverId) {
          const coverHref = extractCoverHref(xml, coverId);
          if (coverHref) {
            const baseDir = opfPath.includes('/') ? opfPath.split('/').slice(0, -1).join('/') + '/' : '';
            const fullCoverPath = baseDir + coverHref;
            const coverFile = zip.find(f => f.name === fullCoverPath || f.name.endsWith(coverHref));
            if (coverFile) {
              const mime = coverHref.endsWith('.png') ? 'image/png' : 'image/jpeg';
              metadata.coverDataUri = `data:${mime};base64,${uint8ArrayToBase64(coverFile.data)}`;
            }
          }
        }
      }
    }

    // 4. 提取目录 (NCX/NAV)
    const ncxFile = zip.find(f => f.name.endsWith('toc.ncx') || f.name.endsWith('nav.xhtml'));
    if (ncxFile) {
      const xml = decodeUTF8(ncxFile.data);
      const toc: { title: string; href: string; }[] = [];
      // NCX format
      const navPoints = xml.match(/<navPoint[^>]*>[\s\S]*?<\/navPoint>/g);
      if (navPoints) {
        for (const np of navPoints) {
          const label = extractXmlTag(np, 'text');
          const src = extractXmlTag(np, 'content', 'src');
          if (label) toc.push({ title: label, href: src || '' });
        }
      }
      // NAV format (EPUB3)
      if (toc.length === 0) {
        const lis = xml.match(/<li[^>]*>[\s\S]*?<\/li>/g);
        if (lis) {
          for (const li of lis) {
            const label = li.replace(/<[^>]+>/g, '').trim();
            const hrefMatch = li.match(/href="([^"]+)"/);
            if (label && hrefMatch) toc.push({ title: label, href: hrefMatch[1] });
          }
        }
      }
      if (toc.length > 0) metadata.toc = toc;
    }

    // 至少要有标题才返回
    if (!metadata.title && !metadata.author) return null;
    return metadata;
  } catch (e) {
    console.warn('[extractMetadata] Failed:', e);
    return null;
  }
}

// ============================================================
// ZIP 解析（极简实现，处理 EPUB 文件）
// ============================================================

interface ZipEntry {
  name: string;
  data: Uint8Array;
}

function parseZip(bytes: Uint8Array): ZipEntry[] | null {
  try {
    const entries: ZipEntry[] = [];
    // 查找 End of Central Directory Record (EOCD) 签名 0x06054b50
    let eocdOffset = -1;
    for (let i = bytes.length - 22; i >= 0; i--) {
      if (bytes[i] === 0x50 && bytes[i+1] === 0x4b && bytes[i+2] === 0x05 && bytes[i+3] === 0x06) {
        eocdOffset = i;
        break;
      }
    }
    if (eocdOffset < 0) return null;

    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const cdOffset = view.getUint32(eocdOffset + 16, true);
    let offset = cdOffset;

    // 遍历 Central Directory entries
    while (offset < eocdOffset) {
      const sig = view.getUint32(offset, true);
      if (sig !== 0x02014b50) break;
      const compMethod = view.getUint16(offset + 10, true);
      const fileNameLen = view.getUint16(offset + 28, true);
      const extraLen = view.getUint16(offset + 30, true);
      const commentLen = view.getUint16(offset + 32, true);
      const localHeaderOff = view.getUint32(offset + 42, true);

      const nameBytes = bytes.slice(offset + 46, offset + 46 + fileNameLen);
      const name = decodeUTF8(nameBytes);

      // 读取 Local File Header
      const lhOffset = localHeaderOff;
      const lhNameLen = view.getUint16(lhOffset + 26, true);
      const lhExtraLen = view.getUint16(lhOffset + 28, true);
      const dataStart = lhOffset + 30 + lhNameLen + lhExtraLen;
      const compSize = view.getUint32(offset + 20, true);

      let data: Uint8Array;
      if (compMethod === 0) {
        // 无压缩
        data = bytes.slice(dataStart, dataStart + compSize);
      } else if (compMethod === 8) {
        // Deflate — 简单跳过（metadata 文件在 EPUB 中通常不压缩）
        // 对于压缩文件，尝试直接读取（很多 EPUB 元数据文件不压缩）
        data = bytes.slice(dataStart, dataStart + compSize);
        // 检测是否为有效 XML（非压缩内容）
        if (data.length > 2 && data[0] !== 0x3c) {
          // 压缩内容，跳过
          offset += 46 + fileNameLen + extraLen + commentLen;
          continue;
        }
      } else {
        offset += 46 + fileNameLen + extraLen + commentLen;
        continue;
      }

      entries.push({ name, data });
      offset += 46 + fileNameLen + extraLen + commentLen;
    }
    return entries;
  } catch {
    return null;
  }
}

// ============================================================
// 辅助函数
// ============================================================

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function decodeUTF8(data: Uint8Array): string {
  // 简单 UTF-8 解码
  let str = '';
  let i = 0;
  while (i < data.length) {
    const b = data[i++];
    if (b < 0x80) {
      str += String.fromCharCode(b);
    } else if (b < 0xE0) {
      str += String.fromCharCode(((b & 0x1F) << 6) | (data[i++] & 0x3F));
    } else if (b < 0xF0) {
      str += String.fromCharCode(((b & 0x0F) << 12) | ((data[i++] & 0x3F) << 6) | (data[i++] & 0x3F));
    } else {
      str += String.fromCharCode(((b & 0x07) << 18) | ((data[i++] & 0x3F) << 12) | ((data[i++] & 0x3F) << 6) | (data[i++] & 0x3F));
    }
  }
  return str;
}

function extractXmlTag(xml: string, tag: string, attr?: string): string | undefined {
  if (attr) {
    const re = new RegExp(`<${tag}[^>]*${attr}="([^"]*)"[^>]*>`, 'i');
    const m = xml.match(re);
    return m ? m[1] : undefined;
  }
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const m = xml.match(re);
  return m ? cleanXmlText(m[1]) : undefined;
}

function extractXmlTags(xml: string, tag: string): string[] {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi');
  const results: string[] = [];
  let m;
  while ((m = re.exec(xml)) !== null) {
    const text = cleanXmlText(m[1]);
    if (text) results.push(text);
  }
  return results;
}

function extractCoverHref(opfXml: string, coverId: string): string | undefined {
  const re = new RegExp(`<item[^>]*id="${coverId}"[^>]*href="([^"]*)"`, 'i');
  const m = opfXml.match(re);
  return m ? m[1] : undefined;
}

function cleanXmlText(text: string): string {
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

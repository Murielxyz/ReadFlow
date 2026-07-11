import { Platform } from 'react-native';

// expo-file-system 仅原生可用，Web 端使用 stub
let FileSystem: any = null;
if (Platform.OS !== 'web') {
  try { FileSystem = require('expo-file-system/legacy'); } catch {}
}

/**
 * EPUB 元数据提取服务 (仅原生平台)
 *
 * 从 EPUB 文件中提取书名、作者、出版社、简介、ISBN 等元数据。
 * EPUB 本质是 ZIP 压缩包，本服务通过读取文件内容并搜索 Dublin Core
 * XML 元数据标签来提取信息（元数据通常在 ZIP 中不压缩）。
 * Web 端不支持文件系统读取，extractEpubMetadata 返回 null。
 */

export interface EpubMetadata {
  title?: string;
  author?: string;
  publisher?: string;
  description?: string;
  isbn?: string;
  coverDataUri?: string;
}

/**
 * 从 EPUB 文件中提取元数据
 * @param fileUri EPUB 文件 URI
 * @returns 提取的元数据，提取失败返回 null
 */
export async function extractEpubMetadata(fileUri: string): Promise<EpubMetadata | null> {
  if (!FileSystem) return null; // Web 端不支持
  try {
    // 读取 EPUB 文件的文本内容（搜索元数据 XML）
    const content = await FileSystem.readAsStringAsync(fileUri, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    const metadata: EpubMetadata = {};

    // dc:title
    const titleMatch = content.match(/<dc:title[^>]*>([\s\S]*?)<\/dc:title>/i);
    if (titleMatch) metadata.title = cleanXmlText(titleMatch[1]);

    // dc:creator (author)
    const creatorMatch = content.match(/<dc:creator[^>]*>([\s\S]*?)<\/dc:creator>/i);
    if (creatorMatch) metadata.author = cleanXmlText(creatorMatch[1]);

    // dc:publisher
    const publisherMatch = content.match(/<dc:publisher[^>]*>([\s\S]*?)<\/dc:publisher>/i);
    if (publisherMatch) metadata.publisher = cleanXmlText(publisherMatch[1]);

    // dc:description
    const descMatch = content.match(/<dc:description[^>]*>([\s\S]*?)<\/dc:description>/i);
    if (descMatch) metadata.description = cleanXmlText(descMatch[1]).slice(0, 500);

    // dc:identifier (ISBN)
    const idMatches = content.match(/<dc:identifier[^>]*>([\s\S]*?)<\/dc:identifier>/gi);
    if (idMatches) {
      for (const idStr of idMatches) {
        const inner = idStr.match(/<dc:identifier[^>]*>([\s\S]*?)<\/dc:identifier>/i);
        if (inner) {
          const idText = cleanXmlText(inner[1]);
          if (idText.match(/^ISBN[:\s-]*/i) || idText.match(/^\d{10,13}$/)) {
            metadata.isbn = idText.replace(/^ISBN[:\s-]*/i, '');
            break;
          }
        }
      }
    }

    // 返回 null 如果什么都没提取到
    if (!metadata.title && !metadata.author) return null;

    return metadata;
  } catch (e) {
    console.error('[extractMetadata] 元数据提取失败:', e);
    return null;
  }
}

// ---- 辅助函数 ----

/** 清理 XML 文本：去除 CDATA 包裹、多余空白、HTML 实体 */
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

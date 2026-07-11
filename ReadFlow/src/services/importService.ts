import { Platform } from 'react-native';

// expo-file-system 仅原生可用，Web 端使用 stub
let File: any = null;
let Directory: any = null;
let Paths: any = { document: '' };
if (Platform.OS !== 'web') {
  try {
    const fs = require('expo-file-system');
    File = fs.File;
    Directory = fs.Directory;
    Paths = fs.Paths;
  } catch {}
}

/** 支持的文件 MIME 类型 */
const EPUB_MIME = 'application/epub+zip';
const PDF_MIME = 'application/pdf';

/** App 内部存储子目录名 */
const STORAGE_DIR = 'readflow';

/** 获取或创建存储目录 */
async function getStorageDir(): Promise<any> {
  const dir = new Directory(Paths.document, STORAGE_DIR);
  dir.create();
  return dir;
}

export interface ImportResult {
  uri: string;
  fileName: string;
  fileSize: number;
}

/**
 * 选取并导入 EPUB 文件（仅原生平台）
 */
export async function pickAndImportEpub(): Promise<ImportResult | null> {
  if (!File) return null;
  return pickAndImport([EPUB_MIME]);
}

/**
 * 选取并导入 PDF 文件（仅原生平台）
 */
export async function pickAndImportPdf(): Promise<ImportResult | null> {
  if (!File) return null;
  return pickAndImport([PDF_MIME]);
}

/**
 * 通用文件选取 + 导入到 App 内部存储
 */
async function pickAndImport(mimeTypes: string[]): Promise<ImportResult | null> {
  if (!File) return null;
  try {
    const result = await File.pickFileAsync({ mimeTypes });
    if (result.canceled || !result.result) return null;

    const pickedFile: any = result.result;
    const storageDir = await getStorageDir();
    const timestamp = Date.now();
    const safeName = pickedFile.name.replace(/[^a-zA-Z0-9一-鿿._-]/g, '_');
    const destName = `${timestamp}_${safeName}`;
    const destFile = new File(storageDir, destName);
    await pickedFile.copy(destFile);
    const info = destFile.info();

    return {
      uri: destFile.uri,
      fileName: pickedFile.name,
      fileSize: info.size ?? 0,
    };
  } catch (e) {
    console.error('pickAndImport error:', e);
    return null;
  }
}

/**
 * 删除 App 内部存储中的文件（仅原生平台）
 */
export async function deleteSourceFile(uri: string): Promise<void> {
  if (!File) return;
  try {
    const file = new File(uri);
    const info = file.info();
    if (info.exists) file.delete();
  } catch (e) {
    console.error('deleteSourceFile error:', e);
  }
}

import { useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Switch, Modal, Share, Alert, ActivityIndicator, Linking, TextInput, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { radii, spacing } from '../../src/theme';
import { ACCENT_PRESETS } from '../../src/theme/colors';
import { softShadow } from '../../src/theme/shadows';
import { useThemeStore, useColors } from '../../src/stores/useThemeStore';
import { useSettingsStore, GOAL_OPTIONS, REMINDER_TIME_OPTIONS } from '../../src/stores/useSettingsStore';
import { getDatabase } from '../../src/db/database';

// expo-file-system 仅原生可用
let Paths: any = { document: '' };
let File: any = { write: () => {}, pickFileAsync: () => { throw new Error('Web not supported'); } };
let requestPermissions: any = null;
let updateReminder: any = null;
if (Platform.OS !== 'web') {
  try {
    const fs = require('expo-file-system');
    Paths = fs.Paths;
    File = fs.File;
    const ns = require('../../src/services/notificationService');
    requestPermissions = ns.requestPermissions;
    updateReminder = ns.updateReminder;
  } catch {}
}

export default function ProfileScreen() {
  const mode = useThemeStore((s) => s.mode);
  const accentPreset = useThemeStore((s) => s.accentPreset);
  const toggleTheme = useThemeStore((s) => s.toggle);
  const setAccentPreset = useThemeStore((s) => s.setAccentPreset);
  const dailyGoalMinutes = useSettingsStore((s) => s.dailyGoalMinutes);
  const setDailyGoal = useSettingsStore((s) => s.setDailyGoal);
  const reminderEnabled = useSettingsStore((s) => s.reminderEnabled);
  const reminderTime = useSettingsStore((s) => s.reminderTime);
  const setReminderEnabled = useSettingsStore((s) => s.setReminderEnabled);
  const setReminderTime = useSettingsStore((s) => s.setReminderTime);
  const userName = useSettingsStore((s) => s.userName);
  const userBio = useSettingsStore((s) => s.userBio);
  const setUserName = useSettingsStore((s) => s.setUserName);
  const setUserBio = useSettingsStore((s) => s.setUserBio);
  const t = useColors();

  const [goalPickerVisible, setGoalPickerVisible] = useState(false);
  const [reminderPickerVisible, setReminderPickerVisible] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [editProfileVisible, setEditProfileVisible] = useState(false);
  const [editName, setEditName] = useState('');
  const [editBio, setEditBio] = useState('');

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const db = await getDatabase();
      const books = await db.getAllAsync('SELECT * FROM books ORDER BY updated_at DESC');
      const sessions = await db.getAllAsync('SELECT * FROM reading_sessions ORDER BY start_time DESC');
      const manualLogs = await db.getAllAsync('SELECT * FROM manual_logs ORDER BY logged_at DESC');
      const sources = await db.getAllAsync('SELECT * FROM reading_sources ORDER BY created_at DESC');
      const tags = await db.getAllAsync('SELECT * FROM tags ORDER BY name ASC');
      const bookTags = await db.getAllAsync('SELECT * FROM book_tags');
      const collections = await db.getAllAsync('SELECT * FROM collections ORDER BY sort_order ASC, created_at DESC');
      const bookCollections = await db.getAllAsync('SELECT * FROM book_collections');
      const readingGoals = await db.getAllAsync('SELECT * FROM reading_goals ORDER BY year DESC');
      const notes = await db.getAllAsync('SELECT * FROM notes ORDER BY created_at DESC');
      const userSettings = await db.getAllAsync('SELECT * FROM user_settings');
      const highlights = await db.getAllAsync('SELECT * FROM highlights ORDER BY created_at DESC');
      await Share.share({ title: 'ReadFlow 数据导出', message: JSON.stringify({ version: '2.3', exportedAt: new Date().toISOString(), books, readingSessions: sessions, manualLogs, readingSources: sources, tags, bookTags, collections, bookCollections, readingGoals, notes, userSettings, highlights }, null, 2) });
    } catch (e: any) { if (e?.message !== 'User did not share') Alert.alert('导出失败', e?.message ?? '未知错误'); }
    finally { setExporting(false); }
  }, []);

  const handleBackup = useCallback(async () => {
    try {
      const db = await getDatabase();
      const books = await db.getAllAsync('SELECT * FROM books ORDER BY updated_at DESC');
      const sessions = await db.getAllAsync('SELECT * FROM reading_sessions ORDER BY start_time DESC');
      const manualLogs = await db.getAllAsync('SELECT * FROM manual_logs ORDER BY logged_at DESC');
      const sources = await db.getAllAsync('SELECT * FROM reading_sources ORDER BY created_at DESC');
      const tags = await db.getAllAsync('SELECT * FROM tags ORDER BY name ASC');
      const bookTags = await db.getAllAsync('SELECT * FROM book_tags');
      const collections = await db.getAllAsync('SELECT * FROM collections ORDER BY sort_order ASC, created_at DESC');
      const bookCollections = await db.getAllAsync('SELECT * FROM book_collections');
      const readingGoals = await db.getAllAsync('SELECT * FROM reading_goals ORDER BY year DESC');
      const notes = await db.getAllAsync('SELECT * FROM notes ORDER BY created_at DESC');
      const userSettings = await db.getAllAsync('SELECT * FROM user_settings');
      const highlights = await db.getAllAsync('SELECT * FROM highlights ORDER BY created_at DESC');
      const json = JSON.stringify({ version: '2.3', exportedAt: new Date().toISOString(), books, readingSessions: sessions, manualLogs, readingSources: sources, tags, bookTags, collections, bookCollections, readingGoals, notes, userSettings, highlights }, null, 2);
      const fileName = `readflow_backup_${new Date().toISOString().replace(/[:.]/g, '-').split('.')[0]}.json`;
      new File(Paths.document, fileName).write(json);
      Alert.alert('备份成功', `数据已保存到本地存储\n\n${fileName}`);
    } catch (e: any) { Alert.alert('备份失败', e?.message ?? '未知错误'); }
  }, []);

  const handleRestore = useCallback(async () => {
    try {
      const pickResult = await File.pickFileAsync({ mimeTypes: ['application/json'] });
      if (pickResult.canceled) return;
      setRestoring(true);
      const content = await pickResult.result.text();
      const data = JSON.parse(content);
      if (!data.books || !Array.isArray(data.books)) { Alert.alert('格式错误', '所选文件不是有效的 ReadFlow 备份文件'); return; }
      const db = await getDatabase();
      let bookCount = 0, sessionCount = 0, manualCount = 0, sourceCount = 0;
      let tagCount = 0, collectionCount = 0, goalCount = 0, noteCount = 0, highlightCount = 0;

      // 恢复书本（按 title + author 去重，修复列名匹配 schema）
      for (const book of data.books) {
        const existing = await db.getFirstAsync<{ id: string }>('SELECT id FROM books WHERE title = ? AND author = ?', [book.title, book.author ?? null]);
        if (existing) continue;
        await db.runAsync(
          'INSERT INTO books (id, title, author, description, cover_url, isbn, page_count, status, rating, accent_color, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [book.id, book.title, book.author ?? null, book.description ?? null, book.cover_url ?? null, book.isbn ?? null, book.page_count ?? null, book.status || 'to_read', book.rating ?? null, book.accent_color ?? null, book.created_at || data.exportedAt, book.updated_at || data.exportedAt]
        );
        bookCount++;
      }

      // 恢复阅读记录（修复列名：移除不存在的 note，新增 source_label/created_at/page_number/chapter/completed_book）
      if (data.readingSessions) for (const s of data.readingSessions) {
        try {
          await db.runAsync(
            'INSERT OR IGNORE INTO reading_sessions (id, book_id, source_id, start_time, end_time, duration_ms, source_label, created_at, page_number, chapter, completed_book) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [s.id, s.book_id, s.source_id ?? null, s.start_time, s.end_time ?? null, s.duration_ms ?? null, s.source_label ?? null, s.created_at ?? data.exportedAt, s.page_number ?? null, s.chapter ?? null, s.completed_book ?? 0]
          );
          sessionCount++;
        } catch { /* skip */ }
      }

      // 恢复手动记录（修复列名：移除 page_from/page_to/pages_read；新增 source_id/source_label/created_at/page_number/chapter/completed_book）
      if (data.manualLogs) for (const m of data.manualLogs) {
        try {
          await db.runAsync(
            'INSERT OR IGNORE INTO manual_logs (id, book_id, source_id, duration_ms, logged_at, note, source_label, created_at, page_number, chapter, completed_book) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [m.id, m.book_id, m.source_id ?? null, m.duration_ms, m.logged_at, m.note ?? null, m.source_label ?? null, m.created_at ?? data.exportedAt, m.page_number ?? null, m.chapter ?? null, m.completed_book ?? 0]
          );
          manualCount++;
        } catch { /* skip */ }
      }

      // 恢复阅读来源（修复列名：name→label，移除 total_pages，新增 file_name）
      if (data.readingSources) for (const src of data.readingSources) {
        try {
          await db.runAsync(
            'INSERT OR IGNORE INTO reading_sources (id, book_id, type, label, file_uri, file_name, current_page, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [src.id, src.book_id, src.type, src.label ?? src.name, src.file_uri ?? null, src.file_name ?? null, src.current_page ?? 0, src.created_at ?? data.exportedAt]
          );
          sourceCount++;
        } catch { /* skip */ }
      }

      // --- 新增 8 张表的恢复 ---

      // 标签（name 列 UNIQUE）
      if (data.tags) for (const t of data.tags) {
        try { await db.runAsync('INSERT OR IGNORE INTO tags (id, name, color, is_system, created_at) VALUES (?, ?, ?, ?, ?)', [t.id, t.name, t.color ?? null, t.is_system ?? 0, t.created_at ?? data.exportedAt]); tagCount++; } catch { /* skip */ }
      }

      // 书本-标签关联
      if (data.bookTags) for (const bt of data.bookTags) {
        try { await db.runAsync('INSERT OR IGNORE INTO book_tags (book_id, tag_id) VALUES (?, ?)', [bt.book_id, bt.tag_id]); } catch { /* skip */ }
      }

      // 书单
      if (data.collections) for (const c of data.collections) {
        try { await db.runAsync('INSERT OR IGNORE INTO collections (id, name, description, color, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?)', [c.id, c.name, c.description ?? null, c.color ?? null, c.sort_order ?? 0, c.created_at ?? data.exportedAt]); collectionCount++; } catch { /* skip */ }
      }

      // 书本-书单关联
      if (data.bookCollections) for (const bc of data.bookCollections) {
        try { await db.runAsync('INSERT OR IGNORE INTO book_collections (book_id, collection_id, added_at) VALUES (?, ?, ?)', [bc.book_id, bc.collection_id, bc.added_at ?? data.exportedAt]); } catch { /* skip */ }
      }

      // 年度阅读目标（year 是主键）
      if (data.readingGoals) for (const g of data.readingGoals) {
        try { await db.runAsync('INSERT OR REPLACE INTO reading_goals (year, target_books, created_at, updated_at) VALUES (?, ?, ?, ?)', [g.year, g.target_books ?? 50, g.created_at ?? data.exportedAt, g.updated_at ?? data.exportedAt]); goalCount++; } catch { /* skip */ }
      }

      // 笔记
      if (data.notes) for (const n of data.notes) {
        try { await db.runAsync('INSERT OR IGNORE INTO notes (id, book_id, content, page_number, chapter, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)', [n.id, n.book_id, n.content, n.page_number ?? null, n.chapter ?? null, n.created_at ?? data.exportedAt, n.updated_at ?? data.exportedAt]); noteCount++; } catch { /* skip */ }
      }

      // 用户设置（key 是主键）
      if (data.userSettings) for (const s of data.userSettings) {
        try { await db.runAsync('INSERT OR REPLACE INTO user_settings (key, value) VALUES (?, ?)', [s.key, s.value]); } catch { /* skip */ }
      }

      // 高亮
      if (data.highlights) for (const h of data.highlights) {
        try { await db.runAsync('INSERT OR IGNORE INTO highlights (id, book_id, content, color, note, page_number, chapter, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [h.id, h.book_id, h.content, h.color ?? '#F5A623', h.note ?? null, h.page_number ?? null, h.chapter ?? null, h.created_at ?? data.exportedAt, h.updated_at ?? data.exportedAt]); highlightCount++; } catch { /* skip */ }
      }

      const parts: string[] = [];
      if (bookCount > 0) parts.push(`${bookCount} 本书`);
      if (sessionCount > 0) parts.push(`${sessionCount} 条阅读记录`);
      if (manualCount > 0) parts.push(`${manualCount} 条手动记录`);
      if (sourceCount > 0) parts.push(`${sourceCount} 个阅读来源`);
      if (tagCount > 0) parts.push(`${tagCount} 个标签`);
      if (collectionCount > 0) parts.push(`${collectionCount} 个书单`);
      if (goalCount > 0) parts.push(`${goalCount} 个年度目标`);
      if (noteCount > 0) parts.push(`${noteCount} 条笔记`);
      if (highlightCount > 0) parts.push(`${highlightCount} 条高亮`);
      Alert.alert('恢复完成', parts.length === 0 ? '所有数据已存在，没有新数据导入' : `成功导入：\n${parts.join('\n')}`);
    } catch (e: any) { Alert.alert('恢复失败', e?.message ?? '未知错误'); }
    finally { setRestoring(false); }
  }, []);

  // ---- 每日阅读提醒 ----

  const handleToggleReminder = useCallback(async (enabled: boolean) => {
    if (enabled) {
      // 请求通知权限
      const granted = await requestPermissions();
      if (!granted) {
        Alert.alert(
          '需要通知权限',
          '请在系统设置中开启通知权限，以便我们按时提醒你阅读。',
          [{ text: '知道了' }],
        );
        return;
      }
    }
    await setReminderEnabled(enabled);
    await updateReminder(enabled, reminderTime);
  }, [reminderTime, setReminderEnabled]);

  const handleSelectReminderTime = useCallback(async (time: string) => {
    await setReminderTime(time);
    setReminderPickerVisible(false);
    // 如果提醒已开启，立即用新时间重新调度
    if (reminderEnabled) {
      await updateReminder(true, time);
    }
  }, [reminderEnabled, setReminderTime]);

  // ---- 评分 & 反馈 ----

  const handleRateUs = useCallback(async () => {
    Alert.alert(
      '感谢支持 ❤️',
      '感谢你使用 ReadFlow！\n\nApp 目前还在开发阶段，等正式上架后就可以在 App Store 给我们评分啦～',
      [{ text: '好的', style: 'default' }],
    );
  }, []);

  const handleFeedback = useCallback(async () => {
    Alert.alert(
      '反馈与帮助 💬',
      '感谢你愿意分享想法！\n\n请通过以下方式联系我们：\n📧 readflow.app@gmail.com\n\n我们会在第一时间回复你。',
      [{ text: '知道了', style: 'default' }],
    );
  }, []);

  const handleOpenEditProfile = useCallback(() => {
    setEditName(userName);
    setEditBio(userBio);
    setEditProfileVisible(true);
  }, [userName, userBio]);

  const handleSaveProfile = useCallback(async () => {
    const name = editName.trim() || 'ReadFlow 读者';
    const bio = editBio.trim() || '热爱阅读，每天进步一点点 📚';
    await setUserName(name);
    await setUserBio(bio);
    setEditProfileVisible(false);
  }, [editName, editBio, setUserName, setUserBio]);

  // ----

  const currentGoalLabel = GOAL_OPTIONS.find((o) => o.value === dailyGoalMinutes)?.label ?? `${dailyGoalMinutes} 分钟`;

  return (
    <View style={[styles.root, { backgroundColor: t.paper.primary }]}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={[styles.pageTitle, { color: t.ink.primary }]}>我的</Text>
        <Text style={[styles.pageSubtitle, { color: t.ink.tertiary }]}>管理你的阅读偏好</Text>

        <TouchableOpacity style={[styles.userCard, { backgroundColor: t.paper.white, borderColor: t.outline.standard }]} activeOpacity={0.7} onPress={handleOpenEditProfile}>
          <View style={[styles.avatar, { backgroundColor: t.accent.blue }]}>
            <Text style={styles.avatarText}>{userName.charAt(0)}</Text>
          </View>
          <View style={styles.userInfo}>
            <View style={styles.userNameRow}>
              <Text style={[styles.userName, { color: t.ink.primary }]}>{userName}</Text>
              <Ionicons name="pencil" size={12} color={t.ink.tertiary} style={{ marginLeft: 4 }} />
            </View>
            <Text style={[styles.userBio, { color: t.ink.tertiary }]}>{userBio}</Text>
          </View>
        </TouchableOpacity>

        <Text style={[styles.sectionLabel, { color: t.ink.tertiary }]}>阅读设置</Text>
        <View style={[styles.settingsGroup, { backgroundColor: t.paper.white, borderColor: t.outline.standard }]}>
          <TouchableOpacity style={styles.settingRow} activeOpacity={0.6} onPress={() => setGoalPickerVisible(true)}>
            <View style={styles.settingLeft}>
              <View style={[styles.settingIcon, { backgroundColor: t.accent.blueBg }]}>
                <Ionicons name="flag-outline" size={18} color={t.accent.primary} />
              </View>
              <View>
                <Text style={[styles.settingTitle, { color: t.ink.primary }]}>每日阅读目标</Text>
                <Text style={[styles.settingDesc, { color: t.ink.tertiary }]}>{currentGoalLabel}</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={16} color={t.ink.tertiary} />
          </TouchableOpacity>

          <View style={[styles.divider, { backgroundColor: t.outline.standard }]} />
          <View style={styles.settingRow}>
            <TouchableOpacity
              style={styles.settingLeft}
              activeOpacity={reminderEnabled ? 0.6 : 1}
              onPress={() => { if (reminderEnabled) setReminderPickerVisible(true); }}
            >
              <View style={[styles.settingIcon, { backgroundColor: t.accent.yellowBg }]}>
                <Ionicons name="notifications-outline" size={18} color={t.accent.primary} />
              </View>
              <View>
                <Text style={[styles.settingTitle, { color: t.ink.primary }]}>每日阅读提醒</Text>
                <Text style={[styles.settingDesc, { color: t.ink.tertiary }]}>
                  {reminderEnabled ? reminderTime : '设置后每天定时提醒你阅读'}
                </Text>
              </View>
            </TouchableOpacity>
            <Switch
              value={reminderEnabled}
              onValueChange={handleToggleReminder}
              trackColor={{ false: t.outline.standard, true: t.accent.primary + '60' }}
              thumbColor={reminderEnabled ? t.accent.primary : t.ink.inverse}
            />
          </View>

          <View style={[styles.divider, { backgroundColor: t.outline.standard }]} />
          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <View style={[styles.settingIcon, { backgroundColor: t.accent.primaryBg }]}>
                <Ionicons name="moon-outline" size={18} color={t.accent.primary} />
              </View>
              <View>
                <Text style={[styles.settingTitle, { color: t.ink.primary }]}>深色模式</Text>
                <Text style={[styles.settingDesc, { color: t.ink.tertiary }]}>{mode === 'dark' ? '已开启' : '已关闭'}</Text>
              </View>
            </View>
            <Switch value={mode === 'dark'} onValueChange={toggleTheme}
              trackColor={{ false: t.outline.standard, true: t.accent.primary + '60' }}
              thumbColor={mode === 'dark' ? t.accent.primary : t.ink.inverse}
            />
          </View>
          <View style={[styles.divider, { backgroundColor: t.outline.standard }]} />
          {/* 强调色选择器 */}
          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <View style={[styles.settingIcon, { backgroundColor: t.accent.primaryBg }]}>
                <Ionicons name="color-palette-outline" size={18} color={t.accent.primary} />
              </View>
              <View>
                <Text style={[styles.settingTitle, { color: t.ink.primary }]}>主题配色</Text>
                <Text style={[styles.settingDesc, { color: t.ink.tertiary }]}>
                  {accentPreset === 'purple' ? '紫色' : accentPreset === 'blue' ? '蓝色' : accentPreset === 'green' ? '绿色' : '黄色'}
                </Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {(['purple', 'blue', 'green', 'yellow'] as const).map((key) => (
                <TouchableOpacity
                  key={key}
                  style={[styles.accentDot, { backgroundColor: ACCENT_PRESETS[key].primary }, accentPreset === key && { borderWidth: 3, borderColor: t.ink.primary }]}
                  onPress={() => setAccentPreset(key)}
                  activeOpacity={0.7}
                />
              ))}
            </View>
          </View>
        </View>

        <Text style={[styles.sectionLabel, { color: t.ink.tertiary }]}>数据管理</Text>
        <View style={[styles.settingsGroup, { backgroundColor: t.paper.white, borderColor: t.outline.standard }]}>
          <TouchableOpacity style={styles.settingRow} activeOpacity={0.6} onPress={handleExport} disabled={exporting}>
            <View style={styles.settingLeft}>
              <View style={[styles.settingIcon, { backgroundColor: t.accent.greenBg }]}>
                {exporting ? <ActivityIndicator size="small" color={t.accent.primary} /> : <Ionicons name="share-outline" size={18} color={t.accent.primary} />}
              </View>
              <View>
                <Text style={[styles.settingTitle, { color: t.ink.primary }]}>导出数据</Text>
                <Text style={[styles.settingDesc, { color: t.ink.tertiary }]}>{exporting ? '准备中...' : '通过分享导出 JSON 文件'}</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={16} color={t.ink.tertiary} />
          </TouchableOpacity>
          <View style={[styles.divider, { backgroundColor: t.outline.standard }]} />
          <TouchableOpacity style={styles.settingRow} activeOpacity={0.6} onPress={handleBackup}>
            <View style={styles.settingLeft}>
              <View style={[styles.settingIcon, { backgroundColor: t.accent.blueBg }]}>
                <Ionicons name="save-outline" size={18} color={t.accent.primary} />
              </View>
              <View>
                <Text style={[styles.settingTitle, { color: t.ink.primary }]}>备份数据</Text>
                <Text style={[styles.settingDesc, { color: t.ink.tertiary }]}>保存备份文件到本地存储</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={16} color={t.ink.tertiary} />
          </TouchableOpacity>
          <View style={[styles.divider, { backgroundColor: t.outline.standard }]} />
          <TouchableOpacity style={styles.settingRow} activeOpacity={0.6} onPress={handleRestore} disabled={restoring}>
            <View style={styles.settingLeft}>
              <View style={[styles.settingIcon, { backgroundColor: t.accent.yellowBg }]}>
                {restoring ? <ActivityIndicator size="small" color={t.accent.primary} /> : <Ionicons name="folder-open-outline" size={18} color={t.accent.primary} />}
              </View>
              <View>
                <Text style={[styles.settingTitle, { color: t.ink.primary }]}>恢复数据</Text>
                <Text style={[styles.settingDesc, { color: t.ink.tertiary }]}>{restoring ? '导入中...' : '从备份文件恢复数据'}</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={16} color={t.ink.tertiary} />
          </TouchableOpacity>
        </View>

        <Text style={[styles.sectionLabel, { color: t.ink.tertiary }]}>关于</Text>
        <View style={[styles.settingsGroup, { backgroundColor: t.paper.white, borderColor: t.outline.standard }]}>
          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <View style={[styles.settingIcon, { backgroundColor: t.accent.primaryBg }]}>
                <Ionicons name="information-circle-outline" size={18} color={t.accent.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.settingTitle, { color: t.ink.primary }]}>关于 ReadFlow</Text>
                <Text style={[styles.settingDesc, { color: t.ink.tertiary }]} numberOfLines={2}>版本 {Constants.expoConfig?.version ?? '2.3'} · 以书为中心的阅读记录</Text>
              </View>
            </View>
          </View>
          <View style={[styles.divider, { backgroundColor: t.outline.standard }]} />
          <TouchableOpacity style={styles.settingRow} activeOpacity={0.6} onPress={handleFeedback}>
            <View style={styles.settingLeft}>
              <View style={[styles.settingIcon, { backgroundColor: t.accent.greenBg }]}>
                <Ionicons name="chatbubble-outline" size={18} color={t.accent.primary} />
              </View>
              <View>
                <Text style={[styles.settingTitle, { color: t.ink.primary }]}>反馈与帮助</Text>
                <Text style={[styles.settingDesc, { color: t.ink.tertiary }]}>告诉我们你的想法</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={16} color={t.ink.tertiary} />
          </TouchableOpacity>
        </View>

        <View style={{ height: spacing.xl }}>
          <Text style={[styles.footer, { color: t.ink.tertiary }]}>ReadFlow v{Constants.expoConfig?.version ?? '2.3'} · Built with ❤️</Text>
        </View>
        <View style={{ height: 32 }} />
      </ScrollView>

      <Modal visible={goalPickerVisible} transparent animationType="fade" onRequestClose={() => setGoalPickerVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setGoalPickerVisible(false)}>
          <View style={[styles.goalPickerCard, { backgroundColor: t.paper.primary, borderColor: t.outline.standard }]}>
            <Text style={[styles.goalPickerTitle, { color: t.ink.primary }]}>选择每日阅读目标</Text>
            <View style={styles.goalOptionsList}>
              {GOAL_OPTIONS.map((opt) => {
                const isActive = opt.value === dailyGoalMinutes;
                return (
                  <TouchableOpacity key={opt.value}
                    style={[styles.goalOption, { backgroundColor: isActive ? t.ink.primary : t.paper.white, borderColor: isActive ? t.ink.primary : t.outline.standard }]}
                    onPress={() => { setDailyGoal(opt.value); setGoalPickerVisible(false); }} activeOpacity={0.7}>
                    <Text style={[styles.goalOptionText, { color: isActive ? t.ink.inverse : t.ink.primary }]}>{opt.label}</Text>
                    {isActive && <Ionicons name="checkmark-circle" size={18} color={t.ink.inverse} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* 每日阅读提醒时间选择 */}
      <Modal visible={reminderPickerVisible} transparent animationType="fade" onRequestClose={() => setReminderPickerVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setReminderPickerVisible(false)}>
          <View style={[styles.goalPickerCard, { backgroundColor: t.paper.primary, borderColor: t.outline.standard }]}>
            <Text style={[styles.goalPickerTitle, { color: t.ink.primary }]}>选择每日提醒时间</Text>
            <View style={styles.goalOptionsList}>
              {REMINDER_TIME_OPTIONS.map((opt) => {
                const isActive = opt.value === reminderTime;
                return (
                  <TouchableOpacity key={opt.value}
                    style={[styles.goalOption, { backgroundColor: isActive ? t.ink.primary : t.paper.white, borderColor: isActive ? t.ink.primary : t.outline.standard }]}
                    onPress={() => handleSelectReminderTime(opt.value)} activeOpacity={0.7}>
                    <Text style={[styles.goalOptionText, { color: isActive ? t.ink.inverse : t.ink.primary }]}>{opt.label}</Text>
                    {isActive && <Ionicons name="checkmark-circle" size={18} color={t.ink.inverse} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* 编辑个人资料 */}
      <Modal visible={editProfileVisible} transparent animationType="fade" onRequestClose={() => setEditProfileVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setEditProfileVisible(false)}>
          <View style={[styles.editProfileCard, { backgroundColor: t.paper.primary, borderColor: t.outline.standard }]}>
            <Text style={[styles.editProfileTitle, { color: t.ink.primary }]}>编辑个人资料</Text>

            <Text style={[styles.editProfileLabel, { color: t.ink.secondary }]}>昵称</Text>
            <TextInput
              style={[styles.editProfileInput, { backgroundColor: t.paper.white, borderColor: t.outline.standard, color: t.ink.primary }]}
              value={editName}
              onChangeText={setEditName}
              placeholder="你的昵称"
              placeholderTextColor={t.ink.tertiary}
              maxLength={20}
              autoFocus
            />

            <Text style={[styles.editProfileLabel, { color: t.ink.secondary }]}>个性签名</Text>
            <TextInput
              style={[styles.editProfileInput, { backgroundColor: t.paper.white, borderColor: t.outline.standard, color: t.ink.primary }]}
              value={editBio}
              onChangeText={setEditBio}
              placeholder="写一句话介绍自己..."
              placeholderTextColor={t.ink.tertiary}
              maxLength={50}
            />

            <View style={styles.modalBtns}>
              <TouchableOpacity style={[styles.modalCancel, { borderColor: t.outline.standard }]} onPress={() => setEditProfileVisible(false)}>
                <Text style={[styles.modalCancelText, { color: t.ink.secondary }]}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalSave, { backgroundColor: t.accent.primary }]} onPress={handleSaveProfile}>
                <Text style={styles.modalSaveText}>保存</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: spacing.lg, paddingTop: 60 },

  pageTitle: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 30, fontWeight: '800', letterSpacing: -0.6 },
  pageSubtitle: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 14, marginTop: 2, marginBottom: spacing.xl },

  userCard: { flexDirection: 'row', alignItems: 'center', borderRadius: radii.lg, borderWidth: 1, padding: spacing.lg, marginBottom: spacing.xl, gap: spacing.md, ...softShadow },
  avatar: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 24, fontWeight: '800', color: '#FFFFFF' },
  userInfo: { flex: 1 },
  userNameRow: { flexDirection: 'row', alignItems: 'center' },
  userName: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 18, fontWeight: '700', marginBottom: 2 },
  userBio: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 13 },

  sectionLabel: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: spacing.sm, marginLeft: spacing.xs },
  settingsGroup: { borderRadius: radii.lg, borderWidth: 1, marginBottom: spacing.xl, ...softShadow },
  settingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  settingLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flex: 1 },
  settingIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  settingTitle: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 14, fontWeight: '600' },
  settingDesc: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12, marginTop: 1 },
  accentDot: { width: 28, height: 28, borderRadius: 14 },
  divider: { height: 1, marginLeft: 68 },

  footer: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12, textAlign: 'center', marginTop: spacing.md },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
  goalPickerCard: { width: '100%', borderRadius: radii.xl, borderWidth: 1, padding: spacing.xl, ...softShadow },
  goalPickerTitle: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 18, fontWeight: '800', marginBottom: spacing.lg, textAlign: 'center' },
  goalOptionsList: { gap: spacing.sm },
  goalOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.md, borderRadius: radii.full, borderWidth: 1 },
  goalOptionText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 15, fontWeight: '700' },

  // 编辑资料弹窗
  editProfileCard: { width: '100%', borderRadius: radii.xl, borderWidth: 1, padding: spacing.xl, ...softShadow },
  editProfileTitle: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 18, fontWeight: '800', marginBottom: spacing.lg, textAlign: 'center' },
  editProfileLabel: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 13, fontWeight: '600', marginBottom: spacing.xs, marginTop: spacing.md },
  editProfileInput: { height: 48, borderRadius: radii.md, borderWidth: 1, paddingHorizontal: spacing.md, fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 15, fontWeight: '600' },
  modalBtns: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.xl },
  modalCancel: { flex: 1, height: 44, borderRadius: radii.full, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  modalCancelText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 14, fontWeight: '600' },
  modalSave: { flex: 1, height: 44, borderRadius: radii.full, alignItems: 'center', justifyContent: 'center' },
  modalSaveText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
});

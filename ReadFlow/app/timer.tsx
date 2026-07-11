import { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  Image,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { spacing, radii } from '../src/theme';
import { softShadow } from '../src/theme/shadows';
import { formatDuration, formatTimer } from '../src/utils/format';
import { useBookStore } from '../src/stores/useBookStore';
import { useReadingStore } from '../src/stores/useReadingStore';
import { useSourceStore } from '../src/stores/useSourceStore';
import { useNoteStore } from '../src/stores/useNoteStore';
import { useHighlightStore } from '../src/stores/useHighlightStore';
import { useColors } from '../src/stores/useThemeStore';
import { safeGoBack } from '../src/utils/navigation';

export default function TimerScreen() {
  const { bookId, sourceId, bookTitle } = useLocalSearchParams<{
    bookId: string;
    sourceId: string;
    bookTitle: string;
  }>();
  const t = useColors();
  const addManualLog = useReadingStore((s) => s.addManualLog);
  const addNote = useNoteStore((s) => s.addNote);
  const addHighlight = useHighlightStore((s) => s.addHighlight);
  const books = useBookStore((s) => s.books);

  const [startTime] = useState(Date.now());
  const [pausedAt, setPausedAt] = useState<number | null>(null);
  const [pausedMs, setPausedMs] = useState(0);
  const [displayMs, setDisplayMs] = useState(0);
  const [stopped, setStopped] = useState(false);
  const [countdown, setCountdown] = useState(false);
  const [countdownMinutes, setCountdownMinutes] = useState(25);
  const [showCountdownPicker, setShowCountdownPicker] = useState(false);
  const [logForm, setLogForm] = useState({ pages: '', chapter: '', note: '', quote: '' });
  const [menuVisible, setMenuVisible] = useState(false);
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });
  const [noteModalVisible, setNoteModalVisible] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [noteQuote, setNoteQuote] = useState('');
  const [notePage, setNotePage] = useState('');

  const book = books.find((b) => b.id === bookId);
  const title = book?.title || decodeURIComponent(bookTitle || '') || '阅读';
  const isRunning = pausedAt === null && !stopped;
  const isPaused = pausedAt !== null;

  useEffect(() => {
    if (stopped) return;
    const interval = setInterval(() => {
      if (pausedAt === null) setDisplayMs(Date.now() - startTime - pausedMs);
    }, 200);
    return () => clearInterval(interval);
  }, [stopped, pausedAt, startTime, pausedMs]);

  const handlePause = () => setPausedAt(Date.now());
  const handleResume = () => {
    if (pausedAt !== null) {
      setPausedMs((prev) => prev + (Date.now() - pausedAt));
      setPausedAt(null);
    }
  };

  // 保存计时中的想法/高亮到书籍详情页阅读笔记 Tab
  const handleSaveNote = useCallback(async () => {
    const q = noteQuote.trim();
    const n = noteText.trim();
    const pg = parseInt(notePage, 10);
    if (!bookId) return;
    try {
      if (q) {
        // 有原文引用 → 创建高亮（可附带想法）
        await addHighlight({
          book_id: bookId,
          content: q,
          color: '#F5A623',
          note: n || undefined,
          page_number: isNaN(pg) ? undefined : pg,
        });
      } else if (n) {
        // 仅有想法 → 创建笔记
        await addNote({
          book_id: bookId,
          content: n,
          page_number: isNaN(pg) ? undefined : pg,
        });
      }
    } catch (e) {
      console.warn('Timer note sync failed:', e);
    }
    setNoteModalVisible(false);
    setNoteText('');
    setNoteQuote('');
    setNotePage('');
  }, [bookId, noteQuote, noteText, notePage, addHighlight, addNote]);

  const handleStop = () => {
    const totalMs = pausedAt !== null ? pausedAt - startTime - pausedMs : Date.now() - startTime - pausedMs;
    setStopped(true);
    if (totalMs < 10000) { safeGoBack(); return; }
    setDisplayMs(totalMs);
  };

  const handleSave = async () => {
    const pages = parseInt(logForm.pages, 10);
    const pageNumber = isNaN(pages) ? undefined : pages;
    if (!bookId) return;
    try {
      await addManualLog(bookId, displayMs, logForm.note.trim() || undefined, title, pageNumber, logForm.chapter.trim() || undefined, false, sourceId || undefined);
      if (pageNumber != null && pageNumber > 0 && sourceId) {
        await useSourceStore.getState().updateSourceProgress(sourceId, pageNumber);
      }
      // 同步笔记 + 原文引用到书籍详情页阅读笔记 Tab
      const noteText = logForm.note.trim();
      const quoteText = logForm.quote.trim();
      try {
        if (quoteText) {
          await addHighlight({ book_id: bookId, content: quoteText, note: noteText || undefined, page_number: pageNumber });
        } else if (noteText) {
          await addNote({ book_id: bookId, content: noteText, page_number: pageNumber });
        }
      } catch {}
      safeGoBack();
    } catch { Alert.alert('保存失败', '请重试'); }
  };

  if (!stopped) {
    return (
      <View style={[styles.root, { backgroundColor: t.paper.primary }]}>
        <View style={[styles.navBar, { borderBottomColor: t.outline.standard }]}>
          <TouchableOpacity onPress={handleStop} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close" size={24} color={t.ink.primary} />
          </TouchableOpacity>
          <Text style={[styles.navTitle, { color: t.ink.primary }]} numberOfLines={1}>{title}</Text>
          <TouchableOpacity onPress={() => setMenuVisible(true)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="ellipsis-horizontal" size={24} color={t.ink.primary} />
          </TouchableOpacity>
        </View>

        {menuVisible && (
          <>
            <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setMenuVisible(false)} />
            <View style={[styles.menuDropdown, { backgroundColor: t.paper.primary, borderColor: t.outline.standard }]}>
              <View style={[styles.menuItem, { borderBottomColor: t.outline.standard }]}>
                <Ionicons name="tablet-portrait-outline" size={16} color={t.ink.secondary} />
                <Text style={[styles.menuItemText, { color: t.ink.secondary }]}>悬浮窗：返回其他页面时持续显示计时气泡</Text>
              </View>
              <View style={styles.menuItem}>
                <Ionicons name="lock-closed-outline" size={16} color={t.ink.secondary} />
                <Text style={[styles.menuItemText, { color: t.ink.secondary }]}>锁屏计时：通知栏显示计时进度</Text>
              </View>
            </View>
          </>
        )}

        <View style={styles.coverSection}>
          {book?.cover_url ? (
            <Image source={{ uri: book.cover_url }} style={styles.cover} resizeMode="contain" />
          ) : (
            <View style={[styles.coverPlaceholder, { backgroundColor: t.accent.primaryBg }]}>
              <Ionicons name="book" size={48} color={t.accent.primary} />
              <Text style={[styles.coverTitle, { color: t.ink.primary }]} numberOfLines={2}>{title}</Text>
            </View>
          )}
        </View>

        <View style={styles.timerSection}>
          <Text style={[styles.timerLabel, { color: t.ink.tertiary }]}>{countdown ? '倒计时' : '正计时'}</Text>
          <Text style={[styles.timerValue, { color: t.ink.primary }]}>{countdown ? formatTimer(Math.max(0, countdownMinutes * 60000 - displayMs)) : formatTimer(displayMs)}</Text>
          <View style={styles.smallBtns}>
            <TouchableOpacity style={[styles.smallBtn, { borderColor: t.outline.standard }]} onPress={() => setNoteModalVisible(true)} activeOpacity={0.6}>
              <Ionicons name="create-outline" size={20} color={t.ink.secondary} />
              <Text style={[styles.smallBtnText, { color: t.ink.secondary }]}>笔记</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.smallBtn, { borderColor: countdown ? t.accent.primary : t.outline.standard, backgroundColor: countdown ? t.accent.primaryBg : 'transparent' }]}
              onPress={() => { if (!countdown) setShowCountdownPicker(true); else setCountdown(false); }}
              activeOpacity={0.6}
            >
              <Ionicons name="timer-outline" size={20} color={countdown ? t.accent.primary : t.ink.secondary} />
              <Text style={[styles.smallBtnText, { color: countdown ? t.accent.primary : t.ink.secondary }]}>{countdown ? `${countdownMinutes}分` : '倒计时'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.controlSection}>
          {isRunning ? (
            <TouchableOpacity style={[styles.bigBtn, { backgroundColor: t.accent.yellowBg, borderColor: t.accent.yellow }]} onPress={handlePause} activeOpacity={0.7}>
              <Ionicons name="pause" size={36} color={t.accent.yellow} />
              <Text style={[styles.bigBtnLabel, { color: t.accent.yellow }]}>暂停</Text>
            </TouchableOpacity>
          ) : isPaused ? (
            <TouchableOpacity style={[styles.bigBtn, { backgroundColor: t.accent.greenBg, borderColor: t.accent.green }]} onPress={handleResume} activeOpacity={0.7}>
              <Ionicons name="play" size={36} color={t.accent.green} />
              <Text style={[styles.bigBtnLabel, { color: t.accent.green }]}>继续</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity style={[styles.bigBtn, { backgroundColor: '#FDDEE5', borderColor: t.accent.pink }]} onPress={handleStop} activeOpacity={0.7}>
            <Ionicons name="stop" size={36} color={t.accent.pink} />
            <Text style={[styles.bigBtnLabel, { color: t.accent.pink }]}>结束</Text>
          </TouchableOpacity>
        </View>

        {/* 倒计时选择器 */}
        <Modal visible={showCountdownPicker} transparent animationType="fade">
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowCountdownPicker(false)} />
          <View style={[styles.pickerBox, { backgroundColor: t.paper.primary, borderColor: t.outline.standard }]}>
            <Text style={[styles.pickerTitle, { color: t.ink.primary }]}>选择倒计时时长</Text>
            <View style={styles.pickerRow}>
              {[5, 10, 15, 20, 25, 30, 45, 60].map((m) => (
                <TouchableOpacity key={m} style={[styles.pickerOption, { borderColor: t.outline.standard, backgroundColor: countdownMinutes === m ? t.accent.primary : t.paper.white }]} onPress={() => { setCountdownMinutes(m); setCountdown(true); setShowCountdownPicker(false); }} activeOpacity={0.7}>
                  <Text style={{ fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 14, color: countdownMinutes === m ? t.ink.inverse : t.ink.primary }}>{m}分</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </Modal>

        {/* 笔记弹窗 — 支持原文引用、页码、想法，同步到书籍详情页阅读笔记 Tab */}
        <Modal visible={noteModalVisible} transparent animationType="fade">
          <View style={[styles.noteOverlay, { backgroundColor: 'rgba(0,0,0,0.4)' }]}>
            <View style={[styles.noteSheet, { backgroundColor: t.paper.primary, borderColor: t.outline.standard }]}>
              <View style={[styles.noteHeader, { borderBottomColor: t.outline.standard }]}>
                <Text style={[styles.noteTitle, { color: t.ink.primary }]}>阅读笔记</Text>
                <TouchableOpacity onPress={() => { setNoteModalVisible(false); setNoteText(''); setNoteQuote(''); setNotePage(''); }}>
                  <Ionicons name="close" size={20} color={t.ink.tertiary} />
                </TouchableOpacity>
              </View>
              {/* 原文引用（可选） */}
              <Text style={[styles.noteFieldLabel, { color: t.ink.secondary }]}>原文引用（可选）</Text>
              <TextInput
                style={[styles.noteInput, { backgroundColor: t.paper.white, borderColor: t.outline.standard, color: t.ink.primary, minHeight: 60 }]}
                value={noteQuote}
                onChangeText={setNoteQuote}
                placeholder="粘贴原文..."
                placeholderTextColor={t.ink.tertiary}
                multiline
                numberOfLines={2}
                textAlignVertical="top"
              />
              {/* 页码（可选） */}
              <Text style={[styles.noteFieldLabel, { color: t.ink.secondary }]}>第几页（可选）</Text>
              <TextInput
                style={[styles.noteInput, { backgroundColor: t.paper.white, borderColor: t.outline.standard, color: t.ink.primary, minHeight: 40 }]}
                value={notePage}
                onChangeText={setNotePage}
                placeholder="例如：32"
                placeholderTextColor={t.ink.tertiary}
                keyboardType="number-pad"
                maxLength={6}
              />
              {/* 想法/笔记 */}
              <Text style={[styles.noteFieldLabel, { color: t.ink.secondary }]}>我的想法（可选）</Text>
              <TextInput
                style={[styles.noteInput, { backgroundColor: t.paper.white, borderColor: t.outline.standard, color: t.ink.primary, minHeight: 80 }]}
                value={noteText}
                onChangeText={setNoteText}
                placeholder="记录你的想法..."
                placeholderTextColor={t.ink.tertiary}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
              <TouchableOpacity
                style={[styles.noteSaveBtn, { backgroundColor: t.ink.primary, opacity: (!noteQuote.trim() && !noteText.trim()) ? 0.4 : 1 }]}
                onPress={handleSaveNote}
                disabled={!noteQuote.trim() && !noteText.trim()}
                activeOpacity={0.8}
              >
                <Text style={[styles.noteSaveText, { color: t.ink.inverse }]}>保存到阅读笔记</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: t.paper.primary }]}>
      <View style={[styles.navBar, { borderBottomColor: t.outline.standard }]}>
        <TouchableOpacity onPress={() => safeGoBack()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="close" size={24} color={t.ink.primary} />
        </TouchableOpacity>
        <Text style={[styles.navTitle, { color: t.ink.primary }]}>记录阅读</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.formContainer}>
        <View style={[styles.resultCard, { backgroundColor: t.paper.white, borderColor: t.outline.standard }]}>
          <Ionicons name="time-outline" size={24} color={t.accent.primary} />
          <Text style={[styles.resultTitle, { color: t.ink.primary }]}>{title}</Text>
          <Text style={[styles.resultDuration, { color: t.accent.primary }]}>阅读 {formatDuration(displayMs)}</Text>
        </View>
        <Text style={[styles.formLabel, { color: t.ink.secondary }]}>阅读页数（可选）</Text>
        <TextInput style={[styles.formInput, { backgroundColor: t.paper.white, borderColor: t.outline.standard, color: t.ink.primary }]} value={logForm.pages} onChangeText={(v) => setLogForm((p) => ({ ...p, pages: v }))} placeholder="例如：32" placeholderTextColor={t.ink.tertiary} keyboardType="number-pad" />
        <Text style={[styles.formLabel, { color: t.ink.secondary }]}>当前章节（可选）</Text>
        <TextInput style={[styles.formInput, { backgroundColor: t.paper.white, borderColor: t.outline.standard, color: t.ink.primary }]} value={logForm.chapter} onChangeText={(v) => setLogForm((p) => ({ ...p, chapter: v }))} placeholder="例如：第三章" placeholderTextColor={t.ink.tertiary} maxLength={50} />
        <Text style={[styles.formLabel, { color: t.ink.secondary }]}>原文引用（可选）</Text>
        <TextInput style={[styles.formInput, { backgroundColor: t.paper.white, borderColor: t.outline.standard, color: t.ink.primary }]} value={logForm.quote} onChangeText={(v) => setLogForm((p) => ({ ...p, quote: v }))} placeholder="粘贴原文..." placeholderTextColor={t.ink.tertiary} maxLength={500} />
        <Text style={[styles.formLabel, { color: t.ink.secondary }]}>笔记（可选）</Text>
        <TextInput style={[styles.formTextarea, { backgroundColor: t.paper.white, borderColor: t.outline.standard, color: t.ink.primary }]} value={logForm.note} onChangeText={(v) => setLogForm((p) => ({ ...p, note: v }))} placeholder="记录你的想法..." placeholderTextColor={t.ink.tertiary} multiline numberOfLines={3} textAlignVertical="top" maxLength={200} />
        <TouchableOpacity style={[styles.saveBtn, { backgroundColor: t.ink.primary }]} onPress={handleSave} activeOpacity={0.8}>
          <Text style={[styles.saveBtnText, { color: t.ink.inverse }]}>保存记录</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.discardBtn} onPress={() => safeGoBack()} activeOpacity={0.6}>
          <Text style={[styles.discardBtnText, { color: t.ink.tertiary }]}>放弃记录</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  navBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth },
  navTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 16, fontWeight: '700', flex: 1, textAlign: 'center', marginHorizontal: spacing.md },
  menuDropdown: { position: 'absolute', top: 52, right: spacing.md, width: 200, borderRadius: radii.lg, borderWidth: 1, zIndex: 10, ...softShadow },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth },
  menuItemText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 13, fontWeight: '600' },

  coverSection: { alignItems: 'center', paddingVertical: spacing.xl },
  cover: { width: 120, height: 160, borderRadius: radii.md },
  coverPlaceholder: { width: 120, height: 160, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center', padding: spacing.md, gap: spacing.xs },
  coverTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11, fontWeight: '700', textAlign: 'center', lineHeight: 14 },

  timerSection: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl },
  timerLabel: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 14, fontWeight: '600', marginBottom: spacing.sm },
  timerValue: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 56, fontWeight: '800', letterSpacing: -1, fontVariant: ['tabular-nums'] },
  smallBtns: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.xl },
  smallBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radii.full, borderWidth: 1 },
  smallBtnText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 13, fontWeight: '600' },

  controlSection: { flexDirection: 'row', justifyContent: 'center', gap: spacing.xl, paddingHorizontal: spacing.xl, paddingBottom: 60 },
  bigBtn: { width: 100, height: 100, borderRadius: 50, borderWidth: 2, alignItems: 'center', justifyContent: 'center', gap: 4 },
  bigBtnLabel: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13, fontWeight: '700' },

  formContainer: { flex: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.xl },
  resultCard: { borderRadius: radii.lg, borderWidth: 1, padding: spacing.xl, alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xl, ...softShadow },
  resultTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 16, fontWeight: '700' },
  resultDuration: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 28, fontWeight: '800' },
  formLabel: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13, fontWeight: '700', marginBottom: spacing.sm, marginTop: spacing.md },
  formInput: { height: 48, borderRadius: radii.md, borderWidth: 1, paddingHorizontal: spacing.md, fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 15, fontWeight: '600' },
  formTextarea: { borderRadius: radii.md, borderWidth: 1, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontFamily: 'PlusJakartaSans_400Regular', fontSize: 14, minHeight: 72, lineHeight: 20 },
  saveBtn: { height: 48, borderRadius: radii.full, alignItems: 'center', justifyContent: 'center', marginTop: spacing.xl },
  saveBtnText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 15, fontWeight: '700' },
  discardBtn: { alignItems: 'center', paddingVertical: spacing.md, marginTop: spacing.sm },
  discardBtnText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 13, fontWeight: '600' },

  // 倒计时选择器
  modalOverlay: { flex: 1 },
  pickerBox: { position: 'absolute', bottom: 40, left: spacing.lg, right: spacing.lg, borderRadius: radii.xl, borderWidth: 1, padding: spacing.xl, ...softShadow },
  pickerTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 16, fontWeight: '700', marginBottom: spacing.md, textAlign: 'center' },
  pickerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'center' },
  pickerOption: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radii.full, borderWidth: 1 },

  // 笔记弹窗
  noteOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: spacing.xl },
  noteSheet: { width: '100%', borderRadius: radii.xl, borderWidth: 1, padding: spacing.lg, ...softShadow },
  noteHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md, paddingBottom: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  noteTitle: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 16, fontWeight: '800' },
  noteFieldLabel: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12, fontWeight: '600', marginBottom: 4, marginTop: spacing.xs },
  noteInput: { borderRadius: radii.md, borderWidth: 1, padding: spacing.md, fontFamily: 'PlusJakartaSans_400Regular', fontSize: 14, minHeight: 100, lineHeight: 20, marginBottom: spacing.md },
  noteSaveBtn: { height: 44, borderRadius: radii.full, alignItems: 'center', justifyContent: 'center' },
  noteSaveText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14, fontWeight: '700' },
  noteCancelBtn: { flex: 1, height: 44, borderRadius: radii.full, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  noteCancelText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 14, fontWeight: '600' },
  noteBtns: { flexDirection: 'row', gap: spacing.md },
});

import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useRouter } from 'expo-router';
import { useSourceStore } from '../../stores/useSourceStore';
import type { ReadingSourceType } from '../../models';
import { spacing, radii } from '../../theme';
import { softShadow } from '../../theme/shadows';
import { useSheetAnimation } from '../../hooks/useSheetAnimation';
import { useColors } from '../../stores/useThemeStore';

interface AddSourceSheetProps {
  visible: boolean;
  bookId: string;
  onClose: () => void;
  onAdded: (shouldStartTimer?: boolean) => void;
}

/**
 * AddSourceSheet — 添加阅读来源弹窗 (v3.0)
 *
 * 3 选项选择器：
 * 1. 导入电子书文件 → DocumentPicker → 创建 epub/pdf 来源 → 跳转阅读器
 * 2. 纸质书 → 直接创建 physical 来源 → 触发计时
 * 3. 其他平台 → 输入平台名称 → 创建 external 来源 → 触发计时
 */
export default function AddSourceSheet({ visible, bookId, onClose, onAdded }: AddSourceSheetProps) {
  const t = useColors();
  const router = useRouter();
  const addSource = useSourceStore((s) => s.addSource);
  const sources = useSourceStore((s) => s.sources);
  const { sheetStyle, backdropStyle } = useSheetAnimation(visible);

  const [step, setStep] = useState<'menu' | 'platformName'>('menu');
  const [platformName, setPlatformName] = useState('');
  const [saving, setSaving] = useState(false);

  const resetForm = useCallback(() => {
    setStep('menu');
    setPlatformName('');
    setSaving(false);
  }, []);

  const handleClose = useCallback(() => {
    resetForm();
    onClose();
  }, [onClose, resetForm]);

  // ---- 1. 导入电子书文件 ----
  const handleImportFile = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/epub+zip',
          'application/pdf',
          'application/x-mobipocket-ebook',
          'text/plain',
          'application/vnd.comicbook+zip',
        ],
        copyToCacheDirectory: true,
      });
      if (!result.canceled) {
        const file = result.assets[0];
        const sourceType: ReadingSourceType = file.name?.endsWith('.pdf') ? 'pdf' : 'epub';
        const sourceLabel = file.name?.replace(/\.(epub|pdf|mobi|txt|cbz)$/i, '') || '电子书';

        // 去重：检查是否已有相同类型的电子书来源
        const existingSameType = sources.find((s) => s.type === sourceType);
        if (existingSameType) {
          Alert.alert(
            '来源已存在',
            `该书已有 ${sourceType.toUpperCase()} 来源"${existingSameType.label}"，是否替换？`,
            [
              { text: '取消', style: 'cancel' },
              {
                text: '替换',
                style: 'destructive',
                onPress: async () => {
                  await useSourceStore.getState().deleteSource(existingSameType.id);
                  if (existingSameType.file_uri) {
                    await require('../../services/importService').deleteSourceFile(existingSameType.file_uri);
                  }
                  const newSource = await addSource(bookId, sourceType, sourceLabel, file.uri, file.name);
                  resetForm();
                  onClose();
                  onAdded();
                  router.push(`/reader/${newSource.id}`);
                },
              },
            ],
          );
          return;
        }

        const newSource = await addSource(bookId, sourceType, sourceLabel, file.uri, file.name);
        resetForm();
        onClose();
        onAdded();
        // 直接跳转阅读器
        router.push(`/reader/${newSource.id}`);
      }
    } catch (e: any) {
      Alert.alert('导入失败', e?.message ?? '请重试');
    }
  }, [bookId, addSource, sources, onAdded, onClose, resetForm, router]);

  // ---- 2. 纸质书 ----
  const handlePhysical = useCallback(async () => {
    if (sources.some((s) => s.type === 'physical')) {
      Alert.alert('', '该书已有纸质书来源');
      return;
    }
    setSaving(true);
    await addSource(bookId, 'physical', '纸质书');
    setSaving(false);
    resetForm();
    onClose();
    onAdded(false); // 不自动开始计时，用户需手动点击
  }, [bookId, addSource, sources, onAdded, onClose, resetForm]);

  // ---- 3. 其他平台：先输入平台名称 ----
  const handleExternal = useCallback(() => {
    setStep('platformName');
  }, []);

  const handleConfirmExternal = useCallback(async () => {
    const name = platformName.trim();
    if (!name) {
      Alert.alert('', '请输入平台名称');
      return;
    }
    // 去重：检查是否已有相同 label 的外部来源
    const existingSameLabel = sources.find((s) => s.type === 'external' && s.label === name);
    if (existingSameLabel) {
      Alert.alert('来源已存在', `已有"${name}"平台的来源，无法重复添加`);
      return;
    }
    setSaving(true);
    await addSource(bookId, 'external', name);
    setSaving(false);
    resetForm();
    onClose();
    onAdded(false); // 不自动开始计时，用户需手动点击
  }, [platformName, bookId, addSource, sources, onAdded, onClose, resetForm]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Animated.View style={[styles.backdrop, backdropStyle]}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={handleClose} />
        </Animated.View>

        <Animated.View style={[styles.sheet, sheetStyle]}>
          <View style={[styles.sheetBody, { backgroundColor: t.paper.primary, borderColor: t.outline.standard }]}>
            {/* 标题 */}
            <View style={styles.header}>
              <Text style={[styles.title, { color: t.ink.primary }]}>
                {step === 'menu' ? '选择阅读方式' : '其他平台'}
              </Text>
              <TouchableOpacity onPress={handleClose} activeOpacity={0.7}>
                <Ionicons name="close" size={22} color={t.ink.tertiary} />
              </TouchableOpacity>
            </View>

            {/* ===== 菜单：3 选项 ===== */}
            {step === 'menu' && (
              <View style={styles.optionList}>
                {/* 导入电子书文件 */}
                <TouchableOpacity
                  style={[styles.optionCard, { backgroundColor: t.paper.white, borderColor: t.outline.standard }]}
                  onPress={handleImportFile}
                  activeOpacity={0.7}
                >
                  <View style={[styles.optionIcon, { backgroundColor: t.accent.primaryBg }]}>
                    <Ionicons name="folder-open-outline" size={24} color={t.accent.primary} />
                  </View>
                  <View style={styles.optionInfo}>
                    <Text style={[styles.optionLabel, { color: t.ink.primary }]}>导入电子书文件</Text>
                    <Text style={[styles.optionHint, { color: t.ink.tertiary }]}>
                      支持 EPUB / PDF / MOBI / TXT
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={t.ink.tertiary} />
                </TouchableOpacity>

                {/* 纸质书 */}
                <TouchableOpacity
                  style={[styles.optionCard, { backgroundColor: t.paper.white, borderColor: t.outline.standard }]}
                  onPress={handlePhysical}
                  activeOpacity={0.7}
                  disabled={saving}
                >
                  <View style={[styles.optionIcon, { backgroundColor: t.accent.greenBg }]}>
                    <Ionicons name="book-outline" size={24} color={t.accent.green} />
                  </View>
                  <View style={styles.optionInfo}>
                    <Text style={[styles.optionLabel, { color: t.ink.primary }]}>纸质书</Text>
                    <Text style={[styles.optionHint, { color: t.ink.tertiary }]}>
                      实体书阅读，手动计时
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={t.ink.tertiary} />
                </TouchableOpacity>

                {/* 其他平台 */}
                <TouchableOpacity
                  style={[styles.optionCard, { backgroundColor: t.paper.white, borderColor: t.outline.standard }]}
                  onPress={handleExternal}
                  activeOpacity={0.7}
                >
                  <View style={[styles.optionIcon, { backgroundColor: t.accent.blueBg }]}>
                    <Ionicons name="globe-outline" size={24} color={t.accent.blue} />
                  </View>
                  <View style={styles.optionInfo}>
                    <Text style={[styles.optionLabel, { color: t.ink.primary }]}>其他平台</Text>
                    <Text style={[styles.optionHint, { color: t.ink.tertiary }]}>
                      微信读书 / Kindle / 其他
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={t.ink.tertiary} />
                </TouchableOpacity>
              </View>
            )}

            {/* ===== 预设平台 + 自定义输入 ===== */}
            {step === 'platformName' && (
              <View>
                <Text style={[styles.inputLabel, { color: t.ink.secondary }]}>常用平台</Text>
                <View style={styles.presetRow}>
                  {['微信读书', 'Kindle', '开源阅读', '豆瓣阅读', '得到', '多看阅读'].map((preset) => (
                    <TouchableOpacity
                      key={preset}
                      style={[styles.presetChip, { backgroundColor: t.paper.white, borderColor: t.outline.standard }]}
                      onPress={async () => {
                        setPlatformName(preset);
                        // 直接创建
                        const existing = sources.find((s) => s.type === 'external' && s.label === preset);
                        if (existing) { Alert.alert('来源已存在', `已有"${preset}"平台的来源`); return; }
                        setSaving(true);
                        await addSource(bookId, 'external', preset);
                        setSaving(false);
                        resetForm();
                        onClose();
                        onAdded(false);
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.presetChipText, { color: t.ink.primary }]}>{preset}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={[styles.inputLabel, { color: t.ink.secondary, marginTop: spacing.md }]}>其他平台</Text>
                <TextInput
                  style={[styles.textInput, { backgroundColor: t.paper.white, borderColor: t.outline.standard, color: t.ink.primary }]}
                  value={platformName}
                  onChangeText={setPlatformName}
                  placeholder="输入平台名称..."
                  placeholderTextColor={t.ink.tertiary}
                  autoFocus
                  maxLength={30}
                  onSubmitEditing={handleConfirmExternal}
                  returnKeyType="done"
                />

                <TouchableOpacity
                  style={[styles.confirmBtn, { backgroundColor: t.ink.primary, opacity: saving ? 0.6 : 1 }]}
                  onPress={handleConfirmExternal}
                  disabled={saving}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.confirmBtnText, { color: t.ink.inverse }]}>
                    {saving ? '添加中...' : '确认添加'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.backBtn, { borderColor: t.outline.standard }]}
                  onPress={() => setStep('menu')}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.backBtnText, { color: t.ink.secondary }]}>返回</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },

  sheet: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.xxl,
  },
  sheetBody: {
    borderRadius: radii.xl,
    borderWidth: 1,
    padding: spacing.lg,
    ...softShadow,
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 18,
    fontWeight: '800',
  },

  // ---- 选项卡片 ----
  optionList: { gap: spacing.md },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.md,
    ...softShadow,
  },
  optionIcon: {
    width: 48,
    height: 48,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionInfo: { flex: 1 },
  optionLabel: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  optionHint: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 12,
  },

  // ---- 平台名输入 ----
  inputLabel: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  presetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm },
  presetChip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radii.full, borderWidth: 1 },
  presetChipText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 13, fontWeight: '600' },
  textInput: {
    height: 48,
    borderRadius: radii.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 15,
    fontWeight: '600',
  },
  confirmBtn: {
    marginTop: spacing.lg,
    height: 48,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    ...softShadow,
  },
  confirmBtnText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 15,
    fontWeight: '700',
  },
  backBtn: {
    marginTop: spacing.md,
    borderRadius: radii.full,
    borderWidth: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  backBtnText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 13,
    fontWeight: '600',
  },
});

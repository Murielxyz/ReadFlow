import { useState, useCallback, useEffect } from 'react';
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
} from 'react-native';
import { spacing, radii } from '../../theme';
import { softShadow } from '../../theme/shadows';
import { useSheetAnimation } from '../../hooks/useSheetAnimation';
import { useCollectionStore } from '../../stores/useCollectionStore';
import { useColors } from '../../stores/useThemeStore';
import type { Collection } from '../../models';

/** 书单颜色预设（与项目 accent 色系一致的柔和色调） */
const COLLECTION_COLORS = [
  '#DFDEFE', // 紫
  '#D4E6FC', // 蓝
  '#D5F0E2', // 绿
  '#FFF0D9', // 黄
  '#FDDEE5', // 粉
  '#E5E0DB', // 灰
];

interface CreateCollectionSheetProps {
  visible: boolean;
  /** 编辑模式：传入已有书单；不传则为新建模式 */
  editCollection?: Collection | null;
  onClose: () => void;
  onSaved: () => void;
}

/**
 * CreateCollectionSheet — 创建/编辑书单底部弹窗
 *
 * 温暖简约风格，复用 useSheetAnimation。
 * 支持新建和编辑两种模式，切换时自动预填/清空。
 */
export default function CreateCollectionSheet({
  visible,
  editCollection,
  onClose,
  onSaved,
}: CreateCollectionSheetProps) {
  const t = useColors();
  const createCollection = useCollectionStore((s) => s.createCollection);
  const updateCollection = useCollectionStore((s) => s.updateCollection);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState<string>(COLLECTION_COLORS[0]);
  const [saving, setSaving] = useState(false);

  const { sheetStyle, backdropStyle } = useSheetAnimation(visible);
  const isEditing = !!editCollection;

  // visible / editCollection 变化时重置表单
  useEffect(() => {
    if (visible) {
      if (editCollection) {
        setName(editCollection.name);
        setDescription(editCollection.description ?? '');
        setColor(editCollection.color ?? COLLECTION_COLORS[0]);
      } else {
        setName('');
        setDescription('');
        setColor(COLLECTION_COLORS[0]);
      }
    }
  }, [visible, editCollection?.id]);

  const handleClose = useCallback(() => {
    setSaving(false);
    onClose();
  }, [onClose]);

  const canSave = name.trim().length > 0 && !saving;

  const handleSave = useCallback(async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      if (isEditing && editCollection) {
        await updateCollection(editCollection.id, {
          name: name.trim(),
          description: description.trim() || null,
          color,
        });
      } else {
        await createCollection(name.trim(), description.trim() || undefined, color);
      }
      onSaved();
      handleClose();
    } catch (e) {
      console.error('Save collection error:', e);
    } finally {
      setSaving(false);
    }
  }, [canSave, isEditing, editCollection, name, description, color, createCollection, updateCollection, onSaved, handleClose]);

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
            {/* 标题栏 */}
            <View style={styles.header}>
              <Text style={[styles.title, { color: t.ink.primary }]}>
                {isEditing ? '编辑书单' : '新建书单'}
              </Text>
              <TouchableOpacity onPress={handleClose} activeOpacity={0.7}>
                <Text style={[styles.closeBtn, { color: t.ink.tertiary }]}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* 书单名称 */}
            <Text style={[styles.label, { color: t.ink.secondary }]}>📝 书单名称</Text>
            <TextInput
              style={[styles.nameInput, { backgroundColor: t.paper.white, borderColor: t.outline.standard, color: t.ink.primary }]}
              value={name}
              onChangeText={setName}
              placeholder="输入书单名称..."
              placeholderTextColor={t.ink.tertiary}
              maxLength={30}
              autoFocus={!isEditing}
            />

            {/* 描述 */}
            <Text style={[styles.label, { color: t.ink.secondary }]}>💬 描述（可选）</Text>
            <TextInput
              style={[styles.descInput, { backgroundColor: t.paper.white, borderColor: t.outline.standard, color: t.ink.primary }]}
              value={description}
              onChangeText={setDescription}
              placeholder="一句话描述这个书单..."
              placeholderTextColor={t.ink.tertiary}
              multiline
              numberOfLines={2}
              textAlignVertical="top"
              maxLength={100}
            />

            {/* 颜色选择器 */}
            <Text style={[styles.label, { color: t.ink.secondary }]}>🎨 颜色</Text>
            <View style={styles.colorRow}>
              {COLLECTION_COLORS.map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[
                    styles.colorCircle,
                    { backgroundColor: c },
                    color === c && styles.colorCircleSelected,
                  ]}
                  onPress={() => setColor(c)}
                  activeOpacity={0.7}
                >
                  {color === c && (
                    <Text style={styles.colorCheck}>✓</Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>

            {/* 保存按钮 */}
            <TouchableOpacity
              style={[styles.saveButton, { backgroundColor: t.ink.primary, opacity: canSave ? 1 : 0.4 }]}
              onPress={handleSave}
              disabled={!canSave}
              activeOpacity={0.8}
            >
              <Text style={[styles.saveText, { color: t.ink.inverse }]}>
                {saving ? '保存中...' : isEditing ? '更新书单' : '创建书单'}
              </Text>
            </TouchableOpacity>
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
    zIndex: 1,
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
  closeBtn: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 18,
    fontWeight: '700',
    padding: spacing.xs,
  },

  label: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },

  // 名称输入
  nameInput: {
    height: 48,
    borderRadius: radii.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: spacing.md,
  },

  // 描述输入
  descInput: {
    borderRadius: radii.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 14,
    minHeight: 60,
    marginBottom: spacing.md,
    lineHeight: 20,
  },

  // 颜色选择
  colorRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  colorCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.6,
  },
  colorCircleSelected: {
    opacity: 1,
    borderWidth: 2,
    borderColor: '#1A1512',
  },
  colorCheck: {
    color: '#1A1512',
    fontSize: 14,
    fontWeight: '700',
  },

  saveButton: {
    height: 48,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    ...softShadow,
  },
  saveText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 15,
    fontWeight: '700',
  },
});

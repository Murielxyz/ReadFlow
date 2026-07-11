import { View, Text, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { radii, spacing } from '../../theme';
import { softShadow } from '../../theme/shadows';
import { useColors } from '../../stores/useThemeStore';

/**
 * AddBookMenuSheet — "+" 按钮弹出的 3 选项选择器
 *
 * 选项：
 * - 🔍 搜索添加：在线搜索书籍信息，自动填充表单
 * - 📂 导入本地文件：支持 EPUB/PDF/MOBI/TXT，自动识别元数据
 * - ✏️ 手动输入：手动填写书籍信息
 */

interface AddBookMenuSheetProps {
  visible: boolean;
  onClose: () => void;
  onSearch: () => void;
  onImport: () => void;
  onManual: () => void;
}

interface MenuOption {
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  title: string;
  description: string;
  onPress: () => void;
}

export default function AddBookMenuSheet({
  visible,
  onClose,
  onSearch,
  onImport,
  onManual,
}: AddBookMenuSheetProps) {
  const t = useColors();

  const options: MenuOption[] = [
    {
      key: 'search',
      icon: 'search',
      color: t.accent.blue,
      title: '搜索添加',
      description: '在线搜索书籍信息，自动填充表单',
      onPress: onSearch,
    },
    {
      key: 'import',
      icon: 'document-outline',
      color: t.accent.green,
      title: '导入本地文件',
      description: '支持 EPUB/PDF/MOBI/TXT，自动识别元数据',
      onPress: onImport,
    },
    {
      key: 'manual',
      icon: 'create-outline',
      color: t.accent.primary,
      title: '手动输入',
      description: '手动填写书籍信息',
      onPress: onManual,
    },
  ];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <View style={[styles.sheet, { backgroundColor: t.paper.primary, borderColor: t.outline.standard }]}>
          {/* 标题栏 */}
          <View style={[styles.header, { borderBottomColor: t.outline.standard }]}>
            <Text style={[styles.title, { color: t.ink.primary }]}>添加书籍</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={20} color={t.ink.tertiary} />
            </TouchableOpacity>
          </View>

          {/* 选项列表 */}
          {options.map((opt) => (
            <TouchableOpacity
              key={opt.key}
              style={[styles.option, { borderBottomColor: t.outline.standard }]}
              activeOpacity={0.6}
              onPress={() => {
                onClose();
                // 延迟回调，避免 Modal 关闭动画冲突
                setTimeout(opt.onPress, 200);
              }}
            >
              <View style={[styles.iconBox, { backgroundColor: opt.color + '14' }]}>
                <Ionicons name={opt.icon} size={22} color={opt.color} />
              </View>
              <View style={styles.optionText}>
                <Text style={[styles.optionTitle, { color: t.ink.primary }]}>{opt.title}</Text>
                <Text style={[styles.optionDesc, { color: t.ink.tertiary }]}>{opt.description}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={t.ink.tertiary} />
            </TouchableOpacity>
          ))}
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingBottom: spacing.xxxl,
    ...softShadow,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
  },
  title: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 18,
    fontWeight: '800',
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: spacing.md,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionText: {
    flex: 1,
  },
  optionTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 15,
    fontWeight: '700',
  },
  optionDesc: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 12,
    marginTop: 2,
  },
});

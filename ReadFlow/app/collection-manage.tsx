import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, router } from 'expo-router';
import { spacing, radii } from '../src/theme';
import { softShadow } from '../src/theme/shadows';
import { useColors } from '../src/stores/useThemeStore';
import { useCollectionStore } from '../src/stores/useCollectionStore';
import { getDatabase } from '../src/db/database';
import CreateCollectionSheet from '../src/components/library/CreateCollectionSheet';
import type { CollectionWithCount } from '../src/models';
import { safeGoBack } from '../src/utils/navigation';

export default function CollectionManageScreen() {
  const t = useColors();
  const collections = useCollectionStore((s) => s.collections);
  const fetchCollections = useCollectionStore((s) => s.fetchCollections);
  const deleteCollection = useCollectionStore((s) => s.deleteCollection);

  const [menuVisible, setMenuVisible] = useState(false);
  const [createVisible, setCreateVisible] = useState(false);
  const [editTarget, setEditTarget] = useState<CollectionWithCount | null>(null);
  const [batchMode, setBatchMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sortMode, setSortMode] = useState(false);
  const [cardMenuId, setCardMenuId] = useState<string | null>(null);
  const [cardMenuPos, setCardMenuPos] = useState({ x: 0, y: 0 });
  const [navMenuPos, setNavMenuPos] = useState({ x: 0, y: 0 });
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());

  const updateCollection = useCollectionStore((s) => s.updateCollection);

  // 加载/保存隐藏状态
  const loadHidden = useCallback(async () => {
    try {
      const db = await getDatabase();
      const row = await db.getFirstAsync<{ value: string }>("SELECT value FROM user_settings WHERE key = 'hidden_collections'");
      if (row && row.value) {
        try { setHiddenIds(new Set(JSON.parse(row.value))); } catch {}
      }
    } catch {}
  }, []);
  const saveHidden = useCallback(async (ids: Set<string>) => {
    try {
      const db = await getDatabase();
      await db.runAsync("INSERT OR REPLACE INTO user_settings (key, value) VALUES ('hidden_collections', ?)", [JSON.stringify([...ids])]);
    } catch {}
  }, []);
  const toggleHidden = useCallback((id: string) => {
    setHiddenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      saveHidden(next);
      return next;
    });
  }, [saveHidden]);

  useFocusEffect(useCallback(() => { fetchCollections(); loadHidden(); }, [fetchCollections, loadHidden]));

  // 进入排序模式时，初始化 sort_order（所有新书单默认为 0）
  const initSortOrder = async () => {
    const items = [...collections];
    for (let i = 0; i < items.length; i++) {
      if (items[i].sort_order !== i) {
        await updateCollection(items[i].id, { sort_order: i });
      }
    }
    await fetchCollections();
  };

  const handleMoveUp = async (index: number) => {
    if (index <= 0) return;
    // 交换当前项和上一项的 sort_order
    const current = collections[index];
    const above = collections[index - 1];
    await updateCollection(current.id, { sort_order: above.sort_order });
    await updateCollection(above.id, { sort_order: current.sort_order });
    await fetchCollections();
  };
  const handleMoveDown = async (index: number) => {
    if (index >= collections.length - 1) return;
    const current = collections[index];
    const below = collections[index + 1];
    await updateCollection(current.id, { sort_order: below.sort_order });
    await updateCollection(below.id, { sort_order: current.sort_order });
    await fetchCollections();
  };

  const handleDelete = (coll: CollectionWithCount) => {
    Alert.alert(coll.name, '确定要删除这个书单吗？\n\n书单中的书籍不会被删除。', [
      { text: '取消', style: 'cancel' },
      { text: '删除', style: 'destructive', onPress: () => deleteCollection(coll.id) },
    ]);
  };

  return (
    <View style={[styles.root, { backgroundColor: t.paper.primary }]}>
      {/* 导航栏 */}
      <View style={[styles.navBar, { borderBottomColor: t.outline.standard }]}>
        <TouchableOpacity onPress={() => safeGoBack()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="chevron-back" size={24} color={t.ink.primary} />
        </TouchableOpacity>
        <Text style={[styles.navTitle, { color: t.ink.primary }]}>书单管理</Text>
        <TouchableOpacity onPressIn={(e) => setNavMenuPos({ x: e.nativeEvent.pageX, y: e.nativeEvent.pageY })} onPress={() => setMenuVisible(true)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="ellipsis-horizontal" size={24} color={t.ink.primary} />
        </TouchableOpacity>
      </View>

      {/* ⋯ 菜单 */}
      <Modal visible={menuVisible} transparent animationType="fade">
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setMenuVisible(false)} />
        <View style={[styles.menuDropdown, { backgroundColor: t.paper.primary, borderColor: t.outline.standard, top: navMenuPos.y - 10, left: navMenuPos.x - 150 }]}>
          <TouchableOpacity style={[styles.menuItem, { borderBottomColor: t.outline.standard }]} onPress={() => { setMenuVisible(false); setCreateVisible(true); }} activeOpacity={0.6}>
            <Ionicons name="add-circle-outline" size={18} color={t.ink.secondary} />
            <Text style={[styles.menuItemText, { color: t.ink.primary }]}>创建书单</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.menuItem, { borderBottomColor: t.outline.standard }]} onPress={() => { setMenuVisible(false); setBatchMode(!batchMode); setSelected(new Set()); setSortMode(false); }} activeOpacity={0.6}>
            <Ionicons name="checkbox-outline" size={18} color={t.ink.secondary} />
            <Text style={[styles.menuItemText, { color: t.ink.primary }]}>{batchMode ? '退出管理' : '批量操作'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.menuItem, { borderBottomColor: t.outline.standard }]} onPress={() => { setMenuVisible(false); if (!sortMode) { initSortOrder(); } setSortMode(!sortMode); setBatchMode(false); setSelected(new Set()); }} activeOpacity={0.6}>
            <Ionicons name="swap-vertical-outline" size={18} color={t.ink.secondary} />
            <Text style={[styles.menuItemText, { color: t.ink.primary }]}>{sortMode ? '完成排序' : '自定义排序'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem} onPress={() => { setMenuVisible(false); if (collections.length > 0) { Alert.alert('删除全部', `确定要删除全部 ${collections.length} 个书单吗？`, [{ text: '取消', style: 'cancel' }, { text: '删除', style: 'destructive', onPress: () => collections.forEach((c) => deleteCollection(c.id)) }]); } }} activeOpacity={0.6}>
            <Ionicons name="trash-outline" size={18} color={t.accent.pink} />
            <Text style={[styles.menuItemText, { color: t.accent.pink }]}>删除全部</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* 内容 */}
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {collections.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="folder-open-outline" size={48} color={t.ink.tertiary} />
            <Text style={[styles.emptyText, { color: t.ink.primary }]}>还没有书单</Text>
          </View>
        ) : (
          collections.map((coll, index) => {
            const isSelected = selected.has(coll.id);
            const showCardMenu = cardMenuId === coll.id;
            return (
              <View key={coll.id} style={[styles.collCard, { backgroundColor: t.paper.white, borderColor: (batchMode && isSelected) ? t.accent.primary : t.outline.standard }]}>
                {batchMode && (
                  <TouchableOpacity style={[styles.checkCircle, { borderColor: t.outline.standard, backgroundColor: isSelected ? t.accent.primary : t.paper.white }]} onPress={() => { setSelected((p) => { const n = new Set(p); if (n.has(coll.id)) n.delete(coll.id); else n.add(coll.id); return n; }); }}>
                    {isSelected && <Ionicons name="checkmark" size={12} color={t.ink.inverse} />}
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={styles.collBody} activeOpacity={sortMode || batchMode ? 1 : 0.7} onPress={() => {
                  if (batchMode) { setSelected((p) => { const n = new Set(p); if (n.has(coll.id)) n.delete(coll.id); else n.add(coll.id); return n; }); }
                  else if (!sortMode) { router.push(`/collection/${coll.id}`); }
                }}>
                  <View style={[styles.collIcon, { backgroundColor: (coll.color || t.accent.primary) + '18' }]}>
                    <Ionicons name="folder" size={24} color={coll.color || t.accent.primary} />
                  </View>
                  <View style={styles.collInfo}>
                    <Text style={[styles.collName, { color: t.ink.primary }]}>{coll.name}</Text>
                    <Text style={[styles.collCount, { color: t.ink.tertiary }]}>{coll.book_count} 本书</Text>
                  </View>
                </TouchableOpacity>
                {/* 排序箭头 */}
                {sortMode && (
                  <View style={styles.sortArrows}>
                    <TouchableOpacity onPress={() => handleMoveUp(index)} disabled={index === 0} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                      <Ionicons name="chevron-up" size={20} color={index === 0 ? t.ink.tertiary : t.ink.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleMoveDown(index)} disabled={index === collections.length - 1} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                      <Ionicons name="chevron-down" size={20} color={index === collections.length - 1 ? t.ink.tertiary : t.ink.primary} />
                    </TouchableOpacity>
                  </View>
                )}
                {/* 卡片 ⋯ 按钮 */}
                {!batchMode && !sortMode && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <TouchableOpacity onPress={() => toggleHidden(coll.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Ionicons name={hiddenIds.has(coll.id) ? 'eye-off-outline' : 'eye-outline'} size={16} color={hiddenIds.has(coll.id) ? t.ink.tertiary : t.ink.secondary} />
                    </TouchableOpacity>
                    <TouchableOpacity onPressIn={(e) => setCardMenuPos({ x: e.nativeEvent.pageX, y: e.nativeEvent.pageY })} onPress={() => setCardMenuId(showCardMenu ? null : coll.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Ionicons name="ellipsis-horizontal" size={18} color={t.ink.tertiary} />
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>

      {/* 批量删除栏 */}
      {batchMode && selected.size > 0 && (
        <View style={[styles.batchBar, { backgroundColor: t.paper.white, borderTopColor: t.outline.standard }]}>
          <Text style={[styles.batchText, { color: t.ink.primary }]}>已选 {selected.size} 个</Text>
          <TouchableOpacity style={[styles.batchDelete, { backgroundColor: t.accent.pink }]} onPress={() => {
            Alert.alert('批量删除', `确定要删除选中的 ${selected.size} 个书单吗？`, [
              { text: '取消', style: 'cancel' },
              { text: '删除', style: 'destructive', onPress: () => { selected.forEach((id) => deleteCollection(id)); setSelected(new Set()); setBatchMode(false); } },
            ]);
          }} activeOpacity={0.8}>
            <Ionicons name="trash-outline" size={14} color={t.ink.inverse} />
            <Text style={[styles.batchDeleteText, { color: t.ink.inverse }]}> 删除</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 卡片 ⋯ 菜单 Modal（渲染在 ScrollView 外避免裁剪） */}
      <Modal visible={cardMenuId !== null} transparent animationType="fade" onRequestClose={() => setCardMenuId(null)}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setCardMenuId(null)} />
        <View style={[styles.cardDropdown, { backgroundColor: t.paper.primary, borderColor: t.outline.standard, top: cardMenuPos.y - 10, left: cardMenuPos.x - 130 }]}>
          <TouchableOpacity style={[styles.cardDropdownItem, { borderBottomColor: t.outline.standard }]} onPress={() => { const id = cardMenuId!; setCardMenuId(null); setEditTarget(collections.find((c) => c.id === id) || null); }} activeOpacity={0.6}>
            <Ionicons name="create-outline" size={14} color={t.ink.secondary} />
            <Text style={[styles.cardDropdownText, { color: t.ink.primary }]}>重命名</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cardDropdownItem} onPress={() => { const id = cardMenuId!; setCardMenuId(null); const c = collections.find((x) => x.id === id); if (c) handleDelete(c); }} activeOpacity={0.6}>
            <Ionicons name="trash-outline" size={14} color={t.accent.pink} />
            <Text style={[styles.cardDropdownText, { color: t.accent.pink }]}>删除</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* 创建/编辑弹窗 */}
      <CreateCollectionSheet
        visible={createVisible || !!editTarget}
        editCollection={editTarget}
        onClose={() => { setCreateVisible(false); setEditTarget(null); }}
        onSaved={() => { setCreateVisible(false); setEditTarget(null); fetchCollections(); }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  navBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth },
  navTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 16, fontWeight: '700' },
  menuDropdown: { position: 'absolute', width: 160, borderRadius: radii.lg, borderWidth: 1, ...softShadow },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth },
  menuItemText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 13, fontWeight: '600' },

  scroll: { flex: 1 },
  scrollContent: { padding: spacing.lg },
  empty: { alignItems: 'center', paddingTop: 80 },
  emptyText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 15, fontWeight: '600', marginTop: spacing.md },

  collCard: { flexDirection: 'row', alignItems: 'center', borderRadius: radii.lg, borderWidth: 1, padding: spacing.md, marginBottom: spacing.sm, ...softShadow },
  collBody: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  checkCircle: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginRight: spacing.md },
  sortArrows: { alignItems: 'center', gap: 2, marginLeft: spacing.sm },
  cardDropdown: { position: 'absolute', width: 140, borderRadius: radii.lg, borderWidth: 1, ...softShadow },
  cardDropdownItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  cardDropdownText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12, fontWeight: '600' },
  collIcon: { width: 44, height: 44, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center', marginRight: spacing.md },
  collInfo: { flex: 1 },
  collName: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 15, fontWeight: '700' },
  collCount: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12, marginTop: 2 },

  batchBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderTopWidth: 1 },
  batchText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 14, fontWeight: '600' },
  batchDelete: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radii.full },
  batchDeleteText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13, fontWeight: '700' },
});

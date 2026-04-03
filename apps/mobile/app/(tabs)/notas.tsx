import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  Alert,
  Platform,
} from 'react-native';
import { useState, useCallback, useMemo, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { colors } from '../../lib/colors';

// ── Types ──

interface ChecklistItem {
  id: string;
  text: string;
  checked: boolean;
}

interface Nota {
  id: string;
  titulo: string;
  conteudo: string;
  tags: string[];
  cor: string;
  fixada: boolean;
  checklist: ChecklistItem[];
  lembrete: string | null;
  criadaEm: string;
  atualizadaEm: string;
}

// ── Constants ──

const STORAGE_KEY = 'meudia_notas';

const CORES: { value: string; label: string; color: string }[] = [
  { value: 'default', label: 'Padrão', color: colors.card },
  { value: 'purple', label: 'Roxo', color: 'rgba(124,106,255,0.15)' },
  { value: 'green', label: 'Verde', color: 'rgba(74,222,128,0.15)' },
  { value: 'orange', label: 'Laranja', color: 'rgba(255,159,74,0.15)' },
  { value: 'red', label: 'Vermelho', color: 'rgba(248,113,113,0.15)' },
  { value: 'yellow', label: 'Amarelo', color: 'rgba(251,191,36,0.15)' },
];

const TAG_COLORS: Record<string, string> = {
  trabalho: colors.accent,
  pessoal: colors.green,
  estudo: colors.orange,
  saude: colors.red,
  financas: colors.yellow,
  ideias: colors.accent2,
  checklist: colors.muted,
};

const SUGESTOES_TAGS: Record<string, string[]> = {
  trabalho: ['reunião', 'deadline', 'projeto', 'apresentação', 'relatório', 'email', 'cliente'],
  pessoal: ['compras', 'casa', 'família', 'aniversário', 'viagem', 'lazer'],
  estudo: ['prova', 'resumo', 'aula', 'livro', 'curso', 'certificação'],
  saude: ['consulta', 'exame', 'remédio', 'treino', 'dieta', 'sono'],
  financas: ['conta', 'pagamento', 'investimento', 'orçamento', 'imposto'],
  ideias: ['projeto', 'negócio', 'criativo', 'app', 'design'],
};

// ── Helpers ──

function gerarId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function autoCategorizarTags(titulo: string, conteudo: string): string[] {
  const texto = `${titulo} ${conteudo}`.toLowerCase();
  const tagsDetectadas: string[] = [];

  for (const [categoria, palavras] of Object.entries(SUGESTOES_TAGS)) {
    for (const palavra of palavras) {
      if (texto.includes(palavra)) {
        if (!tagsDetectadas.includes(categoria)) {
          tagsDetectadas.push(categoria);
        }
        break;
      }
    }
  }

  return tagsDetectadas;
}

function resumirTexto(text: string, max = 100): string {
  if (text.length <= max) return text;
  return text.slice(0, max).trim() + '...';
}

// ── Component ──

export default function NotasScreen() {
  const [notas, setNotas] = useState<Nota[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [busca, setBusca] = useState('');
  const [filtroTag, setFiltroTag] = useState<string | null>(null);

  // Editor state
  const [editando, setEditando] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [titulo, setTitulo] = useState('');
  const [conteudo, setConteudo] = useState('');
  const [corSelecionada, setCorSelecionada] = useState('default');
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [showChecklist, setShowChecklist] = useState(false);
  const [novoCheckItem, setNovoCheckItem] = useState('');

  // Load
  useEffect(() => {
    carregarNotas();
  }, []);

  const carregarNotas = async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) setNotas(JSON.parse(raw));
    } catch {}
  };

  const salvarNotas = async (updated: Nota[]) => {
    setNotas(updated);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await carregarNotas();
    setRefreshing(false);
  }, []);

  // ── Filtered ──

  const notasFiltradas = useMemo(() => {
    let resultado = [...notas];

    if (busca.trim()) {
      const termo = busca.toLowerCase();
      resultado = resultado.filter(
        (n) =>
          n.titulo.toLowerCase().includes(termo) ||
          n.conteudo.toLowerCase().includes(termo) ||
          n.tags.some((t) => t.includes(termo)),
      );
    }

    if (filtroTag) {
      resultado = resultado.filter((n) => n.tags.includes(filtroTag));
    }

    resultado.sort((a, b) => {
      if (a.fixada && !b.fixada) return -1;
      if (!a.fixada && b.fixada) return 1;
      return new Date(b.atualizadaEm).getTime() - new Date(a.atualizadaEm).getTime();
    });

    return resultado;
  }, [notas, busca, filtroTag]);

  const todasTags = useMemo(() => {
    const s = new Set<string>();
    notas.forEach((n) => n.tags.forEach((t) => s.add(t)));
    return Array.from(s).sort();
  }, [notas]);

  // ── Handlers ──

  const resetEditor = () => {
    setEditando(false);
    setEditId(null);
    setTitulo('');
    setConteudo('');
    setCorSelecionada('default');
    setChecklist([]);
    setShowChecklist(false);
    setNovoCheckItem('');
  };

  const abrirNovaNota = () => {
    resetEditor();
    setEditando(true);
  };

  const abrirEditarNota = (nota: Nota) => {
    setEditId(nota.id);
    setTitulo(nota.titulo);
    setConteudo(nota.conteudo);
    setCorSelecionada(nota.cor);
    setChecklist([...nota.checklist]);
    setShowChecklist(nota.checklist.length > 0);
    setEditando(true);
  };

  const salvarNota = async () => {
    if (!titulo.trim()) {
      Alert.alert('Atenção', 'Dê um título para sua nota');
      return;
    }

    const agora = new Date().toISOString();
    const autoTags = autoCategorizarTags(titulo, conteudo);
    const cleanChecklist = checklist.filter((c) => c.text.trim());

    if (editId) {
      const updated = notas.map((n) =>
        n.id === editId
          ? {
              ...n,
              titulo: titulo.trim(),
              conteudo: conteudo.trim(),
              cor: corSelecionada,
              checklist: cleanChecklist,
              tags: Array.from(new Set([...n.tags, ...autoTags])),
              atualizadaEm: agora,
            }
          : n,
      );
      await salvarNotas(updated);
    } else {
      const novaNota: Nota = {
        id: gerarId(),
        titulo: titulo.trim(),
        conteudo: conteudo.trim(),
        tags: autoTags,
        cor: corSelecionada,
        fixada: false,
        checklist: cleanChecklist,
        lembrete: null,
        criadaEm: agora,
        atualizadaEm: agora,
      };
      await salvarNotas([novaNota, ...notas]);
    }

    resetEditor();
  };

  const excluirNota = (nota: Nota) => {
    Alert.alert('Excluir nota', `Excluir "${nota.titulo}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          await salvarNotas(notas.filter((n) => n.id !== nota.id));
        },
      },
    ]);
  };

  const toggleFixar = async (id: string) => {
    const updated = notas.map((n) =>
      n.id === id ? { ...n, fixada: !n.fixada, atualizadaEm: new Date().toISOString() } : n,
    );
    await salvarNotas(updated);
  };

  const toggleCheckItem = async (notaId: string, itemId: string) => {
    const updated = notas.map((n) =>
      n.id === notaId
        ? {
            ...n,
            checklist: n.checklist.map((c) => (c.id === itemId ? { ...c, checked: !c.checked } : c)),
            atualizadaEm: new Date().toISOString(),
          }
        : n,
    );
    await salvarNotas(updated);
  };

  const adicionarCheckItem = () => {
    if (!novoCheckItem.trim()) return;
    setChecklist((prev) => [...prev, { id: gerarId(), text: novoCheckItem.trim(), checked: false }]);
    setNovoCheckItem('');
  };

  const removerCheckItem = (id: string) => {
    setChecklist((prev) => prev.filter((c) => c.id !== id));
  };

  const getCorBg = (cor: string) => CORES.find((c) => c.value === cor)?.color ?? colors.card;

  // ── Editor View ──

  if (editando) {
    const autoTags = autoCategorizarTags(titulo, conteudo);

    return (
      <View style={styles.container}>
        <ScreenHeader title={editId ? 'Editar Nota' : 'Nova Nota'} subtitle="Bloco inteligente" />
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {/* Título */}
          <TextInput
            style={styles.inputTitulo}
            placeholder="Título da nota..."
            placeholderTextColor={colors.muted}
            value={titulo}
            onChangeText={setTitulo}
          />

          {/* Conteúdo */}
          <TextInput
            style={styles.inputConteudo}
            placeholder="Escreva aqui... A IA vai categorizar automaticamente."
            placeholderTextColor={colors.muted}
            value={conteudo}
            onChangeText={setConteudo}
            multiline
            textAlignVertical="top"
          />

          {/* Cores */}
          <Text style={styles.label}>Cor</Text>
          <View style={styles.coresRow}>
            {CORES.map((cor) => (
              <TouchableOpacity
                key={cor.value}
                style={[
                  styles.corBtn,
                  { backgroundColor: cor.color },
                  corSelecionada === cor.value && styles.corBtnAtivo,
                ]}
                onPress={() => setCorSelecionada(cor.value)}
              />
            ))}
          </View>

          {/* Checklist Toggle */}
          <TouchableOpacity
            style={styles.checklistToggle}
            onPress={() => setShowChecklist(!showChecklist)}
          >
            <Text style={styles.checklistToggleText}>
              {showChecklist ? '✅ Esconder checklist' : '☑️ Adicionar checklist'}
            </Text>
          </TouchableOpacity>

          {showChecklist && (
            <View style={styles.checklistEditor}>
              {checklist.map((item) => (
                <View key={item.id} style={styles.checkItemRow}>
                  <Text style={styles.checkItemBullet}>☐</Text>
                  <Text style={styles.checkItemText}>{item.text}</Text>
                  <TouchableOpacity onPress={() => removerCheckItem(item.id)}>
                    <Text style={styles.checkItemRemove}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
              <View style={styles.addCheckRow}>
                <TextInput
                  style={styles.addCheckInput}
                  placeholder="Novo item..."
                  placeholderTextColor={colors.muted}
                  value={novoCheckItem}
                  onChangeText={setNovoCheckItem}
                  onSubmitEditing={adicionarCheckItem}
                  returnKeyType="done"
                />
                <TouchableOpacity style={styles.addCheckBtn} onPress={adicionarCheckItem}>
                  <Text style={styles.addCheckBtnText}>+</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Auto tags preview */}
          {autoTags.length > 0 && (
            <View style={styles.autoTagsBox}>
              <Text style={styles.autoTagsTitle}>✨ Tags detectadas pela IA</Text>
              <View style={styles.tagsRow}>
                {autoTags.map((tag) => (
                  <View key={tag} style={[styles.tagBadge, { borderColor: TAG_COLORS[tag] || colors.muted }]}>
                    <Text style={[styles.tagText, { color: TAG_COLORS[tag] || colors.muted }]}>{tag}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Actions */}
          <View style={styles.editorActions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={resetEditor}>
              <Text style={styles.cancelBtnText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.salvarBtn} onPress={salvarNota}>
              <Text style={styles.salvarBtnText}>{editId ? 'Salvar' : 'Criar Nota'}</Text>
            </TouchableOpacity>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    );
  }

  // ── List View ──

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Notas"
        subtitle={`${notas.length} ${notas.length === 1 ? 'nota' : 'notas'} · Inteligente`}
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} colors={[colors.accent]} />
        }
      >
        {/* Search */}
        <View style={styles.searchBox}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar notas..."
            placeholderTextColor={colors.muted}
            value={busca}
            onChangeText={setBusca}
          />
          {busca.length > 0 && (
            <TouchableOpacity onPress={() => setBusca('')}>
              <Text style={styles.searchClear}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Tags filter */}
        {todasTags.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tagsFilter}>
            <TouchableOpacity
              style={[styles.filterChip, !filtroTag && styles.filterChipAtivo]}
              onPress={() => setFiltroTag(null)}
            >
              <Text style={[styles.filterChipText, !filtroTag && styles.filterChipTextAtivo]}>Todas</Text>
            </TouchableOpacity>
            {todasTags.map((tag) => (
              <TouchableOpacity
                key={tag}
                style={[styles.filterChip, filtroTag === tag && styles.filterChipAtivo]}
                onPress={() => setFiltroTag(filtroTag === tag ? null : tag)}
              >
                <Text style={[styles.filterChipText, filtroTag === tag && styles.filterChipTextAtivo]}>{tag}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* New Note Button */}
        <TouchableOpacity style={styles.novaNota} onPress={abrirNovaNota} activeOpacity={0.7}>
          <Text style={styles.novaNotaIcon}>+</Text>
          <Text style={styles.novaNotaText}>Nova Nota Inteligente</Text>
        </TouchableOpacity>

        {/* Notes */}
        {notasFiltradas.length === 0 && notas.length === 0 && (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyEmoji}>📝</Text>
            <Text style={styles.emptyTitle}>Nenhuma nota</Text>
            <Text style={styles.emptySubtitle}>Crie sua primeira nota inteligente</Text>
          </Card>
        )}

        {notasFiltradas.length === 0 && notas.length > 0 && (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyEmoji}>🔍</Text>
            <Text style={styles.emptyTitle}>Nenhum resultado</Text>
            <Text style={styles.emptySubtitle}>Tente outra busca</Text>
          </Card>
        )}

        {notasFiltradas.map((nota) => {
          const checkDone = nota.checklist.filter((c) => c.checked).length;
          const checkTotal = nota.checklist.length;

          return (
            <TouchableOpacity
              key={nota.id}
              activeOpacity={0.8}
              onPress={() => abrirEditarNota(nota)}
              onLongPress={() =>
                Alert.alert(nota.titulo, 'O que deseja fazer?', [
                  { text: nota.fixada ? 'Desafixar' : 'Fixar', onPress: () => toggleFixar(nota.id) },
                  { text: 'Excluir', style: 'destructive', onPress: () => excluirNota(nota) },
                  { text: 'Cancelar', style: 'cancel' },
                ])
              }
            >
              <Card style={[styles.notaCard, { backgroundColor: getCorBg(nota.cor) }] as any}>
                {/* Header */}
                <View style={styles.notaHeader}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      {nota.fixada && <Text style={{ fontSize: 10 }}>📌</Text>}
                      <Text style={styles.notaTitulo} numberOfLines={1}>{nota.titulo}</Text>
                    </View>
                    <Text style={styles.notaData}>
                      {new Date(nota.atualizadaEm).toLocaleDateString('pt-BR', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Text>
                  </View>
                </View>

                {/* Content */}
                {nota.conteudo ? (
                  <Text style={styles.notaConteudo} numberOfLines={3}>
                    {nota.conteudo}
                  </Text>
                ) : null}

                {/* Checklist */}
                {nota.checklist.length > 0 && (
                  <View style={styles.notaChecklist}>
                    {nota.checklist.slice(0, 3).map((item) => (
                      <TouchableOpacity
                        key={item.id}
                        style={styles.notaCheckItem}
                        onPress={() => toggleCheckItem(nota.id, item.id)}
                      >
                        <Text style={{ fontSize: 12 }}>{item.checked ? '✅' : '☐'}</Text>
                        <Text
                          style={[
                            styles.notaCheckText,
                            item.checked && { textDecorationLine: 'line-through', color: colors.muted },
                          ]}
                          numberOfLines={1}
                        >
                          {item.text}
                        </Text>
                      </TouchableOpacity>
                    ))}
                    {checkTotal > 0 && (
                      <View style={styles.progressRow}>
                        <View style={styles.progressBar}>
                          <View
                            style={[styles.progressFill, { width: `${(checkDone / checkTotal) * 100}%` }]}
                          />
                        </View>
                        <Text style={styles.progressText}>{checkDone}/{checkTotal}</Text>
                      </View>
                    )}
                  </View>
                )}

                {/* Tags */}
                {nota.tags.length > 0 && (
                  <View style={styles.notaTagsRow}>
                    {nota.tags.map((tag) => (
                      <View key={tag} style={[styles.tagBadge, { borderColor: TAG_COLORS[tag] || colors.muted }]}>
                        <Text style={[styles.tagText, { color: TAG_COLORS[tag] || colors.muted }]}>{tag}</Text>
                      </View>
                    ))}
                    <Text style={styles.aiHint}>✨ IA</Text>
                  </View>
                )}
              </Card>
            </TouchableOpacity>
          );
        })}

        <View style={{ height: 20 }} />
      </ScrollView>
    </View>
  );
}

// ── Styles ──

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1 },
  content: { padding: 20, gap: 12 },

  // Search
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    gap: 8,
  },
  searchIcon: { fontSize: 14 },
  searchInput: { flex: 1, color: colors.text, fontSize: 14, paddingVertical: 12 },
  searchClear: { fontSize: 14, color: colors.muted, padding: 4 },

  // Tags filter
  tagsFilter: { flexDirection: 'row', marginBottom: 4 },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 8,
  },
  filterChipAtivo: { backgroundColor: colors.accent, borderColor: colors.accent },
  filterChipText: { fontSize: 12, color: colors.muted, fontWeight: '600' },
  filterChipTextAtivo: { color: '#fff' },

  // New note
  novaNota: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.accent,
    borderStyle: 'dashed',
    backgroundColor: 'rgba(124,106,255,0.06)',
  },
  novaNotaIcon: { fontSize: 18, color: colors.accent, fontWeight: '700' },
  novaNotaText: { fontSize: 14, color: colors.accent, fontWeight: '600' },

  // Empty
  emptyCard: { alignItems: 'center', paddingVertical: 40 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  emptySubtitle: { fontSize: 13, color: colors.muted, marginTop: 4 },

  // Note card
  notaCard: { gap: 8 },
  notaHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  notaTitulo: { fontSize: 15, fontWeight: '700', color: colors.text },
  notaData: { fontSize: 10, color: colors.muted, marginTop: 2 },
  notaConteudo: { fontSize: 12, color: colors.muted, lineHeight: 18 },

  // Checklist in card
  notaChecklist: { gap: 4 },
  notaCheckItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  notaCheckText: { fontSize: 12, color: colors.text },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  progressBar: { flex: 1, height: 4, backgroundColor: colors.card2, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.green, borderRadius: 2 },
  progressText: { fontSize: 10, color: colors.muted },

  // Tags
  notaTagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
  tagBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  tagText: { fontSize: 10, fontWeight: '600' },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  aiHint: { fontSize: 9, color: colors.muted },

  // Editor
  inputTitulo: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
  },
  inputConteudo: {
    fontSize: 14,
    color: colors.text,
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    minHeight: 120,
  },
  label: { fontSize: 13, fontWeight: '600', color: colors.muted, marginTop: 4 },
  coresRow: { flexDirection: 'row', gap: 10, marginTop: 8 },
  corBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.border,
  },
  corBtnAtivo: { borderColor: colors.accent, borderWidth: 3 },

  // Checklist editor
  checklistToggle: { paddingVertical: 8, marginTop: 4 },
  checklistToggleText: { fontSize: 14, color: colors.accent, fontWeight: '600' },
  checklistEditor: { gap: 8, marginTop: 4 },
  checkItemRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  checkItemBullet: { fontSize: 14, color: colors.muted },
  checkItemText: { flex: 1, fontSize: 13, color: colors.text },
  checkItemRemove: { fontSize: 14, color: colors.red, padding: 4 },
  addCheckRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  addCheckInput: {
    flex: 1,
    fontSize: 13,
    color: colors.text,
    backgroundColor: colors.card2,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  addCheckBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addCheckBtnText: { color: '#fff', fontSize: 18, fontWeight: '600' },

  // Auto tags
  autoTagsBox: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(124,106,255,0.15)',
    backgroundColor: 'rgba(124,106,255,0.05)',
    padding: 14,
    gap: 8,
  },
  autoTagsTitle: { fontSize: 11, color: colors.accent, fontWeight: '600' },

  // Editor actions
  editorActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.card2,
    alignItems: 'center',
  },
  cancelBtnText: { fontSize: 14, color: colors.muted, fontWeight: '600' },
  salvarBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.accent,
    alignItems: 'center',
  },
  salvarBtnText: { fontSize: 14, color: '#fff', fontWeight: '700' },
});

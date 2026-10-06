// Google Apps Script — coletor de uso por código individual (equivale ao coletor_local.py).
// Planilha com abas:
//   "codigos"   : A = semestre, B = turma, C = código   (colar codigos_para_planilha.csv; SEM e-mails)
//   "respostas" : criada automaticamente (uma linha por envio)
//   "resumo", "erros_turma" : criadas pelo menu "Física I > Atualizar resumo"
// Implantar: Extensões > Apps Script > colar > Implantar > App da Web
//   Executar como: Eu | Quem tem acesso: Qualquer pessoa  -> copiar a URL /exec
// Não guarda e-mail, nome nem IP. Não publique a planilha.
const CAMPOS = ['recebido_em','app','semestre','turma','codigo','acertos_1a','tentativas_total','concluidos','explorou','duracao_seg','util','comentario','modo','teste_oficial','teste_tentativa','teste_acertos_1a','casos_json','teste_json'];

function saida(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

function doPost(e) {
  try {
    const p = JSON.parse(e.postData.contents);
    if (!/^[A-Z2-9]{3}-[A-Z2-9]{3}$/.test(p.codigo || '')) throw new Error('código inválido');
    if (!Array.isArray(p.casos) || p.casos.length > 40) throw new Error('casos inválidos');
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const tab = ss.getSheetByName('codigos').getDataRange().getValues();
    const linha = tab.find(r => String(r[2]).trim() === p.codigo);
    if (!linha) throw new Error('código desconhecido');
    const sh = ss.getSheetByName('respostas') || ss.insertSheet('respostas');
    if (sh.getLastRow() === 0) sh.appendRow(CAMPOS);
    const c = p.casos, t = p.teste || null;
    sh.appendRow([new Date(), p.app, linha[0], linha[1], p.codigo,
      c.filter(x => x.acertouNaPrimeira).length,
      c.reduce((s, x) => s + (x.tentativas || 0), 0),
      c.filter(x => x.concluido).length,
      p.explorou, p.duracaoSeg, p.util || '', String(p.comentario || '').slice(0, 500),
      p.modo || '', t ? t.oficial : '', t ? t.tentativa : '', t ? t.casos.filter(x => x.ok1).length : '',
      JSON.stringify(c), t ? JSON.stringify(t) : '']);
    return saida({ok: true});
  } catch (err) { return saida({ok: false, erro: String(err.message || err)}); }
}

// ---------- resumo (funções puras: testáveis fora do Apps Script) ----------
function tipoErro_(c) {
  if (c === 'estado_errado') return 'estado';
  if (c === 'cf_inventada') return 'centrifuga';
  if (c === 'mov_inventada') return 'movimento';
  if (c === 'ine_inventada') return 'ficticia';
  if (/_direcao$/.test(c)) return 'direcao';
  if (/_modulo$/.test(c)) return 'tamanho';
  if (/_ausente$/.test(c)) return 'ausente';
  if (/_inventada$/.test(c)) return 'inventada';
  return 'outro';
}
function top_(cont, k) {
  return Object.entries(cont).sort((a, b) => b[1] - a[1]).slice(0, k).map(x => x[0] + ' (' + x[1] + ')').join('; ');
}
// linhas: array de objetos {recebido_em, semestre, turma, codigo, util, casos_json, teste_json, ...}
function agregarResumo_(linhas) {
  // 1) por código e sessão do navegador, vale o ÚLTIMO envio (o estado é cumulativo dentro da sessão)
  const ult = {};
  linhas.slice().sort((a, b) => new Date(a.recebido_em) - new Date(b.recebido_em)).forEach(l => {
    ult[l.codigo + '|' + (l.sessao || l.recebido_em)] = l;
  });
  const utilDe = {};  // a utilidade vem de qualquer envio (a última resposta não vazia vale)
  linhas.slice().sort((a, b) => new Date(a.recebido_em) - new Date(b.recebido_em)).forEach(l => { if (l.util !== '' && l.util != null) utilDe[l.codigo] = +l.util; });
  const porCodigo = {};
  Object.values(ult).sort((a, b) => new Date(a.recebido_em) - new Date(b.recebido_em)).forEach(l => {
    const o = porCodigo[l.codigo] = porCodigo[l.codigo] || {semestre: l.semestre, turma: l.turma, codigo: l.codigo, envios: 0, casos: {}, testes: {}, util: []};
    o.envios++;
    let cs = []; try { cs = JSON.parse(l.casos_json || '[]'); } catch (e) {}
    // 2) entre sessões: concluído = em qualquer uma; acerto de 1ª = da sessão mais antiga; tentativas = maior valor; erros = união
    cs.forEach(c => {
      const m = o.casos[c.id];
      if (!m) { o.casos[c.id] = {id: c.id, cat: c.cat, concluido: !!c.concluido, acertouNaPrimeira: c.acertouNaPrimeira, tentativas: c.tentativas || 0, erros: (c.erros || []).slice()}; }
      else { m.concluido = m.concluido || !!c.concluido; m.tentativas = Math.max(m.tentativas, c.tentativas || 0); (c.erros || []).forEach(e => { if (m.erros.indexOf(e) < 0) m.erros.push(e); }); }
    });
    if (l.teste_json) { try { const t = JSON.parse(l.teste_json); o.testes[t.tentativa + '|' + t.duracaoSeg] = t; } catch (e) {} }
    if (utilDe[l.codigo] != null) o.util = [utilDe[l.codigo]];
  });
  const alunos = [], erroTurma = {};
  Object.values(porCodigo).forEach(o => {
    const casos = Object.values(o.casos), er = {};
    casos.forEach(c => new Set((c.erros || []).map(tipoErro_)).forEach(t => {
      er[t] = (er[t] || 0) + 1;
      const k = o.turma + '|' + (c.cat || '?') + '|' + t; erroTurma[k] = (erroTurma[k] || 0) + 1;
    }));
    const ts = Object.values(o.testes).sort((a, b) => a.tentativa - b.tentativa);
    const ac = t => t.casos.filter(x => x.ok1).length;
    const primeiro = ts[0] || null;
    alunos.push([o.semestre, o.turma, o.codigo, o.envios, casos.filter(c => c.concluido).length,
      casos.filter(c => c.acertouNaPrimeira).length, top_(er, 3),
      ts.length, primeiro ? ac(primeiro) + '/' + primeiro.casos.length : '', ts.length ? Math.max.apply(null, ts.map(ac)) + '/5' : '',
      o.util.length ? (o.util.reduce((a, b) => a + b, 0) / o.util.length).toFixed(1) : '']);
  });
  const erros = Object.entries(erroTurma).map(([k, n]) => { const p = k.split('|'); return [p[0], p[1], p[2], n]; })
    .sort((a, b) => a[0].localeCompare(b[0]) || b[3] - a[3]);
  return {alunos, erros};
}

function atualizarResumo() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName('respostas');
  if (!sh || sh.getLastRow() < 2) return;
  const vals = sh.getDataRange().getValues(), cab = vals[0];
  const linhas = vals.slice(1).map(r => Object.fromEntries(cab.map((c, i) => [c, r[i]])));
  const res = agregarResumo_(linhas);
  const escreve = (nome, cabecalho, dados) => {
    const s = ss.getSheetByName(nome) || ss.insertSheet(nome);
    s.clearContents(); s.appendRow(cabecalho); if (dados.length) s.getRange(2, 1, dados.length, cabecalho.length).setValues(dados);
  };
  escreve('resumo', ['semestre','turma','codigo','envios','casos_concluidos','acertos_1a_treino','erros_mais_frequentes','testes_feitos','teste_1a_tentativa','teste_melhor','util_media'], res.alunos);
  escreve('erros_turma', ['turma','categoria','tipo_de_erro','alunos_com_o_erro'], res.erros);
}
function onOpen() { SpreadsheetApp.getUi().createMenu('Física I').addItem('Atualizar resumo', 'atualizarResumo').addToUi(); }

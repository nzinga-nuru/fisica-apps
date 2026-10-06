// Google Apps Script — coletor de uso por código individual (equivale ao coletor_local.py).
// Planilha com duas abas:
//   "codigos"   : A = semestre, B = turma, C = código   (colar o arquivo codigos_para_planilha.csv; SEM e-mails)
//   "respostas" : criada automaticamente
// Implantar: Extensões > Apps Script > colar > Implantar > App da Web
//   Executar como: Eu | Quem tem acesso: Qualquer pessoa  -> copiar a URL /exec
// Não guarda e-mail, nome nem IP. Não publique a planilha.
const CAMPOS = ['recebido_em','app','semestre','turma','codigo','acertos_1a','tentativas_total','concluidos','explorou','duracao_seg','util','comentario','casos_json'];
function saida(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function doPost(e) {
  try {
    const p = JSON.parse(e.postData.contents);
    if (!/^[A-Z2-9]{3}-[A-Z2-9]{3}$/.test(p.codigo || '')) throw new Error('código inválido');
    if (!Array.isArray(p.casos) || p.casos.length > 20) throw new Error('casos inválidos');
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const tab = ss.getSheetByName('codigos').getDataRange().getValues();
    const linha = tab.find(r => String(r[2]).trim() === p.codigo);
    if (!linha) throw new Error('código desconhecido');
    const sh = ss.getSheetByName('respostas') || ss.insertSheet('respostas');
    if (sh.getLastRow() === 0) sh.appendRow(CAMPOS);
    const c = p.casos;
    sh.appendRow([new Date(), p.app, linha[0], linha[1], p.codigo,
      c.filter(x => x.acertouNaPrimeira).length,
      c.reduce((s, x) => s + (x.tentativas || 0), 0),
      c.filter(x => x.concluido).length,
      p.explorou, p.duracaoSeg, p.util || '', String(p.comentario || '').slice(0, 500), JSON.stringify(c)]);
    return saida({ok:true});
  } catch (err) { return saida({ok:false, erro:String(err.message || err)}); }
}

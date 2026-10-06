#!/usr/bin/env python3
"""Coletor LOCAL de teste (imita o Apps Script): valida o código individual contra
coleta/codigos_teste.csv (colunas semestre,turma,codigo) e grava coleta/respostas.csv.
Uso:  python3 coleta/coletor_local.py   (porta 8935)
App:  http://localhost:8934/fisica-i/produto-vetorial/?coletor=http://localhost:8935/coleta"""
import csv, json, os, re
from http.server import BaseHTTPRequestHandler, HTTPServer

AQUI = os.path.dirname(os.path.abspath(__file__))
ARQ = os.path.join(AQUI, "respostas.csv")
CODIGOS = os.path.join(AQUI, "codigos_teste.csv")
CAMPOS = ["recebido_em", "app", "semestre", "turma", "codigo", "acertos_1a", "tentativas_total", "concluidos",
          "explorou", "duracao_seg", "util", "comentario", "casos_json"]

def turmas():
    with open(CODIGOS, newline="", encoding="utf-8") as f:
        return {r["codigo"]: (r["semestre"], r["turma"]) for r in csv.DictReader(f)}

def validar(p):
    assert re.fullmatch(r"[A-Z2-9]{3}-[A-Z2-9]{3}", p.get("codigo", "")), "código inválido"
    assert isinstance(p.get("casos"), list) and len(p["casos"]) <= 20, "casos inválidos"
    t = turmas().get(p["codigo"])
    assert t, "código desconhecido"
    return t

class H(BaseHTTPRequestHandler):
    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
    def do_OPTIONS(self):
        self.send_response(204); self._cors(); self.end_headers()
    def do_POST(self):
        try:
            p = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
            sem, turma = validar(p)
            novo = not os.path.exists(ARQ)
            with open(ARQ, "a", newline="", encoding="utf-8") as f:
                w = csv.writer(f)
                if novo: w.writerow(CAMPOS)
                c = p["casos"]
                w.writerow([p.get("enviadoEm"), p.get("app"), sem, turma, p["codigo"],
                            sum(1 for x in c if x.get("acertouNaPrimeira")),
                            sum(x.get("tentativas", 0) for x in c),
                            sum(1 for x in c if x.get("concluido")),
                            p.get("explorou"), p.get("duracaoSeg"), p.get("util") or "", str(p.get("comentario") or "")[:500], json.dumps(c, ensure_ascii=False)])
            out, code = {"ok": True}, 200
        except Exception as e:
            out, code = {"ok": False, "erro": str(e)}, 400
        self.send_response(code); self._cors()
        self.send_header("Content-Type", "application/json"); self.end_headers()
        self.wfile.write(json.dumps(out).encode())

HTTPServer(("127.0.0.1", 8935), H).serve_forever()

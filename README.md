# fisica-apps

Simulações interativas em HTML/JS para as aulas de física — pensado para deploy no GitHub Pages (acesso pelo iPad em aula e pelos alunos).

## Estrutura

```
fisica-apps/
├── index.html                       ← escolha da disciplina
├── fisica-i/
│   ├── index.html                   — página de Física I
│   └── produto-vetorial/index.html  — produto vetorial 3D (ω×v′, Coriolis) + registro de uso
├── fisica-ii/
│   ├── index.html                   — página de Física II
│   ├── mhs/  modos-vibracionais/  batimento/
└── coleta/                          — coletor (Apps Script + versão local de teste); sem dados de alunos
```

Cada app é uma pasta com seu próprio `index.html` autocontido (sem build step, sem dependências de servidor). Novas disciplinas entram como `fisica-i/`, `fisica-iii/`, `fisica-iv/` no mesmo padrão; novos apps de uma disciplina entram como mais uma subpasta dentro dela.

## Rodar localmente

Abrir `index.html` direto no navegador funciona para os apps atuais (são autocontidos). Se algum app futuro precisar servir arquivos (fetch, módulos JS), rodar:

```bash
python3 -m http.server 8000
```

e acessar `http://localhost:8000`.

## Deploy (GitHub Pages)

Quando publicar: `Settings → Pages → Deploy from branch → main /(root)` no repositório. A URL final fica `https://<usuario>.github.io/fisica-apps/`, com cada app em `fisica-ii/mhs/`, etc.

## Origem dos arquivos atuais

- `fisica-ii/mhs/index.html` — cópia de `F2-simulacões/mhs_simulacao.html` (iCloud).
- `fisica-ii/modos-vibracionais/index.html` — cópia de `~/Downloads/Onda Estacionária.html`.

As pastas do iCloud continuam sendo o arquivo de referência das simulações prontas; aqui é a cópia de trabalho versionada para o site.

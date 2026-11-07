---
name: visualize
description: 会話の中にインタラクティブな HTML ビジュアライゼーションを出す。仕組みの説明、パラメータを動かしたときの挙動、比較、シミュレーション、チャート、地図、UI モックアップに使う。静的な図表や単なる表には使わない。
---

# visualize

`visualize` ツールで HTML 断片を書き、DSH が会話の中にサンドボックス iframe として描画する。
デスクトップとモバイルの両方で、ツール呼び出しと同じ位置に出る。

## 使うかどうかの判断

**使う**:
- ユーザーが「見たい」「動かしたい」「試したい」と言っている
- パラメータを変えると結果が変わる（スライダー、トグル、ステップ送り）
- 複数の系列や条件を並べて比較する
- 状態遷移・アルゴリズム・データフローを空間的に示す
- レイアウトや UI の提案を見せながら詰める

**使わない**:
- 表で足りる → Markdown の表をそのまま書く
- ラベルの付いた静的な構造（シーケンス図、フローチャート）→ Mermaid のフェンスで書く
- 独立したファイル・サイト・プロジェクトの成果物が欲しい → 通常のファイル作成
- 数値が 2〜3 個 → 文章で書く

迷ったら「そのビジュアルが無いと説明が成立しないか」で決める。データを含むという理由だけで作らない。

## タイミング — ターンの最後に呼ぶ

**`visualize` は、そのターンの最後のツール呼び出しにする。** 直後に最終応答を書いて終わる。

理由: 描画されたカードは**応答が確定した時点で初めて読める**。途中で呼ぶと、
そのあとのツール呼び出しでスクロールが流れ、ユーザーはビジュアルを見ないまま
ターンが終わる。実測でそうなっている。

したがって:

- 調査・計算・ファイル読み込みをすべて終えてから、最後に 1 回だけ呼ぶ
- 「とりあえず出して、あとで直す」をしない。データが揃うまで呼ばない
- 複数出したいときは、同じターンの最後に連続して呼ぶ（間になにも挟まない）
- 呼んだあとにツールを使いたくなったら、そのビジュアルは次のターンに回す

## 呼び方

```
visualize(
  title: "cache-hit-rate",     # 小文字 ASCII スラッグ。ファイル名になる
  html: "<div id=\"viz\">…</div>",
  mode: "regular" | "wide",    # 省略時 regular
  path: "…"                    # 省略可。既定はスレッドの保存先
)
```

ツールは `{ path, title, mode, bytes }` を返す。**HTML はツール結果に含めない**
（結果は以後の全リクエストに載るため）。クライアントが `/api/file` 経由で読む。

**ファイルはスレッド単位で 1 箇所に集まる。** 既定の保存先は
`~/.dsh/visualize/<sessionId>/<title>.html`、添付は同じ階層の `assets/`。
ワークスペースごとに `.dsh-visualize/` を作らない。

**古いファイルは消さない。** トランスクリプトは絶対パスを保持しているので、
消すと過去のメッセージが描画できなくなる。容量が気になったら手で消す。

**同じ title に別の内容は書けない。** 既存ファイルと内容が違えばツールが拒否する。
過去のメッセージが指すファイルを黙って書き換えないため。同じ内容なら通る（再実行が冪等）。

**セッションを複製しても壊れない。** フェンスは絶対パスを持つので、複製先の
トランスクリプトは元セッションのファイルを指したまま描画できる。複製先で新しく
描いたものは複製先のディレクトリに入る。

**添付は `assets` で渡す。** base64 で `{ name, data }` を並べると
`<sessionId>/assets/<name>` に書かれ、断片からは `assets/chart.png` で参照できる。

## 使えるユーティリティ

iframe には次の CSS と小さなランタイムが注入済み。**自前で組まない。**

| 用途 | クラス / 属性 |
|---|---|
| 面 | `.card` `.viz-stat` `.viz-stat-value` `.viz-grid` `.viz-row` `.viz-badge` `<hr>` |
| 操作 | `.btn` `.btn-primary` `.btn-ghost` `.btn-block` |
| 入力 | `.form-label` `.form-control` `.form-select` `.form-range` `.form-check` `.form-check-input` |
| タブ | `.nav-pills` + `.nav-link`（`role="tablist"` / `role="tab"` / `[role="tabpanel"]`） |
| 表 | `.table` `.table-sm` `.table-responsive` |
| 文字 | `.muted` `.text-small` `.text-destructive` `.text-end` `.text-center` `.text-nowrap` `.tabular-nums` `.sr-only` |
| ツールチップ | `data-tooltip="…"` `data-tooltip-placement="top\|right\|bottom\|left"` |

**ツールチップは属性だけ。** 位置決め・テーマ・衝突回避はランタイムがやる。
`title` 属性は使わない。

```html
<button class="btn" data-tooltip="Reset the view">Reset</button>
```

**タブは JS を書かない。** `role` と `aria-controls` を正しく付ければ、
クリックと矢印キーはランタイムが処理する。

```html
<div class="nav-pills" role="tablist" aria-label="Platform">
  <button class="nav-link active" role="tab" id="mac" aria-controls="mac-panel" aria-selected="true" type="button">macOS</button>
  <button class="nav-link" role="tab" id="linux" aria-controls="linux-panel" aria-selected="false" type="button">Linux</button>
</div>
<div id="mac-panel" role="tabpanel" aria-labelledby="mac">…</div>
<div id="linux-panel" role="tabpanel" aria-labelledby="linux" hidden>…</div>
```

**アイコンは無い。** 必要な記号は SVG を自分で書くか、文字で代用する。

**SVG を書くときの落とし穴**（実際に踏んだ）:

- 図形要素に `display: block` を付ける。`<span>` や `<rect>` の親が inline のままだと
  `height` / `width` が効かず、**何も見えない**
- 軸・引き出し線は `<line>` か `fill="none"` を明示する。開いたパスは暗黙に閉じられて
  塗り潰される
- 装飾の塗りは `pointer-events: none` を付ける。でないとクリックを奪う
- `viewBox` は固定幅で縮めない。狭い幅では目盛りを減らす
- 縦軸のラベルは回転させる。左上に水平で置くとタイトルと重なる

**ランタイムは断片より前に注入される。** 断片の `<script>` はパース時に走るので、
`viz` はその時点で定義済み。逆順にすると `viz is not defined` で**何も描かれない**
（実際に踏んだ。見出しだけ出てグラフが消えた）。

**フェンスには返ってきた `path` をそのまま書く。**

````
```visualize
{"path": "C:\\Users\\…\\.dsh\\visualize\\session-…\\cache-hit-rate.html", "mode": "regular"}
```
````

**相対パスは書かない。** `api/file` は絶対パス以外を 400 で拒否する
（実測: `?path=.dsh-visualize/x.html` → 400、絶対パス → 200）。
マークダウン画像の解決器も相対パスでは `undefined` を返すので、代わりにはならない。

## 余白 — 外側は 0、内側は自分で足す

**body の padding は 0、見出しと段落の margin も 0。** 断片が自分で間隔を足す。
Codex と同じモデルで、これが「提示の一部」に見える理由。

最も簡単なのは `.viz-stack` で包むこと。子要素の間に 1×、見出しの直後は 0.5× が入る。

```html
<div class="viz-stack">
  <h2>見出し</h2>
  <div id="chart"></div>
  <p class="muted">補足</p>
</div>
```

個別に調整するときは `--vz-font-size` の倍数で書く。

| 間隔 | 使う場所 |
|---|---|
| `calc(var(--vz-font-size) * 1)` | ブロック間、セクション見出しの前 |
| `calc(var(--vz-font-size) * .5)` | 見出しから図へ |
| `calc(var(--vz-font-size) * .25)` | 見出しから補助テキストへ |

**外側の縁に余白を付けない。** `body` に padding を足すと、カードの中に箱があるように見える。

## チャート — `viz.chart`

軸・目盛り・凡例・ツールチップはランタイムが描く。**SVG を手で組まない。**

```html
<div id="chart"></div>
<script>
viz.chart(document.getElementById('chart'), {
  type: 'bar',                       // 下の表を参照
  columns: ['gate', 'compile', 'bundle'],
  rows: [['Client', 84.09, 113.64], ['Host', 2.85, 80.16]],
  x: 'gate',
  y: ['compile', 'bundle'],          // 配列で複数系列
  stacked: true,                     // bar / area
  format: { style: 'percent', maximumFractionDigits: 1 },
  referenceLines: [{ value: 0.9, label: '目標 90%' }],
  title: 'ビルド時間', yLabel: '秒', height: 240
})
</script>
```

`update(config)` を返すので、操作に応じた再描画もできる。

**型の一覧**:

| type | 見たいもの | columns |
|---|---|---|
| `line` | 推移 | `[x, y…]` |
| `area` | 推移と量 | `[x, y…]` |
| `bar` | 比較 | `[x, y…]` |
| `scatter` | 2 変数の関係 | `[x, y…]` |
| `pie` | 構成比 | `[label, value]` |
| `sparkline` | 一覧の中の小さな推移 | `[x, y]` |
| `ranking` | 名前と値の一覧（**自動で降順ソート**） | `[label, value]` |
| `waterfall` | 増減の積み上げ（正＝系列色、負＝エラー色） | `[step, delta]` |
| `heatmap` | 2 軸の格子（値の大きさを不透明度で表す） | `[x, y, value]` |
| `funnel` | 段階ごとの減少（幅が値に比例） | `[stage, value]` |
| `box-plot` | 分布の要約 | `[label, min, q1, median, q3, max]` |

`box-plot` は列名で指定する。`min` / `q1` / `median` / `q3` / `max` を `columns` の名前で渡すので、
列の順序に依存しない。足りなければエラーになる。

**未対応**: なし（全 11 型が使える）。

**横軸のラベルは自動で間引かれる。** 入る本数は最も長いラベルの文字数から決まるので、
点が多い系列でも潰れない。自分でラベルを間引く必要はない。

**縦軸の目盛りは 1・2・5・10 に丸められる。** `0 / 25 / 50 / 75 / 100` のような読みやすい刻みになる。

**`format` を渡すと軸とツールチップの単位が揃う。** `percent` は `0.6671` を `66.7%` に、
`currency` は `Intl.NumberFormat` で通貨にする。

### 系列の表示切替

**凡例がそのままスイッチになる。** 複数系列のとき、凡例を押すとその系列が消え、
もう一度押すと戻る。隠した系列も軸の範囲には残るので、他の系列が伸び縮みしない。

```js
viz.chart(el, {
  y: ['cumulative', 'rolling20', 'target'],
  legendToggle: false,        // 切替を無効にする
  hiddenSeries: ['target'],   // 初期状態で隠す
  onSeriesToggle: (name, shown) => { … }
})
```

### コントロールと連動

`viz.controls` は宣言から操作 UI を作る。**どの操作を出すかは作る側が決める。**

```js
var ctl = viz.controls(el, [
  { name: 'sort', label: '並び順', type: 'select', value: 'none',
    options: [['none', '呼び出し順'], ['desc', '降順'], ['asc', '昇順']] },
  { name: 'threshold', label: '基準線', type: 'range', min: 0, max: 1, step: 0.05, value: 0.9 },
  { name: 'stack', label: '積み上げ', type: 'checkbox', value: false }
])
viz.bind(ctl, function (v) { return { …config, … } }, chart)
```

`type` は `select` / `range` / `checkbox` / `number` / `text`。`viz.bind` が `input` / `change` を
拾って `chart.update()` に渡す。初回も同じ経路を通るので、初期値とグラフが食い違わない。

**意味のある操作を選ぶ。** 「倍率」のように値を一律に掛けるだけの操作は、棒が伸び縮みする
だけで何も分からない。閾値・絞り込み・ビン幅・系列の選択のように、**見え方が変わる**ものを選ぶ。

### アニメーション

`update()` で値が変わると、bar / line / area / scatter は**図形を再利用して滑る**。
それ以外の型は作り直すので瞬時に切り替わる。初回描画は動かない
（`vz-animate` クラスが 1 フレーム後に付くため）。`prefers-reduced-motion: reduce` では
transition 自体が無効になる。

### 状態の報告と復元

読者が選んだ内容をモデルに伝えられる。

```js
viz.state({ sort: 'desc', hidden: ['target'], threshold: 0.9 })
```

フレームは不透明オリジンなのでホストを直接叩けない。親ページへ `postMessage` し、
プラグインのブラウザ側が `/api/visualize/state` へ中継、ホストが
`<sessionId>/state/<title>.json` に保存する。モデルは `visualize_state` ツールで読む。

**再描画時は読み戻される。** `VisualizeFrame` が srcDoc を組む前に
`GET /api/visualize/state?session=&title=` を投げ、結果を `window.__dshVizState` として
注入する。断片は `viz.restore()` で同期的に取れる。

```js
var saved = viz.restore() || {}
var threshold = saved.threshold ?? 0.9
```

**`null` は正常系。** まだ何も報告されていなければ、断片は自分の既定値から始める。

### セッション — fork との関係

**状態は `(sessionId, title)` で分かれる。** ファイルパスではなく、**読んでいるセッション**が
キーになる。

セッションを複製するとトランスクリプトがコピーされるが、フェンスの絶対パスは元のまま
残る。だから複製先でも同じ図が見える。しかし状態まで元と共有すると、複製先での操作が
**元セッションの状態を上書きする**。それを避けるためにセッション id を分けている。

断片から現在のセッションを知りたいときは `viz.session()`。

### フォローアップ要求

読者の操作から次のターンを起こせる。

```js
viz.followUp({
  prompt: '選択した 300K+ のバケットを詳しく調べて',
  title: 'この範囲を調べる'
})
```

`prompt` がそのままモデルへのメッセージになる。**選択した値と、何を調べるかを書く。**
フレームは `postMessage` し、プラグインが `conversation.sendSession(...)` で通常の
プロンプトとして送る。読者には新しいターンとして見える。

**送信先は `viz.session()` のセッション。** パスから推測すると、fork で元セッションに
飛ぶ。

## 断片の規約

1. **断片だけ書く**。`<!doctype>` / `<html>` / `<head>` / `<body>` を書かない。
   ツールが拒否する。
2. **ルート要素に固有の id** を付け、`document.getElementById` で取る。
   `document.currentScript` は使わない（スクリプトがルートの外に置かれ得る）。
3. **リテラルのマークアップ**を渡す。`\"` や `\n` でエスケープした文字列を埋め込まない。
4. **1 MB 未満**。データが大きいなら集約・ビン・間引きする。
5. **`fetch` / `XMLHttpRequest` / `WebSocket` を使わない**。iframe は
   `sandbox="allow-scripts"`（`allow-same-origin` なし）なので、そもそも
   オリジンを持たず外部と通信できない。データは断片に埋め込む。
6. **高さは自動**。iframe は内容の高さに追従するので `height` を指定しない。
   固定値が要るのは、スクロールさせたい表など限られた場合だけ。

## テーマ — DSH のトークンを使う

DSH は `--dsw-alias-*` という独自のトークンを持ち、ダーク/ライトを
`<body data-ds-dark-theme>` で切り替える。プラグインがそれらを iframe に
コピーし、**短い別名**を用意している。断片は別名だけを使えばよい。

| 用途 | 別名 | 元のトークン |
|---|---|---|
| 本文 | `--vz-text` | `--dsw-alias-label-primary` |
| 補助文字 | `--vz-dim` | `--dsw-alias-label-primary-dimmed` |
| 面 | `--vz-surface` | `--dsw-alias-bg-layer-1` |
| 枠線 | `--vz-border` | `--dsw-alias-border-l1` |
| 強調・リンク | `--vz-accent` | `--dsw-alias-brand-primary` |
| 本文サイズ | `--vz-font-size` | `--dsh-content-font-size` |
| 本文フォント | `--vz-font` | `--dsh-font-family-text` |
| コード | `--vz-font-code` / `--vz-code-bg` | `--dsh-font-family-code` / `--dsw-alias-markdown-code-block` |

系列色は DSH に無いので**プラグインが持っている**。ライトとダークで別の値を
持ち、テーマを切り替えると入れ替わる。色順は固定なので系列の identity は保たれる。

| トークン | 用途 |
|---|---|
| `--viz-series-1` 〜 `--viz-series-6` | 系列色（青・橙・緑・紫・赤・水色） |

エラー・成功・警告は DSH の状態色をそのまま使う:

| 用途 | トークン |
|---|---|
| エラー | `--dsw-alias-state-error-primary` |
| 成功 | `--dsw-alias-state-success-primary` |
| 警告 | `--dsw-alias-state-warn-primary` |
| ホバー面 | `--dsw-alias-interactive-bg-hover-accent` |

**リテラル色を書かない。** `#333` や `black` はダークモードで破綻する。
`var(--vz-text)` などを必ず経由する。

系列色は「重要な識別」にだけ使う。全部の棒に別色を割り当てない。

## サイズ

- `wide`: リクエストウォーターフォール、スタックトレース、フレームチャート、
  月/週カレンダー、デスクトップアプリのモックアップ、複数パネルを横並びにする比較
- `regular`: 単一のプロット、地図、図、タイムライン、ダイアログ、スマホ画面

迷ったら `regular`。縦に積めば済むものを横に並べない。

## モバイル

iframe の幅は会話幅に追従する。固定 px 幅を書かず、`%` か `flex` で組む。
`regular` は最大 780px、`wide` は 100% なので、`regular` のままでも
スマホでは画面幅に収まる。タッチ操作を想定し、ホバーだけに情報を持たせない。

## 応答の書き方

- ビジュアルの外に**1 文**だけ添える。何が見えるか、何を判断できるか。
- ビジュアルの中身を文章で繰り返さない。表も付け足さない。
- 「HTML を書きました」「ファイルを作りました」とは言わない。ユーザーに見えるのは
  ビジュアルそのもので、実装は話題にしない。
- 同じターンに複数出してよいが、1 つが大きい場合は分ける。

## うまくいかないとき

- 何も出ない → `title` がスラッグか、`html` が空でないか、断片に `<html>` が混ざっていないか
- 真っ白 → JavaScript の例外。`document.getElementById` の id が一致しているか確認する
- **ダークモードで白く浮く** → リテラル色を使っている。`var(--vz-surface)` などに置き換える
- 色が黒一色 → `fill: var(--viz-series-1)` を指定しているか。`currentColor` は本文色になる
- はみ出す → 固定幅をやめる。`max-width: 100%` と `overflow: auto` を入れる
- 高さが足りない → 通常は自動。`position: absolute` を使うと計測できないので避ける

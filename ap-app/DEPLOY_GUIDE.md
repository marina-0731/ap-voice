# AP サーバーデプロイ手順(Render無料枠)

所要時間: 15〜20分。必要なもの: GitHubアカウント、Renderアカウント(どちらも無料)。

## ステップ1: GitHubにリポジトリを作る

```bash
# ap-app フォルダを解凍した場所で
cd ap-app
git init
git add .
git commit -m "AP MVP: キューイング音声チャット"
```

GitHub で新規リポジトリ(例: `ap-voice`、**Private推奨**)を作成し:

```bash
git remote add origin https://github.com/<あなたのユーザー名>/ap-voice.git
git branch -M main
git push -u origin main
```

## ステップ2: Renderでデプロイ

1. https://render.com にGitHubアカウントでサインアップ
2. ダッシュボード →「New +」→「**Blueprint**」
3. `ap-voice` リポジトリを選択 → リポジトリ直下の `render.yaml` を自動検出
4. 「Apply」を押すだけ。ビルド〜起動まで2〜3分待つ
5. 発行されたURL(例: `https://ap-server-xxxx.onrender.com`)をメモ

### 動作確認
ブラウザで `https://ap-server-xxxx.onrender.com/health` を開いて
`{"ok":true,...}` が出ればデプロイ成功。

## ステップ3: アプリをサーバーに向ける

`app.json` の1行を書き換え:

```json
"extra": { "serverUrl": "https://ap-server-xxxx.onrender.com" }
```

その後 `npx expo start` で起動し、2台の端末で同じルームコードに入って通話テスト。

## 無料枠の注意点(検証フェーズでは許容)

| 制約 | 影響 | 対策 |
|---|---|---|
| 15分無アクセスでスリープ | 最初の接続に30秒〜1分かかる | 検証時は事前に /health を一度開いておく |
| ディスクが再起動で消える | 音声ファイルが消える | APは音声を1時間で自動削除する設計なので実害なし |
| メモリ512MB | 同時数十ルームまで | 検証には十分。本格運用時に有料プラン($7/月〜)へ |

## STT(文字起こし)を有効にする場合

1. OpenAIのAPIキーを取得(https://platform.openai.com)
2. Renderダッシュボード → ap-server → Environment → `OPENAI_API_KEY` を設定
3. `server/index.js` の `transcribe()` をREADME記載のWhisper実装に差し替えてpush
   (pushすると自動で再デプロイされる)

※ Whisper APIは従量課金(約 $0.006/分)。検証段階なら月数百円以内に収まる見込み。
   APIキーは絶対にコードに直接書かず、必ずRenderの環境変数で設定すること。

## つまずいたら

- ビルド失敗 → RenderのLogsタブを確認。大抵は `rootDir: server` の検出ミス(render.yamlがリポジトリ直下にあるか確認)
- 接続できない → アプリ側のserverUrlが `https://`(httpではなく)になっているか確認

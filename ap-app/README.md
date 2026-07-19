# AP(エーピー)- みんなの声

**声が、順番に届く。** 同時に話してもかぶらない、聞くのも読むのも選べるインクルーシブ音声チャット。

## コンセプト

- 発話開始タイミングをサーバーが検知し、**話した順にボイスメッセージが再生される**タイムラグ式通話
- 全発話が自動で文字起こしされ、**聴覚障害のある人は「読む」モード、視覚障害のある人は「聞く」モード**で同じ場に参加できる
- 相槌(0.8秒未満の短い発話)はキューに並ばず文字としてだけ届く

## 構成

```
ap-app/
├─ app/              # Expo Router 画面(ホーム / ルーム)
├─ components/       # QueueVisualizer, TranscriptFeed, TalkButton
├─ hooks/            # useSocketQueue, useRecorder, useQueuePlayer
├─ services/         # socket.io クライアント
├─ theme/            # デザイントークン(WCAG AA準拠)
└─ server/           # キューイングサーバー(Node.js + socket.io)
```

## 起動方法

### 1. サーバー
```bash
cd server
npm install
npm start          # :3001 で起動
```

### 2. アプリ
```bash
npm install
# app.json の extra.serverUrl を、実機から見えるサーバーのIPに変更
# 例: "serverUrl": "http://192.168.1.10:3001"
npx expo start
```

Expo Go で2台以上の端末から同じルームコードで入室すると、キューイング通話を体験できます。

## STT(文字起こし)の本番接続

`server/index.js` の `transcribe()` 関数がスタブになっています。差し替えはこの関数だけでOK。

```javascript
// 例: OpenAI Whisper API を使う場合
async function transcribe(audioBase64, durationMs) {
  const buffer = Buffer.from(audioBase64, 'base64');
  const form = new FormData();
  form.append('file', new Blob([buffer]), 'audio.m4a');
  form.append('model', 'whisper-1');
  form.append('language', 'ja');
  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: form,
  });
  const data = await res.json();
  return data.text;
}
```

Google Speech-to-Text / Azure Speech でも同様にこの関数の中だけで完結します。

## 検証済みのコアロジック

`server/test-queue.mjs` で以下を自動テスト済み:

- ✅ ほぼ同時(0.3秒以内)の発話開始でも、開始が早い方が先に再生される(音声データの到着順に依存しない)
- ✅ キュー先頭が録音中の間は追い越さない(発言順の保証)
- ✅ 全員の再生完了で次のエントリへ進行
- ✅ 短い発話(相槌)はキューをスキップし文字だけ残る

## フェーズ2以降のTODO

- [ ] Push-to-Talk → ハンズフリーVAD(@picovoice/cobra-react-native)への移行
- [ ] STT本番接続 + フィラー除去(Claude APIで整形)
- [ ] 話者ダイアライゼーション不要の設計(発話単位で話者確定済みなのが本方式の利点)
- [ ] ルームの永続化(現状はメモリ内。Redis/DB化)
- [ ] E2E暗号化の検討
- [ ] 福祉施設・特別支援学校での実地テスト

# AP - App Store リリース手順書

shutter100と同じ流れ。個人名のApple Developerアカウントで進める前提。

## 0. リリース前に必須の判断

| 項目 | 決めること |
|---|---|
| サーバーホスティング | Render / Railway / Fly.io など。socket.io対応のNode.jsホスティングが必要(無料枠あり) |
| STT API | OpenAI Whisper API(従量課金、日本語精度高)を最初の選択肢に推奨 |
| バンドルID | `com.manul.apvoice`(app.json設定済み。変更するならビルド前に) |
| 価格 | 無料。App内課金なしなら審査もシンプル |

## 1. サーバーを本番デプロイ

```bash
# 例: Railway の場合
cd server
railway init && railway up
# 発行されたURLを app.json の extra.serverUrl に設定
```

環境変数 `OPENAI_API_KEY` を設定し、`transcribe()` を本番実装に差し替える(README参照)。

## 2. EAS Buildでバイナリ作成

```bash
npm install -g eas-cli
eas login                      # Expoアカウント
eas build:configure
eas build --platform ios --profile production
```

初回はApple Developerアカウント(年間 $99 / 約15,000円)との連携を求められる。
shutter100で登録済みのアカウントをそのまま使える。

## 3. App Store Connect 設定

1. https://appstoreconnect.apple.com → 「マイApp」→「+」→ 新規App
2. 必須項目:
   - 名前: **AP - みんなの声**(30字以内)
   - サブタイトル案: 「声が、順番に届く。」
   - カテゴリ: ソーシャルネットワーキング
   - プライバシーポリシーURL(必須! マイク・音声データの扱いを明記)
3. スクリーンショット: 6.7インチ(iPhone 15 Pro Max)と6.5インチが必須

## 4. 審査で確実に聞かれるポイント(先回り対応)

- **マイク使用理由**: app.jsonのNSMicrophoneUsageDescriptionは設定済み
- **音声データの保存先と保持期間**: `PRIVACY.md` に明記済み(1時間で自動削除)
- **UGC(ユーザー生成コンテンツ)対策**: ガイドライン1.2の4要素は実装済み
  - 通報導線(発言の長押し / 「⋯」ボタン → サーバーの `/report`)
  - ブロック(声の再生をスキップ、文字も非表示、即時反映、解除画面あり)
  - 初回起動時の利用規約(EULA)同意
  - 通報への24時間以内の対応表明(規約・通報完了ダイアログ・下記の審査メモ)
- デモアカウント: 審査員が試せるルームコードを審査メモに記載

### プライバシーポリシー / 規約のURL

`PRIVACY.md` と `TERMS.md` が原稿です。**そのままではURLになりません。**
GitHub Pages で公開するのが最短:

```bash
gh repo edit --enable-pages --pages-branch main   # または Settings → Pages から有効化
```

公開後のURL例:
- プライバシーポリシー: `https://marina-0731.github.io/ap-voice/PRIVACY`
- 利用規約: `https://marina-0731.github.io/ap-voice/TERMS`

App Store Connect の「プライバシーポリシーURL」と、App情報の「利用許諾契約(EULA)」に設定します。

### 審査メモ(App Review Information → Notes)の下書き

```
AP is an inclusive voice chat app. Multiple people can speak at once without
their voices overlapping: the server assigns a playback order from the moment
each person starts speaking, and everyone hears the messages in the same order.
Every utterance is also transcribed, so deaf and hard-of-hearing users can
participate by reading while blind users participate by listening.

How to test with a single device:
1. Launch the app and agree to the terms on the first screen.
2. Enter any name, and use the room code: demo
3. Press and hold the large button to speak. Release to send.
   (If VoiceOver is on, the button switches to tap-to-start / tap-to-send.)
4. Switch to the「読む」(Read) tab to see the transcript.
5. Long-press any message from another user, or tap the「⋯」button,
   to open the Report / Block menu.

User-generated content safeguards (Guideline 1.2):
- Terms of use (EULA) must be accepted before any room can be entered.
- Every utterance can be reported; reports reach our operators, who review
  them within 24 hours.
- Any user can be blocked instantly and locally: their audio is skipped and
  their transcript is hidden. Blocks can be undone from the「ブロックした人」screen.
- We have a zero-tolerance policy for objectionable content and abusive users.

Audio handling: recordings are stored on our server only to relay them, and
are deleted automatically after 1 hour. Audio is sent to OpenAI Whisper for
transcription only. This is stated in the terms and the privacy policy.

Microphone: required to record the user's voice messages. There is no other
way to participate.

Contact: marina.azuchi@kmanul.org
```

**デモ用ルーム `demo` は、審査期間中に誰かが入って動かせる状態にしておくこと。**
ルームは1人でも入れるので、審査員が単独で録音→文字起こし→通報導線まで確認できます。

## 5. 提出

```bash
eas submit --platform ios
```

審査は通常1〜3日。リジェクトされたら理由が明示されるので個別対応。

## 6. リリース後すぐやること

- 福祉施設・特別支援学校でのモニター利用の声かけ(まぬるすこれ・NPOのネットワーク活用)
- TestFlightでの先行配布も検討(審査が軽く、フィードバック収集に最適)

---

## Claudeが今回作った範囲 / まぬるがやる範囲

**作成済み**: アプリ本体コード、キューイングサーバー(コアロジックはテスト済み)、
Whisper文字起こし、通報・ブロック・規約同意、プライバシーポリシー/規約の原稿、この手順書

**まぬるの作業**:
- Apple Developerアカウント操作、EASビルド、App Store Connect登録・提出
- Render に `OPENAI_API_KEY` を設定(ダッシュボードから。コードには入れない)
- `PRIVACY.md` / `TERMS.md` をGitHub Pages等で公開してURLを取得
- 実機2台での通話テスト、VoiceOver / TalkBack での操作確認
- 通報の受け口の運用(サーバーログの確認、または `REPORT_WEBHOOK_URL` の設定)

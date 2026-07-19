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
- **音声データの保存先と保持期間**: プライバシーポリシーに明記必須
- **UGC(ユーザー生成コンテンツ)対策**: チャットアプリは通報・ブロック機能がないとリジェクトされやすい(ガイドライン1.2)。**フェーズ1リリースでも最低限「ルーム退出」+「通報導線(メールでも可)」を用意すること**
- デモアカウント: 審査員が試せるルームコードを審査メモに記載

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

**作成済み**: アプリ本体コード、キューイングサーバー(コアロジックはテスト済み)、この手順書
**まぬるの作業**: Apple Developerアカウント操作、サーバーデプロイ、STT APIキー取得、プライバシーポリシー作成、App Store Connect登録・提出

# LINE連携セットアップ

## 方針

- LINEは通知・簡易入力の入口として使う。
- 募集枠、応募、確定などの正本はSupabaseに保存する。
- LINEのChannel secret / Channel access tokenはフロントエンドに置かず、Supabase Edge FunctionsのSecretsに保存する。
- LINEアカウントとアプリユーザーは、Messaging APIのアカウント連携フローで紐付ける。

## 1. DBを追加

Supabase SQL Editorで `supabase/line-integration.sql` を実行する。

作成される主なテーブル:

- `line_contacts`: LINE公式アカウントを友だち追加したユーザーのLINE userIdを保存する。
- `user_line_accounts`: Supabase AuthのユーザーIDとLINE userIdの紐付けを保存する。
- `line_link_nonces`: LINE Account Linkで使う一度きりのnonceを一時保存する。
- `line_notification_logs`: Webhook受信、返信、Push通知の履歴を保存する。

## 2. Secretsを設定

LINE DevelopersのMessaging APIチャネルで以下を確認する。

- `Channel secret`
- `Channel access token`

ローカルでは以下を実行する。

```powershell
supabase secrets set LINE_CHANNEL_SECRET="取得したChannel secret"
supabase secrets set LINE_CHANNEL_ACCESS_TOKEN="取得したChannel access token"
supabase secrets set LINE_TEST_ADMIN_KEY="任意の長いテスト用キー"
supabase secrets set APP_BASE_URL="https://idle-task-manager.web.app"
```

`LINE_TEST_ADMIN_KEY` は、テストPush関数を誰でも叩けないようにするための簡易キー。
`APP_BASE_URL` は、LINEから開くアプリURL。Firebase Hostingの本番URLを設定する。

## 3. Edge Functionsをデプロイ

```powershell
supabase functions deploy line-webhook --no-verify-jwt
supabase functions deploy line-link-nonce --no-verify-jwt
supabase functions deploy line-test-push --no-verify-jwt
supabase functions deploy line-admin-test-push --no-verify-jwt
```

Webhook URL:

```text
https://<project-ref>.functions.supabase.co/line-webhook
```

## 4. LINE DevelopersでWebhookを設定

Messaging API設定画面で以下を設定する。

- Webhook URL: `https://<project-ref>.functions.supabase.co/line-webhook`
- Use webhook: Enabled

設定後、「Verify」を押す。

## 5. userId取得テスト

スマホのLINEから公式アカウントに `連携` と送る。

成功すると:

- LINEにアプリへ進むボタンが届く。
- ボタンからアプリを開く。
- 未ログインならログインする。
- アプリがnonceを発行し、LINEのAccount Link画面へ自動遷移する。
- 連携が成功すると、Supabaseの `user_line_accounts` にアプリユーザーIDとLINE userIdが保存される。

補足:

- LINEのlinkTokenは10分間有効で1回だけ使える。
- 期限切れの場合は、LINEで再度 `連携` と送る。
- 連携開始用のリッチメニューを作る場合、Postbackを使える場所では `action=link`、テキストアクションしか使えない場所では `連携` を送る設定にする。

## 6. Push通知テスト

管理者がアプリにログインして、`管理` > `ユーザー管理` から連携済みユーザーの `通知テスト` を押す。
この経路では、Supabase Authのログイン状態をEdge Function側で検証し、管理者だけがLINE Push APIを実行できる。

CLIから直近で受信したLINE userId宛にテスト通知を送る場合は以下を使う。

```powershell
$body = @{ text = "チェキスタッフ募集のテスト通知です。" } | ConvertTo-Json
Invoke-RestMethod `
  -Method Post `
  -Uri "https://<project-ref>.functions.supabase.co/line-test-push" `
  -Headers @{ "x-test-key" = "LINE_TEST_ADMIN_KEYに設定した値" } `
  -Body $body `
  -ContentType "application/json"
```

特定のLINE userIdへ送る場合は、本文に `to` を含める。

```powershell
$body = @{
  to = "Uxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
  text = "テスト通知です。"
} | ConvertTo-Json
```

## 参考

- LINE Account Link: https://developers.line.biz/ja/docs/messaging-api/linking-accounts/
- LINE Webhook署名検証: https://developers.line.biz/en/docs/messaging-api/verify-webhook-signature/
- LINE Webhook受信: https://developers.line.biz/en/docs/messaging-api/receiving-messages/
- LINE Push/Reply送信: https://developers.line.biz/en/docs/messaging-api/sending-messages/

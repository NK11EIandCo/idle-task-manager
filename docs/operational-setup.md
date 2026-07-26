# 実運用セットアップ

## 目的

この版では、フロントエンドだけの確認用プロトタイプから、Supabaseにデータを保存する構成へ移行する。

追加、編集、削除した以下の情報はSupabaseへ保存される。

- グループ
- ライブ
- タスク、サブタスク
- チケット
- 制作物
- 前日・当日進行表
- タスクテンプレート
- 進行表テンプレート
- ログインユーザー自身のチェキスタッフ応募状態

## Supabase

1. Supabaseで新規プロジェクトを作成する。
2. SQL Editorで `supabase/schema.sql` を実行する。
3. Authentication > URL Configurationで、アプリのURLをRedirect URLsに追加する。
4. Authentication > ProvidersでEmailを有効にする。
5. Project Settings > API から以下を控える。
   - Project URL
   - anon public key

## 環境変数

`.env.example` を参考に `.env` を作成する。

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
VITE_AUTH_ENABLED=true
VITE_AUTH_REDIRECT_URL=http://127.0.0.1:5173/
VITE_BASE_PATH=/
```

`.env` はGit管理しない。

GitHub Pagesの `/idle-task-manager/` で配信する場合は、`VITE_BASE_PATH` を未設定にするか `/idle-task-manager/` にする。
Firebase Hostingのようにドメイン直下で配信する場合は、`VITE_BASE_PATH=/` にする。

`VITE_AUTH_REDIRECT_URL` は、SupabaseのRedirect URLsにも登録する。ローカル確認、Firebase本番、GitHub PagesでURLが変わる場合は、それぞれ登録する。

## ログインと初期管理者

ログイン機能を有効化する前に、必ずSQL Editorで最新の `supabase/schema.sql` を実行する。

新規登録したユーザーは、最初は `承認待ち` になる。初期管理者だけは、初回登録後にSQL Editorで明示的に管理者化する。

```sql
update public.app_user_profiles
set role = 'admin',
    status = 'active',
    updated_at = now()
where lower(email) = lower('管理者にするメールアドレス');
```

以後は、管理画面のユーザー管理から他ユーザーのロールと状態を変更できる。

## Sign up / Sign in

- 新規登録ではメールアドレスだけを入力し、確認メールのリンクからパスワード設定へ進む。
- 登録直後は承認待ちになり、管理者がロールと状態を設定するまで業務画面は表示されない。
- ログインはメールアドレスとパスワードで行う。
- パスワードを忘れた場合は、ログイン画面から再設定メールを送信する。

## 権限

- 管理者は作業画面、管理画面、チェキスタッフ画面、ユーザー管理を見られる。
- 社員は作業画面、管理画面、チェキスタッフ画面を見られる。
- チェキスタッフはチェキスタッフ画面のみ見られる。
- DB側でも、チェキスタッフはグループ、ライブ、自分の応募状態のみアクセスできる。
- 承認待ち、停止中のユーザーは業務データへアクセスできない。

## 初期データ

DBが空の場合、管理者または社員ユーザーの初回ログイン時に以下だけが初期登録される。

- Hey!Mommy!
- SCRAMBLE SMILE
- 標準進行表テンプレート

架空ライブ、架空タスク、架空チケット、架空制作物、タスクテンプレートは初期投入しない。

ライブ予定はGoogleカレンダー由来の読み取り専用予定として表示される。管理対象ライブにする場合は、アプリ側でライブを作成する。

## Firebase Hosting

Firebase Hostingで配信できる。

本番ビルド前に環境変数を設定し、`npm run build` の成果物である `dist/` をHosting対象にする。

SPAなので、Firebase Hostingでは全パスを `index.html` へrewriteする設定にする。

## 注意

- Googleカレンダーは読み取り専用。アプリから編集しない。
- 管理者と一般社員の分離は次の段階で実装する。
- 複数人同時編集は可能だが、同じ項目を同時編集した場合は後から保存された内容が優先される。

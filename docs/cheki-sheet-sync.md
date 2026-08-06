# チェキスタッフ募集 スプレッドシート同期

## 方針

- スプレッドシートの1行を「チェキスタッフ1枠」として扱う。
- 同じ `イベント名 + 実施日 + グループ名 + ライブ分類 + 場所` の行をアプリ側で1つの募集にまとめる。
- 募集人数は、同一募集にまとまった行数から自動計算する。
- スプレッドシートは正本として残し、アプリ側には募集枠と応募状況を保存する。
- まずは手動同期で運用する。自動同期は仕様が固まってから追加する。

## 対象列

1行目は列名。A列から順に以下を想定する。

| 列 | 項目 | 用途 |
| --- | --- | --- |
| A | イベント名 | 募集対象ライブ名 |
| B | 実施日 | 募集対象日 |
| C | グループ名 | `Hey!Mommy!` / `SCRAMBLE SMILE` |
| D | スタッフ名 | 既に決まっているスタッフ名 |
| E | ステータス | 募集中、確定など |
| F | 稼働社員 | 管理側の担当者 |
| G | ライブ分類 | 主催、対バンなど |
| H | 場所 | 会場名 |

Apps Script実行時、右側に以下の管理列を追加する。

- `row_uid`
- `反映状態`
- `反映日時`
- `アプリ募集ID`
- `アプリ枠ID`
- `エラー内容`

## Supabase側の準備

Supabase SQL Editorで以下を実行する。

```sql
-- supabase/cheki-sheet-integration.sql の内容を実行
```

次に同期用トークンを作成して、Edge FunctionのSecretへ保存する。

```powershell
$chekiSheetSyncToken = [guid]::NewGuid().ToString("N") + [guid]::NewGuid().ToString("N")
supabase secrets set CHEKI_SHEET_SYNC_TOKEN="$chekiSheetSyncToken"
$chekiSheetSyncToken
```

Edge Functionをデプロイする。

```powershell
supabase functions deploy sheet-cheki-import --no-verify-jwt
```

同期先URLは以下。

```text
https://xwmfiuqvgxswevdjvkpb.functions.supabase.co/sheet-cheki-import
```

## Googleスプレッドシート側の準備

検証用シート:

```text
https://docs.google.com/spreadsheets/d/1NZuZ5iXp9U_L_0JbaX0dIDeBoyEoMrm-BQdJDUdGPbk/edit?gid=0#gid=0
```

手順:

1. スプレッドシートで `拡張機能` > `Apps Script` を開く。
2. `scripts/google-sheets/cheki-sync.gs` の内容を貼り付ける。
3. 保存する。
4. スプレッドシートを再読み込みする。
5. メニューに `チェキ募集` が出る。
6. `チェキ募集` > `初期設定` を押す。
7. 同期先URLと `CHEKI_SHEET_SYNC_TOKEN` の値を入力する。
8. `チェキ募集` > `管理列を追加` を押す。
9. `チェキ募集` > `接続テスト` を押す。
10. 反映したい行を選択して `選択行をアプリへ反映` を押す。

選択行の反映では、選択した行と同じライブに該当する行も自動で一緒に送信される。
例えば同じライブが3行あるうち1行だけ選択しても、募集人数が1名にならないよう、同一ライブの3行をまとめて反映する。

## 期待される動き

- 同じライブの行が3行あれば、アプリ側では `募集 0/3名` のように表示される。
- D列のスタッフ名が入っている行は、既に埋まっている枠として `assigned_count` に反映される。
- 行の反映に成功すると、該当行の `反映状態` が `反映済み` になる。
- エラー時は `エラー内容` に理由が入る。

## 今後追加する候補

- 行追加時の自動同期。
- 募集人数が埋まらない場合のLINE再募集通知。
- 管理画面で応募者一覧を確認して、マネージャーが確定者を選ぶ機能。
- 確定結果をスプレッドシートへ書き戻す機能。

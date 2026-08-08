# 空き家レスキュー「青森の実家係」公式サイト

Cloudflare Pagesへ無料公開する静的サイトです。

## 現在の状態
- お問い合わせ：電話・メールで受付可能
- オンライン申込み・決済：準備中
- 公開希望URL：`https://aomori-akiya-rescue.pages.dev`
- 検索エンジン：営業開始前のため noindex

## 変更箇所
事業者情報、地域、料金、URL等は `site-config.js` に集約しています。

## 営業開始時
1. Stripeの月額会費・会員現地確認・非会員現地確認の決済URLを作成
2. `site-config.js` に各URLを入力
3. `serviceStatus` を `live` に変更
4. 全HTMLの noindex を削除し、robots.txtを更新
5. Cloudflare Pagesへ再アップロード

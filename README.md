# Ohanashi

2人で使うおはなしアプリ（Vite + TypeScript + Firestore / GitHub Pages）

## 残作業

### Firebase
- [ ] Firebase プロジェクトを作成
- [ ] Firestore Database を作成（ロケーション: `asia-northeast1` 推奨）
- [ ] ウェブアプリを登録し、表示された設定値で [src/firebaseConfig.ts](src/firebaseConfig.ts) を置き換える
- [ ] Firestore の「ルール」に [firestore.rules](firestore.rules) の内容を貼り付けて公開

### GitHub Pages
- [ ] リポジトリの Settings > Pages > Source を「GitHub Actions」に設定
- [ ] `main` に push（[deploy.yml](.github/workflows/deploy.yml) が自動でビルド・デプロイ）

### 動作確認（実DB）
- [ ] 2台のスマホで公開URLを開き、それぞれ名前を登録
- [ ] 片方で作ったセッションが、もう片方の一覧にリアルタイムで出る
- [ ] 発言が相手の画面にリアルタイムで反映され、相手の発言が左側に名前付きで表示される

## 注意
- 発言者は端末のブラウザに保存される。ブラウザのデータを消すか別のブラウザで開くと、別の人として登録し直しになる
- 認証なしのため、URL と Firebase 設定値を知っていれば誰でも読み書きできる

## 開発
```sh
npm install
npm run dev       # 開発サーバー
npm run build     # 型チェック + ビルド
```

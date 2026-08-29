/**
 * AP デザイントークン
 * 方針: アクセシビリティ第一。全テキストはWCAG AA (4.5:1) 以上のコントラスト。
 * 世界観: 「声が順番に届く」= 夜のラジオ局のような深い青緑と、
 * 発話中を示す暖かな灯り(ランタンアンバー)。
 */
export const colors = {
  bg: '#0E1B1E',            // 深い青緑(夜のスタジオ)
  surface: '#16282C',
  surfaceRaised: '#1E353A',
  speaking: '#FFB454',      // 発話中: ランタンアンバー
  speakingDeep: '#E08A1E',
  self: '#7BD88F',          // 自分の声: 若葉
  text: '#F2F7F5',
  textDim: '#9DB4AF',
  queued: '#4A6B72',        // 順番待ち
  danger: '#FF7B6B',
  focus: '#8AD8FF',         // フォーカスリング
};

export const type = {
  display: { fontSize: 28, fontWeight: '700' as const, letterSpacing: 0.5 },
  title: { fontSize: 20, fontWeight: '600' as const },
  body: { fontSize: 17, lineHeight: 26 },
  caption: { fontSize: 13 },
};

// タッチターゲットは最低56pt(標準44ptより大きく、運動機能に配慮)
export const touch = { min: 56, large: 96 };
export const radius = { sm: 10, md: 16, lg: 28, full: 999 };

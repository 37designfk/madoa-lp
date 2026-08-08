/**
 * 補助金LP B案・診断ウィジェットのデータとロジック。
 *
 * 金額を変えるときはこのファイルだけを触る。コンポーネント側は結果を表示するだけ。
 * 補助金額は現行の補助金LP（SubsidyPricing.astro）に載せている
 * 先進的窓リノベの数字をそのまま使っている。ここで新しい制度情報を作らない。
 */

/** 住まいの種類 */
export type HouseType = 'detached' | 'apartment';

/** 窓の数のレンジ */
export type WindowCountKey = 'small' | 'medium' | 'large';

/** 窓の大きさ（先進的窓リノベのサイズ区分に対応） */
export type WindowSizeKey = 'kogata' | 'koshidaka' | 'hakidashi';

/** 選択肢1つ分 */
export interface Choice<T extends string> {
  key: T;
  label: string;
  /** 選択肢の下に出す補足。無くてもよい */
  hint?: string;
}

/** 設問1つ分 */
export interface Question<T extends string> {
  id: string;
  title: string;
  choices: Choice<T>[];
  /** 選択を待つ間に目に入れる一言。購入抵抗を潰すために置く */
  aside?: string;
}

export const QUESTION_HOUSE: Question<HouseType> = {
  id: 'house',
  title: 'お住まいはどちらですか？',
  choices: [
    { key: 'detached', label: '戸建て' },
    { key: 'apartment', label: 'マンション・アパート' },
  ],
  aside: 'この診断でお名前や電話番号をうかがうことはありません。',
};

export const QUESTION_COUNT: Question<WindowCountKey> = {
  id: 'count',
  title: '気になる窓はいくつありますか？',
  choices: [
    { key: 'small', label: '1〜2ヶ所' },
    { key: 'medium', label: '3〜5ヶ所' },
    { key: 'large', label: '6ヶ所以上' },
  ],
  aside: '内窓なら1ヶ所あたり1時間ほど。家具の移動も片付けも必要ありません。',
};

export const QUESTION_SIZE: Question<WindowSizeKey> = {
  id: 'size',
  title: '一番気になる窓の大きさは？',
  choices: [
    { key: 'kogata', label: '小さい窓', hint: 'トイレ・浴室・小窓など' },
    { key: 'koshidaka', label: '腰高窓', hint: '一般的な高さの窓' },
    { key: 'hakidashi', label: '掃き出し窓', hint: 'ベランダに出る大きな窓' },
  ],
  aside: '補助金の申請書類は、こちらですべて作成します。',
};

/** 窓の数のレンジ（下限・上限） */
export const WINDOW_COUNT_RANGE: Record<WindowCountKey, { min: number; max: number }> = {
  small: { min: 1, max: 2 },
  medium: { min: 3, max: 5 },
  // 6ヶ所以上は上限が読めないので、目安として8ヶ所で止める
  large: { min: 6, max: 8 },
};

/**
 * 窓1ヶ所あたりの補助金額（内窓・Sグレード・戸建住宅）。
 *
 * 掃き出し窓は制度上「大」と「特大」にまたがるが、単価をレンジにすると
 * 窓数のレンジと掛け算になって結果の幅が3倍近くまで開き、
 * 「結局いくらか分からない」状態になる。
 * そこで代表値の「大」で計算し、特大にあたる窓は結果画面の注記で補う。
 */
export const SUBSIDY_PER_WINDOW: Record<WindowSizeKey, { min: number; max: number }> = {
  kogata: { min: 22_000, max: 22_000 },
  koshidaka: { min: 34_000, max: 34_000 },
  hakidashi: { min: 52_000, max: 52_000 },
};

/** 特大サイズ（2.8平方メートル以上）の窓1ヶ所あたりの補助金額 */
export const SUBSIDY_EXTRA_LARGE = 76_000;

/**
 * 自己負担額を結果画面に出すかどうか。
 *
 * false のあいだは補助金額だけを表示する。
 * 施工価格のレンジを受け取って CONSTRUCTION_COST を埋めたら true にする。
 * コンポーネントの改修は不要。
 */
export const SHOW_SELF_PAY = false;

/**
 * 窓1ヶ所あたりの工事費の目安（内窓・材工込み）。
 *
 * 未確定。菊池様に実際の施工価格のレンジをうかがってから入れる。
 * SHOW_SELF_PAY が false のあいだはどこからも参照されない。
 */
export const CONSTRUCTION_COST: Record<WindowSizeKey, { min: number; max: number }> = {
  kogata: { min: 0, max: 0 },
  koshidaka: { min: 0, max: 0 },
  hakidashi: { min: 0, max: 0 },
};

/** 診断の結果 */
export interface EstimateResult {
  /** 金額を出せるケースか。マンションは補助額の数字を持っていないので false */
  hasAmount: boolean;
  subsidy: { min: number; max: number } | null;
  selfPay: { min: number; max: number } | null;
  /** 結果画面の見出し */
  headline: string;
  /** 見出しの下に置く説明 */
  body: string;
}

/**
 * 回答から補助金額と自己負担額を求める。
 *
 * マンション・アパートは、現行LPが戸建の補助金額しか持っていないため金額を出さない。
 * 持っていない数字を推定して見せると、見積もり時の食い違いで信用を失う。
 */
export function estimate(
  house: HouseType,
  count: WindowCountKey,
  size: WindowSizeKey
): EstimateResult {
  if (house === 'apartment') {
    return {
      hasAmount: false,
      subsidy: null,
      selfPay: null,
      headline: 'マンション・アパートも補助金の対象です',
      body: '集合住宅は窓の仕様や管理規約によって補助額が変わるため、この場で正確な金額をお出しできません。窓の写真を1枚お送りいただければ、対象かどうかと金額の目安をお返しします。',
    };
  }

  const range = WINDOW_COUNT_RANGE[count];
  const perWindow = SUBSIDY_PER_WINDOW[size];
  const subsidy = {
    min: perWindow.min * range.min,
    max: perWindow.max * range.max,
  };

  let selfPay: { min: number; max: number } | null = null;
  if (SHOW_SELF_PAY) {
    const cost = CONSTRUCTION_COST[size];
    selfPay = {
      // 下限は「工事費の下限 − 補助金の上限」。マイナスにはしない
      min: Math.max(0, cost.min * range.min - subsidy.max),
      max: Math.max(0, cost.max * range.max - subsidy.min),
    };
  }

  let body =
    '同じ条件で工事された方の補助金額の目安です。窓の状態や設置場所によって変わるため、正確な金額は現地を見てからお伝えします。';
  if (size === 'hakidashi') {
    body +=
      `なお、とくに大きな窓（2.8平方メートル以上）は1ヶ所あたり${formatYen(SUBSIDY_EXTRA_LARGE)}になるため、目安より上がることがあります。`;
  }

  return {
    hasAmount: true,
    subsidy,
    selfPay,
    headline: '補助金の対象になる可能性が高いです',
    body,
  };
}

/** 金額を「12万3,000円」形式にする */
export function formatYen(value: number): string {
  return value.toLocaleString('ja-JP') + '円';
}

/**
 * LINEに貼り付けてもらうテキストを組み立てる。
 *
 * lin.ee のリンクは友だち追加しかできず、メッセージの事前入力ができない。
 * そのためユーザーにコピーして送ってもらう。
 */
export function buildShareText(
  house: HouseType,
  count: WindowCountKey,
  size: WindowSizeKey,
  result: EstimateResult
): string {
  const houseLabel = QUESTION_HOUSE.choices.find((c) => c.key === house)?.label ?? '';
  const countLabel = QUESTION_COUNT.choices.find((c) => c.key === count)?.label ?? '';
  const sizeLabel = QUESTION_SIZE.choices.find((c) => c.key === size)?.label ?? '';

  const lines = [
    '【窓リフォーム補助金の診断結果】',
    `お住まい: ${houseLabel}`,
    `窓の数: ${countLabel}`,
    `窓の大きさ: ${sizeLabel}`,
  ];

  if (result.subsidy) {
    lines.push(
      `補助金の目安: ${formatYen(result.subsidy.min)}〜${formatYen(result.subsidy.max)}`
    );
  }
  if (result.selfPay) {
    lines.push(
      `ご負担の目安: ${formatYen(result.selfPay.min)}〜${formatYen(result.selfPay.max)}`
    );
  }

  lines.push('', 'この内容で見積もりをお願いします。');
  return lines.join('\n');
}

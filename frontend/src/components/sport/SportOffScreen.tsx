interface SportOffScreenProps {
  /** Има ли запазена (изключена) програма — тогава казваме, че данните са налични. */
  hasSavedData: boolean;
  onEnable: () => void;
  isEnabling: boolean;
}

/**
 * Какво вижда човек, отворил /sport без спортът да е включен.
 * Пунктът „Спорт" не се показва в навигацията в това състояние — тук се стига
 * само по директен адрес или отметка, затова има бутон вместо пренасочване.
 */
export function SportOffScreen({ hasSavedData, onEnable, isEnabling }: SportOffScreenProps) {
  return (
    <section className="off-screen">
      <p className="eyebrow">Спортът не е включен</p>
      <h1>
        Дневник за
        <br />
        движение
      </h1>
      <p className="intro">
        Кратки сесии, ясен седмичен ритъм и записване на реалните тежести и повторения.
        Отделно от задачите ти — работната дъска остава чиста.
      </p>

      <ul className="off-list">
        <li>Планът за деня с отметка на всяка сесия</li>
        <li>Реални килограми и повторения, с история през циклите</li>
        <li>Свой седмичен ритъм — сам решаваш кой ден какво има</li>
        <li>Тегло и обиколки веднъж седмично</li>
      </ul>

      <button className="primary" onClick={onEnable} disabled={isEnabling}>
        {isEnabling ? 'Включване…' : 'Включи спорта'}
      </button>

      {hasSavedData && (
        <p className="off-note">
          Данните ти отпреди са запазени — включиш ли пак, намираш всичко както си го оставил.
        </p>
      )}
    </section>
  );
}

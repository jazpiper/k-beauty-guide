import { useState } from "react";
import "./SkinQuiz.css";

const QUESTIONS = [
  {
    id: 1, question: "How does your skin feel by midday?",
    options: [
      { text: "Tight and flaky", value: "dry" },
      { text: "Shiny and oily", value: "oily" },
      { text: "Oily in T-zone, dry on cheeks", value: "combo" },
      { text: "Normal and comfortable", value: "normal" },
    ],
  },
  {
    id: 2, question: "How often do you get breakouts?",
    options: [
      { text: "Rarely or never", value: "dry" },
      { text: "Frequently", value: "oily" },
      { text: "Sometimes, especially T-zone", value: "combo" },
      { text: "Occasionally", value: "normal" },
    ],
  },
  {
    id: 3, question: "How does your skin react to new products?",
    options: [
      { text: "Often gets red or irritated", value: "sensitive" },
      { text: "Fine most of the time", value: "normal" },
      { text: "Gets oilier", value: "oily" },
      { text: "Feels drier", value: "dry" },
    ],
  },
  {
    id: 4, question: "What's your main skin concern?",
    options: [
      { text: "Dryness & dehydration", value: "dry" },
      { text: "Excess oil & pores", value: "oily" },
      { text: "Uneven tone & dullness", value: "combo" },
      { text: "Redness & sensitivity", value: "sensitive" },
    ],
  },
  {
    id: 5, question: "What does your skin look like in the morning?",
    options: [
      { text: "Still dry and tight", value: "dry" },
      { text: "Very shiny and greasy", value: "oily" },
      { text: "Mix of oily and dry areas", value: "combo" },
      { text: "Fresh and balanced", value: "normal" },
    ],
  },
];

const RESULTS = {
  dry: {
    type: "Dry Skin", emoji: "💧", color: "#E3F2FD",
    desc: "Your skin needs deep hydration and moisture-locking ingredients.",
    tips: ["Use cream-based cleansers", "Layer hydrating toners", "Look for hyaluronic acid & ceramides", "Avoid alcohol-based products"],
    products: ["COSRX Snail 96 Mucin", "Laneige Water Bank Cream", "Klairs Supple Preparation Toner"],
    ingredients: ["Hyaluronic Acid", "Ceramides", "Snail Mucin", "Glycerin"],
  },
  oily: {
    type: "Oily Skin", emoji: "✨", color: "#FFF9C4",
    desc: "Your skin produces excess sebum. Focus on balancing and mattifying.",
    tips: ["Use gel or foam cleansers", "Try BHA exfoliants", "Use lightweight, oil-free moisturizers", "Don't skip moisturizer!"],
    products: ["Some By Mi AHA BHA PHA Toner", "ANUA Heartleaf Serum", "Purito Centella Serum"],
    ingredients: ["Niacinamide", "BHA (Salicylic Acid)", "Green Tea Extract", "Centella Asiatica"],
  },
  combo: {
    type: "Combination Skin", emoji: "⚖️", color: "#F3E5F5",
    desc: "Balance is key! Different zones need different care.",
    tips: ["Use gentle, balancing cleansers", "Spot-treat oily areas with BHA", "Hydrate dry areas with richer creams", "Try multi-masking"],
    products: ["Innisfree Green Tea Serum", "Etude House SoonJung Toner", "Missha Time Revolution Toner"],
    ingredients: ["Niacinamide", "Hyaluronic Acid", "Green Tea", "Adenosine"],
  },
  sensitive: {
    type: "Sensitive Skin", emoji: "🌸", color: "#FCE4EC",
    desc: "Your skin needs gentle, soothing ingredients and minimal irritants.",
    tips: ["Always patch test new products", "Avoid fragrances and alcohol", "Look for soothing & barrier-repairing ingredients", "Introduce new products slowly"],
    products: ["Klairs Midnight Blue Calming Cream", "Purito Centella Unscented Serum", "Etude House SoonJung Toner"],
    ingredients: ["Centella Asiatica", "Ceramides", "Panthenol", "Allantoin"],
  },
  normal: {
    type: "Normal Skin", emoji: "🌟", color: "#E8F5E9",
    desc: "Lucky you! Maintain your balance and focus on prevention.",
    tips: ["Keep up a consistent routine", "Focus on antioxidants & SPF", "Light hydration is enough", "Enjoy trying new K-beauty trends!"],
    products: ["Innisfree Green Tea Serum", "COSRX Snail 96 Mucin", "Banila Co Clean It Zero"],
    ingredients: ["Vitamin C", "Green Tea", "Hyaluronic Acid", "Adenosine"],
  },
};

export default function SkinQuiz() {
  const [step, setStep] = useState(0); // 0=intro, 1-5=questions, 6=result
  const [answers, setAnswers] = useState([]);
  const [selected, setSelected] = useState(null);

  const handleAnswer = (value) => {
    setSelected(value);
    setTimeout(() => {
      const newAnswers = [...answers, value];
      setAnswers(newAnswers);
      setSelected(null);
      if (step < QUESTIONS.length) setStep(step + 1);
      else setStep(6);
    }, 400);
  };

  const getResult = () => {
    const count = {};
    answers.forEach((a) => { count[a] = (count[a] || 0) + 1; });
    return Object.keys(count).reduce((a, b) => count[a] > count[b] ? a : b, "normal");
  };

  const reset = () => { setStep(0); setAnswers([]); setSelected(null); };

  if (step === 0) return (
    <div className="quiz-page">
      <div className="quiz-intro">
        <div className="quiz-emoji">💆</div>
        <h1>Skin Type <span className="pink">Quiz</span></h1>
        <p>Answer 5 quick questions to discover your skin type and get personalized K-beauty recommendations!</p>
        <div className="quiz-features">
          <div className="quiz-feature">⚡ Takes only 2 minutes</div>
          <div className="quiz-feature">🎯 Personalized results</div>
          <div className="quiz-feature">🛍️ Product recommendations</div>
        </div>
        <button className="start-btn" onClick={() => setStep(1)}>Start Quiz →</button>
      </div>
    </div>
  );

  if (step === 6) {
    const result = RESULTS[getResult()];
    return (
      <div className="quiz-page">
        <div className="result-page" style={{ background: result.color }}>
          <div className="result-emoji">{result.emoji}</div>
          <div className="result-type">{result.type}</div>
          <p className="result-desc">{result.desc}</p>
        </div>
        <div className="result-body">
          <div className="result-section">
            <div className="result-section-title">💡 Skincare Tips</div>
            <ul className="tips-list">
              {result.tips.map((t, i) => <li key={i}>{t}</li>)}
            </ul>
          </div>
          <div className="result-section">
            <div className="result-section-title">🛍️ Recommended Products</div>
            <div className="rec-list">
              {result.products.map((p, i) => <div key={i} className="rec-item">✅ {p}</div>)}
            </div>
          </div>
          <div className="result-section">
            <div className="result-section-title">🔬 Key Ingredients to Look For</div>
            <div className="ing-tags">
              {result.ingredients.map((ing, i) => <span key={i} className="ing-tag">{ing}</span>)}
            </div>
          </div>
          <button className="retry-btn" onClick={reset}>🔄 Retake Quiz</button>
        </div>
      </div>
    );
  }

  const q = QUESTIONS[step - 1];
  const progress = ((step) / QUESTIONS.length) * 100;

  return (
    <div className="quiz-page">
      <div className="quiz-header">
        <div className="quiz-progress-label">Question {step} of {QUESTIONS.length}</div>
        <div className="quiz-progress-bar">
          <div className="quiz-progress-fill" style={{ width: `${progress}%` }} />
        </div>
      </div>
      <div className="quiz-question-area">
        <div className="question-text">{q.question}</div>
        <div className="options">
          {q.options.map((opt, i) => (
            <button key={i} onClick={() => handleAnswer(opt.value)}
              className={`option-btn ${selected === opt.value ? "selected" : ""}`}>
              {opt.text}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

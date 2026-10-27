"use client";

import { ChangeEvent, useMemo, useRef, useState } from "react";
import {
  AttackPath,
  Breach,
  DEMO_CODE,
  DEMO_EMAIL,
  Finding,
  Language,
  SecurityControls,
  buildAttackPaths,
  calculateRisk,
  demoBreaches,
  findingLabel,
  glossary,
  sampleText,
  scanText,
} from "./lib/exposure";
import { scanFile } from "./lib/fileScanner";
import LiveBreachCheck from "./LiveBreachCheck";

type View = "audit" | "report" | "privacy";

const copy = {
  pl: {
    navAudit: "Audyt",
    navReport: "Raport",
    navPrivacy: "Prywatność",
    eyebrow: "BEZPIECZNE DEMO • DANE FIKCYJNE",
    heroTitleA: "Sprawdź, co internet",
    heroTitleB: "wie o Tobie.",
    heroText:
      "ExposureGuard łączy informacje o wyciekach ze skanowaniem danych osobowych. Zamiast straszyć terminami, pokazuje co znaleziono, dlaczego to ważne i co zrobić najpierw.",
    localBadge: "Analiza plików odbywa się lokalnie",
    start: "Rozpocznij bezpieczne demo",
    how: "Jak to działa",
    stepVerify: "Potwierdź adres",
    stepScan: "Uruchom analizę",
    stepAct: "Zabezpiecz dane",
    verifyTitle: "1. Potwierdź swój adres",
    verifyText:
      "W wersji produkcyjnej kod trafia na sprawdzany adres. Demo używa wyłącznie bezpiecznej domeny testowej.",
    email: "Adres e-mail",
    sendCode: "Wyślij kod demonstracyjny",
    code: "Kod weryfikacyjny",
    confirm: "Potwierdź",
    demoCode: "Kod demonstracyjny",
    verified: "Adres testowy potwierdzony",
    breachTitle: "2. Sprawdź ekspozycję",
    breachText:
      "Wyniki poniżej są fikcyjnym scenariuszem. Docelowa darmowa integracja skorzysta z XposedOrNot po wyraźnej zgodzie użytkownika.",
    runBreach: "Uruchom skan wycieków",
    scanning: "Analizuję…",
    foundBreaches: "Znalezione wycieki",
    fictional: "Fikcyjny",
    contentTitle: "3. Znajdź dane, które mogą Cię zdradzić",
    contentText:
      "Wklej post, opis profilu lub treść ogłoszenia. Możesz też dodać plik — tekst i metadane są analizowane w Twojej przeglądarce.",
    sample: "Wstaw bezpieczny przykład",
    scanText: "Skanuj tekst",
    drop: "Dodaj TXT, MD, PDF, PNG, JPG lub WEBP",
    fileHint: "Maks. 10 MB. Obrazy są sprawdzane przez OCR i analizę EXIF.",
    processingFile: "Analizuję plik lokalnie",
    findings: "Wykryte informacje",
    noFindings: "Nie wykryto danych osobowych w analizowanej treści.",
    confidence: "pewności",
    protections: "Twoje zabezpieczenia",
    uniquePasswords: "Używam unikalnych haseł",
    mfa: "Mam dodatkowe potwierdzenie logowania",
    passkeys: "Korzystam z passkeys",
    reportTitle: "Twój raport ekspozycji",
    reportIntro:
      "Wynik jest indeksem pomagającym ustalić kolejność działań — nie jest procentowym prawdopodobieństwem ataku.",
    scoreLabel: "Indeks ekspozycji",
    low: "Niski",
    moderate: "Umiarkowany",
    high: "Wysoki",
    critical: "Krytyczny",
    whyScore: "Co wpłynęło na wynik",
    paths: "Co ktoś mógłby zrobić",
    topActions: "Zrób teraz",
    action1: "Zmień powtarzające się hasła, zaczynając od poczty.",
    action2: "Włącz MFA lub passkeys na najważniejszych kontach.",
    action3: "Usuń telefon, lokalizację i datę urodzenia z publicznych profili.",
    glossary: "Słownik bez wychodzenia z aplikacji",
    emptyReport: "Uruchom przynajmniej jeden skan, aby zobaczyć raport.",
    backToAudit: "Wróć do audytu",
    privacyTitle: "Prywatność nie jest dodatkiem.",
    privacyIntro:
      "To demo zostało zaprojektowane tak, aby testować produkt bez przetwarzania prawdziwych danych wyciekowych.",
    privacyCards: [
      ["Lokalne pliki", "Tekst, obrazy i metadane są analizowane w przeglądarce i nie trafiają na serwer."],
      ["Brak surowych wycieków", "Aplikacja pokazuje tylko nazwę zdarzenia i rodzaje ujawnionych danych."],
      ["Dowody, nie domysły", "Każde ostrzeżenie wskazuje konkretne dane, które je uruchomiły."],
      ["Kontrola użytkownika", "Możesz odrzucić błędne wykrycie przed końcową oceną."],
    ],
    sourceNote:
      "W przyszłej wersji live XposedOrNot będzie domyślnym darmowym źródłem. Brak wyniku nigdy nie będzie przedstawiany jako gwarancja bezpieczeństwa.",
    footer: "Projekt demonstracyjny • Privacy by design • PL / EN",
  },
  en: {
    navAudit: "Audit",
    navReport: "Report",
    navPrivacy: "Privacy",
    eyebrow: "SAFE DEMO • FICTIONAL DATA",
    heroTitleA: "See what the internet",
    heroTitleB: "knows about you.",
    heroText:
      "ExposureGuard combines breach intelligence with personal-data scanning. Instead of hiding behind jargon, it explains what was found, why it matters and what to do first.",
    localBadge: "Files are analysed locally",
    start: "Start the safe demo",
    how: "How it works",
    stepVerify: "Verify your address",
    stepScan: "Run the analysis",
    stepAct: "Protect your data",
    verifyTitle: "1. Verify your address",
    verifyText:
      "In production the code goes to the address being checked. The demo only supports a safe test domain.",
    email: "Email address",
    sendCode: "Send demo code",
    code: "Verification code",
    confirm: "Confirm",
    demoCode: "Demo code",
    verified: "Test address verified",
    breachTitle: "2. Check your exposure",
    breachText:
      "The results below are a fictional scenario. The future free integration will use XposedOrNot after explicit consent.",
    runBreach: "Run breach scan",
    scanning: "Analysing…",
    foundBreaches: "Breaches found",
    fictional: "Fictional",
    contentTitle: "3. Find data that can expose you",
    contentText:
      "Paste a post, profile bio or listing. You can also add a file — text and metadata stay in your browser.",
    sample: "Insert safe example",
    scanText: "Scan text",
    drop: "Add TXT, MD, PDF, PNG, JPG or WEBP",
    fileHint: "Max. 10 MB. Images use OCR and EXIF analysis.",
    processingFile: "Analysing file locally",
    findings: "Information detected",
    noFindings: "No personal data was detected in the analysed content.",
    confidence: "confidence",
    protections: "Your protections",
    uniquePasswords: "I use unique passwords",
    mfa: "I use an additional sign-in check",
    passkeys: "I use passkeys",
    reportTitle: "Your exposure report",
    reportIntro:
      "The result is an index for prioritising action — it is not a percentage probability of an attack.",
    scoreLabel: "Exposure index",
    low: "Low",
    moderate: "Moderate",
    high: "High",
    critical: "Critical",
    whyScore: "What affected the result",
    paths: "What someone could do",
    topActions: "Do this now",
    action1: "Change reused passwords, starting with your email account.",
    action2: "Enable MFA or passkeys on your most important accounts.",
    action3: "Remove phone, location and birth date from public profiles.",
    glossary: "Glossary without leaving the app",
    emptyReport: "Run at least one scan to see your report.",
    backToAudit: "Back to audit",
    privacyTitle: "Privacy is not an add-on.",
    privacyIntro:
      "This demo is designed to test the product without processing real breach records.",
    privacyCards: [
      ["Local files", "Text, images and metadata are analysed in your browser and are not uploaded."],
      ["No raw breach data", "The app only shows the incident and types of data exposed."],
      ["Evidence, not guesses", "Every warning points to the exact data that triggered it."],
      ["User control", "You can dismiss an incorrect detection before the final score."],
    ],
    sourceNote:
      "The future live version will use XposedOrNot as the default free source. A missing result will never be presented as a guarantee of safety.",
    footer: "Product demo • Privacy by design • PL / EN",
  },
} as const;

function FindingCard({
  finding,
  language,
  onRemove,
}: {
  finding: Finding;
  language: Language;
  onRemove: (id: string) => void;
}) {
  return (
    <article className="finding-card">
      <div>
        <span className="finding-type">{findingLabel(finding.type, language)}</span>
        <strong>{finding.maskedValue}</strong>
        <p>{finding.context}</p>
      </div>
      <div className="finding-meta">
        <span>{Math.round(finding.confidence * 100)}% {copy[language].confidence}</span>
        <button
          className="icon-button"
          onClick={() => onRemove(finding.id)}
          aria-label={language === "pl" ? "Odrzuć wykrycie" : "Dismiss finding"}
        >
          ×
        </button>
      </div>
    </article>
  );
}

function ReportView({
  language,
  breaches,
  findings,
  controls,
  onBack,
}: {
  language: Language;
  breaches: Breach[];
  findings: Finding[];
  controls: SecurityControls;
  onBack: () => void;
}) {
  const t = copy[language];
  const risk = calculateRisk(breaches, findings, controls, language);
  const paths = buildAttackPaths(breaches, findings);
  const levelLabel = {
    low: t.low,
    moderate: t.moderate,
    high: t.high,
    critical: t.critical,
  }[risk.level];
  const hasData = breaches.length > 0 || findings.length > 0;

  if (!hasData) {
    return (
      <main className="page-shell report-empty">
        <div className="empty-orbit" aria-hidden="true">0</div>
        <h1>{t.emptyReport}</h1>
        <button className="button button-primary" onClick={onBack}>
          {t.backToAudit}
        </button>
      </main>
    );
  }

  return (
    <main className="page-shell report-page">
      <div className="section-heading">
        <div>
          <span className="section-kicker">EXPOSURE REPORT / 01</span>
          <h1>{t.reportTitle}</h1>
          <p>{t.reportIntro}</p>
        </div>
        <button className="button button-secondary" onClick={() => window.print()}>
          {language === "pl" ? "Drukuj / zapisz PDF" : "Print / save PDF"}
        </button>
      </div>

      <section className="score-panel">
        <div
          className={`risk-dial risk-${risk.level}`}
          style={{ "--score": `${risk.score * 3.6}deg` } as React.CSSProperties}
          aria-label={`${t.scoreLabel}: ${risk.score}/100`}
        >
          <div className="risk-dial-inner">
            <strong>{risk.score}</strong>
            <span>/100</span>
          </div>
        </div>
        <div className="score-copy">
          <span>{t.scoreLabel}</span>
          <h2>{levelLabel}</h2>
          <p>
            {language === "pl"
              ? "Największy wpływ ma połączenie danych kontaktowych, daty urodzenia i informacji widocznych publicznie."
              : "The largest impact comes from combining contact details, birth date and publicly visible information."}
          </p>
        </div>
        <div className="score-stats">
          <div><strong>{breaches.length}</strong><span>{t.foundBreaches.toLowerCase()}</span></div>
          <div><strong>{findings.length}</strong><span>{t.findings.toLowerCase()}</span></div>
          <div><strong>{paths.length}</strong><span>{language === "pl" ? "ścieżki ataku" : "attack paths"}</span></div>
        </div>
      </section>

      <div className="report-grid">
        <section className="report-card">
          <div className="report-card-title"><span>01</span><h2>{t.whyScore}</h2></div>
          <div className="contribution-list">
            {risk.contributions
              .sort((a, b) => b.points - a.points)
              .map((item) => (
                <div className="contribution" key={item.id}>
                  <div>
                    <strong>{item.label[language]}</strong>
                    <span>{item.evidence}</span>
                  </div>
                  <b className={item.points < 0 ? "points-negative" : ""}>
                    {item.points > 0 ? "+" : ""}{item.points}
                  </b>
                </div>
              ))}
          </div>
        </section>

        <section className="report-card report-card-dark">
          <div className="report-card-title"><span>02</span><h2>{t.paths}</h2></div>
          <div className="path-list">
            {paths.map((path: AttackPath) => (
              <article className="path-item" key={path.id}>
                <span className={`severity severity-${path.severity}`}>{path.severity}</span>
                <h3>{path.title[language]}</h3>
                <p>{path.description[language]}</p>
              </article>
            ))}
          </div>
        </section>
      </div>

      <section className="actions-section">
        <div className="report-card-title"><span>03</span><h2>{t.topActions}</h2></div>
        {[t.action1, t.action2, t.action3].map((action, index) => (
          <div className="action-row" key={action}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <p>{action}</p>
            <div className="action-check" aria-hidden="true">✓</div>
          </div>
        ))}
      </section>

      <section className="glossary-section">
        <h2>{t.glossary}</h2>
        <div className="glossary-grid">
          {glossary.map((entry) => (
            <details key={entry.term}>
              <summary>{entry.term}<span>+</span></summary>
              <p>{entry[language]}</p>
            </details>
          ))}
        </div>
      </section>
    </main>
  );
}

export default function ExposureGuardApp() {
  const [language, setLanguage] = useState<Language>("pl");
  const [view, setView] = useState<View>("audit");
  const [email, setEmail] = useState(DEMO_EMAIL);
  const [verification, setVerification] = useState<"idle" | "sent" | "verified">("idle");
  const [code, setCode] = useState("");
  const [verificationError, setVerificationError] = useState("");
  const [breachState, setBreachState] = useState<"idle" | "loading" | "done">("idle");
  const [breaches, setBreaches] = useState<Breach[]>([]);
  const [text, setText] = useState("");
  const [findings, setFindings] = useState<Finding[]>([]);
  const [fileName, setFileName] = useState("");
  const [fileProgress, setFileProgress] = useState(0);
  const [fileStatus, setFileStatus] = useState("");
  const [fileError, setFileError] = useState("");
  const [controls, setControls] = useState<SecurityControls>({
    uniquePasswords: false,
    mfa: false,
    passkeys: false,
  });
  const auditRef = useRef<HTMLDivElement>(null);
  const t = copy[language];

  const riskPreview = useMemo(
    () => calculateRisk(breaches, findings, controls, language),
    [breaches, findings, controls, language],
  );

  const goToAudit = () => {
    setView("audit");
    window.setTimeout(() => auditRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  };

  const sendDemoCode = () => {
    setVerificationError("");
    if (email.toLowerCase() !== DEMO_EMAIL) {
      setVerificationError(
        language === "pl"
          ? `Bezpieczne demo obsługuje tylko ${DEMO_EMAIL}.`
          : `The safe demo only supports ${DEMO_EMAIL}.`,
      );
      return;
    }
    setVerification("sent");
  };

  const confirmCode = () => {
    if (code === DEMO_CODE) {
      setVerification("verified");
      setVerificationError("");
    } else {
      setVerificationError(language === "pl" ? "Kod jest nieprawidłowy." : "The code is incorrect.");
    }
  };

  const runBreachScan = () => {
    setBreachState("loading");
    window.setTimeout(() => {
      setBreaches(demoBreaches);
      setBreachState("done");
    }, 900);
  };

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setFileProgress(0);
    setFileError("");
    setFileStatus(language === "pl" ? "Przygotowuję analizę" : "Preparing analysis");
    try {
      const result = await scanFile(file, (progress, status) => {
        setFileProgress(progress);
        setFileStatus(status.replaceAll("_", " "));
      });
      setText(result.extractedText);
      setFindings(result.findings);
      setFileStatus(language === "pl" ? "Analiza zakończona" : "Analysis complete");
    } catch (error) {
      setFileError(error instanceof Error ? error.message : "File analysis failed.");
      setFileStatus("");
    } finally {
      event.target.value = "";
    }
  };

  return (
    <div className="app">
      <header className="site-header">
        <button className="brand" onClick={goToAudit} aria-label="ExposureGuard home">
          <span className="brand-mark">EG</span><span>ExposureGuard<sup>AI</sup></span>
        </button>
        <nav aria-label="Main navigation">
          <button className={view === "audit" ? "active" : ""} onClick={goToAudit}>{t.navAudit}</button>
          <button className={view === "report" ? "active" : ""} onClick={() => setView("report")}>{t.navReport}</button>
          <button className={view === "privacy" ? "active" : ""} onClick={() => setView("privacy")}>{t.navPrivacy}</button>
        </nav>
        <div className="header-actions">
          <button
            className="language-toggle"
            onClick={() => setLanguage(language === "pl" ? "en" : "pl")}
            aria-label={language === "pl" ? "Switch to English" : "Przełącz na polski"}
          >
            <span className={language === "pl" ? "active" : ""}>PL</span>
            <span className={language === "en" ? "active" : ""}>EN</span>
          </button>
          <div className="privacy-status"><i /> LOCAL-FIRST</div>
        </div>
      </header>

      {view === "audit" && (
        <main>
          <section className="hero">
            <div className="hero-grid" aria-hidden="true" />
            <div className="hero-orbit hero-orbit-one" aria-hidden="true" />
            <div className="hero-orbit hero-orbit-two" aria-hidden="true" />
            <div className="hero-content">
              <span className="eyebrow"><i />{t.eyebrow}</span>
              <h1>{t.heroTitleA}<br /><em>{t.heroTitleB}</em></h1>
              <p>{t.heroText}</p>
              <div className="hero-actions">
                <button className="button button-primary" onClick={goToAudit}>
                  {t.start}<span aria-hidden="true">↘</span>
                </button>
                <span className="local-note"><b>✓</b>{t.localBadge}</span>
              </div>
            </div>
            <div className="hero-signal" aria-hidden="true">
              <div className="signal-core">PII</div>
              <span className="signal-node signal-node-a">01</span>
              <span className="signal-node signal-node-b">02</span>
              <span className="signal-node signal-node-c">03</span>
              <span className="signal-line signal-line-a" />
              <span className="signal-line signal-line-b" />
              <span className="signal-line signal-line-c" />
            </div>
            <div className="how-strip">
              <span>{t.how}</span>
              {[t.stepVerify, t.stepScan, t.stepAct].map((step, index) => (
                <div key={step}><b>0{index + 1}</b>{step}</div>
              ))}
            </div>
          </section>

          <div className="audit-shell" ref={auditRef}>
            <section className="audit-card verification-card">
              <div className="card-number">01</div>
              <div className="card-content">
                <h2>{t.verifyTitle}</h2>
                <p>{t.verifyText}</p>
                <div className="form-row">
                  <label>
                    <span>{t.email}</span>
                    <input
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      disabled={verification === "verified"}
                    />
                  </label>
                  {verification === "idle" && (
                    <button className="button button-primary" onClick={sendDemoCode}>{t.sendCode}</button>
                  )}
                </div>
                {verification === "sent" && (
                  <div className="verification-code-panel">
                    <div className="demo-code"><span>{t.demoCode}</span><strong>{DEMO_CODE}</strong></div>
                    <label>
                      <span>{t.code}</span>
                      <input
                        value={code}
                        onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                        inputMode="numeric"
                        placeholder="000000"
                      />
                    </label>
                    <button className="button button-primary" onClick={confirmCode}>{t.confirm}</button>
                  </div>
                )}
                {verification === "verified" && (
                  <div className="success-message"><span>✓</span>{t.verified}</div>
                )}
                {verificationError && <p className="form-error" role="alert">{verificationError}</p>}
              </div>
            </section>

            <section className={`audit-card ${verification !== "verified" ? "card-locked" : ""}`}>
              <div className="card-number">02</div>
              <div className="card-content">
                <h2>{t.breachTitle}</h2>
                <p>{t.breachText}</p>
                <button
                  className="button button-primary"
                  onClick={runBreachScan}
                  disabled={verification !== "verified" || breachState === "loading"}
                >
                  {breachState === "loading" ? t.scanning : t.runBreach}
                </button>
                {breachState === "done" && (
                  <div className="breach-results">
                    <div className="result-heading"><h3>{t.foundBreaches}</h3><span>{breaches.length}</span></div>
                    {breaches.map((breach) => (
                      <article className="breach-row" key={breach.id}>
                        <div className="breach-year">{breach.year}</div>
                        <div className="breach-main">
                          <div><h4>{breach.name}</h4><span>{breach.domain}</span></div>
                          <p>{breach.summary[language]}</p>
                          <div className="tag-row">
                            <span className="tag tag-demo">{t.fictional}</span>
                            {breach.dataTypes.map((type) => (
                              <span className="tag" key={type}>{findingLabel(type, language)}</span>
                            ))}
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            </section>

            <LiveBreachCheck language={language} />
            <section className="audit-card">
              <div className="card-number">03</div>
              <div className="card-content">
                <h2>{t.contentTitle}</h2>
                <p>{t.contentText}</p>
                <div className="scanner-grid">
                  <div className="text-scanner">
                    <div className="scanner-toolbar">
                      <span>PLAIN TEXT / BIO / POST</span>
                      <button onClick={() => setText(sampleText[language])}>{t.sample}</button>
                    </div>
                    <textarea
                      value={text}
                      onChange={(event) => setText(event.target.value)}
                      placeholder={sampleText[language]}
                    />
                    <button
                      className="button button-primary"
                      onClick={() => setFindings(scanText(text))}
                      disabled={!text.trim()}
                    >
                      {t.scanText}
                    </button>
                  </div>
                  <label className="file-drop">
                    <input
                      type="file"
                      accept=".txt,.md,.pdf,.png,.jpg,.jpeg,.webp,text/plain,application/pdf,image/*"
                      onChange={handleFile}
                    />
                    <span className="upload-icon">＋</span>
                    <strong>{t.drop}</strong>
                    <small>{t.fileHint}</small>
                  </label>
                </div>
                {fileName && (
                  <div className="file-progress" aria-live="polite">
                    <div><strong>{fileName}</strong><span>{fileStatus || t.processingFile}</span></div>
                    <div className="progress-track"><i style={{ width: `${fileProgress * 100}%` }} /></div>
                  </div>
                )}
                {fileError && <p className="form-error" role="alert">{fileError}</p>}
                {(findings.length > 0 || text) && (
                  <div className="findings-section">
                    <div className="result-heading"><h3>{t.findings}</h3><span>{findings.length}</span></div>
                    {findings.length === 0 ? (
                      <p className="no-findings">{t.noFindings}</p>
                    ) : (
                      <div className="findings-list">
                        {findings.map((finding) => (
                          <FindingCard
                            key={finding.id}
                            finding={finding}
                            language={language}
                            onRemove={(id) => setFindings((items) => items.filter((item) => item.id !== id))}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </section>

            <section className="controls-panel">
              <div><span className="section-kicker">RISK MODIFIERS</span><h2>{t.protections}</h2></div>
              <div className="control-options">
                {(
                  [
                    ["uniquePasswords", t.uniquePasswords],
                    ["mfa", t.mfa],
                    ["passkeys", t.passkeys],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key}>
                    <input
                      type="checkbox"
                      checked={controls[key]}
                      onChange={(event) =>
                        setControls((current) => ({ ...current, [key]: event.target.checked }))
                      }
                    />
                    <span className="custom-check">✓</span>{label}
                  </label>
                ))}
              </div>
              <button
                className="report-preview-button"
                onClick={() => setView("report")}
                disabled={breaches.length === 0 && findings.length === 0}
              >
                <span>{t.reportTitle}</span>
                <strong>{riskPreview.score}<small>/100</small></strong>
                <i>→</i>
              </button>
            </section>
          </div>
        </main>
      )}

      {view === "report" && (
        <ReportView
          language={language}
          breaches={breaches}
          findings={findings}
          controls={controls}
          onBack={goToAudit}
        />
      )}

      {view === "privacy" && (
        <main className="page-shell privacy-page">
          <span className="section-kicker">PRIVACY BY DESIGN / 01</span>
          <h1>{t.privacyTitle}</h1>
          <p className="privacy-lead">{t.privacyIntro}</p>
          <div className="privacy-grid">
            {t.privacyCards.map(([title, description], index) => (
              <article key={title}>
                <span>0{index + 1}</span><h2>{title}</h2><p>{description}</p>
              </article>
            ))}
          </div>
          <div className="source-note">
            <span>XON</span>
            <p>{t.sourceNote}</p>
            <a href="https://xposedornot.com/api_doc" target="_blank" rel="noreferrer">
              XposedOrNot API ↗
            </a>
          </div>
        </main>
      )}

      <footer>
        <div className="brand"><span className="brand-mark">EG</span><span>ExposureGuard<sup>AI</sup></span></div>
        <p>{t.footer}</p><span>v0.1 DEMO</span>
      </footer>
    </div>
  );
}

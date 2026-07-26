export type Language = "pl" | "en";

export type FindingType =
  | "EMAIL"
  | "PHONE"
  | "PESEL"
  | "IBAN"
  | "CARD"
  | "IP_ADDRESS"
  | "DATE_OF_BIRTH"
  | "USERNAME"
  | "PERSON"
  | "LOCATION"
  | "EMPLOYER"
  | "EXIF_GPS"
  | "EXIF_DEVICE"
  | "EXIF_DATE";

export type Finding = {
  id: string;
  type: FindingType;
  value: string;
  maskedValue: string;
  confidence: number;
  source: "text" | "file" | "metadata";
  context: string;
};

export type Breach = {
  id: string;
  name: string;
  domain: string;
  year: number;
  verified: boolean;
  dataTypes: FindingType[];
  summary: Record<Language, string>;
};

export type SecurityControls = {
  uniquePasswords: boolean;
  mfa: boolean;
  passkeys: boolean;
};

export type RiskContribution = {
  id: string;
  label: Record<Language, string>;
  points: number;
  evidence: string;
};

export type AttackPath = {
  id: string;
  title: Record<Language, string>;
  description: Record<Language, string>;
  severity: "medium" | "high" | "critical";
};

export const DEMO_EMAIL = "demo@exposureguard.test";
export const DEMO_CODE = "624811";

export const demoBreaches: Breach[] = [
  {
    id: "northstar-market",
    name: "Northstar Market",
    domain: "northstar.example",
    year: 2025,
    verified: true,
    dataTypes: ["EMAIL", "PHONE", "PERSON", "DATE_OF_BIRTH"],
    summary: {
      pl: "Fikcyjny sklep internetowy ujawnił dane kontaktowe i daty urodzenia klientów.",
      en: "A fictional online store exposed customer contact details and dates of birth.",
    },
  },
  {
    id: "cloudforum",
    name: "CloudForum",
    domain: "cloudforum.example",
    year: 2022,
    verified: true,
    dataTypes: ["EMAIL", "USERNAME", "IP_ADDRESS"],
    summary: {
      pl: "Fikcyjne forum ujawniło adresy e-mail, nazwy użytkowników i adresy IP.",
      en: "A fictional forum exposed email addresses, usernames and IP addresses.",
    },
  },
  {
    id: "fittrack",
    name: "FitTrack Community",
    domain: "fittrack.example",
    year: 2020,
    verified: true,
    dataTypes: ["EMAIL", "PHONE"],
    summary: {
      pl: "Fikcyjna społeczność fitness ujawniła dane kontaktowe użytkowników.",
      en: "A fictional fitness community exposed user contact details.",
    },
  },
];

const LABELS: Record<FindingType, Record<Language, string>> = {
  EMAIL: { pl: "Adres e-mail", en: "Email address" },
  PHONE: { pl: "Numer telefonu", en: "Phone number" },
  PESEL: { pl: "Numer PESEL", en: "Polish national ID" },
  IBAN: { pl: "Numer rachunku", en: "Bank account number" },
  CARD: { pl: "Numer karty", en: "Payment card number" },
  IP_ADDRESS: { pl: "Adres IP", en: "IP address" },
  DATE_OF_BIRTH: { pl: "Data urodzenia", en: "Date of birth" },
  USERNAME: { pl: "Nazwa użytkownika", en: "Username" },
  PERSON: { pl: "Imię i nazwisko", en: "Full name" },
  LOCATION: { pl: "Lokalizacja lub adres", en: "Location or address" },
  EMPLOYER: { pl: "Miejsce pracy", en: "Employer" },
  EXIF_GPS: { pl: "Lokalizacja GPS zdjęcia", en: "Photo GPS location" },
  EXIF_DEVICE: { pl: "Model urządzenia", en: "Device model" },
  EXIF_DATE: { pl: "Czas wykonania zdjęcia", en: "Photo capture time" },
};

const BASE_WEIGHTS: Partial<Record<FindingType, number>> = {
  EMAIL: 5,
  PHONE: 10,
  PESEL: 25,
  IBAN: 18,
  CARD: 25,
  IP_ADDRESS: 5,
  DATE_OF_BIRTH: 10,
  USERNAME: 4,
  PERSON: 6,
  LOCATION: 14,
  EMPLOYER: 8,
  EXIF_GPS: 18,
  EXIF_DEVICE: 3,
  EXIF_DATE: 4,
};

export function findingLabel(type: FindingType, language: Language) {
  return LABELS[type][language];
}

function makeId(type: FindingType, value: string, index: number) {
  const compact = value.replace(/\W/g, "").slice(0, 12);
  return `${type.toLowerCase()}-${compact}-${index}`;
}

export function maskValue(type: FindingType, value: string): string {
  if (type === "EMAIL") {
    const [local, domain] = value.split("@");
    return `${local.slice(0, 2)}${"•".repeat(Math.max(3, local.length - 2))}@${domain}`;
  }
  if (type === "PHONE") {
    return `${value.slice(0, 3)} ••• •• ${value.slice(-2)}`;
  }
  if (["PESEL", "IBAN", "CARD"].includes(type)) {
    return `${value.slice(0, 2)}${"•".repeat(Math.max(6, value.length - 6))}${value.slice(-4)}`;
  }
  if (type === "IP_ADDRESS") {
    const parts = value.split(".");
    return `${parts[0]}.${parts[1]}.•••.•••`;
  }
  if (type === "PERSON") {
    return value
      .split(/\s+/)
      .map((part) => `${part.charAt(0)}${"•".repeat(Math.max(2, part.length - 1))}`)
      .join(" ");
  }
  if (type === "LOCATION" || type === "EMPLOYER") {
    return `${value.slice(0, 3)}${"•".repeat(Math.max(4, value.length - 3))}`;
  }
  return value.length > 6
    ? `${value.slice(0, 3)}${"•".repeat(value.length - 5)}${value.slice(-2)}`
    : value;
}

function isValidPesel(value: string) {
  if (!/^\d{11}$/.test(value)) return false;
  const weights = [1, 3, 7, 9, 1, 3, 7, 9, 1, 3];
  const sum = weights.reduce((acc, weight, index) => acc + Number(value[index]) * weight, 0);
  return (10 - (sum % 10)) % 10 === Number(value[10]);
}

function isValidIban(value: string) {
  const compact = value.replace(/\s/g, "").toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(compact)) return false;
  const rearranged = compact.slice(4) + compact.slice(0, 4);
  const numeric = rearranged
    .split("")
    .map((char) => (/[A-Z]/.test(char) ? String(char.charCodeAt(0) - 55) : char))
    .join("");
  let remainder = 0;
  for (const digit of numeric) remainder = (remainder * 10 + Number(digit)) % 97;
  return remainder === 1;
}

function isValidCard(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  let double = false;
  for (let index = digits.length - 1; index >= 0; index -= 1) {
    let digit = Number(digits[index]);
    if (double) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    double = !double;
  }
  return sum % 10 === 0;
}

type Pattern = {
  type: FindingType;
  regex: RegExp;
  confidence: number;
  validator?: (value: string) => boolean;
};

const PATTERNS: Pattern[] = [
  {
    type: "EMAIL",
    regex: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
    confidence: 0.99,
  },
  {
    type: "PHONE",
    regex: /(?<!\d)(?:\+48[\s-]?)?(?:\d[\s-]?){9}(?!\d)/g,
    confidence: 0.91,
  },
  {
    type: "PESEL",
    regex: /(?<!\d)\d{11}(?!\d)/g,
    confidence: 0.99,
    validator: isValidPesel,
  },
  {
    type: "IBAN",
    regex: /\b[A-Z]{2}\d{2}(?:[\s]?[A-Z0-9]){10,30}\b/gi,
    confidence: 0.98,
    validator: isValidIban,
  },
  {
    type: "CARD",
    regex: /(?<!\d)(?:\d[ -]*?){13,19}(?!\d)/g,
    confidence: 0.98,
    validator: isValidCard,
  },
  {
    type: "IP_ADDRESS",
    regex: /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g,
    confidence: 0.97,
  },
  {
    type: "DATE_OF_BIRTH",
    regex: /\b(?:0?[1-9]|[12]\d|3[01])[./-](?:0?[1-9]|1[0-2])[./-](?:19|20)\d{2}\b/g,
    confidence: 0.76,
  },
  {
    type: "USERNAME",
    regex: /(?<!\w)@[A-Za-z0-9_.]{3,30}\b/g,
    confidence: 0.82,
  },
];

const CONTEXT_PATTERNS: Array<{ type: FindingType; regex: RegExp; confidence: number }> = [
  {
    type: "PERSON",
    regex: /(?:nazywam się|mam na imię|my name is)\s+([A-ZĄĆĘŁŃÓŚŹŻ][a-ząćęłńóśźż]+(?:\s+[A-ZĄĆĘŁŃÓŚŹŻ][a-ząćęłńóśźż]+)+)/gi,
    confidence: 0.88,
  },
  {
    type: "LOCATION",
    regex: /(?:mieszkam w|jestem z|live in|address is|adres to)\s+([^,.!\n]{3,70})/gi,
    confidence: 0.78,
  },
  {
    type: "EMPLOYER",
    regex: /(?:pracuję w|pracuje w|work at|employer is)\s+([^,.!\n]{2,60})/gi,
    confidence: 0.76,
  },
];

export function scanText(text: string, source: Finding["source"] = "text"): Finding[] {
  const findings: Finding[] = [];
  const seen = new Set<string>();

  for (const pattern of PATTERNS) {
    for (const match of text.matchAll(pattern.regex)) {
      const value = match[0].trim();
      const normalized = value.replace(/\s/g, "").toLowerCase();
      const key = `${pattern.type}:${normalized}`;
      if (seen.has(key) || (pattern.validator && !pattern.validator(value))) continue;
      seen.add(key);
      const start = Math.max(0, (match.index ?? 0) - 28);
      const end = Math.min(text.length, (match.index ?? 0) + value.length + 28);
      findings.push({
        id: makeId(pattern.type, value, findings.length),
        type: pattern.type,
        value,
        maskedValue: maskValue(pattern.type, value),
        confidence: pattern.confidence,
        source,
        context: text.slice(start, end).replace(/\s+/g, " ").trim(),
      });
    }
  }

  for (const pattern of CONTEXT_PATTERNS) {
    for (const match of text.matchAll(pattern.regex)) {
      const value = match[1].trim();
      const key = `${pattern.type}:${value.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      findings.push({
        id: makeId(pattern.type, value, findings.length),
        type: pattern.type,
        value,
        maskedValue: maskValue(pattern.type, value),
        confidence: pattern.confidence,
        source,
        context: match[0].replace(/\s+/g, " ").trim(),
      });
    }
  }

  return findings.sort((a, b) => b.confidence - a.confidence);
}

export function calculateRisk(
  breaches: Breach[],
  findings: Finding[],
  controls: SecurityControls,
  language: Language,
) {
  const contributions: RiskContribution[] = [];
  const detectedTypes = new Set<FindingType>([
    ...breaches.flatMap((breach) => breach.dataTypes),
    ...findings.map((finding) => finding.type),
  ]);

  detectedTypes.forEach((type) => {
    const base = BASE_WEIGHTS[type] ?? 2;
    const repeatedInBreaches = breaches.filter((breach) => breach.dataTypes.includes(type)).length;
    const repetitionBonus = Math.min(5, Math.max(0, repeatedInBreaches - 1) * 2);
    contributions.push({
      id: `risk-${type.toLowerCase()}`,
      label: LABELS[type],
      points: base + repetitionBonus,
      evidence:
        repeatedInBreaches > 0
          ? `${repeatedInBreaches} breach${repeatedInBreaches === 1 ? "" : "es"}`
          : language === "pl"
            ? "Wykryto w analizowanej treści"
            : "Detected in analysed content",
    });
  });

  if (breaches.some((breach) => breach.year >= 2024)) {
    contributions.push({
      id: "risk-recency",
      label: { pl: "Niedawny wyciek", en: "Recent breach" },
      points: 5,
      evidence: language === "pl" ? "Wyciek z ostatnich dwóch lat" : "Breach from the last two years",
    });
  }

  const reductions: RiskContribution[] = [];
  if (controls.uniquePasswords) {
    reductions.push({
      id: "control-passwords",
      label: { pl: "Unikalne hasła", en: "Unique passwords" },
      points: -10,
      evidence: language === "pl" ? "Ogranicza użycie wykradzionych danych" : "Limits credential reuse",
    });
  }
  if (controls.mfa) {
    reductions.push({
      id: "control-mfa",
      label: { pl: "Dodatkowe potwierdzenie logowania", en: "Multi-factor authentication" },
      points: -15,
      evidence: language === "pl" ? "Utrudnia logowanie samym hasłem" : "Blocks password-only sign-ins",
    });
  }
  if (controls.passkeys) {
    reductions.push({
      id: "control-passkeys",
      label: { pl: "Passkeys", en: "Passkeys" },
      points: -5,
      evidence: language === "pl" ? "Zmniejsza zależność od haseł" : "Reduces password dependence",
    });
  }

  const raw = [...contributions, ...reductions].reduce((sum, item) => sum + item.points, 0);
  const score = Math.max(0, Math.min(100, raw));
  const level =
    score >= 75 ? "critical" : score >= 50 ? "high" : score >= 25 ? "moderate" : "low";

  return { score, level, contributions: [...contributions, ...reductions] };
}

export function buildAttackPaths(
  breaches: Breach[],
  findings: Finding[],
): AttackPath[] {
  const types = new Set<FindingType>([
    ...breaches.flatMap((breach) => breach.dataTypes),
    ...findings.map((finding) => finding.type),
  ]);
  const paths: AttackPath[] = [];

  if (types.has("EMAIL") && (types.has("USERNAME") || breaches.length > 1)) {
    paths.push({
      id: "credential-stuffing",
      title: { pl: "Próby logowania w innych serwisach", en: "Sign-in attempts on other services" },
      description: {
        pl: "Znany adres e-mail i nazwa użytkownika mogą zostać automatycznie sprawdzone w innych serwisach. Ryzyko rośnie, jeśli hasła się powtarzają.",
        en: "A known email and username can be automatically tested on other services. Reused passwords increase the risk.",
      },
      severity: "high",
    });
  }
  if (types.has("EMAIL") && types.has("PHONE") && types.has("DATE_OF_BIRTH")) {
    paths.push({
      id: "account-recovery",
      title: { pl: "Podszywanie się podczas odzyskiwania konta", en: "Account recovery impersonation" },
      description: {
        pl: "Połączenie telefonu, daty urodzenia i e-maila ułatwia wiarygodną rozmowę z pomocą techniczną lub przygotowanie phishingu.",
        en: "A phone number, date of birth and email can make support impersonation or targeted phishing more convincing.",
      },
      severity: "critical",
    });
  }
  if (
    types.has("PERSON") &&
    (types.has("LOCATION") || types.has("EMPLOYER") || types.has("EXIF_GPS"))
  ) {
    paths.push({
      id: "doxxing",
      title: { pl: "Łączenie danych prowadzące do doxxingu", en: "Data linking that can enable doxxing" },
      description: {
        pl: "Imię połączone z miejscem pracy lub lokalizacją może pomóc obcej osobie odnaleźć kolejne profile i informacje.",
        en: "A name connected to an employer or location can help a stranger discover further profiles and information.",
      },
      severity: "high",
    });
  }
  if (types.has("EXIF_GPS")) {
    paths.push({
      id: "photo-location",
      title: { pl: "Zdjęcie ujawnia dokładną lokalizację", en: "Photo reveals a precise location" },
      description: {
        pl: "Współrzędne zapisane w metadanych mogą wskazać dom, pracę albo często odwiedzane miejsce.",
        en: "Coordinates stored in metadata can reveal a home, workplace or frequently visited location.",
      },
      severity: "critical",
    });
  }

  return paths;
}

export const sampleText: Record<Language, string> = {
  pl: "Cześć! Nazywam się Anna Kowalska, mieszkam w Gdańsku i pracuję w Northstar Studio. Kontakt: anna.kowalska@example.com, tel. +48 501 234 567. Urodziłam się 14.03.1997. Mój profil to @anna_travel.",
  en: "Hi! My name is Anna Kowalska, I live in Gdansk and work at Northstar Studio. Contact: anna.kowalska@example.com, phone +48 501 234 567. I was born on 14.03.1997. My profile is @anna_travel.",
};

export const glossary: Array<{ term: string; pl: string; en: string }> = [
  {
    term: "Data breach",
    pl: "Sytuacja, w której dane użytkowników zostały skradzione albo udostępnione bez zgody.",
    en: "An incident where user data was stolen or exposed without permission.",
  },
  {
    term: "Doxxing",
    pl: "Gromadzenie i publikowanie informacji pozwalających zidentyfikować lub nękać konkretną osobę.",
    en: "Collecting and publishing information that can identify or enable harassment of a person.",
  },
  {
    term: "MFA",
    pl: "Dodatkowe potwierdzenie logowania, np. w aplikacji. Samo hasło nie wystarcza wtedy do wejścia na konto.",
    en: "An additional sign-in check, such as an app prompt. A password alone is no longer enough.",
  },
  {
    term: "EXIF",
    pl: "Ukryte metadane zdjęcia, które mogą zawierać czas, model telefonu i współrzędne GPS.",
    en: "Hidden photo metadata that can include time, device model and GPS coordinates.",
  },
];

"use client";
import { useEffect, useState } from "react";

export default function LiveBreachCheck({ language }: { language: "pl" | "en" }) {
  const pl = language === "pl";
  const [available, setAvailable] = useState(false);
  const [mailProvider, setMailProvider] = useState('');
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [code, setCode] = useState("");
  const [challenge, setChallenge] = useState("");
  const [verified, setVerified] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ status: string; breaches: { name: string }[] } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/live/status', { signal: controller.signal, cache: 'no-store' }).then(r => r.json()).then(data => { setAvailable(data.available === true); setMailProvider(data.mailProvider === 'gmail' ? 'Gmail (Google)' : 'Resend'); }).catch(() => {});
    return () => controller.abort();
  }, []);
  async function action(kind: string) {
    setBusy(true); setError("");
    if (kind === 'check') setResult(null);
    try {
      const response = await fetch(`/api/live/${kind}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(kind === 'request' ? { email, consent } : kind === 'verify' ? { challenge, code } : {}) });
      const data = await response.json();
      if (!response.ok) {
        if (data.error === 'VERIFICATION_REQUIRED') { setVerified(false); setChallenge(""); }
        const messages: Record<string, string> = {
          INVALID_CODE: pl ? 'Kod wygasł, jest błędny lub wykorzystano limit 5 prób.' : 'Code expired, incorrect, or the 5-attempt limit was reached.',
          RATE_LIMITED: pl ? 'Osiągnięto limit. Spróbuj później — limit może dotyczyć całej usługi.' : 'Rate limit reached. Try later; the limit may apply to the whole service.',
          MAIL_UNAVAILABLE: pl ? 'Wysyłka wiadomości jest teraz niedostępna.' : 'Email delivery is currently unavailable.',
          VERIFICATION_REQUIRED: pl ? 'Sesja wygasła. Potwierdź adres ponownie.' : 'Session expired. Verify your address again.',
        };
        throw new Error(messages[data.error] ?? (pl ? 'Nie udało się zakończyć operacji. Sprawdź dane i spróbuj później.' : 'Operation failed. Check your input and try later.'));
      }
      if (kind === 'request') { setChallenge(data.challenge); setCode(""); }
      if (kind === 'verify') { setVerified(true); setCode(""); }
      if (kind === 'check') setResult(data);
      if (kind === 'logout') { setVerified(false); setChallenge(""); setCode(""); setEmail(""); setConsent(false); setResult(null); }
    } catch (e) { setError(e instanceof Error ? e.message : 'Error'); }
    finally { setBusy(false); }
  }
  return <section className="audit-card" aria-label={pl ? 'Prawdziwe wycieki' : 'Live breach check'}>
    <div className="card-number">LIVE</div><div className="card-content">
      <h2>{pl ? 'Sprawdź własny adres w XposedOrNot' : 'Check your own address with XposedOrNot'}</h2>
      <p>{pl ? 'Adres przekażemy do XposedOrNot dopiero po potwierdzeniu kodem z Twojej skrzynki. Dostawca zwraca nazwy znanych wycieków; brak wyniku nie gwarantuje bezpieczeństwa.' : 'Your address is sent to XposedOrNot only after you verify it using a code delivered to your inbox. The provider returns known breach names; no result does not guarantee safety.'}</p>
      {!available ? <p role="status">{pl ? 'Tryb live czeka na konfigurację poczty. Poniżej możesz korzystać z bezpiecznego demo.' : 'Live mode awaits email configuration. You can use the safe demo below.'}</p> : <>
        {!verified && <>
          <label>{pl ? 'Twój adres e-mail' : 'Your email address'}<input type="email" value={email} disabled={busy || !!challenge} onChange={e => setEmail(e.target.value)} autoComplete="email" /></label>
          <label><input type="checkbox" checked={consent} disabled={busy || !!challenge} onChange={e => setConsent(e.target.checked)} />{pl ? `To moja skrzynka. Zgadzam się na wysłanie kodu przez ${mailProvider} i sprawdzenie adresu w XposedOrNot.` : `I own this inbox. I agree to code delivery via ${mailProvider} and address lookup via XposedOrNot.`}</label>
          {!challenge ? <button className="button button-primary" disabled={busy || !consent || !email.trim()} onClick={() => action('request')}>{pl ? 'Wyślij kod' : 'Send code'}</button> : <>
            <p>{pl ? 'Kod jest ważny przez 10 minut. Masz 5 prób.' : 'The code is valid for 10 minutes. You have 5 attempts.'}</p>
            <label>{pl ? 'Kod z wiadomości' : 'Email code'}<input value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" /></label>
            <button className="button button-primary" disabled={busy || code.length !== 6} onClick={() => action('verify')}>{pl ? 'Potwierdź' : 'Verify'}</button>
            <button className="button button-secondary" disabled={busy} onClick={() => { setChallenge(""); setCode(""); setError(""); }}>{pl ? 'Zmień adres / wyślij ponownie' : 'Change address / resend'}</button>
          </>}
        </>}
        {verified && <><p>{pl ? 'Adres potwierdzony. Sesja jest ważna przez 15 minut.' : 'Address verified. Session is valid for 15 minutes.'}</p><button className="button button-primary" disabled={busy} onClick={() => action('check')}>{pl ? 'Sprawdź wycieki' : 'Check breaches'}</button><button className="button button-secondary" disabled={busy} onClick={() => action('logout')}>{pl ? 'Zakończ sesję' : 'End session'}</button></>}
        {busy && <p role="status">{pl ? 'Przetwarzanie…' : 'Processing…'}</p>}
        {error && <p className="form-error" role="alert">{error}</p>}
        {result && <div aria-live="polite"><h3>{pl ? 'Wynik XposedOrNot' : 'XposedOrNot result'}</h3>{result.status === 'not_found' ? <p>{pl ? 'Dostawca nie zwrócił znanych wycieków dla tego adresu.' : 'The provider returned no known breaches for this address.'}</p> : <ul>{result.breaches.map(b => <li key={b.name}>{b.name}</li>)}</ul>}<p>{pl ? 'Zakres danych jest częściowy. Same nazwy nie wystarczają do wyliczenia indeksu ryzyka.' : 'Coverage is partial. Names alone do not justify a risk score.'}</p></div>}
      </>}
    </div>
  </section>;
}

import { useState } from 'react';
import { errorMessage, useAccount } from '../shared/account.js';

// The account page: sign in, create an account, change the password, delete the
// account. It is the only page in the app that talks about accounts, and it is
// deliberately a separate page rather than chrome inside a game — a child who
// never signs in never sees any of it.
//
// Everything a child reads is Norwegian; every identifier here is English.

function Field({ id, label, type, value, onChange, autoComplete, hint }) {
  return (
    <p className="account-field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        name={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete={autoComplete}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck="false"
        aria-describedby={hint ? `${id}-hint` : undefined}
      />
      {hint ? (
        <span className="account-hint" id={`${id}-hint`}>
          {hint}
        </span>
      ) : null}
    </p>
  );
}

function SignInForm({ onSubmit, busy, error }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  return (
    <form
      className="account-form"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit({ username, password });
      }}
    >
      <Field
        id="signin-username"
        label="Brukernavn"
        type="text"
        value={username}
        onChange={setUsername}
        autoComplete="username"
      />
      <Field
        id="signin-password"
        label="Passord"
        type="password"
        value={password}
        onChange={setPassword}
        autoComplete="current-password"
      />
      <button type="submit" disabled={busy}>
        {busy ? 'Logger inn …' : 'Logg inn'}
      </button>
      {error ? <p className="account-error" role="alert">{error}</p> : null}
    </form>
  );
}

function SignUpForm({ onSubmit, busy, error }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  return (
    <form
      className="account-form"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit({ username, password });
      }}
    >
      <Field
        id="signup-username"
        label="Brukernavn"
        type="text"
        value={username}
        onChange={setUsername}
        autoComplete="username"
        hint="Minst 3 tegn. Bokstaver, tall, bindestrek og understrek."
      />
      <Field
        id="signup-password"
        label="Passord"
        type="password"
        value={password}
        onChange={setPassword}
        autoComplete="new-password"
        hint="Minst 8 tegn."
      />
      <p className="account-warning">
        Skriv ned passordet og ta godt vare på det. Vi kan ikke gjenopprette det
        hvis du glemmer det.
      </p>
      <button type="submit" disabled={busy}>
        {busy ? 'Lager konto …' : 'Lag konto'}
      </button>
      {error ? <p className="account-error" role="alert">{error}</p> : null}
    </form>
  );
}

export function AccountPage() {
  const account = useAccount();
  const [view, setView] = useState('signIn');
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [showDeleteForm, setShowDeleteForm] = useState(false);

  async function run(action, successNotice) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const result = await action();
      if (!result.ok) {
        setError(errorMessage(result.error));
        return false;
      }
      if (successNotice) setNotice(successNotice);
      return true;
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="account-shell">
      <header className="account-header">
        <p className="account-kicker">Lek og lær</p>
        <h1>Konto</h1>
        <p>
          Med en konto følger framgangen din med til andre enheter. Spillene
          virker helt likt uten konto også.
        </p>
      </header>

      {account.status === 'checking' ? (
        <p className="account-status">Sjekker …</p>
      ) : null}

      {account.status === 'ready' && account.signedIn ? (
        <section className="account-card">
          <h2>Du er logget inn som {account.username}</h2>
          <p>Framgangen din lagres og følger deg til andre enheter.</p>

          {showPasswordForm ? (
            <ChangePasswordForm
              busy={busy}
              error={error}
              onCancel={() => {
                setShowPasswordForm(false);
                setError(null);
              }}
              onSubmit={async ({ currentPassword, newPassword }) => {
                const changed = await run(
                  () => account.changePassword(currentPassword, newPassword),
                  'Passordet er byttet. Andre enheter må logge inn på nytt.',
                );
                if (changed) setShowPasswordForm(false);
              }}
            />
          ) : (
            <p>
              <button type="button" onClick={() => setShowPasswordForm(true)}>
                Bytt passord
              </button>
            </p>
          )}

          {showDeleteForm ? (
            <DeleteAccountForm
              busy={busy}
              error={error}
              onCancel={() => {
                setShowDeleteForm(false);
                setError(null);
              }}
              onSubmit={({ password }) =>
                run(() => account.deleteAccount(password))
              }
            />
          ) : (
            <p>
              <button
                type="button"
                className="account-danger"
                onClick={() => setShowDeleteForm(true)}
              >
                Slett kontoen min
              </button>
            </p>
          )}

          <p>
            <button
              type="button"
              className="account-secondary"
              disabled={busy}
              onClick={() => {
                run(() => account.signOut(), 'Du er logget ut. Framgangen din er her fortsatt.');
              }}
            >
              Logg ut
            </button>
          </p>
        </section>
      ) : null}

      {account.status === 'ready' && !account.signedIn ? (
        <section className="account-card">
          <div className="account-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={view === 'signIn'}
              onClick={() => {
                setView('signIn');
                setError(null);
                setNotice(null);
              }}
            >
              Logg inn
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={view === 'signUp'}
              onClick={() => {
                setView('signUp');
                setError(null);
                setNotice(null);
              }}
            >
              Lag konto
            </button>
          </div>

          {view === 'signIn' ? (
            <SignInForm
              busy={busy}
              error={error}
              onSubmit={({ username, password }) => run(() => account.signIn(username, password))}
            />
          ) : (
            <SignUpForm
              busy={busy}
              error={error}
              onSubmit={({ username, password }) => run(() => account.signUp(username, password))}
            />
          )}
        </section>
      ) : null}

      {notice ? <p className="account-notice" role="status">{notice}</p> : null}

      <footer className="account-footer">
        <p>
          Vi lagrer brukernavnet ditt, et kryptert passord og framgangen din i
          spillene. Ingenting annet – ingen e-post, ingen navn, ingen fødselsdato.
        </p>
        <p>
          <a href="../">Tilbake til spillene</a>
        </p>
      </footer>
    </main>
  );
}

function ChangePasswordForm({ onSubmit, onCancel, busy, error }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  return (
    <form
      className="account-form"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit({ currentPassword, newPassword });
      }}
    >
      <Field
        id="change-current"
        label="Nåværende passord"
        type="password"
        value={currentPassword}
        onChange={setCurrentPassword}
        autoComplete="current-password"
      />
      <Field
        id="change-new"
        label="Nytt passord"
        type="password"
        value={newPassword}
        onChange={setNewPassword}
        autoComplete="new-password"
        hint="Minst 8 tegn."
      />
      <p className="account-actions">
        <button type="submit" disabled={busy}>
          Lagre nytt passord
        </button>
        <button type="button" className="account-secondary" onClick={onCancel} disabled={busy}>
          Avbryt
        </button>
      </p>
      {error ? <p className="account-error" role="alert">{error}</p> : null}
    </form>
  );
}

function DeleteAccountForm({ onSubmit, onCancel, busy, error }) {
  const [password, setPassword] = useState('');

  return (
    <form
      className="account-form"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit({ password });
      }}
    >
      <p className="account-warning">
        Da forsvinner kontoen, all framgangen som er lagret, og innloggingen på
        alle enheter. Dette kan ikke angres.
      </p>
      <Field
        id="delete-password"
        label="Passordet ditt"
        type="password"
        value={password}
        onChange={setPassword}
        autoComplete="current-password"
      />
      <p className="account-actions">
        <button type="submit" className="account-danger" disabled={busy}>
          Slett kontoen
        </button>
        <button type="button" className="account-secondary" onClick={onCancel} disabled={busy}>
          Avbryt
        </button>
      </p>
      {error ? <p className="account-error" role="alert">{error}</p> : null}
    </form>
  );
}

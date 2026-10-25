import { useState } from 'react';
import { Overlay, buttonStyles as b } from '@/shared/components/overlay';
import { copyDiagnostic, diagnostic } from '../services/diagnostic';
import { LICENSES, S } from '../strings';
import styles from './help.module.css';

interface Props {
  onClose(): void;
  onEar(): void;
  onLibrary(): void;
}
export function HelpOverlay({ onClose, onEar, onLibrary }: Props) {
  const [report, setReport] = useState(''),
    [copyMessage, setCopyMessage] = useState('');
  const copy = async () => {
    const text = diagnostic();
    setReport(text);
    setCopyMessage((await copyDiagnostic(text)) ? S.copied : S.select);
  };
  return (
    <Overlay title={S.title} closeLabel={S.close} onClose={onClose}>
      <div className={styles.help}>
        <p>{S.intro}</p>
        <section>
          <h3>{S.start}</h3>
          <ol>
            {S.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </section>
        <details>
          <summary>{S.ear}</summary>
          <p>{S.earText}</p>
          <p>{S.earPrivacy}</p>
          <button className={b.btn} type="button" onClick={onEar}>
            {S.openEar}
          </button>
        </details>
        <details>
          <summary>{S.backup}</summary>
          <p>{S.backupText}</p>
          <p>{S.sharedDevice}</p>
          <p>{S.migration}</p>
          <button className={b.btn} type="button" onClick={onLibrary}>
            {S.library}
          </button>
        </details>
        <details>
          <summary>{S.shortcuts}</summary>
          <dl className={styles.shortcuts}>
            {S.keys.map(([key, text]) => (
              <div key={key}>
                <dt>
                  <kbd>{key}</kbd>
                </dt>
                <dd>{text}</dd>
              </div>
            ))}
          </dl>
          <p>{S.keyboardNote}</p>
        </details>
        <details>
          <summary>{S.diagnostic}</summary>
          <p>{S.diagnosticText}</p>
          <button className={b.btn} type="button" onClick={() => void copy()}>
            {S.copy}
          </button>
          <p role="status">{copyMessage}</p>
          {report && <textarea className={styles.report} aria-label={S.output} value={report} readOnly rows={7} />}
        </details>
        <details>
          <summary>{S.licenses}</summary>
          <ul>
            {LICENSES.map(([name, license, file]) => (
              <li key={name}>
                <a href={`${import.meta.env.BASE_URL}licenses/${file}`} target="_blank" rel="noopener noreferrer">
                  {name} · {license} ↗
                </a>
              </li>
            ))}
          </ul>
          <a href={`${import.meta.env.BASE_URL}licenses/apache-2.0.txt`} target="_blank" rel="noopener noreferrer">
            Texto completo de Apache 2.0 ↗
          </a>
        </details>
      </div>
    </Overlay>
  );
}

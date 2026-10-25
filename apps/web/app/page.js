import styles from './page.module.css';

export default function HomePage() {
  return (
    <main className={styles.main}>
      <section className={styles.card}>
        <p className={styles.brand}>SLOWS.DEV</p>
        <h1>One dashboard for your Discord server.</h1>
        <p>Configure welcome messages, moderation safeguards, logging, and music.</p>
        <a className={styles.button} href="/auth/discord">Continue with Discord</a>
      </section>
    </main>
  );
}

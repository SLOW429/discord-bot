import './globals.css';

export const metadata = {
  title: 'Slows Dashboard',
  description: 'Manage your Slows Discord bot server settings.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

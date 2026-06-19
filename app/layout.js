import './globals.css';
import { Montserrat, Inter, JetBrains_Mono } from 'next/font/google';
import Sidebar from '@/components/Sidebar';

const montserrat = Montserrat({ subsets: ['latin'], weight: ['600', '700', '800', '900'], variable: '--font-head' });
const inter = Inter({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-body' });
const mono = JetBrains_Mono({ subsets: ['latin'], weight: ['600', '800'], variable: '--font-mono' });

export const metadata = {
  title: 'ProcessTürk · Pazarlama Komuta Merkezi',
  description: 'Ürün onboarding, video/statik içerik üretimi ve sosyal medya & reklam yönetimi.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="tr" className={`${montserrat.variable} ${inter.variable} ${mono.variable}`}>
      <body className="min-h-screen text-slate-800 font-body antialiased">
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="flex-1 min-w-0">{children}</main>
        </div>
      </body>
    </html>
  );
}

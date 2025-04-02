import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from 'react-hot-toast';

// ... other imports you may have ...

const inter = Inter({ subsets: ['latin'] });

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {/* Your existing providers and layout components */}
        {children}
        <Toaster position="top-right" />
      </body>
    </html>
  );
} 
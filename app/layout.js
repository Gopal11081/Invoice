import '@/styles/globals.css';
import ToastContainer from '@/components/ToastContainer';

export const metadata = {
  title: 'GST Invoice Generator — Professional Billing Made Easy',
  description: 'Generate professional GST-compliant invoices with automatic CGST, SGST, and IGST calculations. Free, fast, and beautiful.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
      </head>
      <body>
        <div className="bg-gradient"></div>
        <div className="bg-grid"></div>
        <ToastContainer />
        {children}
      </body>
    </html>
  );
}

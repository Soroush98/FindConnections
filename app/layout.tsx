import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
      <script async src={`https://www.googletagmanager.com/gtag/js?id=G-7D34GQYS1R`}></script>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', 'G-7D34GQYS1R');
            `,
          }}
        />
      <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Organization",
            "name": "Find Connections Between People",
            "url": "https://findconnections.net",
            "logo": "https://findconnections.net/logo.png"
          })}
        </script>
      <meta name="viewport" content="width=device-width, initial-scale=1" />
        {/* ...existing head elements without icon links... */}
        <title>Find Connections</title>
        <link rel="icon" href="logo.png" type="image/png" sizes = "32x32" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}

export const metadata = {
  title: "LearnSmart Backend",
  description: "API backend for LearnSmart AI",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

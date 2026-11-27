import './globals.css';

export const metadata = {
  title: '휴가 기록',
  description: '직원 휴가 사용 기록과 월별 현황',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}

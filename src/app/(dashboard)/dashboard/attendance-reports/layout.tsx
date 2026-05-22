import { ReactNode } from 'react';

export default function AttendanceReportsLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      {children}
    </div>
  );
}

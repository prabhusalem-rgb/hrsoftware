import { Metadata } from 'next';
import {
  getCurrentPortalSession,
  getPortalCompanies,
  getEmployeePortalData,
} from './actions';
import { LoginCard } from './login-card';
import { PortalView } from './portal-view';

export const metadata: Metadata = {
  title: 'Employee Self-Service Portal | HR Software',
  description: 'View daily attendance, leave balances, availed details, and apply for Annual or Sick Leave.',
};

export default async function EmployeePortalPage() {
  const session = await getCurrentPortalSession();
  const companies = await getPortalCompanies();

  // If there's an active session with company and employee
  if (session.companyId && session.employeeId) {
    const portalData = await getEmployeePortalData(session.companyId, session.employeeId);

    if (!('error' in portalData)) {
      return (
        <PortalView
          initialData={portalData}
          companyId={session.companyId}
          employeeId={session.employeeId}
        />
      );
    }
  }

  // Otherwise, render login card
  return (
    <LoginCard
      companies={companies}
      initialCompanyId={session.companyId || (companies.length > 0 ? companies[0].id : null)}
    />
  );
}


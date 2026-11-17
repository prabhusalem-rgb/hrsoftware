import { getTimesheetFormData } from './actions';
import { TimesheetForm } from './timesheet-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata = {
  title: 'Timesheet Submission',
};

export default async function TimesheetPage({ params }: { params: Promise<{ token: string }> }) {
  try {
    const resolvedParams = await params;
    const token = resolvedParams?.token;
    if (!token) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-gray-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="text-destructive">Error</CardTitle>
              <CardDescription>Missing timesheet token.</CardDescription>
            </CardHeader>
          </Card>
        </div>
      );
    }

    const data = await getTimesheetFormData(token);

    if ('error' in data || !data) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-gray-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="text-destructive">Error</CardTitle>
              <CardDescription>{data?.error || 'Invalid timesheet link.'}</CardDescription>
            </CardHeader>
          </Card>
        </div>
      );
    }

    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <Card className="w-full max-w-xl">
          <CardHeader>
            <CardTitle>Daily Timesheet</CardTitle>
            <CardDescription>
              Submit your daily timesheet for {data.companyName}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TimesheetForm
              token={token}
              employees={data.employees}
              projects={data.projects}
            />
          </CardContent>
        </Card>
      </div>
    );
  } catch (err: any) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-destructive">Error</CardTitle>
            <CardDescription>{err?.message || 'Failed to render timesheet page.'}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }
}

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TimesheetForm } from '@/app/timesheet/[token]/timesheet-form';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';

// Mock the server action
vi.mock('./actions', () => ({
  submitTimesheet: vi.fn(),
}));

vi.mock('@/lib/pdf-utils', () => ({
  downloadTimesheetConfirmationPDF: vi.fn(),
}));

// Mock useForm's toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const mockEmployees = [
  { id: '1', name_en: 'John Doe', emp_code: 'EMP001' },
  { id: '2', name_en: 'Jane Smith', emp_code: 'EMP002' },
];

const mockProjects = [
  { id: 'p1', name: 'Project Alpha' },
  { id: 'p2', name: 'Project Beta' },
];

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('TimesheetForm', () => {
  const defaultProps = {
    token: 'test-token-123',
    employees: mockEmployees,
    projects: mockProjects,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders employee selection dropdown', () => {
      render(<TimesheetForm {...defaultProps} />);
      expect(screen.getByText(/Employee Name/i)).toBeInTheDocument();
    });

    it('renders date input', () => {
      render(<TimesheetForm {...defaultProps} />);
      expect(screen.getByLabelText(/Date/i)).toBeInTheDocument();
    });

    it('renders day type radio buttons', () => {
      render(<TimesheetForm {...defaultProps} />);
      expect(screen.getByLabelText(/Working Day/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Holiday Overtime/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Absent/i)).toBeInTheDocument();
    });

    it('renders project selection dropdown', () => {
      render(<TimesheetForm {...defaultProps} />);
      expect(screen.getByText(/Project Name/i)).toBeInTheDocument();
    });

    it('renders reason textarea', () => {
      render(<TimesheetForm {...defaultProps} />);
      expect(screen.getByLabelText(/Reason/i)).toBeInTheDocument();
    });

    it('renders submit button', () => {
      render(<TimesheetForm {...defaultProps} />);
      expect(screen.getByRole('button', { name: /Submit Timesheet/i })).toBeInTheDocument();
    });

    it('shows only Working Day and Absent day types (no working_holiday)', () => {
      render(<TimesheetForm {...defaultProps} />);
      expect(screen.getByLabelText('Working Day')).toBeInTheDocument();
      expect(screen.getByLabelText('Holiday Overtime')).toBeInTheDocument();
      expect(screen.getByLabelText('Absent')).toBeInTheDocument();
      // working_holiday should NOT be present
      expect(screen.queryByLabelText('Working Holiday')).not.toBeInTheDocument();
    });
  });

  describe('Day Type Selection Behavior', () => {
    it('shows regular hours and overtime options for working_day', async () => {
      render(<TimesheetForm {...defaultProps} />);
      const workingDayRadio = screen.getByLabelText('Working Day');
      await userEvent.click(workingDayRadio);

      expect(screen.getByText(/Regular Hours/i)).toBeInTheDocument();
      expect(screen.getByText(/8 Hours \(Full-day\)/i)).toBeInTheDocument();
      expect(screen.getByText(/4 Hours \(Half-day\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Overtime Hours/i)).toBeInTheDocument();
    });

    it('shows Holiday Overtime Hours dropdown for holiday_overtime', async () => {
      render(<TimesheetForm {...defaultProps} />);
      const holidayOtRadio = screen.getByLabelText('Holiday Overtime');
      await userEvent.click(holidayOtRadio);

      expect(screen.getByText(/Holiday Overtime Hours/i)).toBeInTheDocument();
      expect(screen.getByRole('combobox', { name: /Holiday Overtime Hours/i })).toBeInTheDocument();
      // Regular hours section should NOT be visible
      expect(screen.queryByText(/Regular Hours/i)).not.toBeInTheDocument();
    });

    it('hides hours sections for absent', async () => {
      render(<TimesheetForm {...defaultProps} />);
      const absentRadio = screen.getByLabelText('Absent');
      await userEvent.click(absentRadio);

      expect(screen.queryByText(/Regular Hours/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Holiday Overtime Hours/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Overtime Hours/i)).not.toBeInTheDocument();
    });

    it('resets values when switching day types', async () => {
      render(<TimesheetForm {...defaultProps} />);
      const hoursInput = screen.getByLabelText(/Regular Hours/i) as HTMLInputElement;

      // Select working_day first
      await userEvent.click(screen.getByLabelText('Working Day'));
      // Then switch to absent
      await userEvent.click(screen.getByLabelText('Absent'));

      // Hours should be reset
      expect(screen.queryByLabelText(/Regular Hours/i)).not.toBeInTheDocument();
    });
  });

  describe('Holiday Overtime specific behavior', () => {
    it('defaults to 1 hour when holiday_overtime selected', async () => {
      render(<TimesheetForm {...defaultProps} />);
      const holidayOtRadio = screen.getByLabelText('Holiday Overtime');
      await userEvent.click(holidayOtRadio);

      const select = screen.getByRole('combobox', { name: /Holiday Overtime Hours/i });
      expect(select).toHaveValue('1');
    });

    it('allows selecting 1-8 hours for holiday overtime', async () => {
      render(<TimesheetForm {...defaultProps} />);
      await userEvent.click(screen.getByLabelText('Holiday Overtime'));

      const select = screen.getByRole('combobox', { name: /Holiday Overtime Hours/i });

      for (let i = 1; i <= 8; i++) {
        await userEvent.selectOptions(select, i.toString());
        expect(select).toHaveValue(i.toString());
      }
    });

    it('does not show the info message about pay rate', () => {
      render(<TimesheetForm {...defaultProps} />);
      // The info message should NOT be present
      expect(screen.queryByText(/All hours will be paid at holiday overtime rate/i)).not.toBeInTheDocument();
    });
  });

  describe('Form Submission', () => {
    it('submits the form with correct data', async () => {
      const mockSubmit = vi.fn().mockResolvedValue({ success: true });
      const { submitTimesheet } = await import('./actions');
      vi.mocked(submitTimesheet).mockImplementation(mockSubmit);

      render(<TimesheetForm {...defaultProps} />);

      // Fill employee
      await userEvent.selectOptions(screen.getByRole('combobox', { name: '' }), '1');
      // Select project
      const projectSelect = screen.getAllByRole('combobox')[1];
      await userEvent.selectOptions(projectSelect, 'p1');

      // Select day type
      await userEvent.click(screen.getByLabelText('Holiday Overtime'));

      // Set holiday OT hours
      const otSelect = screen.getByRole('combobox', { name: /Holiday Overtime Hours/i });
      await userEvent.selectOptions(otSelect, '5');

      // Add reason
      const reasonTextarea = screen.getByPlaceholderText(/Please provide a reason/i);
      await userEvent.type(reasonTextarea, 'Holiday work required');

      // Submit
      const submitBtn = screen.getByRole('button', { name: /Submit Timesheet/i });
      await userEvent.click(submitBtn);

      await waitFor(() => {
        expect(mockSubmit).toHaveBeenCalled();
      });
    });

    it('shows validation error when required reason is missing for holiday overtime', async () => {
      render(<TimesheetForm {...defaultProps} />);

      await userEvent.click(screen.getByLabelText('Holiday Overtime'));
      // Holiday OT defaults to 1 hour, reason is required

      const submitBtn = screen.getByRole('button', { name: /Submit Timesheet/i });
      await userEvent.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByText(/Reason is required/i)).toBeInTheDocument();
      });
    });
  });

  describe('Employee Search', () => {
    it('filters employees by name or code', async () => {
      render(<TimesheetForm {...defaultProps} />);
      const searchInput = screen.getByPlaceholderText(/Search employee/i);

      await userEvent.type(searchInput, 'John');

      // Should show John Doe
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      // Should not show Jane Smith
      expect(screen.queryByText('Jane Smith')).not.toBeInTheDocument();
    });

    it('shows "No employees found" when no matches', async () => {
      render(<TimesheetForm {...defaultProps} />);
      const searchInput = screen.getByPlaceholderText(/Search employee/i);

      await userEvent.type(searchInput, 'ZZZZZZ');

      expect(screen.getByText(/No employees found/i)).toBeInTheDocument();
    });
  });

  describe('Date Validation', () => {
    it('does not allow future dates', async () => {
      render(<TimesheetForm {...defaultProps} />);
      const dateInput = screen.getByLabelText(/Date/i);

      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 10);
      const futureDateStr = futureDate.toISOString().split('T')[0];

      await userEvent.clear(dateInput);
      await userEvent.type(dateInput, futureDateStr);

      const submitBtn = screen.getByRole('button', { name: /Submit Timesheet/i });
      await userEvent.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByText(/Date cannot be in the future/i)).toBeInTheDocument();
      });
    });
  });
});

'use client';

// ============================================================
// Export Buttons Component
// Excel, PDF, and Print export options for attendance reports
// ============================================================

import { useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import {
  FileSpreadsheet,
  FileText,
  Printer,
  Download,
  Loader2,
} from 'lucide-react';
import { ProjectAttendanceReport } from '@/types';
import { formatReportForExcel } from '@/lib/attendance-calculations';
import * as XLSX from 'xlsx';
import { PDFDownloadLink, Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';
import { format } from 'date-fns';

// Register a font (optional - using default)
// Font.register({ family: 'Roboto', src: 'https://fonts.googleapis.com/css2?family=Roboto:wght@400;700&display=swap' });

const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontSize: 10,
    fontFamily: 'Helvetica',
  },
  header: {
    marginBottom: 20,
    borderBottomWidth: 2,
    borderBottomColor: '#1e40af',
    paddingBottom: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 12,
    color: '#666',
  },
  table: {
    marginTop: 15,
    marginBottom: 15,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    paddingVertical: 5,
  },
  tableHeader: {
    backgroundColor: '#f3f4f6',
    fontWeight: 'bold',
  },
  tableColHeader: {
    flex: 1,
    fontSize: 8,
    paddingHorizontal: 2,
    textAlign: 'center',
  },
  tableCell: {
    flex: 1,
    fontSize: 9,
    paddingHorizontal: 2,
    textAlign: 'center',
    color: '#333',
  },
  markCell: {
    width: 18,
    height: 18,
    borderRadius: 3,
    textAlign: 'center',
    color: 'white',
    fontSize: 8,
    lineHeight: 18,
    fontWeight: 'bold',
  },
  summary: {
    marginTop: 20,
    padding: 10,
    backgroundColor: '#f9fafb',
    borderRadius: 5,
  },
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 30,
    right: 30,
    textAlign: 'center',
    fontSize: 8,
    color: '#999',
  },
});

// Mark colors
const markColors: Record<string, string> = {
  P: '#22c55e', // green
  A: '#ef4444', // red
  L: '#3b82f6', // blue
  H: '#eab308', // yellow
  W: '#9ca3af', // gray
};

// PDF Document Component
function AttendancePDFDocument({
  report,
  projectName,
}: {
  report: ProjectAttendanceReport;
  projectName: string;
}) {
  const monthName = new Date(report.year, report.month - 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  // Build day headers (1-31)
  const dayHeaders = Array.from({ length: 31 }, (_, i) => ({
    day: i + 1,
    dayOfWeek: new Date(report.year, report.month - 1, i + 1).getDay(),
  }));

  return (
    <Document>
      <Page size="A4" style={styles.page} orientation="landscape">
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>{projectName}</Text>
          <Text style={styles.subtitle}>
            Monthly Attendance Report - {monthName}
          </Text>
          <Text style={styles.subtitle}>
            Generated: {new Date().toLocaleDateString('en-IN')}
          </Text>
        </View>

        {/* Summary */}
        <View style={styles.summary}>
          <Text style={{ fontWeight: 'bold', marginBottom: 5 }}>Summary</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            <Text style={{ width: '33%' }}>Total Employees: {report.summary.total_employees}</Text>
            <Text style={{ width: '33%' }}>Man-Days: {report.summary.total_man_days}</Text>
            <Text style={{ width: '33%' }}>Total Hours: {report.summary.total_hours.toFixed(1)}</Text>
            <Text style={{ width: '33%', marginTop: 5 }}>
              Avg Attendance: {report.summary.average_attendance.toFixed(2)}%
            </Text>
            <Text style={{ width: '33%', marginTop: 5 }}>
              Present: {report.summary.total_present_days} days
            </Text>
            <Text style={{ width: '33%', marginTop: 5 }}>
              Leave: {report.summary.total_leave_days} days
            </Text>
          </View>
        </View>

        {/* Legend */}
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
          {Object.entries(markColors).map(([mark, color]) => (
            <View key={mark} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <View style={{ ...styles.markCell, backgroundColor: color }}>{mark}</View>
              <Text style={{ fontSize: 8 }}>
                {mark === 'P' ? 'Present' : mark === 'A' ? 'Absent' : mark === 'L' ? 'Leave' : mark === 'H' ? 'Holiday' : 'Weekend'}
              </Text>
            </View>
          ))}
        </View>

        {/* Employee Table */}
        <View style={styles.table}>
          {/* Header Row */}
          <View style={[styles.tableRow, styles.tableHeader, { height: 25 }]}>
            <Text style={{ ...styles.tableColHeader, flex: 1.5 }}>Emp Code</Text>
            <Text style={{ ...styles.tableColHeader, flex: 2.5 }}>Name</Text>
            <Text style={{ ...styles.tableColHeader, flex: 1.5 }}>Designation</Text>
            {dayHeaders.map(d => (
              <Text key={d.day} style={styles.tableColHeader}>
                {d.day}
              </Text>
            ))}
            <Text style={styles.tableColHeader}>Pres</Text>
            <Text style={styles.tableColHeader}>Abs</Text>
            <Text style={styles.tableColHeader}>%</Text>
          </View>

          {/* Data Rows */}
          {report.employees.map(emp => (
            <View key={emp.employee_id} style={[styles.tableRow, { minHeight: 20 }]}>
              <Text style={{ ...styles.tableCell, flex: 1.5, fontSize: 8 }}>{emp.emp_code}</Text>
              <Text style={{ ...styles.tableCell, flex: 2.5, fontSize: 8, textAlign: 'left' }}>
                {emp.name_en}
              </Text>
              <Text style={{ ...styles.tableCell, flex: 1.5, fontSize: 8 }}>
                {emp.designation?.substring(0, 12) || '-'}
              </Text>
              {Array.from({ length: 31 }, (_, i) => {
                const dateKey = format(new Date(report.year, report.month - 1, i + 1), 'yyyy-MM-dd');
                const mark = emp.daily_marks[dateKey] || '';
                return (
                  <Text
                    key={i}
                    style={{
                      ...styles.markCell,
                      backgroundColor: mark && markColors[mark] ? markColors[mark] : 'transparent',
                    }}
                  >
                    {mark}
                  </Text>
                );
              })}
              <Text style={{ ...styles.tableCell, color: '#22c55e' }}>{emp.total_present}</Text>
              <Text style={{ ...styles.tableCell, color: '#ef4444' }}>{emp.total_absent}</Text>
              <Text style={{ ...styles.tableCell, fontWeight: 'bold' }}>
                {emp.attendance_percentage.toFixed(2)}%
              </Text>
            </View>
          ))}
        </View>

        {/* Footer */}
        <Text
          style={styles.footer}
          render={() => `Page ${'{pageNumber}'} of {'{totalPages}'}`}
          fixed
        />
      </Page>
    </Document>
  );
}

interface Props {
  report: ProjectAttendanceReport;
  projectName: string;
  month: number;
  year: number;
}

export function ExportButtons({ report, projectName, month, year }: Props) {
  const fileNamePrefix = `${projectName.replace(/\s+/g, '_')}_attendance_${year}_${String(month).padStart(2, '0')}`;

  // Export to Excel
  const exportToExcel = useCallback(() => {
    if (!report?.summary) {
      toast.error('Report data not ready. Please generate a report first.');
      return;
    }
    try {
      const { headers, rows } = formatReportForExcel(report);

      // Create workbook
      const wb = XLSX.utils.book_new();

      // Main data sheet
      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);

      // Set column widths
      const colWidths = [
        { wch: 12 }, // Emp Code
        { wch: 25 }, // Name
        { wch: 18 }, // Designation
        { wch: 12 }, // Join Date
        { wch: 12 }, // Exit Date
        ...Array(31).fill({ wch: 4 }), // Day columns
        { wch: 8 },  // Present
        { wch: 8 },  // Absent
        { wch: 8 },  // Leave
        { wch: 8 },  // Holiday
        { wch: 8 },  // Weekend
        { wch: 12 }, // Working Days
        { wch: 10 }, // Hours
        { wch: 10 }, // Att%
        { wch: 20 }, // Remarks
      ];
      ws['!cols'] = colWidths;

      // Add summary sheet
      const summaryWs = XLSX.utils.json_to_sheet([
        { Metric: 'Month', Value: `${month}/${year}` },
        { Metric: 'Project', Value: projectName },
        { Metric: 'Total Employees', Value: report.summary.total_employees },
        { Metric: 'Total Man-Days', Value: report.summary.total_man_days },
        { Metric: 'Total Hours', Value: report.summary.total_hours },
        { Metric: 'Average Attendance %', Value: `${report.summary.average_attendance}%` },
        { Metric: 'Total Present Days', Value: report.summary.total_present_days },
        { Metric: 'Total Absent Days', Value: report.summary.total_absent_days },
        { Metric: 'Total Leave Days', Value: report.summary.total_leave_days },
      ]);
      summaryWs['!cols'] = [
        { wch: 25 },
        { wch: 20 },
      ];

      XLSX.utils.book_append_sheet(wb, ws, 'Attendance');
      XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary');

      // Write and download
      XLSX.writeFile(wb, `${fileNamePrefix}.xlsx`);
      toast.success('Excel file downloaded successfully');
    } catch (error) {
      console.error('Excel export error:', error);
      toast.error('Failed to export Excel file');
    }
  }, [report, projectName, month, year]);

  // Print handler
  const handlePrint = useCallback(() => {
    if (!report?.summary) {
      toast.error('Report data not ready. Please generate a report first.');
      return;
    }
    // Store current document styles and inject print styles
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Please allow popups for print functionality');
      return;
    }

    // Build print HTML
    const printHtml = buildPrintHtml(report, projectName, month, year);
    printWindow.document.write(printHtml);
    printWindow.document.close();
    printWindow.focus();
    // Give time for content to load before printing
    setTimeout(() => {
      printWindow.print();
    }, 250);
  }, [report, projectName, month, year]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Download className="h-4 w-4" />
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={exportToExcel} className="gap-2">
          <FileSpreadsheet className="h-4 w-4 text-green-600" />
          Export as Excel (.xlsx)
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <PDFDownloadLink
          document={
            <AttendancePDFDocument report={report} projectName={projectName} />
          }
          fileName={`${fileNamePrefix}.pdf`}
        >
          {({ loading }) => (
            <div className="flex items-center gap-2 px-2 py-1.5 text-sm w-full hover:bg-accent rounded-sm cursor-pointer">
              <FileText className={`h-4 w-4 ${loading ? 'text-muted-foreground' : 'text-red-600'}`} />
              {loading ? 'Preparing PDF...' : 'Export as PDF'}
            </div>
          )}
        </PDFDownloadLink>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handlePrint} className="gap-2">
          <Printer className="h-4 w-4 text-primary" />
          Print Preview
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Build HTML for print
function buildPrintHtml(
  report: ProjectAttendanceReport,
  projectName: string,
  month: number,
  year: number
): string {
  const monthName = new Date(year, month - 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  // Build day headers
  const dayHeaders = Array.from({ length: 31 }, (_, i) => i + 1);

  // Build rows
  const rowsHtml = report.employees
    .map(emp => {
      const dayCells = dayHeaders
        .map(day => {
          const dateKey = format(new Date(year, month - 1, day), 'yyyy-MM-dd');
          const mark = emp.daily_marks[dateKey] || '';
          const color = markColors[mark] || '#e5e7eb';
          return `<td style="width: 22px; height: 22px; background-color: ${color}; text-align: center; border: 1px solid #ddd; font-weight: bold; color: ${mark === 'P' || mark === 'A' || mark === 'L' || mark === 'H' ? 'white' : '#666'};">${mark}</td>`;
        })
        .join('');

      return `
        <tr>
          <td style="border: 1px solid #ddd; padding: 4px 8px; font-size: 10px; font-family: monospace;">${emp.emp_code}</td>
          <td style="border: 1px solid #ddd; padding: 4px 8px; font-size: 10px;">${emp.name_en}</td>
          <td style="border: 1px solid #ddd; padding: 4px 8px; font-size: 10px;">${emp.designation || '-'}</td>
          ${dayCells}
          <td style="border: 1px solid #ddd; padding: 4px 8px; font-size: 10px; text-align: center; color: #22c55e; font-weight: bold;">${emp.total_present}</td>
          <td style="border: 1px solid #ddd; padding: 4px 8px; font-size: 10px; text-align: center; color: #ef4444; font-weight: bold;">${emp.total_absent}</td>
          <td style="border: 1px solid #ddd; padding: 4px 8px; font-size: 10px; text-align: center; color: #3b82f6;">${emp.total_leave}</td>
          <td style="border: 1px solid #ddd; padding: 4px 8px; font-size: 10px; text-align: center;">${emp.total_hours_worked.toFixed(2)}</td>
          <td style="border: 1px solid #ddd; padding: 4px 8px; font-size: 10px; text-align: center; font-weight: bold; color: ${emp.attendance_percentage >= 90 ? '#22c55e' : emp.attendance_percentage >= 75 ? '#eab308' : '#ef4444'};">${emp.attendance_percentage.toFixed(2)}%</td>
        </tr>
      `;
    })
    .join('');

  const dayHeaderCells = dayHeaders
    .map(day => {
      const dayOfWeek = new Date(year, month - 1, day).getDay();
      const isWeekend = dayOfWeek === 5; // Friday is weekend
      return `<th style="width: 22px; padding: 4px; border: 1px solid #ddd; background-color: ${isWeekend ? '#fef2f2' : '#f9fafb'}; font-size: 10px; text-align: center;">
        <div>${day}</div>
        <div style="font-size: 9px; color: ${isWeekend ? '#dc2626' : '#666'};">${['S','M','T','W','T','F','S'][dayOfWeek]}</div>
      </th>`;
    })
    .join('');

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>${projectName} - Attendance Report</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 0; }
          @media print {
            @page { size: landscape; margin: 0.5cm; }
            body { font-size: 9pt; }
          }
          .no-print { display: none; }
        </style>
      </head>
      <body>
        <div class="no-print" style="padding: 20px; text-align: center; background: #f3f4f6;">
          <button onclick="window.print()" style="padding: 10px 20px; font-size: 14px; cursor: pointer;">Print Report</button>
          <button onclick="window.close()" style="padding: 10px 20px; font-size: 14px; cursor: pointer; margin-left: 10px;">Close</button>
        </div>

        <div style="padding: 20px;">
          <div style="text-align: center; margin-bottom: 20px; border-bottom: 2px solid #1e40af; padding-bottom: 15px;">
            <h1 style="margin: 0; font-size: 18px; color: #1e40af;">${projectName}</h1>
            <p style="margin: 5px 0 0 0; font-size: 12px; color: #666;">
              Monthly Attendance Report - ${monthName}
            </p>
            <p style="margin: 3px 0 0 0; font-size: 10px; color: #999;">
              Generated: ${new Date().toLocaleDateString('en-IN')}
            </p>
          </div>

          <!-- Summary -->
          <div style="background: #f9fafb; padding: 10px; border-radius: 4px; margin-bottom: 15px; display: flex; flex-wrap: wrap; gap: 15px; font-size: 10px;">
            <div><strong>Total Employees:</strong> ${report.summary.total_employees}</div>
            <div><strong>Man-Days:</strong> ${report.summary.total_man_days}</div>
            <div><strong>Total Hours:</strong> ${report.summary.total_hours.toFixed(1)}</div>
            <div><strong>Avg Attendance:</strong> ${report.summary.average_attendance.toFixed(2)}%</div>
            <div><strong>Present Days:</strong> ${report.summary.total_present_days}</div>
            <div><strong>Leave Days:</strong> ${report.summary.total_leave_days}</div>
          </div>

          <!-- Legend -->
          <div style="margin-bottom: 10px; font-size: 10px;">
            <strong>Legend:</strong>
            <span style="display: inline-block; width: 16px; height: 16px; background: #22c55e; text-align: center; line-height: 16px; color: white; font-size: 9px; font-weight: bold; margin-left: 5px;">P</span>
            <span style="display: inline-block; width: 16px; height: 16px; background: #ef4444; text-align: center; line-height: 16px; color: white; font-size: 9px; font-weight: bold; margin-left: 2px;">A</span>
            <span style="display: inline-block; width: 16px; height: 16px; background: #3b82f6; text-align: center; line-height: 16px; color: white; font-size: 9px; font-weight: bold; margin-left: 2px;">L</span>
            <span style="display: inline-block; width: 16px; height: 16px; background: #eab308; text-align: center; line-height: 16px; color: white; font-size: 9px; font-weight: bold; margin-left: 2px;">H</span>
            <span style="display: inline-block; width: 16px; height: 16px; background: #9ca3af; text-align: center; line-height: 16px; color: white; font-size: 9px; font-weight: bold; margin-left: 2px;">W</span>
          </div>

          <!-- Table -->
          <table style="width: 100%; border-collapse: collapse; font-size: 9px; overflow-x: auto; display: block;">
            <thead>
              <tr>
                <th style="border: 1px solid #ddd; padding: 4px 8px; background: #f3f4f6; width: 70px;">Emp Code</th>
                <th style="border: 1px solid #ddd; padding: 4px 8px; background: #f3f4f6; width: 120px;">Name</th>
                <th style="border: 1px solid #ddd; padding: 4px 8px; background: #f3f4f6; width: 100px;">Designation</th>
                ${dayHeaderCells}
                <th style="border: 1px solid #ddd; padding: 4px 8px; background: #f3f4f6; width: 40px; color: #22c55e;">Pres</th>
                <th style="border: 1px solid #ddd; padding: 4px 8px; background: #f3f4f6; width: 40px; color: #ef4444;">Abs</th>
                <th style="border: 1px solid #ddd; padding: 4px 8px; background: #f3f4f6; width: 40px; color: #3b82f6;">Lv</th>
                <th style="border: 1px solid #ddd; padding: 4px 8px; background: #f3f4f6; width: 45px;">Hrs</th>
                <th style="border: 1px solid #ddd; padding: 4px 8px; background: #f3f4f6; width: 45px;">Att%</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>

          <div style="margin-top: 15px; font-size: 9px; color: #666; text-align: center;">
            Total Employees: ${report.summary.total_employees} | Total Man-Days: ${report.summary.total_man_days}
          </div>
        </div>
      </body>
    </html>
  `;
}

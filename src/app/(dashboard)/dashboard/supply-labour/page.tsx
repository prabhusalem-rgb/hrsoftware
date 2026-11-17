'use client';

import { useState, useEffect, useMemo } from 'react';
import { useCompany } from '@/components/providers/CompanyProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Users,
  HardHat,
  Search,
  Plus,
  Download,
  Edit2,
  Trash2,
  Phone,
  CreditCard,
  Building2,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Clock,
  Loader2,
  DollarSign
} from 'lucide-react';
import { toast } from 'sonner';
import { formatOMR } from '@/lib/utils/currency';
import {
  getSupplyLabourWorkers,
  getSuppliersList,
  createSupplyLabourWorker,
  updateSupplyLabourWorker,
  deleteSupplyLabourWorker
} from './actions';
import { Employee } from '@/types';
import Link from 'next/link';

export default function SupplyLabourPage() {
  const { activeCompanyId, activeCompany, hasPermission, profile } = useCompany();
  const isSuperAdmin = profile?.role === 'super_admin';

  // State
  const [workers, setWorkers] = useState<Employee[]>([]);
  const [suppliers, setSuppliers] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingWorker, setEditingWorker] = useState<Employee | null>(null);

  // Form State (Conditions: Civil ID, Mobile number, optional Bank account, Fixed Gross)
  const [formData, setFormData] = useState({
    name_en: '',
    civil_id: '',
    contact_phone: '',
    gross_salary: '',
    supplier_name: '',
    bank_name: '',
    bank_iban: '',
    designation: 'Supply Labour',
    status: 'active' as 'active' | 'terminated',
  });

  const canCreate = isSuperAdmin || hasPermission('attendance', 'create');
  const canUpdate = isSuperAdmin || hasPermission('attendance', 'update');
  const canDelete = isSuperAdmin || hasPermission('attendance', 'delete');

  // Load data
  const loadData = async () => {
    if (!activeCompanyId) return;
    setLoading(true);
    try {
      const [workersData, suppliersData] = await Promise.all([
        getSupplyLabourWorkers(activeCompanyId),
        getSuppliersList(activeCompanyId),
      ]);
      setWorkers(workersData);
      setSuppliers(suppliersData);
    } catch (err: any) {
      console.error('[SupplyLabourPage] Load error:', err);
      toast.error(err.message || 'Failed to load supply labour workers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeCompanyId]);

  // Open Create Modal
  const handleOpenCreate = () => {
    setEditingWorker(null);
    setFormData({
      name_en: '',
      civil_id: '',
      contact_phone: '',
      gross_salary: '',
      supplier_name: selectedSupplier !== 'all' ? selectedSupplier : '',
      bank_name: '',
      bank_iban: '',
      designation: 'Supply Labour',
      status: 'active',
    });
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (worker: Employee) => {
    setEditingWorker(worker);
    setFormData({
      name_en: worker.name_en || '',
      civil_id: worker.civil_id || '',
      contact_phone: worker.contact_phone || worker.emergency_contact_phone || '',
      gross_salary: String(worker.gross_salary || worker.basic_salary || ''),
      supplier_name: worker.supplier_name || '',
      bank_name: worker.bank_name || '',
      bank_iban: worker.bank_iban || '',
      designation: worker.designation || 'Supply Labour',
      status: worker.status === 'terminated' ? 'terminated' : 'active',
    });
    setIsModalOpen(true);
  };

  // Save worker (create or update)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCompanyId) {
      toast.error('Please select an active company first');
      return;
    }

    if (!formData.name_en.trim()) {
      toast.error('Worker full name is required');
      return;
    }
    if (!formData.civil_id.trim()) {
      toast.error('Civil ID is required');
      return;
    }
    if (!formData.contact_phone.trim()) {
      toast.error('Mobile phone number is required');
      return;
    }
    const salary = parseFloat(formData.gross_salary);
    if (isNaN(salary) || salary <= 0) {
      toast.error('Please enter a valid fixed gross salary');
      return;
    }

    setSubmitting(true);
    try {
      if (editingWorker) {
        await updateSupplyLabourWorker(editingWorker.id, {
          company_id: activeCompanyId,
          name_en: formData.name_en,
          civil_id: formData.civil_id,
          contact_phone: formData.contact_phone,
          gross_salary: salary,
          supplier_name: formData.supplier_name,
          bank_name: formData.bank_name,
          bank_iban: formData.bank_iban,
          designation: formData.designation,
          status: formData.status,
        });
        toast.success(`Updated ${formData.name_en} successfully`);
      } else {
        await createSupplyLabourWorker({
          company_id: activeCompanyId,
          name_en: formData.name_en,
          civil_id: formData.civil_id,
          contact_phone: formData.contact_phone,
          gross_salary: salary,
          supplier_name: formData.supplier_name,
          bank_name: formData.bank_name,
          bank_iban: formData.bank_iban,
          designation: formData.designation,
          status: formData.status,
        });
        toast.success(`Added ${formData.name_en} to Supply Labour roster`);
      }
      setIsModalOpen(false);
      await loadData();
    } catch (err: any) {
      console.error('[handleSubmit] Save error:', err);
      toast.error(err.message || 'Failed to save supply labour record');
    } finally {
      setSubmitting(false);
    }
  };

  // Delete worker
  const handleDelete = async (worker: Employee) => {
    if (!confirm(`Are you sure you want to remove ${worker.name_en}? If timesheets exist, status will be set to Inactive/Terminated.`)) {
      return;
    }

    try {
      const res = await deleteSupplyLabourWorker(worker.id);
      if (res.inactivated) {
        toast.info(res.message);
      } else {
        toast.success(`Removed ${worker.name_en} successfully`);
      }
      await loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete worker');
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    if (filteredWorkers.length === 0) {
      toast.error('No records to export');
      return;
    }
    const headers = ['Code', 'Name', 'Civil ID', 'Mobile', 'Supplier', 'Fixed Gross (OMR)', 'Bank IBAN', 'Status'];
    const rows = filteredWorkers.map(w => [
      `"${w.emp_code || ''}"`,
      `"${w.name_en || ''}"`,
      `"${w.civil_id || ''}"`,
      `"${w.contact_phone || w.emergency_contact_phone || ''}"`,
      `"${w.supplier_name || 'Direct / None'}"`,
      Number(w.gross_salary || 0).toFixed(3),
      `"${w.bank_iban || ''}"`,
      `"${w.status || ''}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `supply-labour-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filtered workers
  const filteredWorkers = useMemo(() => {
    return workers.filter(w => {
      const matchesSearch =
        !search.trim() ||
        w.name_en.toLowerCase().includes(search.toLowerCase()) ||
        (w.emp_code && w.emp_code.toLowerCase().includes(search.toLowerCase())) ||
        (w.civil_id && w.civil_id.toLowerCase().includes(search.toLowerCase())) ||
        (w.contact_phone && w.contact_phone.includes(search));

      const matchesSupplier =
        selectedSupplier === 'all' ||
        (w.supplier_name || '').toLowerCase() === selectedSupplier.toLowerCase();

      const matchesStatus =
        selectedStatus === 'all' ||
        (selectedStatus === 'active' && w.status === 'active') ||
        (selectedStatus === 'terminated' && w.status === 'terminated');

      return matchesSearch && matchesSupplier && matchesStatus;
    });
  }, [workers, search, selectedSupplier, selectedStatus]);

  // Metrics
  const metrics = useMemo(() => {
    const total = workers.length;
    const active = workers.filter(w => w.status === 'active').length;
    const distinctSuppliers = new Set(workers.map(w => w.supplier_name?.trim()).filter(Boolean)).size;
    const totalGross = workers.filter(w => w.status === 'active').reduce((sum, w) => sum + Number(w.gross_salary || 0), 0);
    return { total, active, distinctSuppliers, totalGross };
  }, [workers]);

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
            <div className="p-2 bg-purple-100 dark:bg-purple-950/50 text-purple-600 rounded-xl">
              <HardHat className="w-6 h-6" />
            </div>
            Supply Labour Module
          </h1>
          <p className="text-sm text-slate-500 font-medium mt-1">
            Manage outsourced workforce, supplier agencies, timesheets, and project costing.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button variant="outline" size="sm" onClick={handleExportCSV} className="gap-2">
            <Download className="w-4 h-4" />
            Export CSV
          </Button>

          {canCreate && (
            <Button onClick={handleOpenCreate} className="gap-2 bg-purple-600 hover:bg-purple-700 text-white shadow-md">
              <Plus className="w-4 h-4" />
              Add Supply Worker
            </Button>
          )}
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border shadow-sm">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Supply Workers</p>
              <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{metrics.total}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">{metrics.active} active currently</p>
            </div>
            <div className="p-3 bg-purple-50 text-purple-600 rounded-xl">
              <Users className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border shadow-sm">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Supplier Agencies</p>
              <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{metrics.distinctSuppliers}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Tracked manpower vendors</p>
            </div>
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
              <Building2 className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border shadow-sm">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Monthly Commitment</p>
              <p className="text-2xl font-black font-mono text-emerald-600 mt-1">{formatOMR(metrics.totalGross)}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Fixed gross rate sum</p>
            </div>
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
              <DollarSign className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border shadow-sm bg-gradient-to-br from-purple-500/5 to-transparent">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Overtime Rule</p>
              <p className="text-sm font-black font-mono text-purple-700 mt-1">Gross / 240 × OT</p>
              <p className="text-[11px] text-slate-500 mt-0.5">Fixed gross, no 1.25x markup</p>
            </div>
            <div className="p-3 bg-purple-100 text-purple-700 rounded-xl">
              <Clock className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter Toolbar */}
      <Card className="border shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search by worker name, code, Civil ID, or mobile..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 h-10 rounded-xl"
              />
            </div>

            <div className="w-full md:w-56">
              <Select value={selectedSupplier} onValueChange={(val) => setSelectedSupplier(val || 'all')}>
                <SelectTrigger className="h-10 rounded-xl">
                  <SelectValue placeholder="Filter by Supplier" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Suppliers</SelectItem>
                  {suppliers.map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="w-full md:w-40">
              <Select value={selectedStatus} onValueChange={(val) => setSelectedStatus(val || 'all')}>
                <SelectTrigger className="h-10 rounded-xl">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="terminated">Inactive / Ended</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Workers Table */}
      <Card className="border shadow-sm overflow-hidden">
        <CardHeader className="p-4 pb-2 border-b bg-slate-50/50 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-bold text-slate-700 flex items-center gap-2">
            <Users className="w-4 h-4 text-purple-600" />
            Supply Labour Roster ({filteredWorkers.length})
          </CardTitle>
          <span className="text-xs text-slate-400">Excluded from WPS Salary files automatically</span>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-12 text-center text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-purple-600" />
              Loading supply labour roster...
            </div>
          ) : filteredWorkers.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              <HardHat className="w-10 h-10 mx-auto text-slate-300 mb-2" />
              <p className="font-semibold text-slate-700">No supply labour records found</p>
              <p className="text-xs text-slate-400 mt-1">
                {search || selectedSupplier !== 'all' ? 'Try adjusting your search filters' : 'Add your first outsourced worker using the button above'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b text-[11px] font-black uppercase text-slate-500 tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Code / Worker</th>
                    <th className="py-3 px-4">Civil ID</th>
                    <th className="py-3 px-4">Mobile Number</th>
                    <th className="py-3 px-4">Supplier Agency</th>
                    <th className="py-3 px-4 text-right">Fixed Gross (OMR)</th>
                    <th className="py-3 px-4">Bank Account</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredWorkers.map(w => (
                    <tr key={w.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{w.name_en}</div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <Badge variant="outline" className="font-mono text-[10px] bg-purple-50 text-purple-700 border-purple-200">
                            {w.emp_code}
                          </Badge>
                          <span className="text-[11px] text-slate-400">{w.designation || 'Labour'}</span>
                        </div>
                      </td>

                      <td className="py-3 px-4 font-mono text-xs font-semibold text-slate-700">
                        {w.civil_id || '—'}
                      </td>

                      <td className="py-3 px-4 text-xs font-medium text-slate-600">
                        <div className="flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5 text-slate-400" />
                          <span>{w.contact_phone || w.emergency_contact_phone || '—'}</span>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        {w.supplier_name ? (
                          <Badge variant="secondary" className="text-xs font-medium bg-blue-50 text-blue-700 border-blue-100 flex items-center gap-1 w-fit">
                            <Building2 className="w-3 h-3" />
                            {w.supplier_name}
                          </Badge>
                        ) : (
                          <span className="text-xs text-slate-400 italic">Direct / Independent</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                        {formatOMR(w.gross_salary || w.basic_salary || 0)}
                      </td>

                      <td className="py-3 px-4 text-xs font-mono text-slate-500">
                        {w.bank_iban ? (
                          <div className="truncate max-w-[140px]" title={w.bank_iban}>
                            {w.bank_iban}
                          </div>
                        ) : (
                          <span className="text-slate-300 italic">Optional / None</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-center">
                        <Badge
                          variant={w.status === 'active' ? 'default' : 'secondary'}
                          className={`text-[10px] font-bold ${
                            w.status === 'active'
                              ? 'bg-emerald-500/10 text-emerald-700 border-emerald-200'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {w.status === 'active' ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Link
                            href={`/dashboard/timesheets?employeeId=${w.id}`}
                            className="p-1.5 text-slate-400 hover:text-purple-600 rounded-lg hover:bg-purple-50"
                            title="View Timesheets"
                          >
                            <Clock className="w-4 h-4" />
                          </Link>

                          {canUpdate && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenEdit(w)}
                              className="h-8 w-8 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg"
                              title="Edit Worker"
                            >
                              <Edit2 className="w-4 h-4" />
                            </Button>
                          )}

                          {canDelete && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(w)}
                              className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                              title="Remove Worker"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add / Edit Supply Worker Dialog */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-xl p-0 rounded-2xl overflow-hidden">
          <form onSubmit={handleSubmit}>
            <DialogHeader className="p-6 bg-gradient-to-r from-purple-50 via-white to-white border-b">
              <DialogTitle className="text-lg font-black text-slate-900 flex items-center gap-2">
                <div className="p-2 bg-purple-100 text-purple-700 rounded-xl">
                  <HardHat className="w-5 h-5" />
                </div>
                {editingWorker ? 'Edit Supply Labour Worker' : 'Add Supply Labour Worker'}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 mt-1">
                Collects Civil ID, mobile number, fixed gross salary, and optional bank info. Excluded from WPS.
              </DialogDescription>
            </DialogHeader>

            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Full Name */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">
                  Worker Full Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  required
                  placeholder="e.g. Salim Mohammed / Rajendra Kumar"
                  value={formData.name_en}
                  onChange={e => setFormData({ ...formData, name_en: e.target.value })}
                  className="rounded-xl h-10"
                />
              </div>

              {/* Civil ID & Mobile Number in 2 columns */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700">
                    Civil ID Number <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    required
                    placeholder="e.g. 12345678"
                    value={formData.civil_id}
                    onChange={e => setFormData({ ...formData, civil_id: e.target.value })}
                    className="rounded-xl h-10 font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700">
                    Mobile Phone Number <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    required
                    placeholder="e.g. +968 91234567"
                    value={formData.contact_phone}
                    onChange={e => setFormData({ ...formData, contact_phone: e.target.value })}
                    className="rounded-xl h-10"
                  />
                </div>
              </div>

              {/* Fixed Gross Salary & Supplier Agency in 2 columns */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700">
                    Fixed Gross Monthly Salary (OMR) <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    required
                    type="number"
                    step="0.001"
                    min="0"
                    placeholder="e.g. 180.000"
                    value={formData.gross_salary}
                    onChange={e => setFormData({ ...formData, gross_salary: e.target.value })}
                    className="rounded-xl h-10 font-mono font-bold"
                  />
                  <p className="text-[10px] text-slate-400">
                    Overtime rate will be: Gross / 240 OMR/hr
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700">
                    Manpower Supplier / Agency
                  </Label>
                  <Input
                    placeholder="e.g. Al Manahil Manpower"
                    value={formData.supplier_name}
                    onChange={e => setFormData({ ...formData, supplier_name: e.target.value })}
                    className="rounded-xl h-10"
                  />
                </div>
              </div>

              {/* Bank Account (Optional) */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-3">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-slate-500" />
                  <span className="text-xs font-bold text-slate-700">Bank Account Details (Optional)</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-[11px] text-slate-500">Bank Name</Label>
                    <Input
                      placeholder="e.g. Bank Muscat"
                      value={formData.bank_name}
                      onChange={e => setFormData({ ...formData, bank_name: e.target.value })}
                      className="rounded-lg h-9 text-xs mt-1 bg-white"
                    />
                  </div>
                  <div>
                    <Label className="text-[11px] text-slate-500">Account / IBAN Number</Label>
                    <Input
                      placeholder="OM..."
                      value={formData.bank_iban}
                      onChange={e => setFormData({ ...formData, bank_iban: e.target.value })}
                      className="rounded-lg h-9 text-xs font-mono mt-1 bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* Status & Designation */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700">Designation / Role</Label>
                  <Input
                    placeholder="e.g. Mason / Electrician / Helper"
                    value={formData.designation}
                    onChange={e => setFormData({ ...formData, designation: e.target.value })}
                    className="rounded-xl h-10"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700">Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(val) => setFormData({ ...formData, status: (val as 'active' | 'terminated') || 'active' })}
                  >
                    <SelectTrigger className="h-10 rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active (Available on Timesheets)</SelectItem>
                      <SelectItem value="terminated">Inactive / Terminated</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <DialogFooter className="p-4 px-6 bg-slate-50 border-t flex flex-row items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsModalOpen(false)}
                disabled={submitting}
                className="rounded-xl"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                className="bg-purple-600 hover:bg-purple-700 text-white rounded-xl gap-2"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {editingWorker ? 'Save Changes' : 'Add to Roster'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

'use client';

// ============================================================
// Companies Management Page — List, create, edit, delete companies.
// ============================================================

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Plus, Pencil, Trash2, Building2, Search, Loader2 } from 'lucide-react';
import { Company } from '@/types';
import { toast } from 'sonner';
import { useCompanies } from '@/hooks/queries/useCompanies';
import { useCompanyMutations } from '@/hooks/queries/useCompanyMutations';
import { useCompany } from '@/components/providers/CompanyProvider';
import { LogoUpload } from '@/components/ui/logo-upload';

export default function CompaniesPage() {
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [form, setForm] = useState({
    name_en: '', name_ar: '', cr_number: '', address: '',
    contact_email: '', contact_phone: '', bank_name: '',
    bank_account: '', iban: '', wps_mol_id: '',
    logo_url: '',
  });

  // Queries, Mutations & Context
  const { data: companies = [], isLoading } = useCompanies();
  const { createCompany, updateCompany, deleteCompany } = useCompanyMutations();
  const { refresh, profile } = useCompany();

  // Super Admin guard
  if (profile && profile.role !== 'super_admin') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-3 text-center">
        <Building2 className="w-12 h-12 text-muted-foreground/30" />
        <h2 className="text-xl font-bold">Access Restricted</h2>
        <p className="text-muted-foreground text-sm">Only Super Admins can manage companies.</p>
      </div>
    );
  }

  const filtered = useMemo(() => companies.filter(
    c => c.name_en.toLowerCase().includes(search.toLowerCase()) ||
         (c.cr_number || '').includes(search)
  ), [companies, search]);

  const openNew = () => {
    setEditingCompany(null);
    setForm({ 
      name_en: '', name_ar: '', cr_number: '', address: '', 
      contact_email: '', contact_phone: '', bank_name: '', 
      bank_account: '', iban: '', wps_mol_id: '',
      logo_url: '',
    });
    setDialogOpen(true);
  };

  const openEdit = (company: Company) => {
    setEditingCompany(company);
    setForm({
      name_en: company.name_en, name_ar: company.name_ar || '', 
      cr_number: company.cr_number || '', address: company.address || '', 
      contact_email: company.contact_email || '', contact_phone: company.contact_phone || '', 
      bank_name: company.bank_name || '', bank_account: company.bank_account || '', 
      iban: company.iban || '', wps_mol_id: company.wps_mol_id || '',
      logo_url: company.logo_url || '',
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name_en || !form.cr_number) {
      toast.error('Company name and CR number are required');
      return;
    }

    try {
      if (editingCompany) {
        await updateCompany.mutateAsync({ id: editingCompany.id, ...form });
      } else {
        await createCompany.mutateAsync(form);
      }
      await refresh(); // Sync global state
      setDialogOpen(false);
    } catch (e) {
      // Error handled in mutation hook
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this company?')) {
      await deleteCompany.mutateAsync(id);
      await refresh(); // Sync global state
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Companies</h1>
          <p className="text-muted-foreground text-sm">Manage all registered companies</p>
        </div>
        <Button onClick={openNew} className="gap-2 shrink-0">
          <Plus className="w-4 h-4" /> Add Company
        </Button>
      </div>

      <Card className="border-0 shadow-sm overflow-hidden">
        <CardHeader className="pb-3">
          <div className="relative max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Search companies..." 
              value={search} 
              onChange={e => setSearch(e.target.value)} 
              className="pl-9 h-10" 
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl border border-slate-100 overflow-hidden">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow className="hover:bg-transparent border-0">
                  <TableHead className="font-bold">Company Detail</TableHead>
                  <TableHead className="font-bold">CR Number</TableHead>
                  <TableHead className="hidden md:table-cell font-bold">Email</TableHead>
                  <TableHead className="hidden lg:table-cell font-bold text-center">WPS MOL ID</TableHead>
                  <TableHead className="text-right font-bold pr-6">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-20">
                      <div className="flex flex-col items-center gap-3">
                        <Loader2 className="w-8 h-8 animate-spin text-primary opacity-20" />
                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest">Synchronizing Database...</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filtered.map((company) => (
                  <TableRow key={company.id} className="group border-0 hover:bg-slate-50/50">
                    <TableCell className="py-4">
                      <div className="flex items-center gap-4 pl-1">
                        <div className="p-2.5 rounded-xl bg-primary/5 text-primary group-hover:scale-110 transition-transform shadow-sm">
                          <Building2 className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="font-bold text-sm tracking-tight">{company.name_en}</p>
                          {company.name_ar && <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider" dir="rtl">{company.name_ar}</p>}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-white font-mono font-bold text-[10px] px-2.5">{company.cr_number}</Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-[11px] font-medium text-slate-500">{company.contact_email}</TableCell>
                    <TableCell className="hidden lg:table-cell text-center">
                      <span className="text-[11px] font-mono font-black text-slate-400 bg-slate-100 px-2 py-0.5 rounded">{company.wps_mol_id || '-'}</span>
                    </TableCell>
                    <TableCell className="text-right pr-4">
                      <div className="flex items-center justify-end gap-1.5 translate-x-2 opacity-0 group-hover:opacity-100 group-hover:translate-x-0 transition-all">
                        <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl border-slate-200 hover:border-primary hover:text-primary transition-all" onClick={() => openEdit(company)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl border-slate-200 hover:border-destructive hover:bg-destructive/5 hover:text-destructive transition-all" onClick={() => handleDelete(company.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {!isLoading && filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-16">
                      <div className="flex flex-col items-center gap-2 opacity-20">
                         <Building2 className="w-12 h-12 mb-2" />
                         <p className="text-sm font-bold uppercase tracking-widest">No matching companies established</p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-[2rem] p-0 border-none shadow-2xl">
          <div className="bg-slate-900 px-8 py-6 text-white shrink-0">
             <DialogHeader>
                <DialogTitle className="text-xl font-black uppercase tracking-tight">{editingCompany ? 'Modify Establishment' : 'Register New Company'}</DialogTitle>
                <DialogDescription className="text-white/40 text-xs font-bold uppercase tracking-widest">
                  {editingCompany ? 'Update existing corporate profile details' : 'Establish a new business entity in the HRMS'}
                </DialogDescription>
             </DialogHeader>
          </div>

          <div className="p-8">
            <div className="mb-8">
              <LogoUpload
                value={form.logo_url}
                onChange={(url) => setForm({ ...form, logo_url: url })}
                onRemove={() => setForm({ ...form, logo_url: '' })}
                label="Establishment Logo"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Company Name (English) *</Label>
                <Input value={form.name_en} onChange={e => setForm({...form, name_en: e.target.value})} className="h-11 rounded-xl border-2 focus:border-primary" />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Company Name (Arabic)</Label>
                <Input value={form.name_ar} onChange={e => setForm({...form, name_ar: e.target.value})} className="h-11 rounded-xl border-2 focus:border-primary font-ar" dir="rtl" />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">CR Number *</Label>
                <Input value={form.cr_number} onChange={e => setForm({...form, cr_number: e.target.value})} className="h-11 rounded-xl border-2 focus:border-primary font-mono" />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Contact Email</Label>
                <Input type="email" value={form.contact_email} onChange={e => setForm({...form, contact_email: e.target.value})} className="h-11 rounded-xl border-2 focus:border-primary" />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Contact Phone</Label>
                <Input value={form.contact_phone} onChange={e => setForm({...form, contact_phone: e.target.value})} className="h-11 rounded-xl border-2 focus:border-primary" />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Bank Account Number</Label>
                <Input value={form.bank_account} onChange={e => setForm({...form, bank_account: e.target.value})} className="h-11 rounded-xl border-2 focus:border-primary font-mono text-xs" placeholder="Account number" />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">IBAN</Label>
                <Input value={form.iban} onChange={e => setForm({...form, iban: e.target.value})} className="h-11 rounded-xl border-2 focus:border-primary font-mono text-xs" placeholder="OMXXBMCT..." />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Address / Office Location</Label>
                <Input value={form.address} onChange={e => setForm({...form, address: e.target.value})} className="h-11 rounded-xl border-2 focus:border-primary" />
              </div>
            </div>
            
            <DialogFooter className="pt-6 border-t border-slate-100 flex flex-col-reverse sm:flex-row gap-3 sm:gap-2">
              <Button variant="ghost" onClick={() => setDialogOpen(false)} className="rounded-xl font-bold uppercase tracking-widest text-[10px] text-slate-400 w-full sm:w-auto">Abort Changes</Button>
              <Button
                onClick={handleSave}
                disabled={createCompany.isPending || updateCompany.isPending}
                className="rounded-xl px-10 h-12 bg-slate-900 text-white font-black uppercase tracking-widest text-[10px] shadow-xl hover:bg-slate-800 disabled:opacity-50 w-full sm:w-auto"
              >
                {(createCompany.isPending || updateCompany.isPending) ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  editingCompany ? 'Apply Updates' : 'Establish Business'
                )}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

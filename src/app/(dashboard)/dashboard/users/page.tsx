'use client';

// ============================================================
// Premium Users Management Page - Redesigned Experience
// High-end UI with Glassmorphism, Side-panels, and Advanced 
// Super Admin controls (Reset Password, Manual Credentials).
// ============================================================

import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { 
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter 
} from '@/components/ui/sheet';
import { 
  Plus, Pencil, Trash2, Search, Shield, Loader2, CheckCircle2, 
  Copy, Key, Mail, Building2, UserCircle, Calendar, Phone,
  ChevronRight, RefreshCw, Eye, EyeOff, MoreHorizontal, Fingerprint
} from 'lucide-react';
import { 
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, 
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
  DropdownMenuGroup 
} from '@/components/ui/dropdown-menu';
import { Profile, UserRole } from '@/types';
import { useCompany } from '@/components/providers/CompanyProvider';
import { useProfiles } from '@/hooks/queries/useProfiles';
import { useProfileMutations } from '@/hooks/queries/useProfileMutations';
import { toast } from 'sonner';
import { format } from 'date-fns';

const roleColors: Record<UserRole, string> = {
  super_admin: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300 border-rose-200',
  company_admin: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 border-indigo-200',
  hr: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200',
  finance: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200',
  viewer: 'bg-slate-100 text-slate-700 dark:bg-slate-900/40 dark:text-slate-300 border-slate-200',
};

const roleLabels: Record<UserRole, string> = {
  super_admin: 'Super Admin',
  company_admin: 'Company Admin',
  hr: 'HR Manager',
  finance: 'Finance',
  viewer: 'Viewer',
};

export default function UsersPage() {
  const { availableCompanies, profile } = useCompany();
  const { data: profilesData = [], isLoading: profilesLoading } = useProfiles();
  const { deleteProfile, createProfile, updateProfile } = useProfileMutations();
  
  const [search, setSearch] = useState('');
  const [selectedRole, setSelectedRole] = useState<string>('all');
  
  // UI States
  const [dialogOpen, setDialogOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  
  // Selection States
  const [userToDelete, setUserToDelete] = useState<Profile | null>(null);
  const [viewingUser, setViewingUser] = useState<Profile | null>(null);
  const [isResetingPassword, setIsResetingPassword] = useState(false);
  
  // Form State
  const [form, setForm] = useState({
    userId: '',
    full_name: '',
    email: '',
    role: 'viewer' as UserRole,
    company_id: '',
    phone_number: '',
    password: '',
    is_active: true
  });
  const [showPassword, setShowPassword] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);
  const [showCredentials, setShowCredentials] = useState(false);

  // Computed
  const isMutationPending = deleteProfile.isPending || createProfile.isPending || updateProfile.isPending || isResetingPassword;

  const filtered = useMemo(() => {
    return profilesData.filter(u => {
      const matchesSearch = u.full_name.toLowerCase().includes(search.toLowerCase()) || 
                           (u.username ?? u.email.split('@')[0]).toLowerCase().includes(search.toLowerCase());
      const matchesRole = selectedRole === 'all' || u.role === selectedRole;
      return matchesSearch && matchesRole;
    });
  }, [profilesData, search, selectedRole]);

  const openNew = () => {
    setViewingUser(null);
    setGeneratedPassword(null);
    setForm({ userId: '', full_name: '', email: '', role: 'viewer', company_id: '', phone_number: '', password: '', is_active: true });
    setDialogOpen(true);
  };

  const openView = (user: Profile) => {
    setViewingUser(user);
    setForm({
      userId: user.username ?? user.email.split('@')[0],
      full_name: user.full_name,
      email: user.email,
      role: user.role,
      company_id: user.company_id || '',
      phone_number: user.phone_number || '',
      password: '',
      is_active: !!user.is_active
    });
    setSheetOpen(true);
  };

  const getCompanyName = (companyId: string | null) => {
    if (!companyId) return 'Global (All Companies)';
    const company = availableCompanies.find(c => c.id === companyId);
    return company?.name_en || companyId;
  };

  const handleSave = async (isUpdate = false) => {
    if (!form.userId || !form.full_name) {
      toast.error('User ID and full name are required');
      return;
    }

    // Map role to API format
    const roleMap: Record<UserRole, string> = {
      super_admin: 'superadmin',
      company_admin: 'company_admin',
      hr: 'hr_manager',
      finance: 'employee',
      viewer: 'employee',
    };

    try {
      if (isUpdate && viewingUser) {
        await updateProfile.mutateAsync({ id: viewingUser.id, ...form });
        setForm(prev => ({ ...prev, password: '' })); // Clear password field after update
        toast.success('User updated successfully');
        setSheetOpen(false);
      } else {
        const result = await createProfile.mutateAsync({
          ...form,
          role: roleMap[form.role] as any,
        });
        setGeneratedPassword(result.generatedPassword);
        toast.success('User registered successfully');
        setDialogOpen(false); // Close the entry form
        setShowCredentials(true); // Show the success credentials dialog
      }
    } catch (error: any) {
      toast.error(error.message || 'Operation failed');
    }
  };

  const handleDelete = async () => {
    if (!userToDelete) return;

    try {
      await deleteProfile.mutateAsync(userToDelete.id);
      toast.success('User accounts terminated successfully');
      setDeleteDialogOpen(false);
      setUserToDelete(null);
    } catch (error: any) {
      toast.error(error.message || 'Failed to remove user');
    }
  };

  const handleResetPassword = async () => {
    if (!viewingUser) return;
    
    setIsResetingPassword(true);
    try {
      const resp = await fetch('/api/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: viewingUser.id, userId: viewingUser.email.split('@')[0], action: 'reset_password' }),
      });
      const result = await resp.json();
      
      if (!resp.ok) throw new Error(result.error || 'Failed to reset password');
      
      setGeneratedPassword(result.newPassword);
      toast.success('Password reset successful. New credentials generated.');
      setShowCredentials(true); // Trigger the success dialog
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsResetingPassword(false);
    }
  };

  if (profilesLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <Loader2 className="w-10 h-10 animate-spin text-primary/60" />
        <p className="text-muted-foreground animate-pulse">Synchronizing directory...</p>
      </div>
    );
  }

  if (profile && profile.role !== 'super_admin') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-3 text-center">
        <Shield className="w-12 h-12 text-muted-foreground/30" />
        <h2 className="text-xl font-bold">Access Restricted</h2>
        <p className="text-muted-foreground text-sm">Only Super Admins can manage users and access controls.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      {/* Header Section */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-2 border-b border-border/60">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-transparent">
            Directory
          </h1>
          <p className="text-muted-foreground mt-2 text-lg font-medium">
            Manage your organization's users, roles, and access controls.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={openNew} size="lg" className="rounded-full shadow-xl shadow-primary/10 transition-all hover:scale-105 active:scale-95 bg-primary hover:bg-primary/90">
            <Plus className="w-5 h-5 mr-2" /> Add New Member
          </Button>
        </div>
      </div>

      {/* Stats Quick View (Simplified for Directory) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Members', count: profilesData.length, icon: UserCircle, color: 'text-blue-600' },
          { label: 'Super Admins', count: profilesData.filter(u => u.role === 'super_admin').length, icon: Shield, color: 'text-rose-600' },
          { label: 'Active Now', count: profilesData.filter(u => u.is_active).length, icon: CheckCircle2, color: 'text-emerald-600' },
          { label: 'Unassigned', count: profilesData.filter(u => !u.company_id && u.role !== 'super_admin').length, icon: Building2, color: 'text-amber-600' },
        ].map((stat, i) => (
          <Card key={i} className="border-none bg-white/50 dark:bg-slate-900/40 backdrop-blur-md shadow-sm">
            <CardContent className="p-4 flex items-center gap-4">
              <div className={`p-2.5 rounded-xl bg-white/80 dark:bg-slate-800 shadow-inner ${stat.color}`}>
                <stat.icon className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{stat.label}</p>
                <p className="text-2xl font-bold">{stat.count}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Content Area */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row items-center gap-4 bg-white/40 dark:bg-slate-900/40 p-3 rounded-2xl border border-border/40 backdrop-blur-sm">
          <div className="relative flex-1 group">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <Input 
              placeholder="Search by name or User ID..." 
              value={search} 
              onChange={e => setSearch(e.target.value)} 
              className="pl-10 h-11 bg-white/60 dark:bg-slate-800/60 border-none shadow-none focus-visible:ring-2 focus-visible:ring-primary/20 transition-all rounded-xl" 
            />
          </div>
          <Select value={selectedRole} onValueChange={(v) => v && setSelectedRole(v)}>
            <SelectTrigger className="w-full sm:w-[180px] h-11 bg-white/60 dark:bg-slate-800/60 border-none rounded-xl">
              <SelectValue placeholder="All Roles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              {Object.entries(roleLabels).map(([val, label]) => (
                <SelectItem key={val} value={val}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Card className="border-none shadow-xl shadow-slate-200/50 dark:shadow-none overflow-hidden rounded-3xl">
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-slate-50/50 dark:bg-slate-900/50">
                <TableRow className="hover:bg-transparent border-none">
                  <TableHead className="py-5 font-bold text-slate-900 dark:text-slate-100 pl-6">Member</TableHead>
                  <TableHead className="py-5 font-bold text-slate-900 dark:text-slate-100">Role & Access</TableHead>
                  <TableHead className="py-5 font-bold text-slate-900 dark:text-slate-100 hidden lg:table-cell">Identity Status</TableHead>
                  <TableHead className="py-5 font-bold text-slate-900 dark:text-slate-100 hidden xl:table-cell">Recent Activity</TableHead>
                  <TableHead className="py-5 text-right pr-6 font-bold text-slate-900 dark:text-slate-100">Manage</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((user) => (
                  <TableRow key={user.id} className="group hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-colors border-slate-100 dark:border-slate-800/50">
                    <TableCell className="py-5 pl-6">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 flex items-center justify-center font-bold text-slate-500 shadow-inner group-hover:scale-105 transition-transform">
                          {user.full_name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 dark:text-slate-200">{user.full_name}</p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1"><Fingerprint className="w-3 h-3 text-primary/60" /> ID: {user.username ?? user.email.split('@')[0]}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="py-5">
                      <div className="space-y-1.5">
                        <Badge variant="outline" className={`${roleColors[user.role]} border px-2 py-0.5 rounded-lg text-[10px] uppercase font-bold tracking-tighter`}>
                          {roleLabels[user.role]}
                        </Badge>
                        <p className="text-[10px] text-muted-foreground flex items-center gap-1 font-medium truncate max-w-[140px]">
                          <Building2 className="w-2.5 h-2.5" /> {getCompanyName(user.company_id)}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="py-5 hidden lg:table-cell">
                      <div className="flex items-center gap-2">
                        {user.is_active ? (
                          <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                            <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">Authorized</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-slate-300"></span>
                            <span className="text-xs font-semibold text-slate-500">Disabled</span>
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="py-5 hidden xl:table-cell">
                      <div className="text-xs space-y-1 text-muted-foreground font-medium">
                        <p className="flex items-center gap-1.5"><Calendar className="w-3 h-3" /> Joined: {format(new Date(user.created_at), 'MMM d, yyyy')}</p>
                        <p className="flex items-center gap-1.5">
                          <RefreshCw className="w-3 h-3" /> Active: {user.last_login_at ? format(new Date(user.last_login_at), 'MMM d, HH:mm') : 'Never'}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="py-5 text-right pr-6">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" className="h-9 w-9 text-blue-600 hover:text-blue-700 hover:bg-blue-50" onClick={() => openView(user)}>
                          <Eye className="w-4 h-4" />
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "h-9 w-9")}>
                            <MoreHorizontal className="w-4 h-4" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuGroup>
                              <DropdownMenuLabel>Quick Actions</DropdownMenuLabel>
                              <DropdownMenuItem onClick={() => openView(user)}>Edit Profile</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => {
                                setViewingUser(user);
                                handleResetPassword();
                              }} className="text-amber-600 font-medium">
                                Reset Password
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                onClick={() => {
                                  setUserToDelete(user);
                                  setDeleteDialogOpen(true);
                                }}
                                className="text-rose-600 focus:text-rose-600"
                              >
                                Delete Account
                              </DropdownMenuItem>
                            </DropdownMenuGroup>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {filtered.length === 0 && (
              <div className="py-20 text-center space-y-3">
                <div className="inline-flex p-4 rounded-full bg-slate-50 text-slate-300">
                  <Search className="w-8 h-8" />
                </div>
                <p className="text-muted-foreground font-medium">No members found matching your criteria</p>
                <Button variant="link" onClick={() => { setSearch(''); setSelectedRole('all'); }}>Clear all filters</Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* User Details & Edit Side Panel */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="sm:max-w-md w-full p-0 flex flex-col">
          <div className="p-6 bg-slate-50/50 dark:bg-slate-900/50 border-b">
            <SheetHeader className="text-left">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center text-xl font-bold shadow-sm">
                  {viewingUser?.full_name.charAt(0)}
                </div>
                <div>
                  <SheetTitle className="text-2xl font-bold">{viewingUser?.full_name}</SheetTitle>
                  <SheetDescription className="font-medium flex items-center gap-1.5"><Fingerprint className="w-4 h-4" /> User ID: {viewingUser?.username ?? viewingUser?.email.split('@')[0]}</SheetDescription>
                </div>
              </div>
              <div className="flex gap-2">
                <Badge className={roleColors[form.role]}>{roleLabels[form.role]}</Badge>
                {form.is_active ? <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">Active</Badge> : <Badge variant="secondary">Inactive</Badge>}
              </div>
            </SheetHeader>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-8">
            <div className="space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">General Information</h3>
              <div className="grid gap-4">
                <div className="space-y-1.5"><Label>Full Name</Label><Input value={form.full_name} onChange={e => setForm({...form, full_name: e.target.value})} className="h-11 bg-muted/30" /></div>
                <div className="space-y-1.5"><Label>Email</Label><Input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} className="h-11 bg-muted/30" placeholder="user@company.com" /></div>
                <div className="space-y-1.5"><Label>User ID</Label><Input value={form.userId} onChange={e => setForm({...form, userId: e.target.value})} className="h-11 bg-muted/30" /></div>
                <div className="space-y-1.5">
                  <Label>Phone Number (Optional)</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input placeholder="+968 1234 5678" value={form.phone_number} onChange={e => setForm({...form, phone_number: e.target.value})} className="pl-10 h-11 bg-muted/30" />
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Permissions & Scope</h3>
              <div className="grid gap-4">
                <div className="space-y-1.5">
                  <Label>System Role</Label>
                  <Select value={form.role} onValueChange={(v: UserRole | null) => v && setForm({...form, role: v})}>
                    <SelectTrigger className="h-11 bg-muted/30"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(roleLabels).map(([val, label]) => (
                        <SelectItem key={val} value={val}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Assigned Company</Label>
                  <Select value={form.company_id} onValueChange={(v) => v && setForm({...form, company_id: v})}>
                    <SelectTrigger className="h-11 bg-muted/30">
                      <SelectValue placeholder="Global Access" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Global (All Companies)</SelectItem>
                      {availableCompanies.map(c => <SelectItem key={c.id} value={c.id}>{c.name_en}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label>Manual Password Update (Optional)</Label>
                    <Button variant="link" className="h-auto p-0 text-[10px]" onClick={() => setShowPassword(!showPassword)}>{showPassword ? 'Hide' : 'Show'}</Button>
                  </div>
                  <Input 
                    type={showPassword ? 'text' : 'password'} 
                    placeholder="Enter new password to override..." 
                    value={form.password} 
                    onChange={e => setForm({...form, password: e.target.value})} 
                    className="h-11 bg-muted/30" 
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t">
              <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Security Controls</h3>
              <div className="flex items-center justify-between p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30">
                <div>
                  <p className="font-bold text-rose-900 dark:text-rose-400">Credential Reset</p>
                  <p className="text-xs text-rose-700/70 dark:text-rose-500">Generate a high-security random password</p>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="bg-white hover:bg-rose-50 text-rose-700 border-rose-200" 
                  onClick={handleResetPassword}
                  disabled={isMutationPending}
                >
                  {isMutationPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4 mr-2" />} Reset
                </Button>
              </div>
              
              <div className="flex items-center space-x-3 p-2">
                <input 
                  type="checkbox" 
                  id="is_active_sheet" 
                  checked={!!form.is_active} 
                  onChange={e => setForm({...form, is_active: e.target.checked})} 
                  className="h-5 w-5 rounded-md border-slate-300 text-primary focus:ring-primary shadow-sm"
                />
                <div>
                  <Label htmlFor="is_active_sheet" className="font-bold">Active Status</Label>
                  <p className="text-[10px] text-muted-foreground italic leading-none">Enable or disable all platform access for this user</p>
                </div>
              </div>
            </div>
          </div>

          <SheetFooter className="p-6 border-t bg-white dark:bg-slate-900">
            <Button variant="outline" className="flex-1 rounded-xl h-12" onClick={() => setSheetOpen(false)}>Cancel</Button>
            <Button className="flex-1 rounded-xl h-12 shadow-lg" onClick={() => handleSave(true)} disabled={isMutationPending}>
              {isMutationPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Save Changes
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Credentials Display Dialog (Show after Create or Reset) */}
      <Dialog open={showCredentials} onOpenChange={setShowCredentials}>
        <DialogContent className="sm:max-w-md rounded-3xl p-0 overflow-hidden border-none shadow-2xl">
          <div className="bg-emerald-600 p-8 text-white relative">
            <div className="absolute top-0 right-0 p-8 opacity-10"><CheckCircle2 className="w-32 h-32" /></div>
            <DialogTitle className="text-3xl font-extrabold pb-1">Security Update</DialogTitle>
            <DialogDescription className="text-emerald-100 font-medium">New credentials have been generated successfully.</DialogDescription>
          </div>
          
          <div className="p-8 space-y-6 animate-in fade-in zoom-in duration-300">
            <div className="bg-emerald-50 dark:bg-emerald-950/20 border-2 border-emerald-100 dark:border-emerald-900/30 rounded-3xl p-6 text-center">
              <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900 rounded-full flex items-center justify-center mx-auto mb-4 shadow-inner">
                <Shield className="w-8 h-8 text-emerald-600" />
              </div>
              <h3 className="text-xl font-bold text-emerald-900 dark:text-emerald-400">Credentials Ready</h3>
              <p className="text-sm text-emerald-700/80 mt-2">
                User: <strong className="text-emerald-900">{viewingUser?.full_name || form.full_name}</strong>
              </p>
            </div>
            
            <div className="space-y-6">
              <div className="space-y-3 p-5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200">
                <Label className="text-[10px] uppercase font-bold tracking-[0.2em] text-muted-foreground ml-1">User ID</Label>
                <div className="flex items-center gap-2">
                   <Fingerprint className="w-5 h-5 text-muted-foreground" />
                   <Input value={viewingUser?.username || viewingUser?.email.split('@')[0] || form.userId || ''} readOnly className="font-mono text-xl h-10 border-none shadow-none bg-transparent" />
                </div>
              </div>

              <div className="space-y-3 p-5 bg-emerald-500/5 rounded-2xl border border-emerald-500/10">
                <Label className="text-[10px] uppercase font-bold tracking-[0.2em] text-emerald-600/60 ml-1">New Password</Label>
                <div className="flex gap-2">
                  <Input value={generatedPassword || ''} readOnly className="font-mono text-center text-2xl h-14 border-none shadow-none bg-transparent text-emerald-700 dark:text-emerald-400 font-bold" />
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-14 w-12 hover:bg-white"
                    onClick={() => {
                      if (generatedPassword) {
                        navigator.clipboard.writeText(generatedPassword);
                        toast.success('Security password copied');
                      }
                    }}
                  >
                    <Copy className="w-5 h-5 text-emerald-600" />
                  </Button>
                </div>
              </div>
            </div>
            <Button onClick={() => setShowCredentials(false)} className="w-full h-14 text-lg font-bold rounded-2xl shadow-xl bg-emerald-600 hover:bg-emerald-700">Done & Security Secured</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Simplified Add User Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg rounded-3xl p-0 overflow-hidden border-none shadow-2xl">
          <div className="bg-slate-900 p-8 text-white relative">
            <div className="absolute top-0 right-0 p-8 opacity-10"><UserCircle className="w-32 h-32" /></div>
            <DialogTitle className="text-3xl font-extrabold pb-1">Register Member</DialogTitle>
            <DialogDescription className="text-slate-400 font-medium">Authorize a new colleague to the platform.</DialogDescription>
          </div>
          
            <div className="p-8 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5"><Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Full Name</Label><Input placeholder="Alex Morgan" value={form.full_name} onChange={e => setForm({...form, full_name: e.target.value})} className="h-12 bg-slate-50 border-none shadow-none" /></div>
                <div className="space-y-1.5"><Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">User ID</Label><Input placeholder="alex.morgan" value={form.userId} onChange={e => setForm({...form, userId: e.target.value})} className="h-12 bg-slate-50 border-none shadow-none" /></div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">System Role</Label>
                  <Select value={form.role} onValueChange={(v: UserRole | null) => v && setForm({...form, role: v})}>
                    <SelectTrigger className="h-12 bg-slate-50 border-none shadow-none"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(roleLabels).map(([val, label]) => (
                        <SelectItem key={val} value={val}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Scope</Label>
                  <Select value={form.company_id} onValueChange={(v) => v && setForm({...form, company_id: v})}>
                    <SelectTrigger className="h-12 bg-slate-50 border-none shadow-none"><SelectValue placeholder="Select Scope" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Global Access</SelectItem>
                      {availableCompanies.map(c => <SelectItem key={c.id} value={c.id}>{c.name_en}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Manual Password (Optional)</Label>
                  <Button variant="link" className="h-auto p-0 text-[10px] text-primary" onClick={() => setShowPassword(!showPassword)}>{showPassword ? 'Hide Secret' : 'View Secret'}</Button>
                </div>
                <div className="relative">
                  <Input 
                    type={showPassword ? 'text' : 'password'} 
                    placeholder="Leave blank to auto-generate" 
                    value={form.password} 
                    onChange={e => setForm({...form, password: e.target.value})}
                    className="h-12 bg-slate-50 border-none shadow-none pl-11"
                  />
                  <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <Button variant="outline" onClick={() => setDialogOpen(false)} className="flex-1 h-12 rounded-xl text-slate-500 border-slate-200">Dismiss</Button>
                <Button onClick={() => handleSave(false)} className="flex-1 h-12 rounded-xl shadow-lg shadow-primary/20">Authorize Member</Button>
              </div>
            </div>
          </DialogContent>
      </Dialog>

      {/* Delete User Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="rounded-3xl border-none shadow-2xl">
          <AlertDialogHeader>
            <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mb-4">
              <Trash2 className="w-8 h-8 text-rose-600" />
            </div>
            <AlertDialogTitle className="text-2xl font-bold">Destroy User Account?</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-500 font-medium">
              You are about to permanently delete <span className="text-slate-900 font-bold">{userToDelete?.full_name}</span>. This will revoke all platform access and remove their authentication record. This action is irreversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-6">
            <AlertDialogCancel className="rounded-xl border-slate-200">Preserve Account</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="rounded-xl bg-rose-600 hover:bg-rose-700 shadow-lg shadow-rose-200">Confirm Deletion</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

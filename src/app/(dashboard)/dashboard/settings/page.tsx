'use client';

// ============================================================
// Settings Page — Company settings and profile management.
// ============================================================

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Loader2, User, Shield, Globe, Settings, Eye, EyeOff, Save, Key, Monitor } from 'lucide-react';
import { useCompany } from '@/components/providers/CompanyProvider';
import { LogoUpload } from '@/components/ui/logo-upload';
import { createClient } from '@/lib/supabase/client';
import { SystemSettings } from '@/types';

export default function SettingsPage() {
  const { profile, loading, refresh } = useCompany();
  const [fullName, setFullName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [systemSettings, setSystemSettings] = useState<SystemSettings | null>(null);
  const [isUpdatingSystem, setIsUpdatingSystem] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    async function fetchSystemSettings() {
      if (!supabase) return;
      const { data, error } = await supabase
        .from('system_settings')
        .select('*')
        .eq('id', 'global')
        .single();
      
      if (data) setSystemSettings(data);
    }
    fetchSystemSettings();
  }, [supabase]);

  useEffect(() => {
    if (profile?.full_name) {
      setFullName(profile.full_name);
    }
  }, [profile]);

  const handleSaveProfile = async () => {
    if (!fullName.trim()) {
      toast.error('Full name is required');
      return;
    }

    setIsUpdating(true);
    try {
      const resp = await fetch('/api/auth/update-profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: fullName }),
      });
      const result = await resp.json();
      if (!resp.ok) throw new Error(result.error || 'Failed to update profile');
      
      toast.success('Profile updated successfully');
      if (refresh) await refresh();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (!newPassword) {
      toast.error('Please enter a new password');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setIsUpdating(true);
    try {
      const resp = await fetch('/api/auth/update-profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: newPassword }),
      });
      const result = await resp.json();
      if (!resp.ok) throw new Error(result.error || 'Failed to update password');
      
      toast.success('Password updated successfully');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSaveSystemSettings = async () => {
    if (!systemSettings) return;
    setIsUpdatingSystem(true);
    try {
      const { error } = await supabase
        .from('system_settings')
        .update({
          software_name: systemSettings.software_name,
          software_logo_url: systemSettings.software_logo_url,
          updated_at: new Date().toISOString(),
          updated_by: profile?.id
        })
        .eq('id', 'global');

      if (error) throw error;
      toast.success('System settings updated');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsUpdatingSystem(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-24">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const roleName = profile?.role?.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()) || 'Staff';

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground text-sm">Manage your account and application preferences</p>
      </div>

      {/* Profile */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><User className="w-4 h-4" /> Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Full Name</Label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input defaultValue={profile?.email || ''} disabled />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Label>Role:</Label>
            <Badge className="bg-primary/10 text-primary border-0">{roleName}</Badge>
          </div>
          <Button onClick={handleSaveProfile} disabled={isUpdating}>
            {isUpdating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />} Save Profile
          </Button>
        </CardContent>
      </Card>

      {/* Security */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Shield className="w-4 h-4" /> Security</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>Change Password</Label>
              <Button variant="ghost" size="sm" className="h-6 p-1 text-muted-foreground" onClick={() => setShowPassword(!showPassword)}>
                {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </Button>
            </div>
            <Input 
              type={showPassword ? 'text' : 'password'} 
              placeholder="New password" 
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Confirm Password</Label>
            <Input 
              type={showPassword ? 'text' : 'password'} 
              placeholder="Confirm new password" 
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
            />
          </div>
          <Button variant="outline" onClick={handleUpdatePassword} disabled={isUpdating}>
            {isUpdating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Key className="w-4 h-4 mr-2" />} Update Password
          </Button>
          <Separator />
          <div>
            <p className="text-sm font-medium">Google Account</p>
            <p className="text-xs text-muted-foreground mt-1">Connected via Google OAuth through Supabase</p>
          </div>
        </CardContent>
      </Card>

      {/* Localization */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Globe className="w-4 h-4" /> Localization</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <div>
              <p className="text-sm font-medium">Language</p>
              <p className="text-xs text-muted-foreground">English (default). Arabic with RTL support coming soon.</p>
            </div>
            <Badge variant="outline">English</Badge>
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <div>
              <p className="text-sm font-medium">Currency</p>
              <p className="text-xs text-muted-foreground">Omani Rial (OMR) with 3 decimal places</p>
            </div>
            <Badge variant="outline">OMR</Badge>
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <div>
              <p className="text-sm font-medium">Weekend Days</p>
              <p className="text-xs text-muted-foreground">Friday & Saturday (Oman standard)</p>
            </div>
            <Badge variant="outline">Fri–Sat</Badge>
          </div>
        </CardContent>
      </Card>



      {/* System Settings (Super Admin Only) */}
      {profile?.role === 'super_admin' && (
        <Card className="border-0 shadow-sm border-2 border-primary/20">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-primary">
              <Monitor className="w-4 h-4" /> System Branding
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <LogoUpload
                label="Software Logo"
                value={systemSettings?.software_logo_url}
                onChange={(url) => setSystemSettings(prev => prev ? { ...prev, software_logo_url: url } : null)}
                onRemove={() => setSystemSettings(prev => prev ? { ...prev, software_logo_url: null } : null)}
                folder="branding"
              />
              
              <div className="space-y-1.5">
                <Label>Software Name</Label>
                <Input 
                  value={systemSettings?.software_name || ''} 
                  onChange={e => setSystemSettings(prev => prev ? { ...prev, software_name: e.target.value } : null)} 
                />
              </div>
            </div>

            <Button onClick={handleSaveSystemSettings} disabled={isUpdatingSystem} className="w-full">
              {isUpdatingSystem ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />} 
              Update System Branding
            </Button>
          </CardContent>
        </Card>
      )}

      {/* About */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Settings className="w-4 h-4" /> About</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm space-y-1 text-muted-foreground">
            <p><strong className="text-foreground">hrsoftware</strong> v1.0.0</p>
            <p>Oman-compliant HR & Payroll SaaS</p>
            <p>Royal Decree 53/2023 • Bank Muscat WPS</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

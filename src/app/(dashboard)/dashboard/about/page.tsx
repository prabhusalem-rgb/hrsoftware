'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Flower, ShieldCheck, Zap, Globe } from "lucide-react";

export default function AboutPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] animate-fade-in pb-12">
      {/* Header Section */}
      <div className="text-center space-y-6 pt-8 pb-12">
        <div className="inline-flex items-center justify-center w-24 h-24 rounded-[2.5rem] bg-primary text-primary-foreground mb-4 shadow-2xl shadow-primary/20">
          <Flower className="w-12 h-12" />
        </div>
        <div className="space-y-2">
          <h1 className="text-5xl font-extrabold tracking-tight text-primary">Bright Flowers</h1>
          <p className="text-2xl text-muted-foreground font-medium italic">HR & Payroll Management System</p>
        </div>
        <div className="flex items-center justify-center gap-3 pt-2">
          <Badge variant="secondary" className="px-4 py-1.5 text-xs font-bold tracking-wider uppercase">Version 1.0</Badge>
          <Badge variant="outline" className="px-4 py-1.5 text-xs font-bold border-primary/20 text-primary uppercase">Stable Release</Badge>
        </div>
      </div>

      {/* Main Credits Card */}
      <Card className="w-full max-w-xl border-0 shadow-2xl bg-white overflow-hidden relative group">
        <div className="absolute top-0 right-0 w-48 h-48 bg-primary/5 rounded-full -mr-24 -mt-24 blur-3xl pointer-events-none transition-transform group-hover:scale-110 duration-700" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-primary/5 rounded-full -ml-24 -mb-24 blur-3xl pointer-events-none transition-transform group-hover:scale-110 duration-700" />
        
        <CardHeader className="pb-4 text-center relative">
          <CardTitle className="text-xs text-muted-foreground/60 font-bold uppercase tracking-[0.2em]">Architected & Developed By</CardTitle>
        </CardHeader>
        <CardContent className="text-center pb-12 px-12 relative">
          <h2 className="text-4xl font-black text-slate-900 mb-6 tracking-tight">Kumaresan</h2>
          <div className="w-16 h-1 bg-primary/20 mx-auto mb-6 rounded-full" />
          <p className="text-base text-slate-600 leading-relaxed font-medium">
            A premium, high-performance human resources solution crafted specifically for businesses in Oman, 
            blending elegant design with strict compliance to local labour laws.
          </p>
        </CardContent>
      </Card>

      {/* Simplified Footer */}
      <div className="text-center pt-16 max-w-lg mx-auto">
        <p className="text-sm font-medium text-slate-400">
          © {new Date().getFullYear()} Bright Flowers HR & Payroll
        </p>
        <p className="text-xs text-slate-300 mt-1 uppercase tracking-widest font-bold">
          All rights reserved
        </p>
      </div>
    </div>
  );
}

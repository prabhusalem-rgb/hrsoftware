'use client';

import React, { useRef, useId } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { Button } from '@/components/ui/button';
import { Trash2, Check } from 'lucide-react';

interface SignaturePadProps {
  onSave: (signatureDataUrl: string) => void;
  onClear?: () => void;
  placeholder?: string;
  height?: string;
}

export function SignaturePad({ onSave, onClear, placeholder, height = 'h-48' }: SignaturePadProps) {
  const sigCanvas = useRef<SignatureCanvas>(null);
  const inputId = useId();

  const clear = () => {
    sigCanvas.current?.clear();
    if (onClear) onClear();
  };

  const save = () => {
    if (sigCanvas.current?.isEmpty()) {
      return;
    }
    const dataUrl = sigCanvas.current?.getTrimmedCanvas().toDataURL('image/png');
    if (dataUrl) {
      onSave(dataUrl);
    }
  };

  return (
    <div className="w-full space-y-4">
      <div
        className="border-2 border-dashed border-slate-300 rounded-lg bg-white overflow-hidden touch-none"
        style={{ touchAction: 'none' }}
      >
        <SignatureCanvas
          ref={sigCanvas}
          penColor="black"
          canvasProps={{
            className: `w-full ${height} cursor-crosshair`,
            style: { touchAction: 'none' },
            id: inputId,
          }}
        />
      </div>

      <div className="flex justify-between items-center gap-4">
        <Button
          type="button"
          variant="outline"
          onClick={clear}
          className="flex-1 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
        >
          <Trash2 className="w-4 h-4 mr-2" />
          Clear
        </Button>

        <Button
          type="button"
          onClick={save}
          className="flex-1 bg-slate-900 text-white hover:bg-slate-800"
        >
          <Check className="w-4 h-4 mr-2" />
          Apply Signature
        </Button>
      </div>

      {placeholder && (
        <p className="text-xs text-slate-500 text-center italic">
          {placeholder}
        </p>
      )}
    </div>
  );
}

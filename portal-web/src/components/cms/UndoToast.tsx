"use client";

import React, { useEffect } from 'react';
import { Undo2, CheckCircle2, X, Loader2 } from 'lucide-react';

interface UndoToastProps {
  lastConfirmedTitle: string | null;
  onUndo: () => void;
  onDismiss: () => void;
  isUndoing?: boolean;
}

export default function UndoToast({
  lastConfirmedTitle,
  onUndo,
  onDismiss,
  isUndoing = false
}: UndoToastProps) {
  useEffect(() => {
    if (!lastConfirmedTitle || isUndoing) return;
    const timer = setTimeout(() => {
      onDismiss();
    }, 6000); // 6 seconds auto-dismiss
    return () => clearTimeout(timer);
  }, [lastConfirmedTitle, isUndoing, onDismiss]);

  if (!lastConfirmedTitle) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-3 bg-zinc-900 text-white rounded-2xl shadow-xl border border-zinc-700 text-xs sm:text-sm animate-in slide-in-from-bottom-5 duration-200">
      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
      <span className="truncate max-w-[200px] sm:max-w-xs">
        已確認「{lastConfirmedTitle}」
      </span>
      <div className="h-4 w-px bg-zinc-700" />
      <button
        type="button"
        disabled={isUndoing}
        onClick={onUndo}
        className={`flex items-center gap-1 font-bold shrink-0 ${
          isUndoing
            ? 'text-zinc-400 cursor-not-allowed'
            : 'text-blue-400 hover:text-blue-300 underline cursor-pointer'
        }`}
      >
        {isUndoing ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>復原中...</span>
          </>
        ) : (
          <>
            <Undo2 className="w-3.5 h-3.5" />
            <span>復原 (Undo)</span>
          </>
        )}
      </button>
      {!isUndoing && (
        <button
          type="button"
          onClick={onDismiss}
          className="text-zinc-500 hover:text-zinc-300 ml-1 p-0.5 rounded cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

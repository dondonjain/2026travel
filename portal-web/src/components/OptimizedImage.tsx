"use client";

import React, { useState } from 'react';
import { Image as ImageIcon } from 'lucide-react';

interface OptimizedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  fallbackSrc?: string;
  wrapperClassName?: string;
}

export default function OptimizedImage({
  src,
  alt,
  className,
  wrapperClassName = '',
  fallbackSrc,
  ...props
}: OptimizedImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  const currentSrc = hasError && fallbackSrc ? fallbackSrc : src;

  return (
    <div className={`relative overflow-hidden bg-zinc-100 w-full h-full ${wrapperClassName}`}>
      {/* 載入中骨架屏 (Skeleton) */}
      {!isLoaded && !hasError && (
        <div className="absolute inset-0 bg-zinc-200 animate-pulse flex items-center justify-center z-0">
          <ImageIcon className="text-zinc-400 opacity-40" size={24} />
        </div>
      )}

      {/* 錯誤佔位圖 (Fallback) */}
      {hasError && !fallbackSrc && (
        <div className="absolute inset-0 bg-zinc-100 flex flex-col items-center justify-center text-zinc-400 z-0">
          <ImageIcon size={32} className="mb-2 opacity-30" />
          <span className="text-[10px] font-medium">圖片無法載入</span>
        </div>
      )}

      {/* 實際圖片 */}
      {currentSrc && (
        <img
          src={currentSrc}
          alt={alt || ''}
          className={`w-full h-full object-cover transition-[opacity,transform] duration-500 z-10 relative ${
            isLoaded && !hasError ? 'opacity-100' : 'opacity-0'
          } ${className || ''}`}
          onLoad={() => setIsLoaded(true)}
          onError={() => setHasError(true)}
          loading="lazy"
          {...props}
        />
      )}
    </div>
  );
}

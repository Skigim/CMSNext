import React, { useState } from 'react'
import { AspectRatio } from '@/components/ui/aspect-ratio'
import { Skeleton } from '@/components/ui/skeleton'
import { ImageOff } from 'lucide-react'

interface ImageWithFallbackProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  aspectRatio?: number
}

export function ImageWithFallback({
  src,
  alt,
  style,
  className,
  aspectRatio = 16 / 9,
  ...rest
}: ImageWithFallbackProps) {
  const [didError, setDidError] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  const handleError = () => {
    setDidError(true)
    setIsLoading(false)
  }

  const handleLoad = () => {
    setIsLoading(false)
  }

  if (didError) {
    return (
      <AspectRatio ratio={aspectRatio} className={className} style={style}>
        <div className="flex items-center justify-center w-full h-full bg-muted rounded-md">
          <div className="flex flex-col items-center justify-center gap-2">
            <ImageOff className="h-8 w-8 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">{alt || 'Image not available'}</span>
          </div>
        </div>
      </AspectRatio>
    )
  }

  return (
    <AspectRatio ratio={aspectRatio} className={className} style={style}>
      {isLoading && <Skeleton className="w-full h-full rounded-md" />}
      <img
        src={src}
        alt={alt}
        className={`w-full h-full object-cover rounded-md ${isLoading ? 'hidden' : ''}`}
        onError={handleError}
        onLoad={handleLoad}
        {...rest}
      />
    </AspectRatio>
  )
}

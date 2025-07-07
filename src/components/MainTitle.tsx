'use client'
import { HugeiconsIcon, IconSvgElement } from '@hugeicons/react'

interface Props {
  title: string
  icon?: IconSvgElement
}

export const MainTitle = ({ title, icon }: Props) => {

  return (
    <div className='sticky top-16 p-4 bg-background/70 backdrop-blur-lg z-50 border-b border-b-white/10'>
      <h1 className='flex items-center gap-2 text-2xl font-medium'>
        { icon && <HugeiconsIcon icon={ icon } size={ 32 } strokeWidth={ 1 } /> }
        { title }
      </h1>
    </div>
  )
}
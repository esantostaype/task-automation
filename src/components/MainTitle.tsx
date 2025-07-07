'use client'
import { HugeiconsIcon, IconSvgElement } from '@hugeicons/react'


export const MainTitle = ({ label, icon }: { label: string, icon: IconSvgElement }) => {

  return (
    <h1 className='flex items-center gap-2 text-2xl font-medium'>
      <HugeiconsIcon icon={icon} size={32} strokeWidth={1} />{ label }
    </h1>
  )
}
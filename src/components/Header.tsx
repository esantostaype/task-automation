'use client'
import { HugeiconsIcon } from '@hugeicons/react'
import { LabelImportantIcon, Queue01Icon, Settings01Icon, SwatchIcon, UserGroup03Icon } from '@hugeicons/core-free-icons'
import Image from 'next/image'
import { NavItem } from '@/components'
import { IconButton } from '@mui/joy'
import { useModalStore } from '@/stores/modalStore'
import { SettingsForm } from '@/components'

const navItems = [
  { href: '/', label: 'Tasks', icon: Queue01Icon },
  { href: '/designers', label: 'Designers', icon: UserGroup03Icon },
  { href: '/types', label: 'Types', icon: SwatchIcon },
  { href: '/categories', label: 'Categories', icon: LabelImportantIcon }
]

export const Header = () => {
  const { openModal } = useModalStore()

  const handleSettingsClick = () => {
    openModal({
      title: 'System Settings',
      content: <SettingsForm />,
      size: 'lg'
    })
  }

  return (
    <header className="sticky top-0 bg-background/70 backdrop-blur-lg z-50 flex items-center justify-between px-4 border-b border-b-white/10">
      <div className='flex items-center gap-4'>
        <Image src="/images/logo.svg" alt="Assignify" width={132} height={38} />
        <ul className="flex items-center gap-3 text-sm mb-[-1px]">
          {navItems.map((item) => (
            <NavItem key={item.href} {...item} />
          ))}
        </ul>
      </div>
      <IconButton 
        size='sm' 
        variant='soft'
        onClick={handleSettingsClick}
      >
        <HugeiconsIcon icon={Settings01Icon} size={20} strokeWidth={1.5} />
      </IconButton>
    </header>
  )
}
'use client'
import { HugeiconsIcon } from '@hugeicons/react'
import { LabelImportantIcon, Layers01Icon, Queue01Icon, Logout02Icon, SwatchIcon, UserGroup03Icon } from '@hugeicons/core-free-icons'
import Image from 'next/image'
import { CategoriesForm, NavItem, TaskTypesForm, TierListForm } from '@/components'
import { Button } from '@mui/joy'
import { useModalStore } from '@/stores/modalStore'

export const Header = () => {
  const { openModal } = useModalStore()

  const handleTiersClick = () => {
    openModal({
      title: 'Tier List',
      content: <TierListForm />
    })
  }

  const handleTypesClick = () => {
    openModal({
      title: 'Task Types',
      content: <TaskTypesForm />
    })
  }

  const handleCategoriesClick = () => {
    openModal({
      title: 'Categories',
      content: <CategoriesForm />
    })
  }

  const handleSettingsClick = () => {
    openModal({
      title: 'System Settings',
      content: <TierListForm />
    })
  }

  const navItems = [
    { href: '/tasks', label: 'Tasks', icon: Queue01Icon },
    { href: '/designers', label: 'Designers', icon: UserGroup03Icon },
    { onClick: handleTypesClick, label: 'Types', icon: SwatchIcon },
    { onClick: handleTiersClick, label: 'Tiers', icon: Layers01Icon },
    { onClick: handleCategoriesClick, label: 'Categories', icon: LabelImportantIcon }
  ]

  return (
    <header className="sticky top-0 bg-background/70 backdrop-blur-lg z-50 flex items-center justify-between px-4 border-b border-b-white/10">
      <div className='flex items-center gap-4'>
        <Image src="/images/logo.svg" alt="Assignify" width={132} height={38} />
        <ul className="flex items-center gap-3 text-sm mb-[-1px]">
          {navItems.map((item, index) => (
            <NavItem key={item.href || index} {...item} />
          ))}
        </ul>
      </div>
      <Button 
        size='sm' 
        variant='plain'
        onClick={handleSettingsClick}
        color='danger'
        startDecorator={<HugeiconsIcon icon={Logout02Icon} size={20} strokeWidth={1.5} />}
      >
        Logout
      </Button>
    </header>
  )
}
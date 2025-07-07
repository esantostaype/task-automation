'use client'
import { HugeiconsIcon, IconSvgElement } from '@hugeicons/react'
import { LabelImportantIcon, Queue01Icon, Settings01Icon, SwatchIcon, UserGroup03Icon } from '@hugeicons/core-free-icons'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navItems = [
  { href: '/', label: 'Queue', icon: Queue01Icon },
  { href: '/designers', label: 'Designers', icon: UserGroup03Icon },
  { href: '/types', label: 'Types', icon: SwatchIcon },
  { href: '/categories', label: 'Categories', icon: LabelImportantIcon }
]


const NavItem = ({ href, label, icon }: { href: string, label: string, icon: IconSvgElement }) => {
  const pathname = usePathname()
  const isActive = pathname === href

  return (
    <li className={`group h-full py-3 border-t-2 ${isActive ? 'border-b-2 border-b-accent border-t-transparent' : 'border-b-2 border-b-transparent border-t-transparent'}`}>
      <Link
        href={href}
        className={`
          flex gap-1 items-center rounded-md py-2 px-3 group-active:bg-white/12 group-hover:bg-white/8
          ${isActive ? 'text-white' : 'text-gray-500 group-hover:text-white'}
        `}
      >
        <HugeiconsIcon icon={icon} size={20} strokeWidth={1.5} />
        {label}
      </Link>
    </li>
  )
}

export const Header = () => {
  return (
    <header className="flex items-center justify-between px-4 border-b border-b-white/10">
      <div className='flex items-center gap-4'>
        <Image src="/images/logo.svg" alt="Assignify" width={132} height={38} />
        <ul className="flex items-center gap-3 text-sm mb-[-1px]">
          {navItems.map((item) => (
            <NavItem key={item.href} {...item} />
          ))}
        </ul>
      </div>
      <button className='size-[2.25rem] rounded-md flex items-center justify-center bg-white/8 hover:bg-accent/32 active:bg-accent/48 cursor-pointer'>
        <HugeiconsIcon icon={Settings01Icon} size={20} strokeWidth={1.5} />
      </button>
    </header>
  )
}
'use client'
import { HugeiconsIcon, IconSvgElement } from '@hugeicons/react'
import { Queue01Icon, UserGroup03Icon } from '@hugeicons/core-free-icons'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navItems = [
  { href: '/', label: 'Queue', icon: Queue01Icon },
  { href: '/designers', label: 'Designers', icon: UserGroup03Icon },
]


const NavItem = ({ href, label, icon }: { href: string, label: string, icon: IconSvgElement }) => {
  const pathname = usePathname()
  const isActive = pathname === href

  return (
    <li className={`group h-full py-3 border-t-2 ${isActive ? 'border-b-2 border-b-accent border-t-transparent' : 'border-b-2 border-b-transparent border-t-transparent'}`}>
      <Link
        href={href}
        className={`
          flex gap-1 items-center rounded py-2 px-3 group-active:bg-white/12 group-hover:bg-white/8
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
    <header className="flex items-center gap-4 px-4 border-b border-b-white/10">
      <div>
        <Image src="/images/logo.svg" alt="Assignify" width={132} height={38} />
      </div>
      <ul className="flex items-center gap-3 text-sm mb-[-1px]">
        {navItems.map((item) => (
          <NavItem key={item.href} {...item} />
        ))}
      </ul>
    </header>
  )
}
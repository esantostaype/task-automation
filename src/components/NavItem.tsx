'use client'
import { HugeiconsIcon, IconSvgElement } from '@hugeicons/react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'


export const NavItem = ({ href, label, icon }: { href: string, label: string, icon: IconSvgElement }) => {
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
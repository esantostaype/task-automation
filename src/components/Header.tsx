import { HugeiconsIcon } from '@hugeicons/react'
import { Queue01Icon, UserGroup03Icon } from '@hugeicons/core-free-icons'
import Image from 'next/image'
import Link from 'next/link'

export const Header = () => {
  return (
    <header className='flex gap-8 p-4 border-b border-b-white/10'>
      <div>
        <Image src="/images/logo.svg" alt="Assignify" width={ 148 } height={ 38 }></Image>
      </div>
      <ul className='flex items-center gap-4 text-sm'>
        <li>
          <Link href="/" className='py-1 px-2 rounded flex gap-1 items-center bg-white/8'>
            <HugeiconsIcon
              icon={ Queue01Icon }
              size={ 20 }
              strokeWidth={ 1.5 }
            />
            Queue
          </Link>
        </li>
        <li>
          <Link href="/" className='py-1 px-2 rounded flex gap-1 items-center text-gray-500'>
            <HugeiconsIcon
              icon={ UserGroup03Icon }
              size={ 20 }
              strokeWidth={ 1.5 }
            />
            Designers
          </Link>
        </li>
      </ul>
    </header>
  )
}